'use strict';
'require fs';
'require ui';
'require dom';
'require view';

const CSS = `
.disk-tooltip {
	position: fixed;
	z-index: 10000;
	background: #fff;
	border: 1px solid #dcdcdc;
	border-radius: 6px;
	padding: 8px 10px;
	font-size: 12px;
	color: #333;
	box-shadow: 0 4px 12px rgba(0,0,0,.15);
	max-width: 280px;
	pointer-events: none;
	display: none;
}

.disk-tooltip .title {
	font-weight: 600;
	margin-bottom: 4px;
	color: #222;
}

.disk-tooltip .row {
	white-space: nowrap;
}

.disk-tooltip .muted {
	color: #888;
}`;

let diskTooltip;
const multipliers = { K: 1024, M: 1024 ** 2, G: 1024 ** 3, T: 1024 ** 4 };
const tableTypeMap = { gpt: 'GPT', msdos: 'MBR', dos: 'MBR' };
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
const DISK_CACHE_KEY = 'diskman.cache.v1';
const Cache = {
	expireGlobal: 15 * 1000,
	expireDisk: 30 * 1000,

	_load() {
		try {
			return JSON.parse(sessionStorage.getItem(DISK_CACHE_KEY)) || {};
		} catch (e) {
			return {};
		}
	},

	_save(all) {
		sessionStorage.setItem(DISK_CACHE_KEY, JSON.stringify(all));
	},

	getGlobal() {
		return this._load().global;
	},

	setGlobal(df, mount) {
		const all = this._load();
		all.global = { df, mount, timestamp: Date.now() };
		this._save(all);
	},

	isGlobalFresh(g) {
		return g && (Date.now() - g.timestamp) < this.expireGlobal;
	},

	invalidateGlobal() {
		const all = this._load();
		delete all.global;
		this._save(all);
	},

	getDisk(path) {
		return this._load().disks?.[path];
	},

	setDisk(path, data) {
		const all = this._load();
		all.disks ??= {};
		all.disks[path] = {
			...data,
			timestamp: Date.now()
		};
		this._save(all);
	},

	isDiskFresh(d) {
		return d && (Date.now() - d.timestamp) < this.expireDisk;
	},

	invalidateDisk(path) {
		const all = this._load();
		if (all.disks) delete all.disks[path];
		this._save(all);
	}
};

function loadGlobalInfo() {
	const cached = Cache.getGlobal();

	if (Cache.isGlobalFresh(cached)) return Promise.resolve(cached);

	return Promise.all([
		fs.exec_direct('/usr/libexec/diskman', ['df'])
			.then(JSON.parse)
			.catch(() => []),

		fs.exec_direct('/usr/libexec/diskman', ['mount_info'])
			.then(JSON.parse)
			.catch(() => [])
	]).then(([df, mount]) => {
		Cache.setGlobal(df, mount);
		return { df, mount };
	});
};

function loadDiskInfo(lsblk, global) {
	const path = lsblk.path;
	const cached = Cache.getDisk(path);

	if (Cache.isDiskFresh(cached))
		return Promise.resolve([lsblk, cached.smart, global.df, global.mount, cached.parted, cached.sfdisk]);

	let smartPromise = Promise.resolve({ nosmart: true });
	if (['sata', 'nvme', 'ata', 'scsi'].includes(lsblk.tran)) {
		smartPromise = fs.exec_direct('/usr/sbin/smartctl', ['-ja', path])
			.then(JSON.parse)
			.catch(() => []);
	}

	const partedPromise = fs.exec_direct('/usr/libexec/diskman', ['parted', path])
		.then(JSON.parse)
		.catch(() => []);

	const sfdiskPromise = fs.exec_direct('/usr/libexec/diskman', ['fsfdisk', path])
		.then(JSON.parse)
		.catch(() => null);

	return Promise.all([smartPromise, partedPromise, sfdiskPromise])
		.then(([smart, parted, sfdisk]) => {
			Cache.setDisk(path, { lsblk, smart, parted, sfdisk });
			return [lsblk, smart, global.df, global.mount, parted, sfdisk];
		});
};

function afterDiskChanged(self, path, opts = {}) {
	const { hideModal = true, delay = 400 } = opts;
	if (path) Cache.invalidateDisk(path);
	Cache.invalidateGlobal();

	if (hideModal) setTimeout(() => ui.hideModal(), delay);
	const container = document.getElementById('diskman-container').parentNode;

	return self.load().then(res => {
		container.innerHTML = '';
		container.appendChild(self.render(res));
	});
};

function modalnotify(title, children, timeout, ...classes) {
	const msg = E('div', {
		style: 'display:flex',
		class: 'alert-message fade-in',
		transitionend: function (ev) {
			const node = ev.currentTarget;
			if (node.parentNode && node.classList.contains('fade-out'))
				node.parentNode.removeChild(node);
		}
	}, [
		E('div', { style: 'flex:10' }),
		E('div', { style: 'flex:1 1 auto; display:flex' }, [
			E('button', {
				class: 'btn',
				style: 'margin-left:auto; margin-top:auto',
				click: function (ev) {
					dom.parent(ev.target, '.alert-message').classList.add('fade-out');
				},

			}, [_('Dismiss')])
		])
	]);

	if (title != null) dom.append(msg.firstElementChild, E('h4', {}, title));

	dom.append(msg.firstElementChild, children);
	msg.classList.add(...classes);

	const overlay = document.getElementById('modal_overlay');
	if (overlay && getComputedStyle(overlay).visibility !== 'hidden') {
		overlay.firstElementChild?.prepend(msg);
	} else {
		const mc = document.querySelector('#maincontent') ?? document.body;
		mc.insertBefore(msg, mc.firstElementChild);
	};

	function fadeOutNotification(element) {
		if (element) {
			element.classList.add('fade-out');
			element.classList.remove('fade-in');
			setTimeout(() => {
				if (element.parentNode) {
					element.parentNode.removeChild(element);
				};
			});
		};
	};

	if (typeof timeout === 'number' && timeout > 0) setTimeout(() => fadeOutNotification(msg), timeout);
	return msg;
};

