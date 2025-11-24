'use strict';
'require fs';
'require ui';
'require dom';
'require view';
'require form';

const tableTypeMap = { gpt: 'GPT', dos: 'MBR', msdos: 'MBR', iso9660: 'ISO' };
const interfaceMap = { sata: 'SATA', nvme: 'NVMe', usb: 'USB', scsi: 'SCSI', ata: 'ATA', sas: 'SAS' };

function getTemperature(smartData) {
	if (!smartData || smartData.error) return '-';

	if (smartData.nvme_temperature) {
		return Math.round(smartData.nvme_temperature) + ' °C';
	};

	if (smartData.temperature && smartData.temperature.current !== undefined) {
		return Math.round(smartData.temperature.current) + ' °C';
	};

	let ataTemp = smartData.ata_smart_attributes?.attributes?.find(attr =>
		attr.name === 'Temperature_Celsius' || attr.id === 194
	);
	if (ataTemp && ataTemp.raw && ataTemp.raw.value) {
		return ataTemp.raw.value + ' °C';
	};

	return '-';
};

function getInterfaceSpeed(smartData) {
	let speeds = [];

	if (smartData.sata_version?.string) {
		speeds.push(smartData.sata_version.string);
	};
	if (smartData.interface_speed?.max?.string) {
		speeds.push('Max: ' + smartData.interface_speed.max.string);
	};
	if (smartData.interface_speed?.current?.string) {
		speeds.push('Current: ' + smartData.interface_speed.current.string);
	};

	if (smartData.nvme_pci_vendor?.id) {
		speeds.push('NVMe');
	};

	return speeds.length > 0 ? speeds.join(' | ') : '-';
};

function modalnotify(title, children, timeout, ...classes) {
	function fadeOut(element) {
		element?.classList.replace('fade-in', 'fade-out');
		setTimeout(() => element?.remove());
	};

	const modalContainer = document.querySelector('#modal_overlay .modal');
	if (!modalContainer) return;
	const msg = E('div', {
		class: 'alert-message fade-in',
		style: 'display:flex; margin: 10px 0;',
		transitionend: function (ev) {
			const node = ev.currentTarget;
			if (node.parentNode && node.classList.contains('fade-out')) {
				node.parentNode.removeChild(node);
			};
		}
	}, [
		E('div', { style: 'flex:10' }),
		E('div', { style: 'flex:1 1 auto; display:flex' }, [
			E('button', {
				class: 'btn', style: 'margin-left:auto; margin-top:auto',
				click: () => fadeOut(msg)
			}, _('Dismiss'))
		])
	]);

	L.dom.append(msg.firstElementChild, children);
	msg.classList.add(...classes);
	modalContainer.insertBefore(msg, modalContainer.firstChild);
	if (typeof timeout === 'number' && timeout > 0) {
		setTimeout(() => fadeOut(msg), timeout);
	};
	return msg;
};

const _diskCache = {
	disks: {},

	// disk_info 的挂载信息缓存
	mounted: {
		df: null,
		mount: null,
		timestamp: 0,
		expire: 3000
	},

	// 缓存是否新鲜
	isFresh(ts, expire = 3000) {
		return (Date.now() - ts) < expire;
	},

	// 获取磁盘缓存对象
	getDisk(path) {
		if (!this.disks[path]) {
			this.disks[path] = {
				parted: null,
				mount: null,
				df: null,
				diskObj: null,
				timestamp: 0
			};
		}
		return this.disks[path];
	},

	// 设置磁盘缓存
	setDisk(path, data) {
		const d = this.getDisk(path);
		Object.assign(d, data, { timestamp: Date.now() });
	},

	// 失效某个磁盘
	invalidateDisk(path) { delete this.disks[path]; },

	// 失效全部
	invalidateAll() {
		this.disks = {};
		this.mounted.timestamp = 0;
	}
};

function byteFormat(byte) {
	const units = ["B", "KB", "MB", "GB", "TB"];
	let i = 0;

	while (byte >= 1024 && i < units.length - 1) {
		byte /= 1024;
		i++;
	};

	return `${byte.toFixed(2)} ${units[i]}`;
};

function createMountedTable(df, mount) {
	const table = new L.ui.Table([
		_('设备'), _('挂载点'), _('类型'), _('总大小/使用率'),
		_('已使用/可用'), _('挂载选项')
	], {
		id: 'diskman-mounted-table',
		sortable: true,
		classes: ['cbi-section-table']
	}, E('em', _('无挂载分区')));

	table.update(df.map(item => {
		const m = mount.find(x => x.device === item.Filesystem) || mount.find(x => x.mount_point === item.Mounted);

		return [
			item.Filesystem,
			item.Mounted || '-',
			m?.filesystem || '-',
			`${item.Size}/${item['Use%']}`,
			`${item.Used}/${item.Available}`,
			m?.options || '-'
		];
	}));

	return table.render();
};

