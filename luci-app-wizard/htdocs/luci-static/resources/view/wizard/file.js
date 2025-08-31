'use strict';
'require fs';
'require ui';
'require view';

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
		this.path = '';
		this.content = '';
		const dom = {};
		const fileStatusDiv = E('span', { style: 'color:#888;font-size:90%;' });
		const view = E('div', {}, [
			E('font', { color: 'red', style: 'font-weight: bold;' },
				_('The configuration file is directly edited and saved! Unless you know what you are doing, please do not modify these configuration files. Incorrect configurations may cause issues such as failure to boot or network errors.')),
			E('div', { class: 'cbi-value', style: 'align-items: center;' }, [
				E('label', { class: 'cbi-value-title' }, _('Choose File')),
				E('div', { class: 'cbi-value-field', style: 'max-width: 200px;' }, [
					E('select', {
						class: 'cbi-input-select',
						change: ui.createHandlerFn(this, (ev) => {
							fileStatusDiv.innerHTML = '';
							const filepath = ev.target.value;
							filepath && fs.read(filepath).then(content => {
								const selectedset = data[filepath];
								if (selectedset) {
									fileStatusDiv.innerHTML = _('Last modified: %s, Size: %s bytes').format(
										new Date(selectedset.stat.mtime * 1000).toLocaleString(), selectedset.stat.size);
								};
								this.path = filepath;
								this.content = content;
								dom.textarea.value = content;
							})
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
							var isChecked = ev.target.checked;
							dom.textarea.readOnly = isChecked;
							document.getElementById('page_actions').style.display = isChecked ? 'none' : 'block';
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
				fileStatusDiv,
			]),
			E('div', { class: 'cbi-page-actions', style: 'display: none;', id: 'page_actions' }, [
				E('div', {
					class: 'btn cbi-button-save', style: 'margin-right: 10px;',
					click: ui.createHandlerFn(this, () => {
						const path = dom.select.value || this.path;
						const value = dom.textarea.value;
						if (value === this.content) {
							notify(null, E('p', _('No modifications detected. The content remains unchanged.')), 3000);
						} else {
							this.handleFileSave(path, value.trim().replace(/\r\n/g, '\n') + '\n');
						};
					})
				}, _('Save')),
				E('div', {
					class: 'btn cbi-button-reset',
					click: ui.createHandlerFn(this, () => dom.textarea.value = this.content)
				}, _('Reset'))
			])
		]);
		setTimeout(() => {
			dom.select = document.querySelector('select');
			dom.textarea = document.querySelector('textarea');
		}, 0);
		return view;
	},

	handleFileSave: (path, value) => {
		fs.write(path, value).then(() => {
			notify(null, E('p', '%s %s'.format(path, _('Contents have been saved.'))), 5000, 'info');
			const serviceMap = {
				wireless: { cmd: '/sbin/wifi', args: ['reload'] },
				dhcp: { cmd: '/etc/init.d/dnsmasq', args: ['reload'] },
				crontabs: { cmd: '/etc/init.d/cron', args: ['reload'] },
				hosts: { cmd: '/etc/init.d/dnsmasq', args: ['reload'] },
				uhttpd: { cmd: '/etc/init.d/uhttpd', args: ['reload'] },
				network: { cmd: '/etc/init.d/network', args: ['reload'] },
				dnsmasq: { cmd: '/etc/init.d/dnsmasq', args: ['reload'] },
				firewall: { cmd: '/etc/init.d/firewall', args: ['reload'] }
			};

			const service = Object.entries(serviceMap).find(([key]) => path.includes(key));
			if (service) fs.exec(service[1].cmd, service[1].args).then(res =>
				res.code === 0
					? notify(null, E('p', _('Service %s reloaded successfully.').format(service[1].cmd)), 5000, 'info')
					: notify(null, E('p', _('Service reload failed: %s').format(e.message)), 5000, 'warning'));
		}).catch(e =>
			notify(null, E('p', _('Unable to save contents: %s').format(e.message)), 5000, 'error'));
	},

	handleSave: null,
	handleReset: null,
	handleSaveApply: null
});
