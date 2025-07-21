'use strict';
'require fs';
'require ui';
'require view';

var configFiles = [
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
	load: function () {
		return Promise.all(
			configFiles.map((r) =>
				fs.stat(r.path)
					.then((stat) => stat.size > 0 ? { ...r, stat } : null)
					.catch(() => null)
			))
			.then((p) => p.filter(Boolean))
	},

	handleFileSave: function (path, value) {
		return fs.write(path, value)
			.then(() => {
				ui.addTimeLimitedNotification(null, E('p',
					_('Contents of %s have been saved.').format(path)), 5000, 'info');

				var s = path.includes('crontabs') ? 'cron' :
						path.includes('dhcp') ? 'dnsmasq' :
						path.includes('hosts') ? 'dnsmasq' :
						path.includes('wireless') ? 'wifi' :
						path.includes('uhttpd') ? 'uhttpd' :
						path.includes('network') ? 'network' :
						path.includes('dnsmasq') ? 'dnsmasq' :
						path.includes('firewall') ? 'firewall' : null;
				if (s) {
					var c = s === 'wifi' ? '/sbin/wifi' : '/etc/init.d/' + s;
					return fs.exec_direct(c, ['reload'])
						.then(() => {
							ui.addTimeLimitedNotification(null, E('p',
								_('Service %s reloaded successfully.').format(c)), 5000, 'info');
						})
						.catch((e) => {
							ui.addTimeLimitedNotification(null, E('p',
								_('Service reload failed: %s').format(e.message)), 5000, 'warning');
						});
				}
			})
			.catch((e) => {
				ui.addTimeLimitedNotification(null, E('p',
					_('Unable to save contents: %s').format(e.message)), 5000, 'error');
			});
	},

	render: function (data) {
		var self = this;
		var fileStatusDiv = E('span', { style: 'color:#888;font-size:90%;' });
		const textarea = new ui.Textarea(null, { rows: 18, id: 'file_content', readonly: true });
		self.fileContent = '', self.filePath = '';

		return E('div', {}, [
			E('style', { type: 'text/css' }, [
				`.cbi-input-textarea {
					font-size:14px; color: #c5c5b2; border: 1px solid #555;
					background-color: #272626; font-family: Consolas, monospace;
				}`
			]),
			E('font', { color: 'red', style: 'font-weight: bold;' },
				_('The configuration file is directly edited and saved! Unless you know what you are doing, please do not modify these configuration files. Incorrect configurations may cause issues such as failure to boot or network errors.')),
			E('div', { class: 'cbi-value' }, [
				E('label', { class: 'cbi-value-title' }, _('Choose File')),
				E('div', { class: 'cbi-value-field', style: 'max-width: 200px;' }, [
					E('select', {
						id: 'file_select', class: 'cbi-input-select',
						change: (ev) => {
							fileStatusDiv.innerHTML = '';
							var filePath = ev.target.value;
							var editToggle = document.getElementById('edit_toggle');

							if (!filePath) {
								textarea.setValue(self.fileContent);
								textarea.node.firstElementChild.readOnly = editToggle.checked;
								return;
							}

							var selectedConfig = data.find(c => c.path === filePath);
							if (selectedConfig.stat) {
								fileStatusDiv.innerHTML = _('Last modified: %s, Size: %s bytes').format(
									new Date(selectedConfig.stat.mtime * 1000).toLocaleString(),
									selectedConfig.stat.size
								);
							}

							fs.read_direct(filePath)
								.then((content) => {
									textarea.setValue(content);
									self.filePath = filePath;
									self.fileContent = content;
								})
								.catch((e) => {
									ui.addTimeLimitedNotification(null, E('p',
										_('Unable to read %s: %s').format(filePath, e.message)), 5000, 'error');
								});
						}
					}, [
						E('option', { value: '' }, _('-- Please choose --')),
						...data.map(config => E('option', { value: config.path }, config.title))
					])
				]),
				E('div', { style: 'display: flex; align-items: center; white-space: nowrap; margin-left: 25px;' }, [
					E('label', { style: 'color: red; cursor: pointer;' }, _('Readonly')),
					E('input', {
						type: 'checkbox', id: 'edit_toggle', style: 'margin-left: 12px;',
						checked: true, change: (ev) => {
							var isChecked = ev.target.checked;
							textarea.node.firstElementChild.readOnly = isChecked;
							document.getElementById('page-actions').style.display = isChecked ? 'none' : 'block';
						}
					})
				])
			]),
			textarea.render(),
			E('div', { class: 'cbi-value-description' }, [
				E('font', { color: 'green', style: 'font-weight: bold;' },
					_('It is recommended to back up the file before making changes. Comments can be added by starting a line with #.')),
				fileStatusDiv,
			]),
			E('div', { class: 'cbi-page-actions', style: 'display: none;', id: 'page-actions' }, [
				E('button', {
					class: 'btn cbi-button-save', style: 'margin-right: 10px;',
					click: ui.createHandlerFn(self, () => {
						var path = document.getElementById('file_select').value || self.filePath;
						if (!path) {
							return ui.addTimeLimitedNotification(null, E('p', _('Please select a file.')), 5000, 'error');
						}
						if (!textarea.isChanged()) {
							return ui.addTimeLimitedNotification(null, E('p',
								_('No modifications detected. The content remains unchanged.')), 3000, 'info');
						};
						const value = textarea.getValue().trim().replace(/\r\n/g, '\n');
						return self.handleFileSave(path, value);
					})
				}, _('Save')),
				E('button', {
					class: 'btn cbi-button-reset',
					click: ui.createHandlerFn(self, () => textarea.setValue(self.fileContent))
				}, _('Reset'))
			])
		]);
	},

	handleSave: null,
	handleReset: null,
	handleSaveApply: null
});