function editdev(lsblk, smart) {
	const path = lsblk.path;
	let cachedDiskObj = null;

	// 1. 优先使用新缓存
	const cache = _diskCache.getDisk(path);
	if (_diskCache.isFresh(cache.timestamp)) {
		cachedDiskObj = cache.diskObj;
		render(cache.parted, cache.mount, cache.df);
		return;
	};

	ui.showModal(null, E('div', { class: 'spinning' }, _('加载分区信息…')));

	function disktable(parted, smart) {
		if (!parted || !parted[0] || !parted[0].disk) {
			return E('em', _('无磁盘信息'));
		};

		const disk = parted[0].disk;
		const sectors = parseInt(disk.total_sectors) || 0;
		const bytes = sectors * 512;
		const size = (bytes / 1e9).toFixed(1) + 'GB';

		const info = {
			model: smart.model_name || '-',
			path: disk.device || '-',
			name: disk.device ? disk.device.replace('/dev/', '') : '-',
			size: size,
			sectorSize: `${disk.sector_size.logical}B/${disk.sector_size.physical}B`,
			pttype: disk.partition_table || '-',
			Temp: getTemperature(smart),
			number: smart.serial_number,
			sata: getInterfaceSpeed(smart),
		};

		const table = new L.ui.Table([
			_('路径'), _('型号'), _('序号'), _('大小'),
			_('扇区大小'), _('分区表'), _('温度'),
			_('转速'), _('状态'), _('健康')
		], {
			id: 'diskman-table',
			sortable: true,
			classes: ['cbi-section-table']
		});

		table.update([[
			info.path,
			info.model,
			info.number,
			info.size,
			info.sectorSize,
			tableTypeMap[info.pttype],
			info.Temp, '-', '-', _('正常'), _('良好')
		]]);

		return table.render();
	};

	function parseHumanSize(sz) {
		if (!sz && sz !== 0) return 0;
		if (typeof sz === 'number') return sz;
		sz = String(sz).trim();
		if (/^\d+$/.test(sz)) return parseInt(sz, 10);
		const m = sz.match(/^([\d.]+)\s*([KMGTPEkmgtpe])B?$/);
		if (m) {
			const val = parseFloat(m[1]);
			const unit = m[2].toUpperCase();
			const pow = { K: 1, M: 2, G: 3, T: 4 }[unit] || 0;
			return Math.round(val * Math.pow(1024, pow));
		};
		const n = parseInt(sz.replace(/[^0-9]/g, ''), 10);
		return isNaN(n) ? 0 : n;
	};

	function diskToParted(diskObj, sectorSize = 512) {
		if (!diskObj?.children) return [];
		return diskObj.children.map(part => {
			const number = part.name?.match(/(\d+)$/)?.[1];
			const sizeBytes = parseHumanSize(part.size);
			const sectors = Math.floor(sizeBytes / sectorSize);
			return {
				number: number ? parseInt(number, 10) : null,
				start: '',
				end: '',
				size: sectors > 0 ? `${sectors}s` : '0s',
				type: part.pttype || part.type || '',
				fileSystem: part.fstype || '',
				flags: '',
				path: part.path || `/dev/${part.name || ''}`
			};
		});
	};

	function mountsFromDev(devObj) {
		const mounts = [];
		function traverse(device) {
			device?.children?.forEach(traverse);
			if (device?.mountpoint) {
				mounts.push({
					device: device.path || `/dev/${device.name}`,
					mount_point: device.mountpoint,
					filesystem: device.fstype || ''
				});
			}
		}
		const devices = devObj?.blockdevices || [devObj].filter(Boolean);
		devices.forEach(traverse);
		return mounts;
	};

	function dfFromDev(devObj) {
		const result = [];
		function traverse(device) {
			device?.children?.forEach(traverse);
			if (device?.path) {
				result.push({
					Filesystem: device.path,
					Size: parseHumanSize(device.size) || '-',
					'Mounted on': device.mountpoint || '-'
				});
			}
		}
		const devices = devObj?.blockdevices || [devObj].filter(Boolean);
		devices.forEach(traverse);
		return result;
	};

	function diskNeedsResetFromDev(devParam) {
		if (!devParam) return false;
		let d = devParam;
		if (typeof d === 'string') {
			try { d = JSON.parse(d); } catch (e) { return true; }
		};
		if (d && d.blockdevices && Array.isArray(d.blockdevices)) {
			const found = d.blockdevices.find(x => x.path === path || ('/dev/' + x.name) === path);
			if (found) d = found;
			else d = d.blockdevices[0] || d;
		};
		if (d && d.fstype && String(d.fstype).toLowerCase() === 'iso9660') return true;
		const ch = d && d.children ? d.children : [];
		if (!ch || ch.length === 0) return false;
		if (ch.some(c => c.fstype && String(c.fstype).toLowerCase() === 'iso9660')) return true;
		const allNoFstypeNoMount = ch.every(c => {
			const hasFstype = c.fstype !== undefined && c.fstype !== null && String(c.fstype).trim() !== '';
			const hasMount = c.mountpoint !== undefined && c.mountpoint !== null && String(c.mountpoint).trim() !== '';
			return !hasFstype && !hasMount;
		});
		if (allNoFstypeNoMount) return true;
		return false;
	};

	function estimateDiskFreeFromLsblk(diskObj) {
		if (!diskObj) return { freeBytes: 0, diskBytes: 0, partitionsBytes: 0 };
		const diskBytes = parseHumanSize(diskObj.size || 0);
		let sumParts = 0;
		(diskObj.children || []).forEach(c => { sumParts += parseHumanSize(c.size || 0); });
		const freeBytes = Math.max(0, diskBytes - sumParts);
		return { freeBytes, diskBytes, partitionsBytes: sumParts };
	};

	function musttable(parted, mount, df) {
		const sectorSize = 512;
		const mountMap = {};
		(mount || []).forEach(m => {
			if (m.device && m.device.startsWith('/dev/')) {
				if (!mountMap[m.device]) mountMap[m.device] = [];
				mountMap[m.device].push(m.mount_point || '-');
			}
		});

		const dfMap = {};
		(df || []).forEach(item => {
			if (item.Filesystem && item.Filesystem.startsWith('/dev/')) {
				dfMap[item.Filesystem] = {
					used: item.Used || '-',
					avail: item.Available || '-',
					percent: item['Use%'] || '-'
				};
			}
		});

		const partitions = (parted && parted[0] && parted[0].partitions) ? parted[0].partitions : [];
		const diskDevice = (parted && parted[0] && parted[0].disk) ? parted[0].disk.device : '/dev/sdb';

		const rows = partitions.map(entry => {
			const bytes = (parseInt(entry.size) || 0) * sectorSize;
			const fullDev = entry.number !== null ? `${diskDevice}${entry.number}` : null;
			let deviceCell = entry.number === null ? '-' : `${diskDevice}${entry.number}`;
			const mountPoints = fullDev && mountMap[fullDev] ? mountMap[fullDev].join('<br>') : '-';

			let fsCell;
			if (entry.number === null) {
				fsCell = '-';
			} else if (entry.fileSystem && entry.fileSystem !== '') {
				fsCell = entry.fileSystem;
			} else {
				fsCell = E('button', {
					class: 'cbi-button cbi-button-remove',
					click: () => {
						const modalContent = [
							E('p', { style: 'margin:15px 0' }, [
								_('要格式化分区 '), E('strong', {}, fullDev), _(' 吗？所有数据将被清除！')
							]),
							E('div', { class: 'cbi-section' }, [
								E('label', { style: 'display:block;margin:10px 0' }, _('选择文件系统：')),
								E('select', { id: 'format-type', style: 'width:100%;padding:8px' }, [
									E('option', { value: 'ext4' }, 'ext4（推荐，Linux 原生）'),
									E('option', { value: 'ext2' }, 'ext2（无日志）'),
									E('option', { value: 'vfat' }, 'FAT32（兼容 Windows/U盘）'),
									E('option', { value: 'ntfs' }, 'NTFS（Windows 专用）'),
									E('option', { value: 'xfs' }, 'XFS（高性能）')
								]),
								E('label', { style: 'display:block;margin:10px 0' }, _('分区标签（可选）：')),
								E('input', { type: 'text', id: 'format-label', placeholder: 'DATA', style: 'width:100%;padding:8px' })
							])
						];

						ui.showModal(_('格式化分区'), [
							...modalContent,
							E('div', { class: 'button-row', style: 'margin-top:20px' }, [
								E('button', {
									class: 'btn cbi-button cbi-button-positive important',
									click: () => {
										const fstype = document.getElementById('format-type').value;
										const label = document.getElementById('format-label').value.trim();

										ui.showModal(null, E('div', { class: 'spinning' }, _('格式化中，请稍候…')));

										fs.exec_direct('/usr/libexec/diskman', ['format', fullDev, fstype, label])
											.then(r => {
												ui.hideModal();
												const output = (typeof r === 'object' ? (r.stdout || '') : r) || '';
												if (output.includes('格式化完成')) {
													ui.addTimeLimitedNotification(null, E('p', output), 5000, 'success');
													editdev(dev);  // 刷新
												} else {
													const err = output.includes('错误：')
														? output.split('错误：')[1].trim()
														: output || '未知错误';
													ui.addNotification(null, E('p', '格式化失败：' + err), 'error');
												};
											})
									}
								}, _('确认格式化')),
								E('button', { class: 'btn cbi-button', click: ui.hideModal }, _('取消'))
							])
						]);
					}
				}, _('格式化'));
			}

			let action = entry.number === null
				? E('button', {
					class: 'btn cbi-button cbi-button-positive',
					style: 'min-width:60px',
					click: () => onResetClick(diskDevice, lsblk, false)
				}, _('新建'))
				: E('button', {
					class: 'cbi-button cbi-button-remove',
					style: 'min-width:60px',
					click: () => {
						const dev = `${diskDevice}${entry.number}`;
						if (!confirm(_('确定要删除分区 ' + dev + ' 吗？此操作将永久丢失数据！')))
							return;

						fs.exec_direct('/sbin/parted', ['-s', diskDevice, 'rm', entry.number])
							.then(() => fs.exec_direct('/sbin/partprobe', [diskDevice]))
							.then(() => {
								ui.addNotification(null, E('p', _('分区删除成功')), 'success');
								_diskCache.invalidateDisk(diskDevice);
								editdev(dev);
							})
							.catch(err => {
								ui.addNotification(null,
									E('p', ['删除失败：', E('br'), err.message || String(err)]),
									'error'
								);
							});
					}
				}, _('移除'));

			const u = fullDev && dfMap[fullDev] ? dfMap[fullDev] : { used: '-', avail: '-', percent: '-' };

			return [
				deviceCell,
				parseInt(entry.start) || '-',
				parseInt(entry.end) || '-',
				byteFormat(bytes),
				entry.type || '-',
				fsCell,
				u.used,
				u.avail,
				u.percent,
				mountPoints,
				action
			];
		});

		const table = new L.ui.Table([
			_('设备'), _('起始扇区'), _('结束扇区'), _('大小'),
			_('类型'), _('文件系统'), _('已使用'), _('空闲空间'),
			_('用量'), _('挂载点'), _('操作')
		], {
			id: 'diskman-table-simple',
			sortable: true,
			classes: ['cbi-section-table', 'diskman-table']
		}, E('em', _('无分区')));

		table.update(rows);
		return table.render();
	};

	function onResetClick(diskPath, diskObj) {
		const totalBytes = parseHumanSize(diskObj.size || "0");
		const freeMiB = Math.floor(totalBytes / 1024 / 1024);
		if (freeMiB < 10) return ui.addNotification(null, E('p', _('磁盘太小')), 'warning');

		const availableFS = {
			ext4: { cmd: "/usr/sbin/mkfs.ext4", label: "EXT4（推荐）", args: ["-F", "-E", "lazy_itable_init=1"] },
			ext2: { cmd: "/usr/sbin/mkfs.ext2", label: "EXT2", args: ["-F", "-E", "lazy_itable_init=1"] },
			ext3: { cmd: "/usr/sbin/mkfs.ext3", label: "EXT3", args: ["-F", "-E", "lazy_itable_init=1"] },
			btrfs: { cmd: "/usr/bin/mkfs.btrfs", label: "btrfs", args: ["-f"] },
			fat32: { cmd: "/usr/bin/mkfs.fat", label: "FAT32（U盘通用）", args: ["-F", "32"] },
			mkswap: { cmd: "/sbin/mkswap", label: "mkswap", args: [] },
			exfat: { cmd: "/usr/sbin/mkfs.exfat", label: "exFAT", args: [] }
		};

		// 创建主模态框结构
		const modal = E('div', { style: 'display:flex;flex-direction:column;gap:15px;font-size:14px;max-width:600px;' }, [
			// 警告区域
			E('div', { style: 'background:#fff3cd;border:1px solid #ffeaa7;border-radius:4px;padding:12px;' }, [
				E('div', { style: 'color:#856404;font-weight:bold;margin-bottom:5px;' }, '⚠️ ' + _('警告：此操作将擦除磁盘所有数据！')),
				E('div', { style: 'color:#856404;font-size:13px;' }, _('磁盘：') + diskPath + ' | ' + _('容量：') + `${freeMiB.toLocaleString()} MiB`)
			]),

			// 配置区域
			E('div', { style: 'display:flex;flex-direction:column;gap:12px;' }, [
				// 分区表类型
				E('div', { style: 'display:flex;align-items:center;gap:10px;' }, [
					E('label', { style: 'min-width:120px;font-weight:bold;' }, _('分区表类型：')),
					E('select', { style: 'flex:1;padding:6px 8px;border:1px solid #ccc;border-radius:4px;' }, [
						E('option', { value: 'gpt' }, 'GPT（推荐，支持大容量）'),
						E('option', { value: 'msdos' }, 'MBR（兼容旧系统）')
					])
				]),

				// 操作模式
				E('div', { style: 'display:flex;align-items:center;gap:10px;' }, [
					E('label', { style: 'min-width:120px;font-weight:bold;' }, _('操作模式：')),
					E('select', {
						style: 'flex:1;padding:6px 8px;border:1px solid #ccc;border-radius:4px;',
						id: 'action-select'
					}, [
						E('option', { value: 'multi_partition' }, '自定义多个分区'),
						E('option', { value: 'single_partition' }, '创建单个分区并格式化'),
						E('option', { value: 'init_only' }, '仅初始化分区表（清空）')
					])
				]),

				// 文件系统
				E('div', { style: 'display:flex;align-items:center;gap:10px;' }, [
					E('label', { style: 'min-width:120px;font-weight:bold;' }, _('文件系统：')),
					E('select', {
						style: 'flex:1;padding:6px 8px;border:1px solid #ccc;border-radius:4px;',
						id: 'fs-select'
					}, Object.keys(availableFS).map(k =>
						E('option', { value: k }, availableFS[k].label)
					))
				])
			]),

			// 多分区容器（初始隐藏）
			E('div', {
				id: 'multi-partition-container',
				style: 'display:none;margin-top:10px;border:1px solid #e9ecef;border-radius:4px;padding:15px;background:#f8f9fa;'
			}, [
				E('div', {
					id: 'partitions-header',
					style: 'display:flex;font-weight:bold;margin-bottom:10px;padding-bottom:5px;border-bottom:1px solid #dee2e6;'
				}, [
					E('span', { style: 'flex:2;' }, _('分区大小 (MiB)')),
					E('span', { style: 'flex:3;' }, _('文件系统')),
					E('span', { style: 'flex:1;' }, _('操作'))
				]),
				E('div', { id: 'partitions-list' }),
				E('div', {
					id: 'remain-info',
					style: 'font-weight:bold;padding:8px;margin:10px 0;background:white;border-radius:4px;text-align:center;'
				}),
				E('button', {
					id: 'add-partition-btn',
					class: 'cbi-button cbi-button-add',
					style: 'width:100%;margin-top:5px;'
				}, '+ ' + _('添加分区'))
			]),

			// 按钮区域
			E('div', {
				style: 'display:flex;justify-content:flex-end;gap:10px;margin-top:20px;padding-top:15px;border-top:1px solid #e9ecef;'
			}, [
				E('button', {
					id: 'cancel-btn',
					class: 'cbi-button',
					style: 'min-width:80px;'
				}, _('取消')),
				E('button', {
					id: 'confirm-btn',
					class: 'cbi-button cbi-button-positive important',
					style: 'min-width:100px;'
				}, _('确认执行'))
			])
		]);

		// 获取元素引用
		const ptSelect = modal.querySelector('select'); // 第一个 select 是分区表类型
		const fsSelect = modal.querySelector('#fs-select');
		const cancelBtn = modal.querySelector('#cancel-btn');
		const confirmBtn = modal.querySelector('#confirm-btn');
		const remainInfo = modal.querySelector('#remain-info');
		const addBtn = modal.querySelector('#add-partition-btn');
		const actionSelect = modal.querySelector('#action-select');
		const partitionsList = modal.querySelector('#partitions-list');
		const multiPartitionContainer = modal.querySelector('#multi-partition-container');

		// === 关键修复 1：设置文件系统默认值并禁用 ===
		fsSelect.value = 'ext4'; // 默认选中 ext4
		fsSelect.disabled = true;

		let partitions = [];

		// 更新剩余空间显示
		const updateRemain = () => {
			const used = partitions.reduce((sum, p) => sum + (p.size || 0), 0);
			const remain = freeMiB - used;
			remainInfo.textContent = _('剩余空间：') + `${Math.max(0, remain)} MiB`;
			remainInfo.style.color = remain >= 0 ? '#28a745' : '#dc3545';
			remainInfo.style.background = remain >= 0 ? '#d4edda' : '#f8d7da';
			return remain >= 0;
		};

		// 添加分区行
		const addPartitionRow = (size = '', fsType = 'ext4') => {
			const rowId = 'partition-' + Date.now() + '-' + Math.random().toString(36).substr(2, 5);
			const row = E('div', {
				style: 'display:flex;align-items:center;gap:8px;margin:8px 0;padding:8px;background:white;border-radius:4px;',
				'data-id': rowId
			}, [
				E('input', {
					type: 'number',
					min: 1,
					max: freeMiB,
					value: size,
					style: 'flex:2;padding:6px 8px;border:1px solid #ccc;border-radius:4px;',
					placeholder: _('大小')
				}),
				E('select', { style: 'flex:3;padding:6px 8px;border:1px solid #ccc;border-radius:4px;' }, Object.keys(availableFS).map(k =>
					E('option', { value: k, selected: k === fsType }, availableFS[k].label)
				)),
				E('button', {
					class: 'cbi-button cbi-button-remove',
					style: 'flex:1;padding:6px 12px;'
				}, _('删除'))
			]);

			const [sizeInput, fsSel, delBtn] = row.children;

			const updatePartition = () => {
				const partition = partitions.find(p => p.id === rowId);
				if (partition) {
					partition.size = parseInt(sizeInput.value) || 0;
					partition.fs = fsSel.value;
				}
				updateRemain();
			};

			sizeInput.addEventListener('input', updatePartition);
			fsSel.addEventListener('change', updatePartition);

			delBtn.onclick = () => {
				partitions = partitions.filter(p => p.id !== rowId);
				row.remove();
				updateRemain();
			};

			partitionsList.appendChild(row);
			partitions.push({ id: rowId, size: parseInt(size) || 0, fs: fsType });
			updateRemain();
		};

		addBtn.onclick = () => addPartitionRow();

		// === 关键修复 2：操作模式切换时确保 fsSelect 状态正确 ===
		actionSelect.addEventListener('change', () => {
			const mode = actionSelect.value;
			const isMulti = mode === 'multi_partition';
			const isSingle = mode === 'single_partition';

			// 启用/禁用文件系统选择
			fsSelect.disabled = !isSingle;
			if (isSingle) {
				// 确保有有效默认值
				if (!fsSelect.value || !availableFS[fsSelect.value]) {
					fsSelect.value = 'ext4';
				}
			}

			multiPartitionContainer.style.display = isMulti ? 'block' : 'none';

			if (isMulti && partitions.length === 0) {
				addPartitionRow(Math.floor(freeMiB * 0.5), 'ext4');
			}

			if (!isMulti) {
				partitions = [];
				partitionsList.innerHTML = '';
				updateRemain();
			}
		});

		// 显示模态框
		ui.showModal(_('磁盘初始化与分区'), modal, 'warning');

		cancelBtn.onclick = ui.hideModal;

		confirmBtn.onclick = () => {
			const mode = actionSelect.value;
			const ptType = ptSelect.value;
			let fsType = fsSelect.value; // 获取当前值

			// === 关键修复 3：再次校验 single 模式下的 fsType 有效性 ===
			if (mode === 'single_partition') {
				if (!availableFS[fsType]) {
					ui.addNotification(null, E('p', _('请选择有效的文件系统')), 'error');
					return;
				}
			}

			if (mode === 'multi_partition') {
				if (partitions.length === 0) {
					return ui.addNotification(null, E('p', _('请至少添加一个分区')), 'error');
				}
				if (!updateRemain()) {
					return ui.addNotification(null, E('p', _('分区总大小不能超过磁盘容量')), 'error');
				}
				for (const p of partitions) {
					if (p.size <= 0) {
						return ui.addNotification(null, E('p', _('分区大小必须大于0')), 'error');
					}
					if (!availableFS[p.fs]) {
						return ui.addNotification(null, E('p', _('无效的文件系统类型')), 'error');
					}
				}
			}

			// 开始执行
			confirmBtn.disabled = true;
			ui.showModal(null, E('div', { class: 'spinning' }, _('正在执行，请勿拔盘…')));

			// 执行分区操作
			fs.exec_direct('/sbin/parted', ['-s', diskPath, 'mklabel', ptType])
				.then(() => new Promise(r => setTimeout(r, 1000)))
				.then(() => {
					if (mode === 'init_only') return [];

					if (mode === 'single_partition') {
						return fs.exec_direct('/sbin/parted', ['-s', diskPath, 'mkpart', 'primary', '0%', '100%'])
							.then(() => new Promise(r => setTimeout(r, 1500)))
							.then(() => fs.exec_direct('/sbin/partprobe', [diskPath]).catch(() => {}))
							.then(() => new Promise(r => setTimeout(r, 1000)))
							.then(() => fs.exec_direct('/usr/bin/lsblk', ['-rno', 'NAME', diskPath])
								.then(out => {
									const lines = out.trim().split('\n').filter(l => l !== diskPath.replace('/dev/', ''));
									return lines.length > 0 ? ['/dev/' + lines[0]] : [];
								}));
					}

					if (mode === 'multi_partition') {
						const partConfigs = [];
						let startMiB = 1;

						const rows = Array.from(partitionsList.querySelectorAll('div[data-id]'));
						rows.forEach(row => {
							const sizeInput = row.querySelector('input[type="number"]');
							const fsSel = row.querySelector('select');
							const size = parseInt(sizeInput.value) || 0;
							const fsKey = fsSel.value;

							if (size > 0 && availableFS[fsKey]) {
								partConfigs.push({ start: startMiB, end: startMiB + size, fs: fsKey });
								startMiB += size;
							}
						});

						if (partConfigs.length === 0) {
							throw new Error('至少需要一个有效分区');
						}

						return Promise.all(partConfigs.map(p =>
							fs.exec_direct('/sbin/parted', ['-s', diskPath, 'mkpart', 'primary', `${p.start}MiB`, `${p.end}MiB`])
						))
							.then(() => new Promise(r => setTimeout(r, 1500)))
							.then(() => fs.exec_direct('/sbin/partprobe', [diskPath]).catch(() => {}))
							.then(() => new Promise(r => setTimeout(r, 1000)))
							.then(() => fs.exec_direct('/usr/bin/lsblk', ['-rno', 'NAME', diskPath])
								.then(out => {
									const lines = out.trim().split('\n').filter(l => l !== diskPath.replace('/dev/', ''));
									return lines.slice(0, partConfigs.length).map(n => '/dev/' + n);
								}));
					}
				})
				.then(partitionPaths => {
					if (!partitionPaths || partitionPaths.length === 0) {
						ui.hideModal();
						ui.addNotification(null, E('p', _('操作成功完成！')), 'success');
						if (typeof _diskCache !== 'undefined') {
							_diskCache.invalidateDisk(diskPath);
						}
						setTimeout(() => location.reload(), 1500);
						return;
					}

					// 格式化分区
					return Promise.all(partitionPaths.map((path, i) => {
						let fsTool;

						if (mode === 'single_partition') {
							fsTool = availableFS[fsType]; // ✅ 现在 fsType 是有效且用户指定的
						} else if (mode === 'multi_partition') {
							const fsKey = partitions[i]?.fs;
							fsTool = availableFS[fsKey];
							if (!fsTool) throw new Error('无效文件系统: ' + fsKey);
						}

						if (!fsTool) {
							throw new Error('无法确定文件系统工具');
						}

						return fs.exec_direct(fsTool.cmd, [...fsTool.args, path]);
					}));
				})
				.then(() => {
					ui.hideModal();
					ui.addNotification(null, E('p', _('分区与格式化成功！')), 'success');
					if (typeof _diskCache !== 'undefined') {
						_diskCache.invalidateDisk(diskPath);
					}
					setTimeout(() => location.reload(), 2000);
				})
				.catch(err => {
					ui.hideModal();
					ui.addNotification(null, E('p', ['操作失败：', E('br'), err.message || String(err)]), 'error');
					confirmBtn.disabled = false;
				});
		};
	};

	function render(parted, mount, df) {
		let freeNote = null;
		if (cachedDiskObj) {
			const est = estimateDiskFreeFromLsblk(cachedDiskObj);
			if (est.freeBytes > 0) {
				freeNote = E('div', {
					style: 'margin-bottom:10px;color:#3c763d;background:#dff0d8;padding:8px;border-radius:4px;'
				}, _(`（${cachedDiskObj.model} ${cachedDiskObj.vendor} ）总容量${cachedDiskObj.size}，检测到未分配空间： %s。 可直接创建分区。`).format(byteFormat(est.freeBytes)));
			}
		}

		const needReset = diskNeedsResetFromDev(lsblk);

		ui.showModal(_(`${path} 分区管理`), [
			E('style', ['.modal{max-width: 1000px;padding:.5em;}h4 {text-align:center;padding:9px;background-color: #f0f0f0;color:red;}']),
			freeNote || E('span'),
			E('h5', {}, _('设备信息')),
			disktable(parted, smart),
			E('h5', {}, _('分区信息')),
			musttable(parted, mount, df),
			E('div', { style: 'display: flex; justify-content: space-around; gap: 0.5em;' }, [
				needReset ? E('button', {
					class: 'btn cbi-button-remove',
					click: () => onResetClick(path, lsblk, true)
				}, _('重置磁盘')) : '',
				E('button', { class: 'btn cbi-button cbi-button-positive important', click: ui.hideModal }, _('保存')),
				E('button', { class: 'btn cbi-button', click: ui.hideModal }, _('取消'))
			])
		]);
	};

	Promise.all([
		fs.exec_direct('/usr/libexec/diskman', ['df']).catch(() => '[]'),
		fs.exec_direct('/usr/libexec/diskman', ['mount_info']).catch(() => '[]'),
		fs.exec_direct('/usr/libexec/diskman', ['parted', path]).catch(() => 'null')
	]).then(res => {
		let df = [], mount = [], parted = null;
		try { df = JSON.parse(res[0]); } catch (e) { df = []; }
		try { mount = JSON.parse(res[1]); } catch (e) { mount = []; }
		try { parted = JSON.parse(res[2]); } catch (e) { parted = null; }

		const hasParted = Array.isArray(parted) && parted.length > 0;

		const continueWith = (finalParted, finalMount = mount, finalDf = df, diskObjForCache = null) => {
			_diskCache.setDisk(path, { parted: finalParted, mount: finalMount, df: finalDf, diskObj: diskObjForCache || cachedDiskObj });
			cachedDiskObj = diskObjForCache || cachedDiskObj;
			ui.hideModal();
			render(finalParted, finalMount, finalDf);
		};

		if (hasParted) {
			continueWith(parted, mount, df);
			return;
		}

		const diskObj = (function extractDiskObj(p) {
			if (p && p.blockdevices && Array.isArray(p.blockdevices)) {
				const found = p.blockdevices.find(x => x.path === path || ('/dev/' + x.name) === path || (path && path.endsWith(x.name)));
				return found || null;
			}
			if (p && (p.type === 'disk' || p.children)) return p;
			return null;
		})(lsblk);

		if (diskObj) {
			const derived = diskToParted(diskObj);
			const dfFromDevList = dfFromDev(diskObj);
			const mountFromDev = mountsFromDev(diskObj);
			continueWith(derived, mountFromDev, dfFromDevList, diskObj);
			return;
		}
	});
};

