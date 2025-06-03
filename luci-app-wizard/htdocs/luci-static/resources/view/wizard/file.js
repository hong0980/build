'use strict';
'require view';
'require fs';
'require ui';

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
	load: function() {
		return Promise.all(
			configFiles.map(function(r) {
				return fs.stat(r.path)
					.then(function(s) { return s.size > 0 ? r : null })
					.catch(function() { return null });
			})
		).then(function(p) {
			return p.filter(Boolean);
		});
	},

	handleFileSave: function(path, textareaId) {
		var value = document.getElementById(textareaId).value;
		return fs.write(path, value).then(function() {
			ui.addNotification(null, E('p',
				_('Contents of %s have been saved.').format(path)), 'info');

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
				return fs.exec_direct(c, 'reload').then(function() {
					ui.addNotification(null, E('p',
						_('Service %s reloaded successfully.').format(c)), 'info');
				}).catch(function(err) {
					ui.addNotification(null, E('p',
						_('Service reload failed: %s').format(err.message)), 'warning');
				});
			}
		}).catch(function(err) {
			ui.addNotification(null, E('p',
				_('Unable to save contents: %s').format(err.message)), 'error');
		});
	},

	render: function(data) {
		var self = this;
		self.originalContent = '';
		self.lastSelectedPath = '';
		return E('div', { 'class': 'cbi-section' }, [
			E('font', { 'color': 'red', 'style': 'font-weight: bold;' },
				_('The configuration file is directly edited and saved! Unless you know what you are doing, please do not modify these configuration files. Incorrect configurations may cause issues such as failure to boot or network errors.')),
			E('div', { 'class': 'cbi-value' }, [
				E('label', { 'class': 'cbi-value-title' }, _('Choose File')),
				E('div', { 'style': 'display: flex; align-items: center; gap: 20px; justify-content: space-between;' }, [
					E('div', { 'class': 'cbi-value-field', 'style': 'flex: 1;' }, [
						E('select', {
							'id': 'file_select', 'class': 'cbi-input-select',
							'change': function(ev) {
								var value = ev.target.value;
								var textarea = document.getElementById('file_content');
								var editToggle = document.getElementById('edit_toggle');
								if (!value) {
									textarea.value = self.originalContent || '';
									textarea.readOnly = editToggle.checked;
									return;
								}
								fs.read(value)
									.then(function(content) {
										textarea.value = content;
										self.lastSelectedPath = value;
										self.originalContent = content;
										textarea.readOnly = editToggle.checked;
									})
									.catch(function(err) {
										ui.addNotification(null, E('p',
											_('Unable to read %s: %s').replace("%s", value).replace("%s", err.message)), 'error');
									});
							}
						}, [
							E('option', { 'value': '' }, _('-- Please choose --')),
							...data.map(function(config) {
								return E('option', { 'value': config.path }, config.title);
							})
						])
					]),
					E('div', { 'class': 'cbi-checkbox', 'style': 'display: flex; align-items: center; gap: 10px;' }, [
						E('label', {}, [
							E('font', { 'color': 'red' }, _('Readonly'))
						]),
						E('input', {
							'type': 'checkbox', 'id': 'edit_toggle', 'checked': true,
							'change': function(ev) {
								var isChecked = ev.target.checked;
								document.getElementById('file_content').readOnly = isChecked;
								document.getElementById('page-actions').style.display = !isChecked ? 'block' : 'none';
							}
						})
					])
				]),
			]),
			E('div', { 'style': 'width:100%' }, [
				E('textarea', {
					'rows': 22, 'id': 'file_content', 'readonly': true,
					'style': 'width:100%; background-color:#272626; color:#c5c5b2; border:1px solid #555; font-family:Consolas, monospace; font-size:14px;'
				}, '')
			]),
			E('div', { 'class': 'cbi-value-description' }, [
				E('font', { 'color': 'green', 'style': 'font-weight: bold;' },
					_('It is recommended to back up the file before making changes. Comments can be added by starting a line with #.'))
			]),
			E('div', { 'class': 'cbi-page-actions', 'style': 'display: none;', 'id': 'page-actions' }, [
				E('button', {
					'id': 'save_button', 'class': 'btn cbi-button-save',
					'style': 'margin-right: 10px;',
					'click': ui.createHandlerFn(self, function() {
						var path = document.getElementById('file_select').value || self.lastSelectedPath;
						if (!path) {
							ui.addNotification(null, E('p', _('Please select a file.')), 'error');
							return;
						}
						return self.handleFileSave(path, 'file_content');
					})
				}, _('Save')),
				E('button', {
					'id': 'reset_button', 'class': 'btn cbi-button-reset',
					'click': ui.createHandlerFn(self, function() {
						document.getElementById('file_content').value = self.originalContent;
					})
				}, _('Reset'))
			])
		]);
	},

	handleSave: null,
	handleReset: null,
	handleSaveApply: null
});
