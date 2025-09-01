'use strict';
'require fs';
'require ui';
'require view';

const d = {};
const notify = L.bind(ui.addTimeLimitedNotification || ui.addNotification, ui);
const configFiles = [
	{ path: '/etc/config/network', 	title: _('Network configuration (network)') },
	{ path: '/etc/config/firewall', title: _('Firewall configuration (firewall)') },
	{ path: '/etc/config/dhcp',		title: _('DHCP configuration (dhcp)') },
	{ path: '/etc/dnsmasq.conf',	title: _('DNS configuration (dnsmasq)') },
	{ path: '/etc/config/uhttpd',	title: _('Web server configuration (uhttpd)') },
	{ path: '/etc/config/wireless', title: _('Wireless configuration (wireless)') },
	{ path: '/etc/hosts',			title: _('Host configuration (hosts)') },
	{ path: '/etc/rc.local',		title: _('Startup script (rc.local)') },
	{ path: '/etc/crontabs/root',	title: _('Scheduled tasks (crontabs)') }
];

return view.extend({
	load: () => Promise.all(
		configFiles.map((res) =>
			fs.stat(res.path)
				.then((stat) => ({ ...res, stat }))
				.catch(() => null)
		))
		.then((data) => Object.fromEntries(data.filter(Boolean).map(c => [c.path, c]))),

	render: function (data) {
		const filestatus = E('span', { style: 'color:#888;font-size:90%;' });
		const view = E('div', [
			E('font', { color: 'red', style: 'font-weight: bold;' },
				_('The configuration file is directly edited and saved! Unless you know what you are doing, please do not modify these configuration files. Incorrect configurations may cause issues such as failure to boot or network errors.')),
			E('div', { class: 'cbi-value', style: 'align-items: center;' }, [
				E('label', { class: 'cbi-value-title' }, _('Choose File')),
				E('div', { class: 'cbi-value-field', style: 'max-width: 200px;' }, [
					E('select', {
						class: 'cbi-input-select',
						change: ui.createHandlerFn(this, (ev) => {
							const filepath = ev.target.value;
							filepath && fs.read(filepath).then(content => {
								const set = data[filepath];
								filestatus.textContent = _('Last modified: %s, Size: %s bytes').format(
									new Date(set.stat.mtime * 1000).toLocaleString(), set.stat.size);
								d.path = filepath;
								d.oldcontent = content;
								d.textarea.value = content;
							});
						})
					}, [
						E('option', { value: '' }, _('-- Please choose --')),
						...Object.values(data).map(config => E('option', { value: config.path }, config.title))
					])
				]),
				E('div', { style: 'display: flex; align-items: center; margin-left: 25px;' }, [
					E('label', { style: 'color: red; cursor: pointer;' }, _('Readonly')),
					E('input', {
						type: 'checkbox', style: 'margin-left: 12px;', checked: true,
						change: ui.createHandlerFn(this, (ev) => {
							const isChecked = ev.target.checked;
							d.textarea.readOnly = isChecked;
							d.actions.style.display = isChecked ? 'none' : 'block';
						})
					})
				])
			]),
			E('textarea', {
				readonly: '', wrap: 'off', rows: 20,
				style: 'width:100%; background-color:#272626; color:#c5c5b2; border:1px solid #555; font-family:Consolas, monospace; font-size:14px;',
			}),
			E('div', { class: 'cbi-value-description' }, [
				E('font', { color: 'green', style: 'font-weight: bold;' },
					_('It is recommended to back up the file before making changes. Comments can be added by starting a line with #.')),
				filestatus,
			]),
		]);
		setTimeout(() => {
			d.textarea = document.querySelector('textarea');
			d.actions = document.querySelector('.cbi-page-actions');
			if (d.actions) d.actions.style.display = 'none';
		}, 0);
		return view;
	},

	handleSaveApply: function () {
		if (d.oldcontent === d.textarea.value)
			return notify(null, E('p', _('No modifications detected. The content remains unchanged.')), 3000);
		d.path && fs.write(d.path, d.textarea.value).then(() => {
			notify(null, E('p', '%s %s'.format(d.path, _('Contents have been saved.'))), 5000, 'info');
			const serviceMap = [
				{ key: 'wireless', cmd: '/sbin/wifi' },
				{ key: 'crontabs', cmd: '/etc/init.d/cron' },
				{ key: 'uhttpd', cmd: '/etc/init.d/uhttpd' },
				{ key: 'dhcp', cmd: '/etc/init.d/dnsmasq' },
				{ key: 'hosts', cmd: '/etc/init.d/dnsmasq' },
				{ key: 'network', cmd: '/etc/init.d/network' },
				{ key: 'dnsmasq', cmd: '/etc/init.d/dnsmasq' },
				{ key: 'firewall', cmd: '/etc/init.d/firewall' }
			];

			const service = serviceMap.find(({ key }) => d.path.includes(key));
			if (service) {
				fs.exec(service.cmd, ['reload']).then((res) =>
					res.code === 0
						? notify(null, E('p', _('Service %s reloaded successfully.').format(service.cmd)), 5000, 'info')
						: notify(null, E('p', _('Service reload failed: %s').format(e.message)), 5000, 'warning')
				);
			};
		}).catch((e) =>
			notify(null, E('p', _('Unable to save contents: %s').format(e.message)), 5000, 'error')
		);
	},

	handleSave: function () {
		if (d.oldcontent === d.textarea.value)
			return notify(null, E('p', _('No modifications detected. The content remains unchanged.')), 3000);
		d.path && fs.write(d.path, d.textarea.value)
			.then(() => notify(null, E('p', '%s %s'.format(d.path, _('Contents have been saved.'))), 5000, 'info'))
			.catch(e => notify(null, E('p', _('Unable to save contents: %s').format(e.message)), 5000, 'error'));
	},

	handleReset: function () {
		d.path && (document.querySelector('textarea').value = d.oldcontent);
	},
});