function disk_info() {
	const m = _diskCache.mounted;
	const now = Date.now();

	if (_diskCache.isFresh(m.timestamp, m.expire)) {
		return createMountedTable(m.df, m.mount);
	}

	return Promise.all([
		fs.exec_direct('/usr/libexec/diskman', ['df']),
		fs.exec_direct('/usr/libexec/diskman', ['mount_info'])
	]).then(([dfOut, mountOut]) => {
		const df = JSON.parse(dfOut);
		const mount = JSON.parse(mountOut);
		_diskCache.mounted = { df, mount, timestamp: Date.now(), expire: m.expire };

		const getMount = (dev, point) =>
			mount.find(m => m.mount_point === point) ||
			mount.find(m => m.device === dev) ||
			mount.find(m => point?.startsWith(m.mount_point + '/')) ||
			null;

		const table = new L.ui.Table([
			_('设备'), _('挂载点'), _('类型'), _('总大小/使用率'),
			_('已使用/可用'), _('挂载选项'), ''
		], {
			id: 'diskman-mounted-table',
			sortable: true,
			classes: ['cbi-section-table']
		}, E('em', _('无挂载分区')));

		table.update(df.map(item => {
			const m = getMount(item.Filesystem, item.Mounted);
			const isMounted = !!item.Mounted && item.Mounted !== '/';
			let actionBtn;

			if (isMounted) {
				actionBtn = E('button', {
					class: 'btn cbi-button cbi-button-remove',
					click: () => {
						ui.showModal(_('卸载确认'), [
							E('p', {}, [_('确认卸载 '), E('strong', {}, item.Mounted || item.Filesystem), '？']),
							E('div', { class: 'button-row' }, [
								E('button', {
									class: 'btn cbi-button cbi-button-danger important', click: () => {
										ui.showModal(null, E('div', { class: 'spinning' }, _('卸载中…')));
										fs.exec_direct('/usr/libexec/diskman', ['umount', item.Mounted || item.Filesystem])
											.then(() => {
												ui.hideModal();
												ui.addTimeLimitedNotification(null, E('p', (item.Mounted || item.Filesystem) + _(' 已卸载')), 3000, 'success');
												// 强制失效两个缓存
												_diskCache.mounted.timestamp = 0;
												delete _diskCache.parted[Object.keys(_diskCache.parted).find(k => item.Filesystem.startsWith(k))];
												disk_info().then(t => document.querySelector('#diskman-editContainer')?.replaceChildren(t));
											})
											.catch(() => ui.addNotification(null, E('p', _('卸载失败')), 'error'));
									}
								}, _('确认')),
								E('button', { class: 'btn cbi-button', click: ui.hideModal }, _('取消'))
							])
						]);
					}
				}, _('卸载'));
			} else if (m?.filesystem && m.filesystem !== 'squashfs' && m.filesystem !== 'overlay') {
				// 有文件系统但未挂载 → 一键挂载按钮（神级功能！）
				actionBtn = E('button', {
					class: 'btn cbi-button cbi-button-positive',
					style: 'min-width:60px;',
					click: () => {
						ui.showModal(_('挂载分区'), [
							E('p', {}, [
								_('挂载设备：'), E('strong', {}, item.Filesystem),
								_('（文件系统：'), E('strong', {}, m.filesystem), '）'
							]),
							E('div', { class: 'cbi-section' }, [
								E('label', {}, _('挂载点：')),
								E('input', {
									type: 'text',
									value: defaultMountPoint,
									id: 'mount-point-input',
									style: 'width:100%; padding:8px; margin:5px 0;'
								}),
								E('p', { style: 'color:#666;font-size:12px;margin:5px 0;' },
									_('建议使用 /mnt/xxx 格式，系统会自动创建目录'))
							]),
							E('div', { class: 'button-row' }, [
								E('button', {
									class: 'btn cbi-button cbi-button-positive important',
									click: () => {
										const mp = document.getElementById('mount-point-input').value.trim();
										if (!mp) return ui.addNotification(null, E('p', '请输入挂载点'), 'warning');

										ui.showModal(null, E('div', { class: 'spinning' }, _('挂载中…')));

										fs.exec_direct('/usr/libexec/diskman', ['mount_dev', item.Filesystem, mp])
											.then(r => {
												ui.hideModal();
												if (r.includes('成功') || !r) {
													ui.addTimeLimitedNotification(null, E('p', item.Filesystem + _(' 已挂载到 ') + mp), 4000, 'success');
													_diskCache.mounted.timestamp = 0;  // 强制刷新
													disk_info().then(t => document.querySelector('#diskman-editContainer')?.replaceChildren(t));
												} else {
													ui.addNotification(null, E('p', _('挂载失败：') + r), 'error');
												};
											})
											.catch(() => ui.addNotification(null, E('p', '挂载命令执行失败'), 'error'));
									}
								}, _('确认挂载')),
								E('button', { class: 'btn cbi-button', click: ui.hideModal }, _('取消'))
							])
						]);
					}
				}, _('挂载'));
			} else { actionBtn = '-'; }

			return [
				item.Filesystem,
				E('span', { style: 'max-width:140px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;display:inline-block;', title: item.Mounted || '' }, item.Mounted || '-'),
				m?.filesystem || '-',
				`${item.Size}/${item['Use%']}`,
				`${item.Used}/${item.Available}`,
				E('span', { style: 'max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;display:inline-block;', title: m?.options || '' }, m?.options || '-'),
				actionBtn
			];
		}));

		return table.render();
	});
};