function mount_dev(dev, mountpoints = null, self = null) {
	let mp = '', opts = '';
	ui.showModal(_('Mount %s').format(dev), [
		E('style', ['h4 {text-align:center;color:red;}']),
		E('div', { style: 'display:flex;align-items:center;gap:10px;' }, [
			E('label', { style: 'min-width:80px;font-weight:bold;' }, _('Mount point:')),
			E('input', {
				class: 'cbi-input-text', style: 'flex:1;padding:6px;',
				blur: ui.createHandlerFn(this, ev => mp = ev.target.value.trim()),
				placeholder: mountpoints?.length > 0 ? _('Mounted at %s by default').format(mountpoints) : ''
			})
		]),
		E('div', { style: 'display:flex;align-items:center;gap:10px;' }, [
			E('label', { style: 'min-width:80px;font-weight:bold;' }, _('Mount options:')),
			E('input', {
				class: 'cbi-input-text', style: 'flex:2;padding:6px;',
				placeholder: _('Leave blank to automatically mount'),
				blur: ui.createHandlerFn(this, ev => opts = ev.target.value.trim())
			})
		]),
		E('div', { class: 'button-row' }, [
			E('button', { class: 'btn', click: ui.hideModal }, _('Cancel')),
			E('button', {
				class: 'btn cbi-button-positive important',
				click: ui.createHandlerFn(this, () => {
					if (!mp) modalnotify(null, E('p', _('Please enter the mount point')), 4000, 'warning');

					let mountArgs = [dev, mp];
					if (opts) mountArgs = ['-o', opts, dev, mp];

					return fs.exec_direct('/bin/mkdir', ['-p', mp])
						.then(() => fs.exec('/bin/mount', mountArgs))
						.then(r => {
							if (r.code === 0) {
								modalnotify(null, E('p', _('%s is mounted to %s').format(dev, mp)), 2000, 'success');
								afterDiskChanged(self, null)
								return r;
							} else {
								modalnotify(null, E('p', _('Mount failed: %s').format(r.stderr)), 4000, 'error');
								throw new Error(r.stderr);
							}
						})
						.catch(() => {});
				})
			}, _('mount'))
		])
	]);
};

function umount_dev(target, silent = false, self = null) {
	const list = /^\/dev\/([a-z]+|nvme\d+n\d+|mmcblk\d+)$/.test(target)
		? fs.read('/proc/mounts').then(c =>
			c.trim().split('\n')
				.filter(l => l.startsWith(target))
				.map(l => l.split(' ')[1])
		)
		: Promise.resolve([target]);

	return list
		.then(l => l.length ? Promise.all(l.map(t =>
			fs.exec('/bin/umount', [t]).then(r => {
				if (r.code !== 0) throw new Error(r.stderr);
				return r;
			})
		)) : null)
		.then(() => {
			if (!silent) modalnotify(null, E('p', _('%s uninstalled successfully').format(target)), 2000, 'success');
			if (self) return afterDiskChanged(self, null)
		})
		.catch(e => !silent && modalnotify(null, E('p', _('Uninstall failed: %s').format(e.message || e)), 8000, 'error'));
};

