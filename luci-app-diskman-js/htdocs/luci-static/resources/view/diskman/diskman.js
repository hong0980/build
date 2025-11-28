'use strict';
'require fs';
'require ui';
'require dom';
'require view';
'require form';

const tableTypeMap = { gpt: 'GPT', dos: 'MBR', msdos: 'MBR', iso9660: 'ISO' };
const interfaceMap = { sata: 'SATA', nvme: 'NVMe', usb: 'USB', scsi: 'SCSI', ata: 'ATA', sas: 'SAS' };
const _diskCache = {
	disks: {},
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
				df: null,
				mount: null,
				parted: null,
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

function mount_dev(dev, mp) {
	if (!mp) return modalnotify(null, E('p', '请输入挂载点'), 'warning');
	fs.exec_direct('/usr/libexec/diskman', ['mount_dev', dev, mp])
		.then(r => {
			if (r.includes('__OK__')) {
				modalnotify(null, E('p', _('%s 已挂载到 %s').format(dev, mp)), 4000, 'success');
				setTimeout(() => ui.hideModal(), 2000);
			} else {
				modalnotify(null, E('p', _('挂载失败：%s').format(r)), 'error');
			};
		});
};

function umount(path) {
	fs.exec_direct('/bin/umount', [path])
		.then(() => {
			modalnotify(null, E('p', _('%s 卸载成功').format(path)), 3000, 'success');
			setTimeout(() => location.reload(), 3000);
		})
		.catch(e => {
			modalnotify(null, E('p', _('卸载失败：%s').format(e.message || e)), 8000, 'error');
		});
};

function format_dev(fullDev, fstype, label) {
	fs.exec_direct('/usr/libexec/diskman', ['format', fullDev, fstype, label])
		.then(r => {
			const output = (typeof r === 'object' ? (r.stdout || '') : r) || '';
			if (output.includes('格式化完成')) {
				modalnotify(null, E('p', output), 5000, 'success');
			} else {
				const err = output.includes('错误：')
					? output.split('错误：')[1].trim()
					: output || '未知错误';
				modalnotify(null, E('p', _('格式化失败： %s').format(err)), 'error');
			};
		})
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
	}, E('em', _('No disks found')));

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
	// let cachedDiskObj = null;

	// // 1. 优先使用新缓存
	// const cache = _diskCache.getDisk(path);
	// if (_diskCache.isFresh(cache.timestamp)) {
	// 	cachedDiskObj = cache.diskObj;
	// 	render(cache.parted, cache.mount, cache.df);
	// 	return;
	// };

	// ui.showModal(null, E('div', { class: 'spinning' }, _('加载分区信息…')));

	function disktable(parted, smart) {
		if (!parted || !parted[0] || !parted[0].disk) {
			return E('em', _('无磁盘信息'));
		};


		const disk = parted[0].disk;
		const sectors = parseInt(disk.total_sectors) || 0;
		const bytes = sectors * 512;
		const hasSMART = smart && !smart.nosmart && !smart.error && smart.smart_status !== undefined;
		const health = hasSMART ? (smart.smart_status.passed ? '正常' : '警告') : (smart?.error ? 'SMART错误' : '不支持');

		const table = new L.ui.Table([
			_('路径'), _('型号'), _('序号'), _('大小'),
			_('扇区大小'), _('分区表'), _('温度'),
			_('转速'), _('状态')
		], {
			id: 'diskman-table',
			sortable: true,
			classes: ['cbi-section-table']
		}, E('em', _('No disks found')));

		table.update([[
			disk.device || '-',
			smart.model_name || disk.model || '-',
			smart.serial_number || '-',
			(bytes / 1e9).toFixed(1) + 'GB',
			`${disk.sector_size.logical}B/${disk.sector_size.physical}B`,
			tableTypeMap[disk.partition_table || '-'],
			getTemperature(smart), '-', health
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
		const diskDevice = (parted && parted[0] && parted[0].disk) ? parted[0].disk.device : '';

		const rows = partitions.map(entry => {
			const isnumber = entry.number !== null;
			const bytes = (parseInt(entry.size) || 0) * sectorSize;
			const fullDev = isnumber ? `${diskDevice}${entry.number}` : null;
			let deviceCell = isnumber ? `${diskDevice}${entry.number}` : '-';
			let mountPoints = fullDev && mountMap[fullDev] ? mountMap[fullDev].join('<br>') : '-';
			if (mountPoints === '-' && deviceCell !== '-')
				mountPoints = E('button', {
					class: 'btn cbi-button cbi-button-positive important',
					click: ui.createHandlerFn(this, () => {
						ui.showModal(_(`挂载 ${deviceCell}`), [
							E('div', { class: 'cbi-value' }, [
								E('label', _('请输入挂载点：')),
								E('input', { type: 'text', id: 'mount-point-input' })
							]),
							E('dev', { class: 'button-row' }, [
								E('button', {
									class: 'btn cbi-button cbi-button-positive important',
									click: ui.createHandlerFn(this, () => {
										const mp = document.getElementById('mount-point-input').value.trim();
										mount_dev(deviceCell, mp);
									})
								}, _('挂载')),
								E('button', { class: 'btn cbi-button', click: ui.hideModal }, _('取消'))
							])
						]);
					})
				}, _('挂载'))

			let fsCell = entry.fileSystem || '-';
			if (!isnumber && entry.type == null) {
				fsCell = E('button', {
					class: 'cbi-button cbi-button-remove',
					click: ui.createHandlerFn(this, () => {
						ui.showModal(_('格式化 %s 分区').format(fullDev), [
							E('p', { style: 'margin:15px 0;color:red;' }, [
								_('确定要格式化分区 %s 吗？所有数据将被清除！').format(fullDev)
							]),
							E('div', {}, [
								E('label', _('选择文件系统：')),
								E('select', { id: 'format-type' }, [
									E('option', { value: 'ext4' }, 'ext4（推荐，Linux 原生）'),
									E('option', { value: 'ext2' }, 'ext2（无日志）'),
									E('option', { value: 'vfat' }, 'FAT32（兼容 Windows/U盘）'),
									E('option', { value: 'ntfs' }, 'NTFS（Windows 专用）'),
									E('option', { value: 'xfs' }, 'XFS（高性能）')
								]),
							]),
							E('div', {}, [
								E('label', _('分区标签（可选）：')),
								E('input', { type: 'text', id: 'format-label' })
							]),
							E('div', { class: 'button-row' }, [
								E('button', {
									class: 'btn cbi-button cbi-button-positive important',
									click: ui.createHandlerFn(this, () => {
										const fstype = document.getElementById('format-type').value;
										const label = document.getElementById('format-label').value.trim();
										format_dev(fullDev, fstype, label);
									})
								}, _('确认格式化')),
								E('button', { class: 'btn cbi-button', click: ui.hideModal }, _('取消'))
							])
						]);
					})
				}, _('格式化'));
			};

			let action = isnumber
				? E('button', {
					class: 'cbi-button cbi-button-remove',
					style: 'min-width:60px',
					click: ui.createHandlerFn(this, () => {
						ui.showModal(_('删除 %s 分区').format(fullDev), [
							E('style', ['h4 {text-align:center;color:red;}']),
							E('p', _(`确定要删除分区 ${diskDevice}${entry.number} 吗？此操作将永久丢失数据！`)),
							E('div', { class: 'button-row' }, [
								E('button', { class: 'btn', click: ui.hideModal }, _('取消')),
								E('button', {
									class: 'btn cbi-button-remove important',
									click: ui.createHandlerFn(this, () => {
										fs.exec_direct('/sbin/parted', ['-s', diskDevice, 'rm', entry.number])
											.then(() => fs.exec_direct('/sbin/partprobe', [diskDevice]))
											.then(() => {
												modalnotify(null, E('p', _('分区删除成功')), 2000, 'success');
												// setTimeout(() => ui.hideModal(), 2000);
												setTimeout(() => location.reload(), 2000);
											})
											.catch(err => {
												modalnotify(null,
													E('p', ['删除失败：', E('br'), err.message || String(err)]),
													'error'
												);
											});
									})
								}, _('确认删除')),
							])
						])

					})
				}, _('移除'))
				: E('button', {
					style: 'min-width:60px',
					class: 'btn cbi-button cbi-button-positive',
					click: ui.createHandlerFn(this, () => onreset(diskDevice, parted, df))
				}, _('新建'));

			if (entry.type === 'Free Space' && entry.size <= 1024) action = '-'

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
			_('设备'), _('起始扇区'), _('结束扇区'), _('大小'), _('类型'),
			_('文件系统'), _('已使用'), _('空闲空间'), _('用量'), _('挂载点'), _('操作')
		], {
			sortable: true,
			id: 'diskman-table-simple',
			classes: ['cbi-section-table', 'diskman-table']
		}, E('em', _('No disks found')));

		table.update(rows);
		return table.render();
	};

	function onreset(diskPath, partedjson, df) {
		if (!diskPath) return;

		const sleep = ms => new Promise(r => setTimeout(r, ms));
		const partedcmd = args => fs.exec_direct('/sbin/parted', ['-s', diskPath, ...args]);
		const partprobe = () => fs.exec_direct('/sbin/partprobe', [diskPath]).catch(() => {});
		const lsblkParts = () => fs.exec_direct('/usr/bin/lsblk', ['-rno', 'NAME', diskPath])
			.then(out => out.trim().split('\n').filter(l =>
				l !== diskPath.replace('/dev/', '')
			).map(n => '/dev/' + n));

		const calculateDiskSpace = () => {
			const totalSectors = parseIntSafe(diskInfo.total_sectors) || 0;

			const usedSectors = partsInfo
				.filter(p => p.number && p.size && !p.type.toLowerCase().includes('free'))
				.reduce((sum, p) => sum + parseIntSafe(p.size), 0);

			const reservedStart = 2048;   // 起始保留（4K 对齐）
			const reservedEnd = 34;       // GPT 备份表
			const maxUsableSectors = Math.max(0, totalSectors - reservedStart - reservedEnd);
			const freeSectors = Math.max(0, maxUsableSectors - usedSectors);

			return {
				totalMiB: sectorsToMiB(totalSectors),
				freeMiB: sectorsToMiB(freeSectors),
				freeSectors,
				maxUsableSectors,
				usedSectors
			};
		};

		const pjRoot = Array.isArray(partedjson) && partedjson.length ? partedjson[0] : (partedjson || {});
		const diskInfo = pjRoot.disk || {};
		const partsInfo = Array.isArray(pjRoot.partitions) ? pjRoot.partitions : [];
		const SECTOR_SIZE = (diskInfo.sector_size && diskInfo.sector_size.logical) ? parseInt(diskInfo.sector_size.logical) : 512;
		const ALIGN_MI = 4; // 4 MiB 对齐
		const ALIGN_SECTORS = Math.ceil((ALIGN_MI * 1024 * 1024) / SECTOR_SIZE); // 4MiB对齐的扇区数

		const sectorsToMiB = (sectors) => Math.floor((parseInt(sectors || 0) * SECTOR_SIZE) / 1024 / 1024);
		const miBToSectors = (miB) => Math.ceil((parseFloat(miB || 0) * 1024 * 1024) / SECTOR_SIZE);
		const parseIntSafe = v => (v === null || v === undefined) ? 0 : parseInt(v);
		const { totalMiB, freeMiB } = calculateDiskSpace();
		const diskInfoEl = E('div', { style: 'color:#856404;font-size:13px;', id: 'disk-info' },
			`磁盘：${diskPath} | 总空间：${totalMiB.toLocaleString()} MiB | 可用空间：${freeMiB.toLocaleString()} MiB`
		);
		// 扇区对齐函数
		const alignSectors = (sectors) => {
			const n = Math.max(0, parseIntSafe(sectors));
			return Math.floor(n / ALIGN_SECTORS) * ALIGN_SECTORS;
		};

		// MiB对齐函数
		const alignMiB = (v) => {
			const n = Math.max(0, Math.floor(parseIntSafe(v) || 0));
			return Math.floor(n / ALIGN_MI) * ALIGN_MI;
		};

		// 获取所有空闲区域的总扇区数
		const getTotalFreeSectors = () => {
			let total = 0;
			for (const p of partsInfo) {
				if ((p.type || '').toLowerCase().includes('free')) {
					total += parseIntSafe(p.size);
				}
			}
			return total;
		};

		// 找到最大的空闲区域
		const findLargestFreeSpace = () => {
			let largest = null;
			for (const p of partsInfo) {
				if ((p.type || '').toLowerCase().includes('free')) {
					if (!largest || parseIntSafe(p.size) > parseIntSafe(largest.size)) {
						largest = p;
					}
				}
			}
			return largest;
		};

		// 找到足够大的空闲区域（至少10MB）
		const findUsableFreeSpace = (minSizeMiB = 10) => {
			const minSectors = miBToSectors(minSizeMiB);
			let best = null;

			for (const p of partsInfo) {
				if ((p.type || '').toLowerCase().includes('free')) {
					const size = parseIntSafe(p.size);
					if (size >= minSectors) {
						if (!best || size > parseIntSafe(best.size)) {
							best = p;
						}
					}
				}
			}
			return best;
		};

		const safeUmount = async (dev) => {
			try {
				const mountPoints = (df || [])
					.filter(item => item.Filesystem === dev)
					.map(item => item.Mounted);

				for (const mountPoint of mountPoints) {
					if (mountPoint) {
						await fs.exec_direct('/bin/umount', [mountPoint]).catch(() => {});
						await sleep(500);
					}
				}
			} catch (e) { modalnotify(null, E('p', _('卸载失败') + e), 'warning'); }
		};

		if (freeMiB < 10) return modalnotify(null, E('p', _('磁盘太小')), 'warning');

		const availableFS = {
			ext2: { cmd: "/usr/sbin/mkfs.ext2", label: "EXT2", args: ["-F", "-E", "lazy_itable_init=1"] },
			ext3: { cmd: "/usr/sbin/mkfs.ext3", label: "EXT3", args: ["-F", "-E", "lazy_itable_init=1"] },
			btrfs: { cmd: "/usr/bin/mkfs.btrfs", label: "btrfs", args: ["-f"] },
			fat32: { cmd: "/usr/bin/mkfs.fat", label: _("FAT32（U盘通用）"), args: ["-F", "32"] },
			mkswap: { cmd: "/sbin/mkswap", label: "mkswap", args: [] },
			exfat: { cmd: "/usr/sbin/mkfs.exfat", label: "exFAT", args: [] },
			ext4: { cmd: "/usr/sbin/mkfs.ext4", label: _("EXT4（推荐）"), args: ["-F", "-E", "lazy_itable_init=1"] },
		};

		const modal = E('div', { style: 'display:flex;flex-direction:column;gap:15px;font-size:14px;max-width:600px;' }, [
			E('div', {
				style: 'background:#fff3cd;border:1px solid #ffeaa7;border-radius:4px;padding:12px;'
			}, [
				E('div', { style: 'color:#856404;font-weight:bold;margin-bottom:5px;' }, _('⚠️ 警告：此操作将擦除磁盘所有数据！')),
				diskInfoEl,
			]),
			E('div', { style: 'display:flex;flex-direction:column;gap:12px;' }, [
				E('div', { style: 'display:flex;align-items:center;gap:10px;' }, [
					E('label', { style: 'min-width:120px;font-weight:bold;' }, _('分区表类型：')),
					E('select', { id: 'pt-select', style: 'flex:1;padding:6px;' }, [
						E('option', { value: diskInfo.partition_table || 'gpt' }, diskInfo.partition_table ? diskInfo.partition_table.toUpperCase() : 'GPT'),
						E('option', { value: 'msdos' }, _('MBR（兼容旧系统）'))
					])
				]),
				E('div', { style: 'display:flex;align-items:center;gap:10px;' }, [
					E('label', { style: 'min-width:120px;font-weight:bold;' }, _('操作模式：')),
					E('select', { id: 'action-select', style: 'flex:1;padding:6px;' }, [
						E('option', { value: 'single_partition' }, _('创建单个分区并格式化')),
						E('option', { value: 'multi_partition' }, _('多个分区(磁盘扩容)'))
					])
				]),
				E('div', { style: 'display:flex;align-items:center;gap:10px;' }, [
					E('label', { style: 'min-width:120px;font-weight:bold;' }, _('文件系统：')),
					E('select', { id: 'fs-select', style: 'flex:1;padding:6px;' }, Object.keys(availableFS).map(k => E('option', { value: k }, availableFS[k].label)))
				])
			]),
			E('div', { id: 'multi-partition-container', style: 'display:none;margin-top:10px;border:1px solid #e9ecef;border-radius:4px;padding:15px;background:#f8f9fa;' }, [
				E('div', { id: 'mode-hint', style: 'font-weight:bold;color:#007bff;margin-bottom:10px;' }),
				E('div', { style: 'margin-bottom:8px;display:flex;align-items:center;gap:8px;' }, [
					E('input', { id: 'auto-fill-last', type: 'checkbox', checked: true }),
					E('label', { for: 'auto-fill-last', style: 'color:red;font-weight:bold;' }, _('自动填满剩余空间，新建分区默认自动填满（分区大小=0 的分区自动分配空间.）'))
				]),
				E('div', { style: 'display:flex;font-weight:bold;margin-bottom:10px;' }, [
					E('span', { style: 'flex:2;' }, _('分区大小 (MiB)')),
					E('span', { style: 'flex:3;' }, _('文件系统')),
					E('span', { style: 'flex:1;' }, _('操作')),
				]),
				E('div', { id: 'partitions-list' }),
				E('div', { id: 'remain-info', style: 'font-weight:bold;padding:8px;margin:10px 0;background:white;border-radius:4px;text-align:center;' }),
				E('button', { id: 'add-partition-btn', class: 'cbi-button cbi-button-add', style: 'width:100%;' }, '+ ' + _('添加分区'))
			]),
			E('div', { style: 'display:flex;justify-content:flex-end;gap:10px;margin-top:20px;' }, [
				E('button', { id: 'cancel-btn', class: 'cbi-button' }, _('取消')),
				E('button', { id: 'confirm-btn', class: 'cbi-button cbi-button-positive important' }, _('确认执行'))
			])
		]);

		let partitions = [];
		const modeHint = modal.querySelector('#mode-hint');
		const ptSelect = modal.querySelector('#pt-select');
		const fsSelect = modal.querySelector('#fs-select');
		const remainInfo = modal.querySelector('#remain-info');
		const confirmBtn = modal.querySelector('#confirm-btn');
		const addBtn = modal.querySelector('#add-partition-btn');
		const actionSelect = modal.querySelector('#action-select');
		const partitionsList = modal.querySelector('#partitions-list');
		const mpContainer = modal.querySelector('#multi-partition-container');

		fsSelect.value = 'ext4';
		fsSelect.disabled = true;

		const autoFillEnabled = () => modal.querySelector('#auto-fill-last').checked;

		// 更新剩余空间显示
		const updateRemain = () => {
			const totalDiskSectors = parseIntSafe(diskInfo.total_sectors) || 0;
			const existingParts = partsInfo.filter(p =>
				p.number && parseIntSafe(p.size) > 0 && !p.type.toLowerCase().includes('free')
			);
			const hasExistingParts = existingParts.length > 0;
			const { freeSectors: globalFreeSectors, maxUsableSectors } = calculateDiskSpace();

			let totalAvailableSectors;
			if (hasExistingParts && sectorsToMiB(globalFreeSectors) > 10) {
				const fixedSum = partitions.reduce((s, p) => s + (p.sizeSectors > 0 ? p.sizeSectors : 0), 0);
				totalAvailableSectors = fixedSum + globalFreeSectors;
			} else {
				totalAvailableSectors = maxUsableSectors;
			}
			// 固定分区扇区总和（已对齐）
			const fixedSum = partitions.reduce((s, p) => s + (p.sizeSectors > 0 ? p.sizeSectors : 0), 0);
			let remainSectors = Math.max(0, totalAvailableSectors - fixedSum);

			if (autoFillEnabled()) {
				const zeros = partitions.filter(p => p.sizeSectors === 0);
				if (zeros.length > 0) {
					let remaining = remainSectors;
					// 先给前 N-1 个分配（对齐后的最小单位）
					for (let i = 0; i < zeros.length - 1; i++) {
						const share = Math.floor(remaining / (zeros.length - i));
						const aligned = alignSectors(share);
						const actual = Math.min(aligned, remaining);
						zeros[i].sizeSectors = actual;
						remaining -= actual;
					}

					// 最后一个拿走全部剩余（不再对齐，确保吃干净）
					if (zeros.length >= 1) {
						const last = zeros[zeros.length - 1];
						last.sizeSectors = Math.max(0, remaining); // ← 修复点
						remaining = 0;
					}

					// 重新计算 remainSectors
					remainSectors = Math.max(0, totalAvailableSectors - partitions.reduce((s, p) =>
						s + (p.sizeSectors || 0), 0));
				}
			}

			const remainMiB = sectorsToMiB(remainSectors);
			remainInfo.textContent = _('剩余空间：') + `${Math.max(0, remainMiB)} MiB`;
			remainInfo.style.color = remainSectors >= 0 ? '#28a745' : '#dc3545';
			remainInfo.style.background = remainSectors >= 0 ? '#d4edda' : '#f8d7da';

			return remainSectors >= 0;
		};

		const addPartitionRow = (sizeMiB = 0, fs = 'ext4') => {
			const id = 'p-' + Math.random().toString(36).slice(2);
			const sizeSectors = alignSectors(miBToSectors(sizeMiB));
			partitions.push({ id, sizeSectors, fs });

			const row = E('div', { 'data-id': id, style: 'display:flex;align-items:center;gap:8px;margin:8px 0;padding:8px;background:white;border-radius:4px;' }, [
				E('input', {
					type: 'number',
					min: 0,
					max: totalMiB,
					value: sizeMiB > 0 ? sizeMiB : '',
					placeholder: '输入数字指定大小',
					title: '新建默认自动填满 | 输入数字指定大小',
					style: 'flex:2;padding:6px;'
				}),
				E('select', { style: 'flex:3;padding:6px;' }, Object.keys(availableFS).map(k =>
					E('option', { value: k, selected: k === fs }, availableFS[k].label)
				)),
				E('button', { class: 'cbi-button cbi-button-remove', style: 'flex:1;' }, _('删除'))
			]);

			const [sizeInput, fsSel, delBtn] = row.children;

			const sync = () => {
				const p = partitions.find(x => x.id === id);
				let valMiB = parseInt(sizeInput.value) || 0;
				if (isNaN(valMiB)) valMiB = 0;

				p.sizeSectors = alignSectors(miBToSectors(valMiB));
				sizeInput.value = valMiB; // ← 只有非零才显示数字，0 显示为空
				p.fs = fsSel.value;
				updateRemain();
			};

			fsSel.onchange = sync;
			sizeInput.onblur = sync;
			sizeInput.onchange = sync;

			delBtn.onclick = () => {
				partitions = partitions.filter(p => p.id !== id);
				row.remove();
				updateRemain();
			};

			partitionsList.appendChild(row);
			updateRemain();
		};

		const sortPartitionDevices = (devices) => {
			return devices.sort((a, b) => {
				const numA = parseInt(a.match(/(\d+)$/)?.[1] || 0, 10);
				const numB = parseInt(b.match(/(\d+)$/)?.[1] || 0, 10);
				return numA - numB;
			});
		};

		addBtn.onclick = () => {
			const isMBR = ptSelect.value === 'msdos';
			const newUserParts = partitions.filter(p => !p.id?.startsWith('existing-'));
			if (isMBR && newUserParts.length >= 4) {
				modalnotify(null, E('p', _('MBR 分区表最多支持 4 个主分区。如需更多分区，请选择 GPT 分区表类型。')), 'warning');
				return;
			}
			addPartitionRow(0, 'ext4');
		};

		// 动作选择变化处理
		actionSelect.onchange = () => {
			const mode = actionSelect.value;
			const isMulti = mode === 'multi_partition';
			fsSelect.disabled = !(mode === 'single_partition');
			mpContainer.style.display = isMulti ? 'block' : 'none';

			partitions = [];
			partitionsList.innerHTML = '';
			addBtn.disabled = false;

			if (!isMulti) return;

			// 场景判断
			const existingParts = partsInfo.filter(p => p.number && parseIntSafe(p.size) > 0 && !p.type.toLowerCase().includes('free'));
			const hasExistingParts = existingParts.length > 0;
			const totalFreeMiB = sectorsToMiB(getTotalFreeSectors());
			const totalDiskMiB = sectorsToMiB(parseIntSafe(diskInfo.total_sectors));

			let currentMode = '';
			if (hasExistingParts && totalFreeMiB > 10) {
				currentMode = _('🔹 模式：空闲容量扩容（保留现有分区）');
			} else if (hasExistingParts) {
				currentMode = _('🔸 模式：重新分区（将删除所有现有分区）');
			} else {
				currentMode = _('🔸 模式：全新分区（整个磁盘）');
			}
			modeHint.textContent = currentMode;

			if (hasExistingParts && totalFreeMiB > 10) {
				// 场景1：空闲容量扩容
				const largestFree = findLargestFreeSpace();
				if (largestFree) {
					const freeMiB = sectorsToMiB(parseIntSafe(largestFree.size));

					// 显示现有分区（只读）
					for (const p of existingParts) {
						const sizeMiB = sectorsToMiB(parseIntSafe(p.size));
						const row = E('div', {
							'data-id': 'existing-' + p.number,
							style: 'display:flex;align-items:center;gap:8px;margin:8px 0;padding:8px;background:#e9ecef;border-radius:4px;color:#6c757d;'
						}, [
							E('input', {
								type: 'number',
								value: sizeMiB,
								disabled: true,
								style: 'flex:2;padding:6px;background:#f8f9fa;'
							}),
							E('select', {
								disabled: true,
								style: 'flex:3;padding:6px;background:#f8f9fa;'
							}, [E('option', p.type || 'ext4')]),
							E('span', { style: 'flex:1;text-align:center;' }, _('现有分区'))
						]);
						partitionsList.appendChild(row);
					}

					partitionsList.appendChild(E('div', {
						style: 'border-top:1px dashed #007bff;margin:15px 0;padding:5px;background:#e7f3ff;text-align:center;font-weight:bold;'
					}, _('👇 新分区（在空闲空间创建）')));

					const half = Math.max(1, Math.floor(freeMiB / 2));
					addPartitionRow(alignMiB(half), 'ext4');
					addPartitionRow(0, 'ext4');
				}
			} else {
				// 场景2/3：重新分区或全新分区
				const quarter = Math.max(1, Math.floor(totalDiskMiB / 3));
				addPartitionRow(alignMiB(quarter), 'ext4');
				// addPartitionRow(0, 'ext4');
			}

			updateRemain();
		};

		ui.showModal(_('磁盘初始化与分区'), modal);
		modal.querySelector('#cancel-btn').onclick = ui.hideModal;

		// 确认按钮点击执行逻辑
		confirmBtn.onclick = async () => {
			const mode = actionSelect.value;
			const fsType = fsSelect.value;

			// 场景判断
			const existingParts = partsInfo.filter(p =>
				p.number && parseIntSafe(p.size) > 0 && !p.type.toLowerCase().includes('free')
			);
			const hasExistingParts = existingParts.length > 0;
			const totalFreeMiB = sectorsToMiB(getTotalFreeSectors());
			const isResizeMode = hasExistingParts && totalFreeMiB > 10;

			// 校验
			if (mode === 'single_partition' && !availableFS[fsType]) {
				return modalnotify(null, E('p', _('请选择有效的文件系统')), 2000, 'error');
			}
			if (mode === 'multi_partition') {
				if (partitions.length === 0) return modalnotify(null, E('p', _('请至少添加一个分区')), 2000, 'error');
				if (!updateRemain()) return modalnotify(null, E('p', _('分区总大小不能超过磁盘容量')), 'error');
			}

			confirmBtn.disabled = true;
			ui.showModal(null, E('div', { class: 'spinning' }, _('正在执行，请勿拔盘…')));

			try {
				let newPartDevices = [];

				if (mode === 'single_partition') {
					// 单分区：全新分区表 + 一个分区
					await partedcmd(['mklabel', ptSelect.value]);
					await sleep(1000);
					await partedcmd(['mkpart', 'primary', '0%', '100%']);
					await sleep(1000);
					await partprobe();
					await sleep(1000);

					const parts = await lsblkParts();
					newPartDevices = parts.length ? [parts[0]] : [];
				} else {
					if (isResizeMode) {
						const free = findLargestFreeSpace();
						if (!free) throw new Error(_('找不到可用的空闲空间'));

						const alignUp = n => Math.ceil(parseIntSafe(n) / ALIGN_SECTORS) * ALIGN_SECTORS;
						const alignDown = n => Math.floor(parseIntSafe(n) / ALIGN_SECTORS) * ALIGN_SECTORS;

						let start = alignUp(free.start);
						const endLimit = alignDown(free.end);

						if (start >= endLimit) throw new Error(_('可用空闲区对齐后无有效空间'));

						const todo = partitions.filter(p => !p.id?.startsWith('existing-'));
						if (todo.length === 0) return;

						for (let i = 0; i < todo.length; i++) {
							const p = todo[i];
							let want = parseIntSafe(p.sizeSectors);
							if ((!want || want <= 0) && autoFillEnabled()) {
								const freeLeft = endLimit - start + 1;
								want = Math.floor(freeLeft / (todo.length - i));
							}
							if (!want || want <= 0) continue;

							let size = alignDown(Math.min(want, endLimit - start + 1));
							if (size <= 0) continue;

							const end = start + size - 1;
							if (end > endLimit) break;

							const partType = ptSelect.value === 'msdos' ? 'primary' : '';

							await partedcmd(['mkpart', partType, p.fs || 'ext4', `${start}s`, `${end}s`].filter(Boolean));
							await sleep(600);

							start = alignUp(end + 1);
							if (start > endLimit) break;
						}

						await partprobe();
						await sleep(1000);

						const before = new Set(existingParts.map(
							p => `/dev/${diskPath.replace('/dev/', '')}${p.number}`
						));
						const after = new Set(await lsblkParts());
						newPartDevices = sortPartitionDevices([...after].filter(dev => !before.has(dev)));
					} else {
						await partedcmd(['mklabel', ptSelect.value]);
						await sleep(1000);

						const totalDiskSectors = parseIntSafe(diskInfo.total_sectors) || 0;
						const tailReserved = (ptSelect.value === 'gpt') ? 34 : 0;
						let currentStart = 2048; // 1MB 引导保留 + 4K 对齐起点

						const validPartitions = partitions.filter(p => p.sizeSectors > 0);
						for (const p of validPartitions) {
							const alignedSize = alignSectors(p.sizeSectors);
							const endSector = Math.min(currentStart + alignedSize - 1, totalDiskSectors - 1 - tailReserved);
							if (endSector <= currentStart) break;

							await partedcmd(['mkpart', 'primary', `${currentStart}s`, `${endSector}s`]);
							await sleep(600);
							currentStart = endSector + 1;
						}

						await partprobe();
						await sleep(1000);
						newPartDevices = sortPartitionDevices(await lsblkParts());
					}
				}

				// 格式化新分区
				for (let i = 0; i < newPartDevices.length; i++) {
					const dev = newPartDevices[i];
					const targetFS = mode === 'single_partition'
						? fsType
						: (partitions[i]?.fs || 'ext4');

					const fsTool = availableFS[targetFS] || availableFS.ext4;
					if (!fsTool) continue;

					await safeUmount(dev);
					await fs.exec_direct(fsTool.cmd, [...fsTool.args, dev]);
					await sleep(300);
				}
				modalnotify(null, E('p', _('操作成功！')), 3000, 'success');
				setTimeout(() => location.reload(), 3000);
			} catch (err) {
				modalnotify(null, E('p', [_('操作失败：'), E('br'), err.message || String(err)]), 'error');
				confirmBtn.disabled = false;
			}
		};
	};

	function render(parted, mount, df) {
		ui.showModal(_(`${path} 分区管理`), [
			E('style', ['.modal{max-width: 1000px;padding:.5em;}h4 {text-align:center;padding:9px;background-color: #f0f0f0;color:red;}']),
			E('h6', {}, _('设备信息')),
			disktable(parted, smart),
			E('h6', {}, _('分区信息')),
			E('div', { id: 'part-table-container' }, musttable(parted, mount, df)),
			E('div', { style: 'display: flex; justify-content: space-around; gap: 0.5em;' }, [
				E('button', { class: 'btn cbi-button', click: ui.hideModal }, _('取消'))
			])
		]);
	};

	Promise.all([
		fs.exec_direct('/usr/libexec/diskman', ['df']).catch(() => '[]'),
		fs.exec_direct('/usr/libexec/diskman', ['mount_info']).catch(() => '[]'),
		fs.exec_direct('/usr/libexec/diskman', ['parted', path]).catch(() => 'null')
	]).then(res => {
		let df = JSON.parse(res[0]);
		let mount = JSON.parse(res[1]);
		let parted = JSON.parse(res[2]) || null;

		const hasParted = Array.isArray(parted) && parted.length > 0;

		if (hasParted) {
			render(parted, mount, df);
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
			render(derived, mountFromDev, dfFromDevList, diskObj);
			return;
		}
	});
};

function disk_info() {
	// const m = _diskCache.mounted;

	// if (_diskCache.isFresh(m.timestamp, m.expire)) {
	// 	return createMountedTable(m.df, m.mount);
	// }

	return Promise.all([
		fs.exec_direct('/usr/libexec/diskman', ['df']),
		fs.exec_direct('/usr/libexec/diskman', ['mount_info'])
	]).then(([dfOut, mountOut]) => {
		const df = JSON.parse(dfOut);
		const mount = JSON.parse(mountOut);
		// _diskCache.mounted = { df, mount, timestamp: Date.now(), expire: m.expire };

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
		}, E('em', _('No disks found')));

		const rows = df
			.map(item => {
				const m = getMount(item.Filesystem, item.Mounted);
				const isMounted = !!item.Mounted && item.Mounted !== '/';
				let actionBtn;

				if (isMounted) {
					if (!['/overlay', '/tmp', '/', '/rom', '/dev'].includes(item.Mounted)) {
						actionBtn = E('button', {
							class: 'btn cbi-button cbi-button-remove',
							click: ui.createHandlerFn(this, () => {
								ui.showModal('', [
									E('p', {}, _('确认卸载 %s ？').format(item.Mounted)),
									E('div', { class: 'button-row' }, [
										E('button', {
											class: 'btn cbi-button cbi-button-danger important',
											click: ui.createHandlerFn(this, () => umount(item.Mounted))
										}, _('确认')),
										E('button', { class: 'btn cbi-button', click: ui.hideModal }, _('取消'))
									])
								]);
							})
						}, _('Unmount'));
					};
				} else if (m?.filesystem && m.filesystem !== 'squashfs' && m.filesystem !== 'overlay') {
					actionBtn = E('button', {
						class: 'btn cbi-button cbi-button-positive',
						style: 'min-width:60px;',
						click: ui.createHandlerFn(this, () => {
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
											if (!mp) return modalnotify(null, E('p', '请输入挂载点'), 'warning');
											mount_dev(item.Filesystem, mp)
										}
									}, _('确认挂载')),
									E('button', { class: 'btn cbi-button', click: ui.hideModal }, _('取消'))
								])
							]);
						})
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
			});
		table.update(rows);
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
			const hasSMART = smart && !smart.nosmart && !smart.error && smart.smart_status !== undefined;
			const health = hasSMART ? (smart.smart_status.passed ? '正常' : '警告') : (smart?.error ? 'SMART错误' : '不支持');
			const healthColor = { 正常: '#8bc34a', 警告: '#ff9800', SMART错误: '#f44336' }[health] || '#9e9e9e';
			const healthElement = E('span', {
				style: `background:${healthColor};color:#fff;padding:2px 6px;border-radius:3px;font-size:12px;`
			}, health);

			const ejectButton = E('button', {
				class: 'cbi-button cbi-button-remove',
				click: ui.createHandlerFn(this, () => {
					return fs.exec('/usr/libexec/diskman', ['reject', JSON.stringify(dev)])
						.then(r => {
							const sign = r.stdout || '';
							if (sign.includes('错误')) {
								ui.addTimeLimitedNotification(null, E('p', _(sign)), 8000, 'error');
							} else if (sign.includes('安全弹出')) {
								ui.addTimeLimitedNotification(null, E('p', _(sign)), 3000, 'info');
							}
						});
				})
			}, _('Eject'));

			const editButton = E('button', {
				class: 'btn cbi-button cbi-button-edit',
				click: ui.createHandlerFn(this, () => editdev(dev, smart))
			}, _('Edit'));

			tableData.push([
				[dev.path, E('span', dev.path)],
				`${dev.model.trim()} ${dev.vendor.trim()}` || '未知',
				smart.serial_number || '-',
				dev.size || '-',
				tableTypeMap[dev.pttype] || tableTypeMap[ptable],
				interfaceMap[dev.tran] || dev.tran || '-',
				hasSMART ? getTemperature(smart) : '-',
				hasSMART ? getInterfaceSpeed(smart) : '-',
				healthElement,
				hasSMART ? (smart.rotation_rate || '-') : '-',
				hasSMART ? (smart.power_on_time?.hours || smart.nvme_smart_health_information_log?.power_on_hours || '-') : '-',
				hasSMART ? (smart.power_cycle_count || smart.nvme_smart_health_information_log?.power_cycles || '-') : '-',
				ejectButton, editButton
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
						.join(' ') || ' ';

					return E('div', {
						title: txt,
						style: `display:inline-block;width:${Math.max(final, 1)}%;height:16px;background:${COLORS[j % 5]};font-size:12px;text-align:center;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;`
					}, txt);
				}));

			partitionBars.push({ path: dev.path, bar: barWrapper });
		});

		const table = new L.ui.Table([
			_('Path'), _('Model'), _('Serial Number'),
			_('Size'), _('Partition Table'), _('Interface'),
			_('Temp'), _('SATA Version'), _('Health'),
			_('Rotation Rate'), _('Hours'), _('Cycles'),
			'', ''],
			{
				id: 'diskman-table',
				sortable: true,
				classes: ['cbi-section-table']
			}, E('em', _('No disks found'))
		);

		table.update(tableData);
		const tableElement = table.render();

		function insertPartitionRows() {
			const tbody = tableElement.querySelector('tbody') || tableElement;
			if (!tbody) return;

			const old = tbody.querySelectorAll('tr.disk-part-row');
			for (const r of old) r.remove();

			const rows = Array.from(tbody.querySelectorAll('tr.tr:not(.table-titles)'));
			if (!rows.length) return;

			const colCount = rows[0].children.length || 12;

			const tdStyle = {
				maxWidth: '100px',
				overflow: 'hidden',
				whiteSpace: 'nowrap',
				textOverflow: 'ellipsis'
			};

			for (const row of rows) {
				for (const cell of row.children) {
					const txt = (cell.textContent ?? '').trim();
					if (txt.length > 10) cell.title = txt;
					Object.assign(cell.style, tdStyle);
				}
			}

			for (const { path, bar } of partitionBars) {
				const td = tbody.querySelector(`td[data-value="${path}"]`);
				const targetRow = td?.closest('tr.tr');

				if (!targetRow) continue;

				const tr = E('tr', { class: 'disk-part-row' },
					E('td', { colspan: colCount }, bar)
				);

				targetRow.after(tr);
			}
		}

		insertPartitionRows();

		let debounceTimer = null;
		const tbody = tableElement.querySelector('tbody') || tableElement;
		if (tbody) {
			const mo = new MutationObserver(() => {
				if (debounceTimer) clearTimeout(debounceTimer);
				debounceTimer = setTimeout(() => {
					insertPartitionRows();
					debounceTimer = null;
				}, 30);
			});

			mo.observe(tbody, { childList: true, subtree: false });
		}

		const editContainer = E('div');
		disk_info().then(t => {
			editContainer.appendChild(t);
		});

		return E([], [
			E('h2', {}, _('DiskMan')),
			E('div', { class: 'cbi-map-descr' }, _('Manage Disks over LuCI.')),
			E('p', {
				class: 'cbi-button cbi-button-add',
				click: ui.createHandlerFn(this, () =>
					fs.exec('/usr/libexec/diskman', ['rescandisks'])
						.then(r => r.code === 0 && location.reload()))
			}, _('Rescan Disks')),
			E('h3', {}, _('Disks')),
			E('div', { id: 'diskman-container' }, tableElement),
			E('h3', {}, _('Mount Point')),
			E('div', { id: 'diskman-editContainer' }, editContainer),
		]);
	},

	handleSave: null,
	handleReset: null,
	handleSaveApply: null
});