return view.extend({
	load: function () {
		return fs.exec_direct('/usr/libexec/diskman', ['lsblk'])
			.then(r => JSON.parse(r))
			.then(res => {
				let disks = (res.blockdevices || []).filter(dev =>
					dev.type === 'disk'
					&& !/^(loop|sr|ram|zram)/.test(dev.name || '')
					&& parseFloat(String(dev.size).replace(/[^\d.]/g, '')) > 0
				);

				return Promise.all(disks.map(dev => {
					let smartPromise = Promise.resolve({ nosmart: true });
					if (['sata', 'nvme', 'ata', 'scsi'].includes(dev.tran)) {
						smartPromise = fs.exec_direct('/usr/libexec/diskman', ['smartctl', dev.path])
							.then(out => JSON.parse(out));
					};

					return Promise.all([smartPromise])
						.then(([smart]) => ([dev, smart]));
				}));
			});
	},

	render: function (res) {
		const MIN_PCT = 8;
		let tableData = [], partitionBars = [];
		const COLORS = ["#c0c0ff", "#fbbd00", "#e97c30", "#a0e0a0", "#e0c0ff"];
		// const COLORS = ["#cdb4db", "#ffc8dd", "#bde0fe", "#a2d2ff", "#ffafcc"];

		const toBytes = s => {
			if (!s || s === '-') return 0;
			const m = s.match(/^([\d.]+)\s*([KMGTP]?)[B]?$/i);
			if (!m) return 0;
			const u = { K: 1 << 10, M: 1 << 20, G: 1 << 30, T: 1 << 40 };
			return +m[1] * (u[m[2].toUpperCase()] || 1);
		};

		res.forEach(([dev, smart], i) => {
			let size = dev.size || '-';
			let model = `${dev.model.trim()} ${dev.vendor.trim()}` || '未知';

			const hasSMART = smart && !smart.nosmart && !smart.error && smart.smart_status !== undefined;
			const health = hasSMART ? (smart.smart_status.passed ? '正常' : '警告') : (smart?.error ? 'SMART错误' : '不支持');
			const healthColor = { 正常: '#8bc34a', 警告: '#ff9800', SMART错误: '#f44336' }[health] || '#9e9e9e';
			const healthElement = E('span', {
				style: `background:${healthColor};color:#fff;padding:2px 6px;border-radius:3px;font-size:12px;`
			}, health);

			const ejectButton = E('button', {
				class: 'cbi-button cbi-button-remove',
				click: () => {
					fs.exec('/usr/libexec/diskman', ['reject', JSON.stringify(dev)])
						.then(r => {
							let sign = r.stdout || '';
							if (sign.includes('错误')) ui.addTimeLimitedNotification(null, E('p', _(sign)), 8000, 'error');
							if (sign.includes('安全弹出')) {
								ui.addTimeLimitedNotification(null, E('p', _(sign)), 3000, 'info');
								setTimeout(() => { location.reload(); }, 3000);
							};
						})
				}
			}, _('Eject'));

			const editButton = E('button', {
				class: 'btn cbi-button cbi-button-edit',
				click: ui.createHandlerFn(this, () => editdev(dev, smart))
			}, _('Edit'));

			tableData.push([
				dev.path,
				model,
				smart.serial_number || '-',
				size,
				tableTypeMap[dev.pttype] || tableTypeMap[ptable],
				interfaceMap[dev.tran] || dev.tran || '-',
				hasSMART ? getTemperature(smart) : '-',
				hasSMART ? getInterfaceSpeed(smart) : '-',
				healthElement,
				hasSMART ? (smart.rotation_rate || '-') : '-',
				hasSMART ? (smart.power_on_time?.hours || smart.nvme_smart_health_information_log?.power_on_hours || '-') : '-',
				hasSMART ? (smart.power_cycle_count || smart.nvme_smart_health_information_log?.power_cycles || '-') : '-',
				ejectButton,
				editButton
			]);

			let expand = 0, smallSum = 0;
			const children = dev.children || [dev];
			const parts = children.map(p => {
				const pct = toBytes(p.size) / toBytes(dev.size) * 100;
				if (pct <= MIN_PCT) { expand += MIN_PCT; smallSum += pct; }
				return { p, pct };
			});

			const barWrapper = E('div',
				parts.map(({ p, pct }, j) => {
					const final = pct <= MIN_PCT ? MIN_PCT : pct * (100 - expand) / (100 - smallSum);
					const txt = [p.name, tableTypeMap[p.fstype] || p.fstype, p.size, p.mountpoint]
						.filter(x => x && x !== '-' && x !== 'Free Space')
						.join(' ') || ' ';

					return E('div', {
						title: txt,
						style: `display:inline-block;width:${Math.max(final, 1)}%;height:16px;background:${COLORS[j % 5]};font-size:12px;text-align:center;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;`
					}, txt);
				}));

			partitionBars.push({ index: i, bar: barWrapper });
		});

		const table = new L.ui.Table(
			[
				_('Path'),
				_('Model'),
				_('Serial Number'),
				_('Size'),
				_('Partition Table'),
				_('Interface'),
				_('Temp'),
				_('SATA Version'),
				_('Health'),
				_('Rotation Rate'),
				_('Hours'),
				_('Cycles'),
				_(''), // 弹出按钮列
				_('')  // 编辑按钮列
			],
			{
				id: 'diskman-table',
				sortable: true,
				classes: ['cbi-section-table']
			},
			E('em', _('No disks found'))
		);

		table.update(tableData);
		const tableElement = table.render();

		Promise.resolve().then(() => {
			const rows = Array.from((tableElement.querySelector('tbody') || tableElement)
				.querySelectorAll('tr.tr:not(.table-titles)'));
			const cellStyle = { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '150px' };

			rows.forEach(row => row.querySelectorAll('td').forEach(cell => {
				const content = cell.textContent || cell.innerText;
				if (content?.length > 15) cell.title = content;
				Object.assign(cell.style, cellStyle);
			}));

			partitionBars.forEach(({ index, bar }) => {
				rows[index]?.after(E('td', { colspan: '14' }, bar));
			});
		});
		const editContainer = E('div');
		disk_info(res).then(t => {
			editContainer.appendChild(t);
		});

		return E([], [
			E('h2', {}, _('DiskMan')),
			E('div', { class: 'cbi-map-descr' }, _('Manage Disks over LuCI.')),
			E('p', {
				class: 'cbi-button cbi-button-add',
				click: () => fs.exec('/usr/libexec/diskman', ['rescandisks'])
					.then(r => r.code === 0 && location.reload())
			}, _('Rescan Disks')),
			E('h3', {}, _('Disks')),
			E('div', { id: 'diskman-container' }, [tableElement]),
			E('h3', {}, _('Mount Point')),
			E('div', { id: 'diskman-editContainer' }, [editContainer]),

		]);
	},

	handleSaveApply: null,
	handleSave: null,
	handleReset: null
});
