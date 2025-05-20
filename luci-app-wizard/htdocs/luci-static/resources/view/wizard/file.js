'use strict';
'require view';
'require fs';
'require ui';

var configFiles = [
	{ path: '/etc/config/network', title: _('网络配置（network）') },
	{ path: '/etc/config/firewall', title: _('防火墙配置（firewall）') },
	{ path: '/etc/config/dhcp', title: _('DHCP配置（dhcp）') },
	{ path: '/etc/dnsmasq.conf', title: _('DNS配置（dnsmasq）') },
	{ path: '/etc/config/uhttpd', title: _('Web服务器配置（uhttpd）') },
	{ path: '/etc/config/wireless', title: _('无线配置（wireless）') },
	{ path: '/etc/hosts', title: _('主机配置（hosts）') },
	{ path: '/etc/rc.local', title: _('启动脚本') },
	{ path: '/etc/crontabs/root', title: _('定时任务（crontabs）') }
];

return view.extend({
	load: function() {
		return Promise.all(
			configFiles.map(function(r) {
				return fs.stat(r.path)
					.then(function() { return r })
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
				var a = s === 'wifi' ? ['reload'] : ['reload'];
				return fs.exec_direct(c, a).then(function() {
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
		var view = E('div', { 'class': 'cbi-section' }, [
			E('b', {}, [
				E('font', { 'color': 'red' }, _('The configuration file is directly edited and saved! Unless you know what you are doing, please do not modify these configuration files. Incorrect configurations may cause issues such as failure to boot or network errors.')),
				E('br'),
				E('font', { 'color': 'green' }, _('It is recommended to back up the file before making changes. Comments can be added by starting a line with #.'))
			]),
			E('div', { 'class': 'cbi-value' }, [
				E('label', { 'class': 'cbi-value-title' }, _('Choose File')),
				E('div', { 'class': 'cbi-value-field' }, [
					E('select', {
						'id': 'file_select',
						'class': 'cbi-input-select',
						'change': function(ev) {
							var value = ev.target.value;
							var textarea = document.getElementById('file_content');
							var editToggle = document.getElementById('edit_toggle');
							textarea.value = '';
							self.originalContent = '';
							fs.read(value)
								.then(function(content) {
									textarea.value = content;
									self.originalContent = content;
									textarea.readOnly = editToggle.checked;
								})
								.catch(function(err) {
									ui.addNotification(null, E('p',
										_('Unable to read file: %s').format(err.message)), 'error');
								});
						}
					}, [
						E('option', { 'value': '' }, _('-- Please choose --')),
						...data.map(function(config) {
							return E('option', { 'value': config.path }, config.title);
						})
					])
				])
			]),
			E('div', { 'class': 'cbi-value' }, [
				E('div', { 'class': 'cbi-checkbox', 'style': 'display: flex; justify-content: flex-end; margin-bottom: 10px; width: 100%;' }, [
					E('label', { 'style': 'margin-right: 10px;' }, [
						E('font', { 'color': 'red' }, _('Readonly'))
					]),
					E('input', {
						'type': 'checkbox',
						'id': 'edit_toggle',
						'checked': true,
						'change': function(ev) {
							var isChecked = ev.target.checked;
							var textarea = document.getElementById('file_content');
							var buttons = [document.getElementById('save_button'), document.getElementById('reset_button')];
							textarea.readOnly = isChecked;
							buttons.forEach(function(button) {
								button.style.display = !isChecked ? 'inline-block' : 'none';
							});
						}
					})
				]),
				E('div', { 'style': 'width:100%' }, [
					E('textarea', {
						'rows': 22,
						'id': 'file_content',
						'style': 'width:100%; background-color:#272626; color:#c5c5b2; border:1px solid #555; font-family:Consolas, monospace; font-size:14px;',
						'readonly': true
					}, '')
				])
			]),
			E('div', { 'class': 'cbi-page-actions',  }, [
				E('button', {
					'id': 'save_button',
					'class': 'btn cbi-button-save',
					'style': 'display: none; margin-right: 10px;',
					'click': ui.createHandlerFn(self, function() {
						var path = document.getElementById('file_select').value;
						if (!path) {
							ui.addNotification(null, E('p', _('Please select a file.')), 'error');
							return;
						}
						return self.handleFileSave(path, 'file_content');
					})
				}, _('Save')),
				E('button', {
					'id': 'reset_button',
					'style': 'display: none',
					'class': 'btn cbi-button-reset',
					'click': ui.createHandlerFn(self, function() {
						var textarea = document.getElementById('file_content');
						textarea.value = self.originalContent;
					})
				}, _('Reset'))
			])
		]);

		return view;
	},

	handleSave: null,
	handleReset: null,
	handleSaveApply: null
});
