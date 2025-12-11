'use strict';
'require fs';
'require ui';
'require dom';
'require view';
'require form';

// const start_sec = "100s";
// let end_sec = '+1g';

// const match = end_sec.match(/^\+?(\d*)([bkmgts])$/i);
// if (match) {
// 	const [, size, unitChar] = match;
// 	const unit = {
// 		B: 1, S: 512, K: 1024, M: 1048576,
// 		G: 1073741824, T: 1099511627776
// 	};

// 	const startValue = parseInt(start_sec) || 0;
// 	const unitKey = unitChar.toUpperCase();

// 	if (size && unit[unitKey]) {
// 		end_sec = `${(parseInt(size) * unit[unitKey] / unit.S + startValue - 1)}s`;
// 	}
// }

// console.log(end_sec);

const tableTypeMap = { gpt: 'GPT', msdos: 'MBR', dos: 'MBR', iso9660: 'ISO' };
const interfaceMap = { sata: 'SATA', nvme: 'NVMe', usb: 'USB', scsi: 'SCSI', ata: 'ATA', sas: 'SAS' };
const availableFS = {
	ext4: { cmd: "/usr/sbin/mkfs.ext4", label: "EXT4", args: ["-F", "-E", "lazy_itable_init=1"], labelFlag: "-L" },
	ext2: { cmd: "/usr/sbin/mkfs.ext2", label: "EXT2", args: ["-F", "-E", "lazy_itable_init=1"], labelFlag: "-L" },
	ext3: { cmd: "/usr/sbin/mkfs.ext3", label: "EXT3", args: ["-F", "-E", "lazy_itable_init=1"], labelFlag: "-L" },
	btrfs: { cmd: "/usr/bin/mkfs.btrfs", label: "Btrfs", args: ["-f"], labelFlag: "-L" },
	fat32: { cmd: "/usr/sbin/mkfs.fat", label: "FAT32", args: ["-F", "32"], labelFlag: "-n" },
	exfat: { cmd: "/usr/sbin/mkfs.exfat", label: "exFAT", args: [], labelFlag: "-n" },
	mkswap: { cmd: "/sbin/mkswap", label: "Mkswap", args: [], labelFlag: null }
};

function modalnotify(title, children, timeout, ...classes) {
	const msg = E('div', {
		'class': 'alert-message fade-in',
		'style': 'display:flex',
		'transitionend': function (ev) {
			const node = ev.currentTarget;
			if (node.parentNode && node.classList.contains('fade-out'))
				node.parentNode.removeChild(node);
		}
	}, [
		E('div', { 'style': 'flex:10' }),
		E('div', { 'style': 'flex:1 1 auto; display:flex' }, [
			E('button', {
				'class': 'btn',
				'style': 'margin-left:auto; margin-top:auto',
				'click': function (ev) {
					dom.parent(ev.target, '.alert-message').classList.add('fade-out');
				},

			}, [_('Dismiss')])
		])
	]);

	if (title != null)
		dom.append(msg.firstElementChild, E('h4', {}, title));

	dom.append(msg.firstElementChild, children);
	msg.classList.add(...classes);

	const overlay = document.getElementById('modal_overlay');
	if (overlay && getComputedStyle(overlay).visibility !== 'hidden') {
		overlay.firstElementChild?.prepend(msg);
	} else {
		const mc = document.querySelector('#maincontent') ?? document.body;
		mc.insertBefore(msg, mc.firstElementChild);
	}

	function fadeOutNotification(element) {
		if (element) {
			element.classList.add('fade-out');
			element.classList.remove('fade-in');
			setTimeout(() => {
				if (element.parentNode) {
					element.parentNode.removeChild(element);
				}
			});
		}
	}

	if (typeof timeout === 'number' && timeout > 0) {
		setTimeout(() => fadeOutNotification(msg), timeout);
	}
	return msg;
};

function mount_dev(dev) {
	ui.showModal(_(`挂载 ${dev}`), [
		E('style', ['h4 {text-align:center;color:red;}']),
		E('div', { style: 'display:flex;align-items:center;gap:10px;' }, [
			E('label', { style: 'min-width:150px;' }, _('挂载点：')),
			E('input', { type: 'text', id: 'mount-point-input', style: 'flex:1;padding:6px;' })
		]),
		E('div', { style: 'display:flex;align-items:center;gap:10px;' }, [
			E('label', { style: 'min-width:150px;' }, _('挂载选项：')),
			E('input', { type: 'text', id: 'mount-opts-input', style: 'flex:2;padding:6px;', placeholder: _('留空自动挂载') })
		]),
		E('div', { class: 'button-row' }, [
			E('button', { class: 'btn', click: ui.hideModal }, _('取消')),
			E('button', {
				class: 'btn cbi-button-positive important',
				click: ui.createHandlerFn(this, () => {
					const mp = document.getElementById('mount-point-input').value.trim();
					if (!mp) return modalnotify(null, E('p', _('请输入挂载点')), 4000, 'warning');
					const opts = document.getElementById('mount-opts-input').value.trim();

					let mountArgs = [dev, mp];
					if (opts) mountArgs = ['-o', opts, dev, mp];

					return fs.exec_direct('/bin/mkdir', ['-p', mp])
						.then(() => fs.exec_direct('/bin/mount', mountArgs))
						.then(() => {
							modalnotify(null, E('p', _('%s 已挂载到 %s').format(dev, mp)), 2000, 'success');
							setTimeout(() => location.reload(), 2000);
						})
						.catch(e => {
							const errMsg = (e.message || String(e)).trim() || _('未知错误');
							modalnotify(null, E('p', _('挂载失败：%s').format(errMsg)), 4000, 'error');
						});
				})
			}, _('nmount'))
		])
	]);
};

function umount_dev(target, silent = false) {
	return fs.exec('/bin/umount', [target])
		.then(() => {
			if (!silent) {
				modalnotify(null, E('p', _('%s 卸载成功').format(target)), 3000, 'success');
				setTimeout(() => location.reload(), 3000);
			}
		})
		.catch(e => {
			if (!silent) {
				modalnotify(null, E('p', _('卸载失败：%s').format(e.message || e)), 8000, 'error');
			}
			throw e;
		});
};

