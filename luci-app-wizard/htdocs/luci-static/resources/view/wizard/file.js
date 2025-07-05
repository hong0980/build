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
	load: () => Promise.all(
		configFiles.map((r) =>
			fs.stat(r.path)
				.then((s) => s.size > 0 ? r : '')
				.catch(() => '')
			))
	.then((p) => p.filter(Boolean)),

	handleFileSave: function(path) {
		var value = document.getElementById('file_content').value;
		return fs.write(path, value)
			.then(function() {
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
						.then(function() {
							ui.addTimeLimitedNotification(null, E('p',
								_('Service %s reloaded successfully.').format(c)), 5000, 'info');
						})
						.catch(function(err) {
							ui.addTimeLimitedNotification(null, E('p',
								_('Service reload failed: %s').format(err.message)), 5000, 'warning');
						});
				}
			})
			.catch(function(err) {
				ui.addTimeLimitedNotification(null, E('p',
					_('Unable to save contents: %s').format(err.message)), 5000, 'error');
			});
	},

	render: function(data) {
		var self = this;
		self.originalContent = '';
		self.lastSelectedPath = '';
		return E('div', {}, [
			E('font', { 'color': 'red', 'style': 'font-weight: bold;' },
				_('The configuration file is directly edited and saved! Unless you know what you are doing, please do not modify these configuration files. Incorrect configurations may cause issues such as failure to boot or network errors.')),
			E('div', { 'class': 'cbi-value' }, [
			    E('label', { 'class': 'cbi-value-title' }, _('Choose File')),
		        E('div', { 'class': 'cbi-value-field', 'style': 'max-width: 200px;' }, [
		            E('select', { 'id': 'file_select', 'class': 'cbi-input-select',
		                'change': function(ev) {
		                    var value = ev.target.value;
		                    var textarea = document.getElementById('file_content');
		                    var editToggle = document.getElementById('edit_toggle');
		                    if (!value) {
		                        textarea.value = self.originalContent || '';
		                        textarea.readOnly = editToggle?.checked;
		                        return;
		                    };
		                    fs.read_direct(value)
		                        .then(function(content) {
		                            textarea.value = content;
		                            self.lastSelectedPath = value;
		                            self.originalContent = content;
		                            textarea.readOnly = editToggle?.checked;
		                        })
		                        .catch(function(err) {
		                            ui.addTimeLimitedNotification(null, E('p',
		                                _('Unable to read %s: %s').format(value, err.message)), 5000, 'error');
		                        });
		                }
		            }, [
		                E('option', { 'value': '' }, _('-- Please choose --')),
		                ...data.map(config => E('option', { 'value': config.path }, config.title))
		            ])
		        ]),
		        E('div', { 'style': 'display: flex; align-items: center; white-space: nowrap; margin-left: 25px;' }, [
		            E('label', { 'style': 'color: red; cursor: pointer;' }, _('Readonly')),
		            E('input', { 'type': 'checkbox', 'id': 'edit_toggle', 'style': 'margin-left: 12px;',
		                'checked': true, 'change': function(ev) {
		                    var isChecked = ev.target.checked;
		                    document.getElementById('file_content').readOnly = isChecked;
		                    document.getElementById('page-actions').style.display = isChecked ? 'none' : 'block';
		                }
		            })
		        ])
			]),

			E('textarea', {
				'rows': 18, 'id': 'file_content',
				'style': 'width:100%; background-color:#272626; color:#c5c5b2; border:1px solid #555; font-family:Consolas, monospace; font-size:14px;'
			}, ''),
			// E('div', { 'class': 'cbi-value-description' }, [
			// 	E('font', { 'color': 'green', 'style': 'font-weight: bold;' },
			// 		_('It is recommended to back up the file before making changes. Comments can be added by starting a line with #.'))
			// ]),
			E('div', { 'class': 'cbi-page-actions', 'style': 'display: none;', 'id': 'page-actions' }, [
				E('button', {
					'id': 'save_button', 'class': 'btn cbi-button-save',
					'style': 'margin-right: 10px;',
					'click': ui.createHandlerFn(self, function() {
						var path = document.getElementById('file_select').value || self.lastSelectedPath;
						if (!path) {
							ui.addTimeLimitedNotification(null, E('p', _('Please select a file.')), 5000, 'error');
							return;
						};
						return self.handleFileSave(path);
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
