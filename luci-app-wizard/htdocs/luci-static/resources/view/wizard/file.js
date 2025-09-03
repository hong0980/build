'use strict';
'require fs';
'require ui';
'require view';

const notify = L.bind(ui.addTimeLimitedNotification || ui.addNotification, ui);
const configFiles = [
	{ path: '/etc/config/network',  title: _('Network configuration (network)'),   cmd: '/etc/init.d/network'},
	{ path: '/etc/config/firewall', title: _('Firewall configuration (firewall)'), cmd: '/etc/init.d/firewall'},
	{ path: '/etc/config/dhcp',     title: _('DHCP configuration (dhcp)'),         cmd: '/etc/init.d/dnsmasq'},
	{ path: '/etc/dnsmasq.conf',    title: _('DNS configuration (dnsmasq)'),       cmd: '/etc/init.d/dnsmasq'},
	{ path: '/etc/config/uhttpd',   title: _('Web server configuration (uhttpd)'), cmd: '/etc/init.d/uhttpd'},
	{ path: '/etc/config/wireless', title: _('Wireless configuration (wireless)'), cmd: '/sbin/wifi'},
	{ path: '/etc/hosts',           title: _('Host configuration (hosts)'),        cmd: '/etc/init.d/dnsmasq'},
	{ path: '/etc/crontabs/root',   title: _('Scheduled tasks (crontabs)'),        cmd: '/etc/init.d/cron'},
	{ path: '/etc/rc.local',        title: _('Startup script (rc.local)'),         cmd: ''}
];

return view.extend({
	dom: {},
	load: function () {
		return Promise.all(
			configFiles.map((res) => fs.stat(res.path)
				.then((stat) => ({ ...res, stat }))
				.catch(() => null)
			))
			.then((p) => p.filter(Boolean))
	},

	render: function (data) {
		this.dom.textarea = E('textarea', {
			readonly: '', wrap: 'off', rows: 10,
			style: 'width:100%; background-color:#272626; color:#c5c5b2; border:1px solid #555; font-family:Consolas, monospace; font-size:14px;'
		});
		const filestatus = E('div', { style: 'color:#888;font-size:90%;' });
		const view = E('div', [
			E('font', { color: 'red', style: 'font-weight: bold;' },
				_('The configuration file is directly edited and saved! Unless you know what you are doing, please do not modify these configuration files. Incorrect configurations may cause issues such as failure to boot or network errors.')),
			E('p', { style: 'color: green; font-weight: bold;' },
				_('It is recommended to back up the file before making changes. Comments can be added by starting a line with #.')),
			E('p', { style: 'display: flex; justify-content: center; align-items: center;gap: 10px;' }, [
				E('label', _('Choose File')),
				E('select', {
					class: 'cbi-input-select', style: 'width: 180px;',
					change: ui.createHandlerFn(this, (ev) => {
						const filepath = ev.target.value;
						const config = data.find((c) => c.path === filepath);
						config.stat && fs.read(filepath).then((content) => {
							this.dom.path = filepath;
							this.dom.cmd = config.cmd;
							this.dom.oldcontent = content;
							this.dom.textarea.value = content;
							this.dom.textarea.rows = Math.min(content.split('\n').length + 3, 20),
								filestatus.textContent = _('Last modified: %s, Size: %s bytes').format(
									new Date(config.stat.mtime * 1000).toLocaleString(), config.stat.size);
						});
					})
				}, [
					E('option', { value: '' }, _('-- Please choose --')),
					...data.map((c) => E('option', { value: c.path }, c.title))
				]),
				E('div', { style: 'color: red;' }, _('Readonly')),
				E('input', {
					type: 'checkbox', checked: 'true',
					change: ui.createHandlerFn(this, (ev) => {
						const isChecked = ev.target.checked;
						this.dom.textarea.readOnly = isChecked;
						this.dom.actions.style.display = isChecked ? 'none' : 'block';
					})
				}),
			]),
			this.dom.textarea,
			filestatus
		]);
		setTimeout(() => {
			this.dom.actions = document.querySelector('.cbi-page-actions');
			this.dom.actions.style.display = 'none';
		}, 0);
		return view;
	},

	handleSaveApply: function () {
		const content = this.dom.textarea.value.trim().replace(/\r\n/g, '\n');
		if (this.dom.oldcontent === content)
			return notify(null, E('p', _('No modifications detected. The content remains unchanged.')), 3000);

		this.dom.path && fs.write(this.dom.path, content + '\n')
			.then(() => {
				notify(null, E('p', '%s %s'.format(this.dom.path, _('Contents have been saved.'))), 5000, 'info');
				if (this.dom.cmd) {
					fs.exec(this.dom.cmd, ['reload']).then((res) =>
						res.code === 0
							? notify(null, E('p', _('Service %s reloaded successfully.').format(this.dom.cmd)), 5000, 'info')
							: notify(null, E('p', _('Service reload failed: %s').format(e.message)), 5000, 'warning')
					);
				};
			}).catch((e) =>
				notify(null, E('p', _('Unable to save contents: %s').format(e.message)), 5000, 'error')
			);
	},

	handleSave: function () {
		const content = this.dom.textarea.value.trim().replace(/\r\n/g, '\n');
		if (this.dom.oldcontent === content)
			return notify(null, E('p', _('No modifications detected. The content remains unchanged.')), 3000);

		this.dom.path && fs.write(this.dom.path, content + '\n')
			.then(() => notify(null, E('p', '%s %s'.format(this.dom.path, _('Contents have been saved.'))), 5000, 'info'))
			.catch(e => notify(null, E('p', _('Unable to save contents: %s').format(e.message)), 5000, 'error'));
	},

	handleReset: function () {
		this.dom.path && (this.dom.textarea.value = this.dom.oldcontent);
	}
});