function getInterfaceSpeed(smartData) {
	let speeds = [];
	if (smartData.sata_version?.string) speeds.push(smartData.sata_version.string);

	if (smartData.interface_speed?.max?.string) {
		speeds.push(('Max: %s').format(smartData.interface_speed.max.string));
	};
	if (smartData.interface_speed?.current?.string) {
		speeds.push(('Current: %s').format(smartData.interface_speed.current.string));
	};

	if (smartData.nvme_pci_vendor?.id) speeds.push('NVMe');

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

function editdev(lsblk, smart, df, jsonsfdisk = null) {
	const path = lsblk.path;
	function disktable(parted, smart) {
		if (!parted || !parted || !parted.disk) {
			return E('em', _('无磁盘信息'));
		};

		const disk = parted.disk;
		const sectors = parseInt(disk.total_sectors) || 0;
		const health = !smart.nosmart
			? (smart.smart_status.passed ? '正常' : '警告')
			: (smart?.error ? 'SMART错误' : '不支持');

		const p_table = lsblk.children?.some(c => c.mountpoints?.length > 0)
			? _(tableTypeMap[disk.partition_table] || disk.partition_table)
			: E('select', {
				change: ui.createHandlerFn(this, (ev) => {
					const value = ev.target.value;
					if (!value) return;
					ui.showModal(_('警告！！'), [
						E('style', ['h4 {text-align:center;color:red;}']),
						E('p', { style: 'text-align:center;margin:15px 0;color:red;' },
							_('此操作会覆盖现有分区，确定修改 %s 分区表为 %s？').format(disk.device, tableTypeMap[value] || value)
						),
						E('div', { class: 'button-row' }, [
							E('button', { class: 'btn', click: ui.hideModal }, _('取消')),
							E('button', {
								class: 'btn cbi-button-positive important',
								click: ui.createHandlerFn(this, () => {
									return fs.exec_direct('/sbin/parted', ['-s', disk.device, 'mklabel', value])
										.then(() => {
											setTimeout(() => location.reload(), 500);
										})
										.catch(err =>
											modalnotify(null, E('p', [_('操作失败：'), E('br'), err.message || String(err)]), 'error')
										);
								})
							}, _('确定'))
						])
					]);
				})
			},
				['msdos', 'gpt'].map(c => E('option', {
					value: c, selected: c === disk.partition_table ? '' : null
				}, _(tableTypeMap[c] || c))
				)
			);

		const table = new L.ui.Table([
			_('路径'), _('型号'), _('序号'), _('大小'), _('扇区大小'),
			_('分区表'), _('温度'), _('转速'), _('状态')
		],
			{ sortable: true, classes: 'cbi-section-table' },
			E('em', _('No disks found'))
		);

		table.update([[
			disk.device || '-',
			smart.model_name || disk.model || '-',
			smart.serial_number || '-',
			disk.size || byteFormat(sectors * 512),
			`${disk.sector_size.logical}B/${disk.sector_size.physical}B`,
			p_table,
			getTemperature(smart), getInterfaceSpeed(smart), health
		]]);

		return table.render();
	};

	function sfdiskToParted(sfdisk) {
		return fs.exec_direct('/usr/libexec/diskman', ['lsfdisk', path])
			.then(JSON.parse)
			.then(result => {
				if (sfdisk.free_space) {
					result.partitions.push({
						type: '',
						flags: '',
						fileSystem: '',
						number: null,
						end: String(sfdisk.free_space.end),
						Size: String(sfdisk.free_space.Size),
						start: String(sfdisk.free_space.start),
						size: String(sfdisk.free_space.sectors)
					});
					result.disk.sector_size.logical = sfdisk.free_space.logical;
					result.disk.sector_size.physical = sfdisk.free_space.physical;
				};

				return result;
			})
			.catch(() => {});
	};

	function onreset(partedjson) {
		const diskInfo = partedjson.disk || null;
		const diskPath = diskInfo.device;
		const partsInfo = partedjson.partitions || {};
		const SECTOR_SIZE = (diskInfo.sector_size && diskInfo.sector_size.logical) ? parseInt(diskInfo.sector_size.logical) : 512;
		const ALIGN_MI = 4; // 4 MiB 对齐
		const ALIGN_SECTORS = Math.ceil((ALIGN_MI * 1024 * 1024) / SECTOR_SIZE); // 4MiB对齐的扇区数
		const sleep = ms => new Promise(r => setTimeout(r, ms));
		const partedcmd = args => fs.exec_direct('/sbin/parted', ['-s', diskPath, ...args]);
		const partprobe = () => fs.exec_direct('/sbin/partprobe', [diskPath]).catch(() => {});
		const lsblkParts = () => fs.exec_direct('/usr/bin/lsblk', ['-rno', 'NAME', diskPath])
			.then(out => {
				const base = diskPath.replace(/^\/dev\//, '');
				return out.trim().split('\n')
					.filter(name => name.startsWith(base) && name.length > base.length)
					.map(name => `/dev/${name}`);
			});
		const calculateDiskSpace = () => {
			const totalSectors = parseIntSafe(diskInfo.total_sectors) || 0;
			const usedSectors = partsInfo
				.filter(p => p.number != null && p.size != null)
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

		const sectorsToMiB = (sectors) => Math.floor((parseInt(sectors || 0) * SECTOR_SIZE) / 1024 / 1024);
		const miBToSectors = (miB) => Math.ceil((parseFloat(miB || 0) * 1024 * 1024) / SECTOR_SIZE);
		const parseIntSafe = v => (v === null || v === undefined) ? 0 : parseInt(v);
		const { totalMiB, freeMiB } = calculateDiskSpace();

		const alignSectors = (sectors, forceAlign = true) => {
			const n = Math.max(0, parseIntSafe(sectors));
			if (!forceAlign && n < ALIGN_SECTORS) {
				return n;
			}
			return Math.floor(n / ALIGN_SECTORS) * ALIGN_SECTORS;
		};

		const alignMiB = (v) => {
			const n = Math.max(0, Math.floor(parseIntSafe(v) || 0));
			return Math.floor(n / ALIGN_MI) * ALIGN_MI;
		};

		const getTotalFreeSectors = () => {
			let total = 0;
			for (const p of partsInfo) {
				if (p.fileSystem === 'Free Space') {
					total += parseIntSafe(p.size) || 0;
				}
			}
			return total;
		};

		const findLargestFreeSpace = () => {
			let largest = null;
			for (const p of partsInfo) {
				if (p.fileSystem === 'Free Space') {
					const size = parseIntSafe(p.size) || 0;
					if (!largest || size > (parseIntSafe(largest.size) || 0)) {
						largest = p;
					}
				}
			}
			return largest;
		};

		const findUsableFreeSpace = (minSizeMiB = 10) => {
			const minSectors = miBToSectors(minSizeMiB);
			let best = null;

			for (const p of partsInfo) {
				if (p.fileSystem === 'Free Space') {
					const size = parseIntSafe(p.size) || 0;
					if (size >= minSectors) {
						if (!best || size > (parseIntSafe(best.size) || 0)) {
							best = p;
						}
					}
				}
			}
			return best;
		};

		if (freeMiB < 10) return modalnotify(null, E('p', _('磁盘太小')), 'warning');

		const modal = E('div', { style: 'display:flex;flex-direction:column;gap:15px;font-size:14px;max-width:600px;' }, [
			E('div', {
				style: 'background:#fff3cd;border:1px solid #ffeaa7;border-radius:4px;padding:12px;'
			}, [
				E('div', { style: 'color:#856404;font-weight:bold;margin-bottom:5px;' }, _('⚠️ 警告：此操作将擦除磁盘所有数据！')),
				E('div', { style: 'color:#856404;font-size:13px;', id: 'disk-info' },
					`磁盘：${diskPath} | 总空间：${totalMiB.toLocaleString()} MiB | 可用空间：${freeMiB.toLocaleString()} MiB`
				),
			]),
			E('div', { style: 'display:flex;flex-direction:column;gap:12px;' }, [
				E('div', { style: 'display:flex;align-items:center;gap:10px;' }, [
					E('label', { style: 'min-width:80px;font-weight:bold;' }, _('分区表类型：')),
					E('select', { id: 'pt-select', style: 'flex:1;padding:6px;' },
						['msdos', 'gpt'].map(pt =>
							E('option', { value: pt, selected: pt === diskInfo.partition_table ? '' : null },
								_(tableTypeMap[pt]))
						))
				]),
				E('div', { style: 'display:flex;align-items:center;gap:10px;', id: 'fs-div' }, [
					E('label', { style: 'min-width:80px;font-weight:bold;' }, _('文件系统：')),
					E('select', { id: 'fs-select', style: 'flex:1;padding:6px;' },
						Object.keys(availableFS).map(k => E('option', { value: k }, availableFS[k].label))
					)
				]),
				E('div', { style: 'display:flex;align-items:center;gap:10px;' }, [
					E('label', { style: 'min-width:80px;font-weight:bold;' }, _('操作模式：')),
					E('select', { id: 'action-select', style: 'flex:1;padding:6px;' }, [
						E('option', { value: 'single_partition' }, _('创建单个分区并格式化')),
						E('option', { value: 'multi_partition' }, _('多个分区(磁盘扩容)'))
					])
				])
			]),
			E('div', { id: 'multi-partition-container', style: 'display:none;margin-top:10px;border:1px solid #e9ecef;border-radius:4px;padding:15px;background:#f8f9fa;' }, [
				E('div', { style: 'margin-bottom:8px;display:flex;align-items:center;gap:8px;' }, [
					E('input', { id: 'auto-fill-last', type: 'checkbox', checked: true }),
					E('label', { for: 'auto-fill-last', style: 'color:red;font-weight:bold;' }, _('自动填满剩余空间，新建分区默认自动填满（分区大小=0 的分区自动分配空间.）'))
				]),
				E('div', { id: 'remain-info', style: 'font-weight:bold;padding:8px;margin:10px 0;background:white;border-radius:4px;text-align:center;' }),
				E('div', { style: 'display:flex;font-weight:bold;margin-bottom:10px;' }, [
					E('span', { style: 'flex:2;' }, _('分区大小 (MiB)')),
					E('span', { style: 'flex:3;' }, _('文件系统')),
					E('span', { style: 'flex:1;' }, _('操作')),
				]),
				E('div', { id: 'partitions-list' }),
				E('button', { id: 'add-partition-btn', class: 'btn cbi-button-add', style: 'width:100%;' }, _('添加分区')),
			]),
			E('div', { style: 'display:flex;justify-content:flex-end;gap:10px;margin-top:20px;' }, [
				E('button', { id: 'confirm-btn', class: 'btn cbi-button-positive important' }, _('确认执行')),
				E('button', { id: 'cancel-btn', class: 'btn' }, _('取消'))
			])
		]);

		let partitions = [];
		const fsdiv = modal.querySelector('#fs-div');
		const ptSelect = modal.querySelector('#pt-select');
		const fsSelect = modal.querySelector('#fs-select');
		const remainInfo = modal.querySelector('#remain-info');
		const confirmBtn = modal.querySelector('#confirm-btn');
		const addBtn = modal.querySelector('#add-partition-btn');
		const actionSelect = modal.querySelector('#action-select');
		const partitionsList = modal.querySelector('#partitions-list');
		const mpContainer = modal.querySelector('#multi-partition-container');

		const autoFillEnabled = () => modal.querySelector('#auto-fill-last').checked;

		const updateRemain = () => {
			const existingParts = partsInfo.filter(p =>
				p.number != null && (parseIntSafe(p.size) || 0) > 0
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

			const fixedSum = partitions.reduce((s, p) => s + (p.sizeSectors > 0 ? p.sizeSectors : 0), 0);
			let remainSectors = Math.max(0, totalAvailableSectors - fixedSum);

			if (autoFillEnabled()) {
				const zeros = partitions.filter(p => p.sizeSectors === 0);
				if (zeros.length > 0) {
					let remaining = remainSectors;
					for (let i = 0; i < zeros.length - 1; i++) {
						const share = Math.floor(remaining / (zeros.length - i));
						const aligned = alignSectors(share);
						const actual = Math.min(aligned, remaining);
						zeros[i].sizeSectors = actual;
						remaining -= actual;
					}

					if (zeros.length >= 1) {
						const last = zeros[zeros.length - 1];
						last.sizeSectors = Math.max(0, remaining);
						remaining = 0;
					}

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
					min: 0,
					max: totalMiB,
					type: 'number',
					style: 'flex:2;padding:6px;',
					placeholder: '输入数字指定大小',
					value: sizeMiB > 0 ? sizeMiB : '',
					title: '新建默认自动填满 | 输入数字指定大小'
				}),
				E('select', { style: 'flex:3;padding:6px;' },
					Object.keys(availableFS).map(k =>
						E('option', { value: k, selected: k === fs ? '' : null }, availableFS[k].label)
					)),
				E('button', { class: 'btn cbi-button-remove', style: 'flex:1;' }, _('删除'))
			]);

			const [sizeInput, fsSel, delBtn] = row.children;

			const sync = () => {
				const p = partitions.find(x => x.id === id);
				let valMiB = parseInt(sizeInput.value) || 0;
				if (isNaN(valMiB)) valMiB = 0;

				p.sizeSectors = alignSectors(miBToSectors(valMiB));
				sizeInput.value = valMiB;
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

		actionSelect.onchange = () => {
			const mode = actionSelect.value;
			const isMulti = mode === 'multi_partition';
			mpContainer.style.display = isMulti ? 'block' : 'none';
			fsdiv.style.display = (mode === 'single_partition') ? 'flex' : 'none';

			partitions = [];
			partitionsList.innerHTML = '';
			addBtn.disabled = false;

			if (!isMulti) return;

			const existingParts = partsInfo.filter(p => p.number != null && (parseIntSafe(p.size) || 0) > 0);

			const hasExistingParts = existingParts.length > 0;
			const totalFreeMiB = sectorsToMiB(getTotalFreeSectors());
			const totalDiskMiB = sectorsToMiB(parseIntSafe(diskInfo.total_sectors));
			if (hasExistingParts && totalFreeMiB > 10) {
				const largestFree = findLargestFreeSpace();
				if (largestFree) {
					const freeMiB = sectorsToMiB(parseIntSafe(largestFree.size));

					for (const p of existingParts) {
						const sizeMiB = sectorsToMiB(parseIntSafe(p.size));
						const row = E('div', {
							'data-id': ('existing-').format(p.number),
							style: 'display:flex;align-items:center;gap:8px;margin:8px 0;padding:8px;background:#e9ecef;border-radius:4px;color:#6c757d;'
						}, [
							E('input', {
								type: 'number',
								value: sizeMiB,
								disabled: true,
								style: 'width:160px;padding:6px;background:#f8f9fa;'
							}),
							E('select', {
								disabled: true,
								style: 'width:240px;padding:6px;background:#f8f9fa;'
							}, [E('option', p.fileSystem || 'ext4')]),
							E('span', { style: 'text-align:center;' }, _('现有分区'))
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

		ui.showModal(_('磁盘分区'), modal);
		modal.querySelector('#cancel-btn').onclick = ui.hideModal;

		// 确认按钮点击执行逻辑
		confirmBtn.onclick = async () => {
			const mode = actionSelect.value;
			const fsType = fsSelect.value;

			// 场景判断
			const existingParts = partsInfo.filter(p =>
				p.number != null && (parseIntSafe(p.size) || 0) > 0
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
				const partType = ptSelect.value === 'msdos' ? 'primary' : '';
				if (mode === 'single_partition') {
					await partedcmd(['mklabel', ptSelect.value]);
					await sleep(1000);
					await partedcmd(['mkpart', 'primary', '0%', '100%'].filter(Boolean));
					await sleep(1000);
					await partprobe();
					await sleep(1000);

					const parts = await lsblkParts();
					newPartDevices = parts.length ? [parts[0]] : [];
				} else {
					if (isResizeMode) {
						const largestFree = findUsableFreeSpace(10);
						if (!largestFree) {
							throw new Error(_('未找到足够大的空闲空间用于扩容'));
						}

						let start = parseIntSafe(largestFree.start);
						const usableEnd = parseIntSafe(largestFree.end);

						if (start > usableEnd) {
							throw new Error(_('空闲区域无效'));
						}

						const todo = partitions.filter(p => !p.id?.startsWith('existing-'));
						if (todo.length === 0) return;

						if (todo.length === 1 && (!todo[0].sizeSectors || todo[0].sizeSectors <= 0) && autoFillEnabled()) {
							const fsType = todo[0].fs || 'ext4';
							await partedcmd(['mkpart', partType, fsType, `${start}s`, `${usableEnd}s`].filter(Boolean));
						} else {
							for (let i = 0; i < todo.length; i++) {
								const p = todo[i];
								let wantSectors = parseIntSafe(p.sizeSectors);

								if ((!wantSectors || wantSectors <= 0) && autoFillEnabled()) {
									const remaining = usableEnd - start + 1;
									if (remaining <= 0) break;
									wantSectors = Math.floor(remaining / (todo.length - i));
								}

								if (!wantSectors || wantSectors <= 0) continue;

								let end;

								const isLastAndAutoFill = (i === todo.length - 1)
									&& autoFillEnabled()
									&& (!parseIntSafe(p.sizeSectors) || parseIntSafe(p.sizeSectors) <= 0);

								if (isLastAndAutoFill) {
									const remainingSectors = usableEnd - start + 1;
									if (remainingSectors <= 0) continue;
									end = usableEnd;
								} else {
									const alignedSize = alignSectors(wantSectors, true);
									if (alignedSize <= 0) continue;
									end = start + alignedSize - 1;
									if (end > usableEnd) {
										end = usableEnd;
									}
								}

								await partedcmd(['mkpart', partType, p.fs || 'ext4', `${start}s`, `${end}s`].filter(Boolean));

								await sleep(600);
								start = end + 1;
								if (start > usableEnd) break;
							}
						}

						await partprobe();
						await sleep(1000);

						const before = new Set(
							partsInfo
								.filter(p => p.number != null)
								.map(p => `${diskPath}${p.number}`)
						);
						const after = new Set(await lsblkParts());
						newPartDevices = sortPartitionDevices([...after].filter(dev => !before.has(dev)));
					} else {
						await partedcmd(['mklabel', ptSelect.value]);
						await sleep(1000);

						const totalDiskSectors = parseIntSafe(diskInfo.total_sectors) || 0;
						const tailReserved = (ptSelect.value === 'gpt') ? 34 : 0;
						const maxEnd = totalDiskSectors - 1 - tailReserved;
						let currentStart = 2048; // 起始对齐点

						const todo = partitions; // 包含 size=0 的 auto-fill 分区
						const autoFillParts = todo.filter(p => (p.sizeSectors || 0) <= 0);
						const fixedParts = todo.filter(p => (p.sizeSectors || 0) > 0);

						// 先处理固定大小分区（对齐）
						for (const p of fixedParts) {
							if (currentStart >= maxEnd) break;
							const alignedSize = alignSectors(p.sizeSectors, true); // 强制对齐
							const endSector = Math.min(currentStart + alignedSize - 1, maxEnd);
							if (endSector <= currentStart) break;

							await partedcmd(['mkpart', partType, p.fs || 'ext4', `${currentStart}s`, `${endSector}s`
							].filter(Boolean));
							await sleep(600);
							currentStart = endSector + 1;
						}

						if (autoFillEnabled() && autoFillParts.length > 0 && currentStart < maxEnd) {
							if (autoFillParts.length === 1) {
								// 单个 auto-fill：直接吃到底
								await partedcmd(['mkpart', partType, autoFillParts[0].fs || 'ext4', `${currentStart}s`, `${maxEnd}s`].filter(Boolean));
							} else {
								// 多个 auto-fill：前 N-1 个对齐分配，最后一个吃剩余
								let remaining = maxEnd - currentStart + 1;
								for (let i = 0; i < autoFillParts.length; i++) {
									const p = autoFillParts[i];
									let partEnd;
									if (i === autoFillParts.length - 1) {
										// 最后一个：吃掉所有剩余，不对齐
										partEnd = maxEnd;
									} else {
										// 前面的：按比例分配 + 对齐
										const share = Math.floor(remaining / (autoFillParts.length - i));
										const aligned = alignSectors(share, true);
										const actual = Math.min(aligned, remaining);
										partEnd = currentStart + actual - 1;
										remaining -= actual;
									}
									if (currentStart > partEnd) break;

									await partedcmd(['mkpart', partType, p.fs || 'ext4', `${currentStart}s`, `${partEnd}s`].filter(Boolean));
									await sleep(600);
									currentStart = partEnd + 1;
									if (i < autoFillParts.length - 1) {
										remaining = maxEnd - currentStart + 1;
									}
								}
							}
						}

						await partprobe();
						await sleep(1000);
						newPartDevices = sortPartitionDevices(await lsblkParts());
					}
				}

				for (let i = 0; i < newPartDevices.length; i++) {
					const dev = newPartDevices[i];
					const targetFS = mode === 'single_partition'
						? fsType
						: (partitions[i]?.fs || 'ext4');

					const fsTool = availableFS[targetFS] || availableFS.ext4;
					if (!fsTool) continue;

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

	function deletePartitions(disk, numbers) {
		if (!disk?.startsWith('/dev/')) {
			modalnotify(null, E('p', '无效的磁盘设备'), 5000, 'error');
			return Promise.reject();
		};

		const parts = [numbers].flat().map(String).filter(n => /^\d+$/.test(n));
		if (!parts.length) {
			modalnotify(null, E('p', '未指定有效分区号'), 5000, 'error');
			return Promise.reject();
		};
		const devs = parts.map(n => disk + n);

		return Promise.all(devs.map(d => umount_dev(d, true)))
			.then(() => fs.exec_direct('/usr/sbin/sfdisk', ['--delete', disk, ...parts]))
			.then(() => fs.exec_direct('/sbin/partprobe', [disk]))
			.then(() => {
				modalnotify(null, E('p', '分区删除成功'), '', 'success');
				setTimeout(() => location.reload(), 2000);
			})
			.catch(err => {
				modalnotify(null, E('p', '操作失败：' + (err.message || String(err))), 8000, 'error');
				return Promise.reject(err);
			});
	};

	function musttable(parted, df, onSelectionChange) {
		const dfMap = {};
		(df || []).forEach(i => {
			if (i.Filesystem && i.Filesystem.startsWith(path)) {
				dfMap[i.Filesystem] = {
					used: i.Used || '-',
					avail: i.Available || '-',
					percent: i['Use%'] || '-'
				};
			}
		});

		const lsblkMap = {};
		lsblk.children?.forEach(i => {
			if (i.path && i.path.startsWith(path)) {
				lsblkMap[i.path] = {
					path: i.path,
					size: i.size,
					type: i.fstype,
					fstype: i.fstype,
					percent: i['fsuse%'] || '-',
					mountpoints: i.mountpoints || '-',
				};
			}
		});

		const rows = parted.partitions?.map(entry => {
			const bytes = (parseInt(entry.size) || 0) * 512;
			let fullDev = entry.number ? `${path}${entry.number}` : null;
			const lsblkEntry = fullDev ? lsblkMap[fullDev] : null;
			let mountPoints = lsblkEntry
				? lsblkEntry.mountpoints.join('<br>')
				: '-';

			let action = E('span', { style: 'display: inline-flex; align-items: center; justify-content: center;' });
			entry.fileSystem = lsblkEntry?.fstype || entry.fileSystem || null;
			let fsCell = entry.fileSystem || '-';
			const isPrimary = entry.fileSystem === 'primary';

			if (entry.number && fullDev) {
				fsCell = E('button', {
					title: isPrimary ? _('格式化 %s').format(fullDev) : _('修改 %s 文件系统').format(fsCell),
					class: isPrimary ? 'btn cbi-button-remove' : 'btn cbi-button-positive',
					click: ui.createHandlerFn(this, () => {
						let label = '';
						ui.showModal(_('格式化 %s').format(fullDev), [
							E('style', ['h4 {text-align:center;color:red;}']),
							E('p', { style: 'margin:15px 0;color:red;' },
								_('确定要格式化 %s 吗？所有数据将被清除！').format(fullDev)
							),
							E('div', { style: 'display:flex;align-items:center;gap:10px;' }, [
								E('label', { style: 'min-width:150px;' }, _('文件系统：')),
								E('select', { id: 'fs-select', style: 'flex:1;padding:6px;' },
									Object.keys(availableFS).map(k =>
										E('option', { value: k, selected: k === entry.fileSystem ? '' : null }, availableFS[k].label))
								)
							]),
							E('div', { style: 'display:flex;align-items:center;gap:10px;' }, [
								E('label', { style: 'min-width:150px;' }, _('分区标签（可选）：')),
								E('input', {
									type: 'text', style: 'flex:2;padding:6px;',
									blur: ui.createHandlerFn(this, (ev) => label = ev.target.value.trim())
								})
							]),
							E('div', { class: 'button-row' }, [
								E('button', { class: 'btn', click: ui.hideModal }, _('取消')),
								E('button', {
									class: 'btn cbi-button-positive important',
									click: ui.createHandlerFn(this, () => {
										const fstype = document.getElementById('fs-select').value;
										if (entry.fileSystem === fstype)
											return modalnotify(null, E('p', _('文件系统相同')), 8000, 'error')

										const fsTool = availableFS[fstype] || availableFS.ext4;
										let finalArgs = [...fsTool.args];
										if (label) {
											if (fstype === 'fat32' || fstype === 'exfat') {
												label = label.replace(/[^a-zA-Z0-9 _\-]/g, '').substring(0, 11).trim();
												if (!label) {
													return modalnotify(null, E('p', _('分区标签格式非法')), 8000, 'error');
												}
											}
											finalArgs.push(fsTool.labelFlag, label);
										};

										finalArgs.push(fullDev);
										return umount_dev(fullDev, true)
											.then(() => fs.exec_direct(fsTool.cmd, finalArgs)
												.then(() => {
													modalnotify(null, E('p', '格式化完成'), '', 'success');
													setTimeout(() => location.reload(), 2000);
												})
												.catch((err) => modalnotify(null, E('p', _('格式化失败： %s').format(err)), 8000, 'error'))
											)
									})
								}, _('格式化'))
							])
						]);
					})
				}, _(isPrimary ? '格式化' : (tableTypeMap[fsCell] || fsCell)));

				if (mountPoints === '' && entry.fileSystem !== 'primary')
					mountPoints = E('button', {
						class: 'btn cbi-button-positive important',
						click: ui.createHandlerFn(this, () => mount_dev(fullDev))
					}, _('挂载'));

				let singleDeleteButton = E('button', {
					class: 'btn cbi-button-remove',
					click: ui.createHandlerFn(this, () => {
						ui.showModal(_('删除 %s 分区').format(fullDev), [
							E('style', ['h4 {text-align:center;color:red;}']),
							E('p', { style: 'text-align:center;color:red;' }, _(`确定要删除分区 ${fullDev} 吗？此操作将永久丢失数据！`)),
							E('div', { class: 'button-row' }, [
								E('button', { class: 'btn', click: ui.hideModal }, _('取消')),
								E('button', {
									class: 'btn cbi-button-remove important',
									click: ui.createHandlerFn(this, () => deletePartitions(path, [entry.number]))
								}, _('确认删除')),
							])
						]);
					})
				}, _('移除'));

				let partitionCheckbox = E('input', {
					type: 'checkbox',
					'data-partition': entry.number,
					style: 'margin-left: 10px; transform: scale(1.2);'
				});

				partitionCheckbox.addEventListener('change', function () {
					if (onSelectionChange) {
						onSelectionChange(entry.number, this.checked);
					}
				});
				action.appendChild(singleDeleteButton);
				action.appendChild(partitionCheckbox);
			} else {
				if (entry.fileSystem === 'Free Space' && entry.size > 2048)
					action.appendChild(E('button', {
						class: 'btn cbi-button-positive',
						click: ui.createHandlerFn(this, () => onreset(parted))
					}, _('新建')));
			};

			const u = fullDev && dfMap[fullDev] ? dfMap[fullDev] : { used: null, avail: null, percent: '-' };

			return [
				fullDev || '-',
				entry.start === 0 ? String(entry.start) : entry.start || '-',
				entry.end || '-',
				lsblkEntry?.size || entry.Size || byteFormat(bytes),
				entry.type || '-',
				fsCell,
				u.used && u.avail ? `${u.used}/${u.avail}` : '-',
				lsblkEntry?.percent || u.percent,
				mountPoints,
				action
			];
		});

		const table = new L.ui.Table([
			_('设备'), _('起始扇区'), _('结束扇区'), _('大小'), _('类型'),
			_('文件系统'), _('已用/空闲'), _('用量'), _('挂载点'), _('操作')
		],
			{ sortable: true, classes: 'cbi-section-table' },
			E('em', _('No disks found'))
		);

		table.update(rows);
		return table.render();
	};

	function dskirender(parted, df) {
		const selected = new Set();
		const diskDevice = parted.disk.device;
		const hasPartitions = parted.partitions.some(p => p.number != null);

		const updateBtn = () => {
			const btn = document.getElementById('batch-delete-btn');
			if (!btn) return;

			const count = selected.size;
			btn.disabled = !count;
			btn.classList.toggle('cbi-button-disabled', !count);
			btn.textContent = count ? _('批量删除 %s').format(count) : _('批量删除');
		};

		const onSelectionChange = (num, isSelected) => {
			isSelected ? selected.add(num + '') : selected.delete(num + '');
			updateBtn();
		};

		const handleBatchDelete = () => {
			if (!selected.size)
				return modalnotify(null, E('p', _('请先选择要删除的分区')), 4000, 'warning');

			deletePartitions(diskDevice, Array.from(selected));
		};

		ui.showModal(_(`${path} 分区管理`), [
			E('style', ['.modal{max-width:1000px;padding:.5em;} h4{text-align:center;padding:9px;background:#f0f0f0;color:red;}']),
			E('h5', _('设备信息')),
			disktable(parted, smart),
			E('h5', _('分区信息')),
			musttable(parted, df, onSelectionChange),
			E('div', { style: 'display:flex;justify-content:space-around;gap:0.5em;' }, [
				hasPartitions
					? E('button', {
						disabled: true, id: 'batch-delete-btn',
						class: 'btn cbi-button-remove',
						click: ui.createHandlerFn(this, handleBatchDelete)
					}, _('批量删除'))
					: [],
				E('button', { class: 'btn', click: ui.hideModal }, _('取消'))
			])
		]);

		setTimeout(updateBtn, 300);
	};

	fs.exec_direct('/usr/libexec/diskman', ['parted', path])
		.then(JSON.parse)
		.then(parted => {
			if (parted?.partitions?.length > 0)
				return dskirender(parted, df);

			sfdiskToParted(jsonsfdisk)
				.then(sfdisk => dskirender(sfdisk, df))
		})
		.catch(() => []);
};

return view.extend({
	load: function () {
		return fs.exec_direct('/usr/bin/lsblk', ['-fJo', 'NAME,PATH,TYPE,SIZE,MODEL,TRAN,FSTYPE,VENDOR,ROTA,PTTYPE,MOUNTPOINTS,FSUSE%'])
			.then(JSON.parse)
			.then(res => {
				let disks = (res.blockdevices || []).filter(dev =>
					dev.type === 'disk'
					&& !/^(loop|sr|ram|zram)/.test(dev.name || '')
					&& parseFloat(String(dev.size).replace(/[^\d.]/g, '')) > 0
				);
				let dfPromise, miPromise;

				dfPromise = fs.exec_direct('/usr/libexec/diskman', ['df'])
					.then(JSON.parse)
					.catch(() => []);

				miPromise = fs.exec_direct('/usr/libexec/diskman', ['mount_info'])
					.then(JSON.parse)
					.catch(() => []);

				return Promise.all(disks.map(lsblk => {
					let smartPromise = Promise.resolve({ nosmart: true });
					if (['sata', 'nvme', 'ata', 'scsi'].includes(lsblk.tran)) {
						smartPromise = fs.exec_direct('/usr/sbin/smartctl', ['-ja', lsblk.path])
							.then(JSON.parse)
							.catch(() => []);
					};
					const sfPromise = fs.exec_direct('/usr/libexec/diskman', ['fsfdisk', lsblk.path])
						.then(JSON.parse)
						.catch(() => null)

					return Promise.all([smartPromise, dfPromise, miPromise, sfPromise])
						.then(([smart, df, mount, sfdisk]) => ([lsblk, smart, df, mount, sfdisk]));
				}));
			});
	},

	render: function (res) {
		const MIN_PCT = 7;
		let allMountRows, tableData = [], partitionBars = [];
		const COLORS = ["#f8cb43ff", "#a0e0a0", "#fd9f5bff", "#d1a3ffff", "#a9c5faff"];
		// const COLORS = ["#ffc8dd", "#bde0fe", "#ffafcc", "#a2d2ff", "#cdb4db"];

		const toBytes = s => {
			if (!s || s === '-') return 0;
			const m = s.match(/^([\d.]+)\s*([KMGT]?)[B]?$/i);
			if (!m) return 0;
			const u = { K: 1 << 10, M: 1 << 20, G: 1 << 30, T: 1 << 40 };
			return +m[1] * (u[m[2].toUpperCase()] || 1);
		};

		res.forEach(([lsblk, smart, df, mount, sfdisk], i) => {
			const health = !smart.nosmart
				? (smart.smart_status.passed ? '正常' : '警告')
				: (smart?.error ? 'SMART错误' : '不支持');
			const healthColor = { 正常: '#8bc34a', 警告: '#ff9800', SMART错误: '#f44336' }[health] || '#9e9e9e';
			const healthElement = E('span', {
				style: `background:${healthColor};color:#fff;padding:2px 6px;border-radius:3px;font-size:12px;`
			}, health);
			const children = lsblk.children || [lsblk];
			const editButton = E('button', {
				class: 'btn cbi-button-edit',
				click: ui.createHandlerFn(this, () => editdev(lsblk, smart, df, sfdisk))
			}, _('Edit'));
			const ejectButton = E('button', {
				class: 'btn cbi-button-remove',
				click: ui.createHandlerFn(this, () => {
					return umount_dev(lsblk.path, true)
						.then(() => fs.exec('/usr/libexec/diskman', ['reject', lsblk.name, lsblk.path, lsblk.type]))
						.then(r => {
							const sign = r.stdout || '';
							if (sign.includes('安全弹出')) {
								ui.addTimeLimitedNotification(null, E('p', _(sign)), '', 'info');
								setTimeout(() => location.reload(), 2000);
							} else if (sign.includes('错误')) {
								ui.addTimeLimitedNotification(null, E('p', _(sign)), 8000, 'error');
							}
						});
				})
			}, _('Eject'));

			tableData.push([
				[lsblk.path, E('span', lsblk.path)],
				`${lsblk.model.trim()} ${lsblk.vendor.trim()}` || '-',
				smart.serial_number || '-',
				lsblk.size || '-',
				tableTypeMap[lsblk.pttype] || lsblk.pttype || '-',
				interfaceMap[lsblk.tran] || lsblk.tran || '-',
				getTemperature(smart),
				getInterfaceSpeed(smart),
				healthElement,
				smart.rotation_rate || '-',
				smart.power_on_time?.hours || smart.nvme_smart_health_information_log?.power_on_hours || '-',
				smart.power_cycle_count || smart.nvme_smart_health_information_log?.power_cycles || '-',
				ejectButton, editButton
			]);

			const allParts = [...children];
			if (sfdisk?.free_space.sectors > 0) {
				allParts.push({
					fstype: null,
					mountpoints: null,
					name: 'Free Space',
					type: 'Free Space',
					size: sfdisk.free_space.size
				});
			};

			const diskTotalBytes = toBytes(lsblk.size);
			const parts = allParts.map(p => ({
				p, pct: diskTotalBytes > 0 ? (toBytes(p.size) / diskTotalBytes) * 100 : 0
			}));
			const smallParts = parts.filter(({ pct }) => pct <= MIN_PCT);
			const expand = smallParts.length * MIN_PCT;
			const smallSum = smallParts.reduce((sum, { pct }) => sum + pct, 0);
			const barWrapper = E('div', {
				style: window.innerWidth <= 768
					? 'display:flex; width:100vw; min-height:20px; overflow:auto; padding:4px;'
					: 'display:flex; width:100%; height:16px; overflow:hidden;'
			},
				parts.map(({ p, pct }, j) => {
					const color = p.fstype ? COLORS[j % 5] : '#ccc';
					const width = pct <= MIN_PCT ? MIN_PCT : pct * (100 - expand) / (100 - smallSum);
					const txt = [p.name, tableTypeMap[p.fstype] || p.fstype, p.size, p.mountpoints?.join(' ')]
						.filter(x => x && x !== '-' && x !== 'Free Space').join(' ') || ' ';
					return E('div', {
						title: txt,
						style: `width:${Math.max(width, 1)}%;height:17px;background:${color};font-size:12px;text-align:center;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;`
					}, txt);
				})
			);
			partitionBars.push({ path: lsblk.path, bar: barWrapper });

			const getMount = (dev, point) =>
				mount.find(m => m.device === dev) ||
				mount.find(m => m.mount_point === point) ||
				mount.find(m => point?.startsWith(m.mount_point + '/')) ||
				null;

			const unmountedPartitions = (children || [])
				.filter(c => (c.mountpoints.length === 0) && c.fstype)
				.map(c => ({
					Filesystem: c.path,
					Mounted: '',
					Size: c.size || '-',
					Used: '',
					Available: '',
					'Use%': '-',
					fstype: c.fstype,
					_isUnmounted: true
				}));

			allMountRows = [...df, ...unmountedPartitions].map(item => {
				const isUnmounted = item._isUnmounted;
				const m = isUnmounted
					? { filesystem: item.fstype, options: '' }
					: getMount(item.Filesystem, item.Mounted);

				let actionBtn;
				if (isUnmounted) {
					actionBtn = E('button', {
						class: 'btn cbi-button-positive',
						click: ui.createHandlerFn(this, () => mount_dev(item.Filesystem))
					}, _('挂载'));
				} else if (!/^\/(overlay|rom|tmp(?:\/.+)?|dev(?:\/.+)?|)$/.test(item.Mounted)) {
					actionBtn = E('button', {
						class: 'btn cbi-button-remove',
						click: ui.createHandlerFn(this, () => umount_dev(item.Mounted))
					}, _('Unmount'));
				} else {
					actionBtn = '-';
				};

				const fsType = isUnmounted ? item.fstype : (m?.filesystem || '-');

				return [
					item.Filesystem,
					E('span', {
						style: 'max-width:140px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;display:inline-block;',
						title: item.Mounted || ''
					}, item.Mounted || '-'),
					tableTypeMap[fsType] || fsType || '-',
					item.Size,
					(item.Used && item.Available && item['Use%']) ? `${item.Available}/${item.Used}(${item['Use%']})` : '-',
					E('span', {
						style: 'max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;display:inline-block;',
						title: m?.options || ''
					}, m?.options || '-'),
					actionBtn
				];
			});
		});

		const dsiktable = new L.ui.Table([
			_('Path'), _('Model'), _('Serial Number'), _('Size'),
			_('Partition Table'), _('Interface'), _('Temp'), _('SATA Version'),
			_('Health'), _('Rotation Rate'), _('Hours'), _('Cycles'), '', ''
		],
			{ sortable: true, classes: 'cbi-section-table' },
			E('em', _('No disks found'))
		);

		dsiktable.update(tableData);
		const dsikElement = dsiktable.render();

		function insertPartitionRows() {
			const tbody = dsikElement.querySelector('tbody') || dsikElement;
			if (!tbody) return;

			const old = tbody.querySelectorAll('tr.disk-part-row');
			for (const r of old) r.remove();

			const rows = Array.from(tbody.querySelectorAll('tr.tr:not(.table-titles)'));
			if (!rows.length) return;

			const colCount = rows[0].children.length || 12;
			const tdStyle = { maxWidth: '100px', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' };

			for (const row of rows) {
				for (const cell of row.children) {
					const txt = (cell.textContent ?? '').trim();
					if (txt.length > 10) cell.title = txt;
					Object.assign(cell.style, tdStyle);
				};
			};

			for (const { path, bar } of partitionBars) {
				const td = tbody.querySelector(`td[data-value="${path}"]`);
				const targetRow = td?.closest('tr.tr');

				if (!targetRow) continue;

				const tr = E('tr', { class: 'disk-part-row' },
					E('td', { colspan: colCount }, bar)
				);

				targetRow.after(tr);
			};
		};

		insertPartitionRows();

		let debounceTimer = null;
		const tbody = dsikElement.querySelector('tbody') || dsikElement;
		if (tbody) {
			const mo = new MutationObserver(() => {
				if (debounceTimer) clearTimeout(debounceTimer);
				debounceTimer = setTimeout(() => {
					insertPartitionRows();
					debounceTimer = null;
				}, 30);
			});

			mo.observe(tbody, { childList: true, subtree: false });
		};

		const mounttable = new L.ui.Table([
			_('设备'), _('挂载点'), _('类型'), _('总大小'), _('可用/已用(使用率)'), _('挂载选项'), ''
		],
			{ sortable: true, classes: 'cbi-section-table' },
			E('em', _('No disks found'))
		);

		mounttable.update(allMountRows);

		return E([
			E('h2', _('DiskMan')),
			E('div', { class: 'cbi-map-descr' }, _('Manage Disks over LuCI.')),
			E('p', {
				class: 'cbi-button cbi-button-add',
				click: ui.createHandlerFn(this, () =>
					fs.exec('/usr/libexec/diskman', ['rescandisks'])
						.then(r => r.code === 0 && location.reload()))
			}, _('Rescan Disks')),
			E('h3', _('Disks')),
			E('div', { id: 'diskman-container' }, dsikElement),
			E('h3', _('Mount Point')),
			E('div', { id: 'diskman-editContainer' }, mounttable.render()),
		]);
	},

	handleSave: null,
	handleReset: null,
	handleSaveApply: null
});