function getInterfaceSpeed(smartData) {
	let speeds = [];
	if (smartData.sata_version?.string) speeds.push(smartData.sata_version.string);

	if (smartData.interface_speed?.max?.string) {
		speeds.push(_('Max: %s').format(smartData.interface_speed.max.string));
	};
	if (smartData.interface_speed?.current?.string) {
		speeds.push(_('Current: %s').format(smartData.interface_speed.current.string));
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

const toSectors = (input, sectorSize = 512) => {
	if (!input || input === '-') return 0;
	if (/^\d+$/.test(input)) return parseInt(input);

	const match = input.match(/^([\d.]+)\s*([KMGT]?i?)[B]?$/i);
	if (match) {
		const value = parseFloat(match[1]);
		const unit = match[2].toUpperCase().charAt(0);
		const bytes = value * (multipliers[unit] || 1);
		return Math.floor(bytes / sectorSize);
	}
	return null;
};

const sectorsTohuman = (sectors, sectorSize = 512) => {
	// if (sectors <= 0) return '0 B';
	let bytes = sectors * sectorSize;
	const units = ['B', 'KB', 'MB', 'GB', 'TB'];
	let i = 0;
	while (bytes >= 1024 && i < 4) {
		bytes /= 1024;
		i++;
	}
	return `${bytes % 1 === 0 ? bytes : bytes.toFixed(1)} ${units[i]}`;
};

return view.extend({
	load: function () {
		return fs.exec_direct('/usr/bin/lsblk', ['-fJo', 'NAME,PATH,TYPE,SIZE,MODEL,TRAN,FSTYPE,VENDOR,ROTA,PTTYPE,MOUNTPOINTS,FSUSE%'])
			.then(JSON.parse)
			.then(res => {
				const disks = (res.blockdevices || []).filter(dev =>
					dev.type === 'disk'
					&& !/^(loop|sr|ram|zram)/.test(dev.name || '')
					&& parseFloat(String(dev.size).replace(/[^\d.]/g, '')) > 0
				);

				return loadGlobalInfo().then(global =>
					Promise.all(disks.map(lsblk =>
						loadDiskInfo(lsblk, global)
					))
				);
			});
	},

	render: function (res) {
		const self = this;
		let allMountRows, tableData = [], partitionBars = [];
		const COLORS = ["#f8cb43ff", "#a0e0a0", "#fd9f5bff", "#d1a3ffff", "#a9c5faff"];
		// const COLORS = ["#ffc8dd", "#bde0fe", "#ffafcc", "#a2d2ff", "#cdb4db"];

		res.forEach(([lsblk, smart, df, mount, parted, sfdisk]) => {
			const disk = parted.disk;
			const partitions = parted.partitions || [];
			const children = lsblk.children || [lsblk];
			const healthStatus = !smart.nosmart
				? (smart.smart_status.passed ? 'Normal' : 'warning')
				: (smart?.error && 'SMART error');

			const healthText = {
				'Normal': _('Normal'),
				'warning': _('warning'),
				'SMART error': _('SMART error')
			}[healthStatus];

			const healthColor = {
				'Normal': '#8bc34a',
				'warning': '#ff9800',
				'SMART error': '#f44336'
			}[healthStatus];
			const editButton = E('button', {
				class: 'btn cbi-button-edit',
				click: ui.createHandlerFn(this, 'editdev', lsblk, smart, df, parted, sfdisk)
			}, _('Edit'));
			const ejectButton = E('button', {
				class: 'btn cbi-button-remove',
				click: ui.createHandlerFn(this, () => {
					return umount_dev(lsblk.path, true)
						.then(() => fs.read('/proc/mounts'))
						.then(txt => {
							const busy = txt.split('\n').some(line => {
								if (!line.startsWith(lsblk.path + ' ')) return false;
								return !line.match(/\s(squashfs|vfat|exfat|ntfs|fuseblk|iso9660)\s/);
							});
							if (busy) throw new Error(_('Device %s is still occupied and cannot be ejected').format(lsblk.path));
						})
						.then(() => {
							if (lsblk.type === 'disk')
								return fs.exec('/bin/sh', ['-c', `echo 1 > /sys/block/${lsblk.name}/device/delete`]);

							if (/^md\d+/.test(lsblk.name)) {
								return fs.exec_direct('/sbin/mdadm', ['--stop', `/dev/${lsblk.name}`]).then(() =>
									fs.exec_direct('/sbin/mdadm', ['--remove', `/dev/${lsblk.name}`])
								);
							}
							throw new Error(_('Unsupported device type: %s').format(lsblk.type));
						})
						.then(() => {
							modalnotify(null, E('p', _('Disk %s has been safely ejected').format(lsblk.path)), 1000, 'info');
							return afterDiskChanged(self, lsblk.path);
						})
						.catch(err => {
							modalnotify(null, E('p', _('Disk %s failed to eject, %s').format(lsblk.path, err.message || err)), 8000, 'error');
						});
				})
			}, _('Eject'));

			tableData.push([
				[lsblk.path, E('span', lsblk.path)],
				`${lsblk.model.trim()} ${lsblk.vendor.trim()}` || '-',
				smart.serial_number || '-',
				lsblk.size || '-',
				tableTypeMap[lsblk.pttype] || '-',
				interfaceMap[lsblk.tran] || lsblk.tran || '-',
				getTemperature(smart),
				getInterfaceSpeed(smart),
				healthColor ?
					E('span', {
						style: `background:${healthColor};color:#fff;padding:2px 6px;border-radius:3px;font-size:12px;`
					}, healthText) : '-',
				smart.rotation_rate || '-',
				smart.power_on_time?.hours || smart.nvme_smart_health_information_log?.power_on_hours || '-',
				smart.power_cycle_count || smart.nvme_smart_health_information_log?.power_cycles || '-',
				ejectButton, editButton
			]);

			const allParts = partitions.map(p => {
				const child = children.find(c => {
					const match = c.path?.match(/\d+$/);
					return match && match[0] === p.number?.toString();
				}) || {};

				return {
					end: p.end,
					start: p.start,
					number: p.number,
					path: child.path || '',
					mountpoints: child.mountpoints || [],
					fileSystem: p.fileSystem || child.fstype,
					size: child.size ? toSectors(child.size) : p.size
				};
			});

			const mountpointsMap = [], noPartitions = partitions.length === 0;
			children.forEach(i => {
				if ((i.mountpoints.length === 0 || i.mountpoints[0] === null) && i.fstype) {
					mountpointsMap.push({
						Size: i.size, fstype: i.fstype, Filesystem: i.path, isUnmounted: true
					});
				};

				if (noPartitions) {
					allParts.push({
						path: i.path, fileSystem: i.fstype, size: toSectors(i.size), mountpoints: i.mountpoints || []
					});
				};
			});

			if (sfdisk?.free_space.sectors > 0 && disk.partition_table === 'unknown') {
				allParts.push({ fileSystem: 'Free Space', size: sfdisk.free_space.sectors });
			};

			const maxEnd = disk.total_sectors || 0;
			const parts = allParts.filter(p => p.size > 2048).map(p => {
				const w = maxEnd ? (p.size / maxEnd) * 100 : 0;
				return { p, width: Math.max(w, p.fileSystem === 'Free Space' ? 0 : 7) };
			});

			const totalWidth = parts.reduce((sum, { width }) => sum + width, 0);
			const scale = totalWidth > 100 ? 100 / totalWidth : 1;

			const barWrapper = E('div', {
				style: window.innerWidth <= 768
					? 'display:flex;width:100vw;min-height:20px;overflow:auto;padding:4px;'
					: 'display:flex;width:100%;height:16px;overflow:hidden;'
			}, parts.map(({ p, width }, j) => {
				const color = p.fileSystem === 'Free Space' ? '#ccc' : COLORS[j % 5];
				const txt = [p.path, p.fileSystem, sectorsTohuman(p.size), [...new Set(p.mountpoints)].join(' ')]
					.filter(x => x && x !== '-' && x !== 'Free Space').join(' ') || ' ';

				return E('div', {
					style: `width:${Math.max((width * scale), 1)}%;height:17px;background:${color};font-size:12px;
						text-align:center;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;cursor:pointer;`,
					mouseenter: ui.createHandlerFn(this, () => {
						const tip = this.getDiskTooltip();
						tip.innerHTML = '';

						tip.appendChild(E('div', { class: 'title' }, p.path || _('unnamed partition')));
						tip.appendChild(E('div', { class: 'row' }, _('Filesystem: %s').format(p.fileSystem || '-')));
						tip.appendChild(E('div', { class: 'row' }, _('Size: %s').format(sectorsTohuman(p.size))));

						if (p.mountpoints?.length) {
							tip.appendChild(E('div', { class: 'row' }, _('Mounts:')));
							[...new Set(p.mountpoints)].forEach(m =>
								tip.appendChild(E('div', { class: 'row' }, m))
							);
						};

						tip.style.display = 'block';
					}),
					mousemove: ui.createHandlerFn(this, (ev) => {
						const tip = this.getDiskTooltip();
						const offset = 12;
						tip.style.left = (ev.clientX + offset) + 'px';
						tip.style.top = (ev.clientY + offset) + 'px';
					}),
					mouseleave: ui.createHandlerFn(this, () => {
						const tip = this.getDiskTooltip();
						tip.style.display = 'none';
					})
				}, txt);
			}));

			partitionBars.push({ path: lsblk.path, bar: barWrapper });

			const getMount = (d) => mount.find(m => m.device === d);
			allMountRows = [...df, ...mountpointsMap].map(i => {
				const m = getMount(i.Filesystem) || {};
				let actionBtn = '-';
				if (i.isUnmounted) {
					actionBtn = E('button', {
						class: 'btn cbi-button-positive',
						click: ui.createHandlerFn(this, () =>
							mount_dev(i.Filesystem, null, self))
					}, _('挂载'));
				} else if (!/^\/(overlay|rom|tmp(?:\/.+)?|dev(?:\/.+)?|)$/.test(i.Mounted)) {
					actionBtn = E('button', {
						class: 'btn cbi-button-remove',
						click: ui.createHandlerFn(this, () =>
							umount_dev(i.Mounted, false, self).then(() => ui.hideModal))
					}, _('Unmount'));
				};
				return [
					m.device || i.Filesystem,
					E('span', {
						style: 'max-width:140px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;display:inline-block;',
						title: m.mount_point || i.Mounted || ''
					}, m.mount_point || i.Mounted || '-'),
					m.filesystem || i.fstype || '-',
					i.Size || '-',
					(i.Used && i.Available && i['Use%']) ? `${i.Available}/${i.Used}(${i['Use%']})` : '-',
					E('span', {
						style: 'max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;display:inline-block;',
						title: m.options || ''
					}, m.options || '-'),
					actionBtn
				];
			});
		});

		const dsiktable = new ui.Table([
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
				const td = tbody.querySelector(`td[data-value="${path}"]`) || {};
				const targetRow = td.closest('tr.tr');

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

		const mounttable = new ui.Table([
			_('device'), _('Mount Point'), _('type'), _('total size'), _('Available/used (usage rate)'), _('Mount Options'), ''
		],
			{ sortable: true, classes: 'cbi-section-table' },
			E('em', _('No disks found'))
		);
		const mountElement = mounttable.update(allMountRows);

		return E([
			E('style', [CSS]),
			E('h2', _('DiskMan')),
			E('div', [
				E('span', _('Manage Disks over LuCI.')),
				E('span', {
					class: 'btn cbi-button-add',
					click: ui.createHandlerFn(this, () =>
						fs.exec('/bin/sh', ['-c', 'echo "- - -" | tee /sys/class/scsi_host/host*/scan >/dev/null 2>&1'])
							.then(r => r.code === 0 && afterDiskChanged(self, null)))
				}, _('Rescan Disks'))
			]),
			E('h3', _('Disks')),
			E('div', { id: 'diskman-container' }, dsikElement),
			E('h3', _('Mount Point')),
			E('div', { id: 'diskman-editContainer' }, mountElement),
		]);
	},

	getDiskTooltip: function () {
		if (diskTooltip) return diskTooltip;

		diskTooltip = E('div', { class: 'disk-tooltip' });
		document.body.appendChild(diskTooltip);
		return diskTooltip;
	},

	editdev: function (lsblk, smart, df, parted, sfdisk = null) {
		const self = this;
		const path = lsblk.path;
		function disktable(parted, smart) {
			if (!parted || !parted.disk) return E('em', _('No disks found'));

			const disk = parted.disk;
			const sectors = disk.total_sectors || 0;
			const health = !smart.nosmart
				? (smart.smart_status.passed ? _('normal') : _('warning'))
				: (smart?.error ? 'SMART错误' : '不支持');

			const p_table = lsblk.children?.some(c => c.mountpoints?.length > 0)
				? _(tableTypeMap[disk.partition_table] || disk.partition_table)
				: E('select', {
					change: ui.createHandlerFn(this, (ev) => {
						const value = ev.target.value;
						if (!value) return;
						ui.showModal(_('warn! !'), [
							E('style', ['h4 {text-align:center;color:red;}']),
							E('p', { style: 'text-align:center;margin:15px 0;color:red;' },
								_('This operation will overwrite the existing partition. Are you sure you want to modify the %s partition table to %s?').format(disk.device, tableTypeMap[value] || value)
							),
							E('div', { class: 'button-row' }, [
								E('button', { class: 'btn', click: ui.hideModal }, _('Cancel')),
								E('button', {
									class: 'btn cbi-button-positive important',
									click: ui.createHandlerFn(this, () => {
										return fs.exec_direct('/sbin/parted', ['-s', disk.device, 'mklabel', value])
											.then(() => {
												modalnotify(null, E('p', _('Partition table modified successfully')), 2000, 'success');
												return afterDiskChanged(self, path);
											})
											.catch(err =>
												modalnotify(null, E('p', [_('Operation failed:'), E('br'), err.message || String(err)]), 'error')
											);
									})
								}, _('define'))
							])
						]);
					})
				},
					['msdos', 'gpt'].map(c => E('option', {
						value: c, selected: c === disk.partition_table ? '' : null
					}, _(tableTypeMap[c] || c)))
				);

			const table = new ui.Table([
				_('Path'), _('model'), _('serial number'), _('size'), _('sector size'),
				_('Partition Table'), _('temperature'), _('Speed'), _('status')
			],
				{ sortable: true, classes: 'cbi-section-table' },
				E('em', _('No disks found'))
			);

			table.update([[
				disk.device || '-',
				smart.model_name || disk.model || '-',
				smart.serial_number || '-',
				disk.size || sectorsTohuman(sectors),
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
							number: null,
							end: sfdisk.free_space.end,
							Size: sfdisk.free_space.Size,
							start: sfdisk.free_space.start,
							size: sfdisk.free_space.sectors
						});
					};

					return result;
				})
				.catch(() => {});
		};

		function onreset(partedjson, initialstart = null, initialend = null) {
			let newParts = [];
			const disk = partedjson.disk || {};
			const pttable = disk.partition_table;
			let ptSelect = pttable;
			const parts = partedjson.partitions || [];
			const SECTOR = disk.sector_size?.logical || 512;
			const ALIGN = Math.ceil((1 * 1024 * 1024) / SECTOR);
			const maxEnd = disk.total_sectors || 0;
			const isMBR = tableTypeMap[pttable] === 'MBR';
			const maxUsable = Math.max(0, maxEnd - 1024 - (isMBR ? 1 : 34));
			const existing = parts.filter(p => p.number != null && p.size > 0);
			const checkMBR = () => isMBR && newParts.length >= 4;
			const existingUsed = () =>
				existing.reduce((s, p) => s + (p.end - p.start + 1), 0);
			const getUsedSectors = () =>
				existingUsed() + newParts.reduce((s, p) => s + (p.end - p.start + 1), 0);
			const getFreeSectors = () =>
				Math.max(0, maxUsable - getUsedSectors());
			const hasSpace = (min = ALIGN) => getFreeSectors() >= min;
			const getLastEnd = () => {
				const all = [...existing.map(p => p.end), ...newParts.map(p => p.end)];
				return all.length ? Math.max(...all) : -1;
			};
			const getNextStart = () => {
				const last = getLastEnd();
				return last < ALIGN ? ALIGN : last + 1;
			};
			const checkOverlap = (part, excludeId) => {
				for (const p of existing) {
					if ((part.start >= p.start && part.start <= p.end) ||
						(part.end >= p.start && part.end <= p.end) ||
						(part.start <= p.start && part.end >= p.end)) return true;
				}
				for (const p of newParts) {
					if (excludeId && p.id === excludeId) continue;
					if ((part.start >= p.start && part.start <= p.end) ||
						(part.end >= p.start && part.end <= p.end) ||
						(part.start <= p.start && part.end >= p.end)) return true;
				}
				return false;
			};
			const parseSize = (e, s) => {
				const str = String(e).trim();
				if (!str) return null;
				if (/^\d+$/.test(str)) return parseInt(str, 10);

				const m = str.match(/^\+?(\d+(?:\.\d+)?)([bkmgtps])$/i);
				if (!m) return null;

				const bytes = parseFloat(m[1]) * multipliers[m[2].toUpperCase()];
				return s + Math.ceil(bytes / SECTOR) - 1;
			};

			const executeOperation = async (partitions, specificIndex = null) => {
				ui.showModal(null, E('div', { class: 'spinning' }, _('Creating partition...')));
				try {
					const sleep = ms => new Promise(r => setTimeout(r, ms));
					const parted = args => fs.exec_direct('/sbin/parted', ['-s', path, ...args]);
					const partprobe = () => fs.exec_direct('/sbin/partprobe', [path]).catch(() => {});

					if (ptSelect !== pttable) {
						await parted(['mklabel', ptSelect]);
						await sleep(500);
					};

					for (const p of partitions) {
						await parted(['mkpart', isMBR ? 'primary' : '', 'ext4', `${p.start}s`, `${p.end}s`].filter(Boolean));
						await sleep(500);
					};

					await partprobe();
					await sleep(500);

					if (specificIndex) {
						const p = partitions[0];
						const fsTool = availableFS[p.fs] || availableFS.ext4;
						await fs.exec_direct(fsTool.cmd, [...fsTool.args, `${path}${p.devices}`]);
						await sleep(300);
					} else {
						const base = path.replace(/^\/dev\//, '');
						const out = await fs.exec_direct('/usr/bin/lsblk', ['-rno', 'NAME', path]);
						const devices = out.trim().split('\n')
							.filter(name => name.startsWith(base) && name.length > base.length)
							.map(name => `/dev/${name}`)
							.sort((a, b) => {
								const n1 = parseInt(a.match(/(\d+)$/)?.[1] || '0', 10);
								const n2 = parseInt(b.match(/(\d+)$/)?.[1] || '0', 10);
								return n1 - n2;
							})
							.slice(existing.length);

						for (let i = 0; i < devices.length && i < partitions.length; i++) {
							const fsTool = availableFS[partitions[i].fs] || availableFS.ext4;
							await fs.exec_direct(fsTool.cmd, [...fsTool.args, devices[i]]);
							await sleep(300);
						};
					};

					modalnotify(null, E('p', _('Operation successful!')), 2000, 'success');
					return afterDiskChanged(self, path);
				} catch (err) {
					modalnotify(null, E('p', [_('Operation failed:'), E('br'), err.message || String(err)]), 15000, 'error');
					confirmBtn.disabled = false;
				};
			};

			const table = new ui.Table([
				_('Start Sector'), _('end sector'), _('File System'), _('operate')
			], { sortable: false, classes: 'cbi-section-table' },
				E('em', _('No disks found'))
			);

			const addBtn = E('button', {
				class: 'btn cbi-button-add', style: 'width:100%;',
				click: ui.createHandlerFn(this, () => addRow())
			}, _('Add partition'));
			const confirmBtn = E('button', {
				class: 'btn cbi-button-positive important',
				click: ui.createHandlerFn(this, async () => {
					if (!newParts.length) return modalnotify(null, E('p', _('Please add partition')), 4000, 'error');
					const sorted = [...newParts].sort((a, b) => a.start - b.start);
					for (let i = 1; i < sorted.length; i++) {
						if (sorted[i].start <= sorted[i - 1].end)
							return modalnotify(null, E('p', _('Partition overlap')), 4000, 'error');
					};
					if (getFreeSectors() < 0) return modalnotify(null, E('p', _('Disk capacity exceeded')), 4000, 'error');
					await executeOperation(sorted);
				})
			}, _('确认执行'));
			const updateUI = () => {
				let remaining = Math.max(0, maxUsable - getLastEnd());
				confirmBtn.disabled = !newParts.length > 0;
				addBtn.title = checkMBR() ? _('MBR up to 4 primary partitions') : '';
				addBtn.disabled = !hasSpace() || checkMBR() || remaining === 0;
				addBtn.innerHTML = _('Add partition <span style="color:red">Remaining: %s</span>')
					.format(sectorsTohuman(remaining));
			};

			const buildFsSelect = (val, onChange = null) => {
				const sel = E('select', {
					class: 'cbi-input-select',
					style: 'width: 100%; box-sizing: border-box;'
				});
				Object.keys(availableFS).forEach(k => {
					sel.appendChild(E('option', {
						value: k, selected: k === val || undefined
					}, availableFS[k].label));
				});
				if (onChange) sel.onchange = onChange;
				return sel;
			};

			const buildNewPartRow = (part) => {
				const startInput = E('input', {
					value: part.start,
					class: 'cbi-input-text',
					style: 'width: 100%; box-sizing: border-box;',
					title: _('Starting position: %s').format(sectorsTohuman(part.start))
				});
				const endInput = E('input', {
					value: part.end,
					class: 'cbi-input-text',
					style: 'width: 100%; box-sizing: border-box;',
					title: _('Size: %s').format(sectorsTohuman(part.end - part.start + 1))
				});
				const fsSel = buildFsSelect(part.fs);
				const update = () => {
					const s = parseInt(startInput.value) || part.start;
					let e = parseSize(endInput.value, s);
					if (e == null || e <= s)
						return modalnotify(null, E('p', _('Format not supported (should be e.g. +5M, 10G, 100s or just a number)')), 5000, 'error');

					e = Math.min(e, maxUsable);

					if (checkOverlap({ id: part.id, start: s, end: e }, part.id)) {
						endInput.value = part.end;
						startInput.value = part.start;
						return modalnotify(null, E('p', _('Partition overlap')), 4000, 'error');
					};

					part.end = e;
					part.start = s;
					part.fs = fsSel.value;
					updateUI();
					return true;
				};

				[startInput, endInput].forEach(i => { i.onblur = update; i.onchange = update; });
				fsSel.onchange = update;

				endInput.onkeydown = (e) => {
					if (e.ctrlKey && e.key === 'Enter') {
						endInput.value = maxUsable;
						update();
						e.preventDefault();
					};
				};

				return [startInput, endInput, fsSel,
					E('button', {
						style: 'flex: 0 0 auto;',
						class: 'btn cbi-button-remove',
						click: ui.createHandlerFn(this, () => {
							newParts = newParts.filter(p => p.id !== part.id);
							refreshTable();
						}),
					}, _('删除 %s').format(sectorsTohuman(part.end - part.start + 1)))
				];
			};

			const buildTableData = () => {
				const rows = [];
				parts.slice(0, -1)
					.filter(p => p.size > 2048)
					.forEach((p, i) => {
						let fstype = 'ext4';
						const isFree = p.number === null;
						const readonlyStyle = isFree ? '' : 'background-color: #f8f9fa; color: #6c757d; cursor: not-allowed;';
						rows.push([
							E('input', {
								class: `cbi-input-text`,
								value: p.start, readonly: isFree,
								style: `width: 100%; box-sizing: border-box; ${readonlyStyle}`,
								title: isFree ? _('Starting position: %s').format(sectorsTohuman(p.start)) : ''
							}),
							E('input', {
								class: `cbi-input-text`,
								value: p.end, readonly: isFree,
								style: `width: 100%; box-sizing: border-box; ${readonlyStyle}`,
								title: isFree ? _('Size: %s').format(sectorsTohuman(p.end - p.start + 1)) : ''
							}),
							isFree
								? buildFsSelect('ext4', (ev) => { fstype = ev.target.value; })
								: E('input', {
									class: `cbi-input-text`,
									value: p.fileSystem, readonly: isFree,
									style: `width: 100%; box-sizing: border-box; ${readonlyStyle}`
								}),
							isFree
								? E('button', {
									style: 'width: 100%;',
									class: 'btn cbi-button-positive',
									click: ui.createHandlerFn(this, async () => {
										await executeOperation([{ start: p.start, end: p.end, fs: fstype, devices: i + 1 }], true);
									})
								}, _('New'))
								: E('span', {
									style: 'color:#6c757d; font-weight: 500; padding: 6px 0;',
								}, _('existing partition'))
						]);
					});

				newParts.forEach(p => rows.push(buildNewPartRow(p)));
				return rows;
			};

			const refreshTable = () => {
				table.update(buildTableData());
				updateUI();
			};

			const addRow = (fs = 'ext4', start = null, end = null) => {
				if (!hasSpace())
					return modalnotify(null, E('p', _('Not enough space')), 4000, 'error');
				if (checkMBR())
					return modalnotify(null, E('p', _('MBR up to 4 primary partitions')), 4000, 'warning');

				start = start || (newParts.length ? getNextStart() : initialstart);
				// end = end ? Math.min(end, maxUsable) : maxUsable;
				end = Math.min(end || Infinity, maxUsable);
				if (start >= maxUsable)
					return modalnotify(null, E('p', _('Start sector exceeds capacity')), 5000, 'error');
				const part = { id: 'p-' + Math.random().toString(36).slice(2), start, end, fs };
				if (checkOverlap(part))
					return modalnotify(null, E('p', _('Partition overlap')), 4000, 'error');

				newParts.push(part);
				refreshTable();
				return true;
			};

			const modal = E('div', {
				style: 'display:flex;flex-direction:column;gap:15px;font-size:14px;max-width:600px;'
			}, [
				E('div', {
					style: 'background:#fff3cd;border:1px solid #ffeaa7;border-radius:4px;padding:12px;'
				}, [
					E('div', {
						style: 'color:#856404;font-weight:bold;margin-bottom:5px;'
					}, _('⚠️ Warning: This operation will erase all data on the disk!'))
				]),
				existing.length === 0
					? E('div', { style: 'display:flex;flex-direction:column;gap:12px;' }, [
						E('div', { style: 'display:flex;align-items:center;gap:10px;' }, [
							E('label', { style: 'min-width:80px;font-weight:bold;' }, _('Partition table type:')),
							E('select', {
								style: 'flex:1;padding:6px;',
								change: ui.createHandlerFn(this, (ev) => {
									ptSelect = ev.target.value;
									updateUI();
								})
							}, ['msdos', 'gpt'].map(pt =>
								E('option', { value: pt, selected: pt === pttable ? '' : null }, _(tableTypeMap[pt]))
							))
						]),
					])
					: [],
				E('div', { style: 'display:flex;flex-direction:column;gap:12px;' }, [
					table.render(), addBtn,
					E('div', {
						style: 'display:flex;justify-content:flex-end;gap:10px;margin-top:20px;'
					}, [confirmBtn, E('button', { class: 'btn', click: ui.hideModal }, _('Cancel'))])
				])
			]);

			refreshTable();
			ui.showModal(_(('%s disk partition').format(path)), [
				E('style', ['h4 {text-align:center;color:red;}']), modal
			]);
		};

		function deletePartitions(disk, numbers) {
			if (!disk?.startsWith('/dev/')) {
				modalnotify(null, E('p', _('Invalid disk device')), 5000, 'error');
				return Promise.reject();
			};

			const parts = [numbers].flat().map(String).filter(n => /^\d+$/.test(n));
			if (!parts.length) {
				modalnotify(null, E('p', _('No valid partition number specified')), 5000, 'error');
				return Promise.reject();
			};
			const devs = parts.map(n => disk + n);

			return Promise.all(devs.map(d => umount_dev(d, true)))
				.then(() => fs.exec_direct('/usr/sbin/sfdisk', ['--delete', disk, ...parts]))
				.then(() => fs.exec_direct('/sbin/partprobe', [disk]))
				.then(() => {
					modalnotify(null, E('p', _('Partition deleted successfully')), 2000, 'success');
					return afterDiskChanged(self, path);
				})
				.catch(err => {
					modalnotify(null, E('p', _('Operation failed:') + (err.message || String(err))), 18000, 'error');
					return Promise.reject(err);
				});
		};

		function musttable(parted, df, onSelectionChange) {
			const parts = parted.partitions || [];
			const dfMap = {};
			df.forEach(i => {
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

			const rows = parts.map(entry => {
				let fullDev = entry.number ? `${path}${entry.number}` : null;
				const lsblkEntry = fullDev ? lsblkMap[fullDev] : {};
				let mountPoints = lsblkEntry.mountpoints
					? E('button', {
						class: 'btn cbi-button-positive important',
						title: lsblkEntry.mountpoints[0]
							? _(('Modify mount %s').format([...new Set(lsblkEntry.mountpoints)].join('\n')))
							: _('mount'),
						click: ui.createHandlerFn(this, () =>
							umount_dev(fullDev, true)
								.then(() => mount_dev(fullDev, lsblkEntry.mountpoints, self))
						)
					}, lsblkEntry.mountpoints[0] || _('mount'))
					: '-';

				let action = E('span', { style: 'display: inline-flex; align-items: center; justify-content: center;' });
				entry.fileSystem = lsblkEntry.fstype || entry.fileSystem || null;
				let fsCell = entry.fileSystem || '-';
				const isPrimary = entry.fileSystem === 'primary';

				if (entry.number && fullDev) {
					fsCell = E('button', {
						title: isPrimary
							? _('Format %s').format(fullDev)
							: _('Modify %s file system').format(fsCell),
						class: isPrimary
							? 'btn cbi-button-remove'
							: 'btn cbi-button-positive',
						click: ui.createHandlerFn(this, () => {
							let label = '', fstype = entry.fileSystem;
							ui.showModal(_('Format %s').format(fullDev), [
								E('style', ['h4 {text-align:center;color:red;}']),
								E('p', { style: 'margin:15px 0;color:red;' },
									_('Are you sure you want to format %s? All data will be cleared!').format(fullDev)
								),
								E('div', { style: 'display:flex;align-items:center;gap:10px;' }, [
									E('label', { style: 'min-width:80px;font-weight:bold;' }, _('File system:')),
									E('select', {
										style: 'flex:1;padding:6px;',
										change: ui.createHandlerFn(this, (ev) => fstype = ev.target.value)
									}, Object.keys(availableFS).map(k =>
										E('option', { value: k, selected: k === fstype ? '' : null }, availableFS[k].label))
									)
								]),
								E('div', { style: 'display:flex;align-items:center;gap:10px;' }, [
									E('label', { style: 'min-width:80px;font-weight:bold;' }, _('Partition label (optional):')),
									E('input', {
										class: 'cbi-input-text', style: 'flex:2;padding:6px;',
										blur: ui.createHandlerFn(this, (ev) => label = ev.target.value.trim())
									})
								]),
								E('div', { class: 'button-row' }, [
									E('button', { class: 'btn', click: ui.hideModal }, _('Cancel')),
									E('button', {
										class: 'btn cbi-button-positive important',
										click: ui.createHandlerFn(this, () => {
											const fsTool = availableFS[fstype] || availableFS.ext4;
											let finalArgs = [...fsTool.args];
											if (label) {
												if (fstype === 'fat32' || fstype === 'exfat') {
													label = label.replace(/[^a-zA-Z0-9 _\-]/g, '').substring(0, 11).trim();
													if (!label) return modalnotify(null, E('p', _('Partition label format is illegal')), 8000, 'error');
												}
												finalArgs.push(fsTool.labelFlag, label);
											};

											finalArgs.push(fullDev);
											ui.hideModal();
											ui.showModal(null, E('div', { class: 'spinning' }, _('Formatting...')));
											return umount_dev(fullDev, true)
												.then(() => fs.exec_direct(fsTool.cmd, finalArgs)
													.then(() => {
														modalnotify(null, E('p', _('Formatting completed')), 2000, 'success');
														return afterDiskChanged(self, path);
													})
													.catch((err) => modalnotify(null, E('p', _('Format failed: %s').format(err)), 8000, 'error'))
												)
										})
									}, _('Format'))
								])
							]);
						})
					}, _(isPrimary ? _('Format') : (tableTypeMap[fsCell] || fsCell)));

					if (mountPoints === '' && entry.fileSystem !== 'primary')
						mountPoints = E('button', {
							class: 'btn cbi-button-positive important',
							click: ui.createHandlerFn(this, () => mount_dev(fullDev))
						}, _('mount'));

					action.appendChild(E('button', {
						class: 'btn cbi-button-remove',
						title: _('delete partition'),
						click: ui.createHandlerFn(this, () => {
							ui.showModal(_('Delete %s partition').format(fullDev), [
								E('style', ['h4 {text-align:center;color:red;}']),
								E('p', { style: 'text-align:center;color:red;' }, _('Are you sure you want to delete partition %s? This operation will result in permanent data loss!').format(fullDev)),
								E('div', { class: 'button-row' }, [
									E('button', { class: 'btn', click: ui.hideModal }, _('Cancel')),
									E('button', {
										class: 'btn cbi-button-remove important',
										click: ui.createHandlerFn(this, () => deletePartitions(path, [entry.number]))
									}, _('Delete')),
								])
							]);
						})
					}, _('Delete')));
					action.appendChild(E('input', {
						type: 'checkbox',
						title: _('Select batch delete'),
						'data-partition': entry.number,
						style: 'margin-left: 10px; transform: scale(1.2);',
						change: ui.createHandlerFn(this, (ev) =>
							onSelectionChange(entry.number, ev.target.checked))
					}));
				} else {
					if ((entry.fileSystem === null || entry.fileSystem === 'Free Space') && entry.size > 2048)
						action.appendChild(E('button', {
							class: 'btn cbi-button-positive',
							click: ui.createHandlerFn(this, () => onreset(parted, entry.start, entry.end))
						}, _('New')));
				};
				const u = dfMap[fullDev] || { used: null, avail: null, percent: '-' };

				return [
					fullDev || '-',
					entry.start || '-',
					entry.end || '-',
					lsblkEntry.size || sectorsTohuman(entry.size),
					entry.type || '-',
					fsCell,
					u.used && u.avail
						? `${u.used}/${u.avail}(${lsblkEntry.percent || u.percent})`
						: '-',
					mountPoints,
					action
				];
			});

			const table = new ui.Table([
				_('device'), _('start sector'), _('end sector'), _('Size'), _('type'),
				_('File System'), _('Used/Idle (usage)'), _('Mount Point'), _('delete partition')
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

			const updateDeleteButton = () => {
				const buttonContainer = document.getElementById('button-container');
				if (!buttonContainer) return;

				let deleteBtn = document.getElementById('batch-delete-btn');

				if (selected.size > 0) {
					if (!deleteBtn) {
						deleteBtn = E('button', {
							id: 'batch-delete-btn', class: 'btn cbi-button-remove',
							click: ui.createHandlerFn(this, () => deletePartitions(diskDevice, Array.from(selected)))
						}, _('Delete %s in batches').format(selected.size));
						const cancelBtn = buttonContainer.querySelector('.cancel-btn');
						buttonContainer.insertBefore(deleteBtn, cancelBtn);
					} else {
						deleteBtn.textContent = _('Delete %s in batches').format(selected.size);
					}
				} else if (deleteBtn) {
					deleteBtn.remove();
				}
			};

			const onSelectionChange = (num, isSelected) => {
				isSelected ? selected.add(num + '') : selected.delete(num + '');
				updateDeleteButton();
			};

			ui.showModal(_('%s partition management').format(path), [
				E('style', ['.modal{max-width:1000px;padding:.5em;} h4{text-align:center;padding:9px;background:#f0f0f0;color:red;}']),
				E('h5', _('Device information')),
				disktable(parted, smart),
				E('h5', _('Partition information')),
				musttable(parted, df, onSelectionChange),
				E('div', {
					id: 'button-container',
					style: 'display:flex;justify-content:space-around;gap:0.5em;'
				}, [
					E('button', { class: 'btn cancel-btn', click: ui.hideModal }, _('Cancel'))
				])
			]);
		};

		parted.partitions.length > 0
			? dskirender(parted, df)
			: sfdiskToParted(sfdisk).then(sfdisk => dskirender(sfdisk, df))
	},

	handleSave: null,
	handleReset: null,
	handleSaveApply: null
});
