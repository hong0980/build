'use strict';
'require view';
'require fs';
'require ui';

var isReadonlyView = !L.hasViewPermission() || null;
var configFiles = [
	'/etc/config/network',
	'/etc/config/firewall',
	'/etc/config/dhcp',
	'/etc/dnsmasq.conf',
	'/etc/config/uhttpd',
	'/etc/config/wireless',
	'/etc/hosts',
	'/etc/rc.local',
	'/etc/crontabs/root'
].map(function(path) {
	var fileName = path.split('/').pop();
	var tabName = fileName.includes('.') ? fileName.split('.').shift() : fileName;
	return {
		path: path,
		data_tab: tabName,
		title: fileName.replace(/^./, function(c) { return c.toUpperCase(); })
	};
});

return view.extend({
	load: function() {
		return Promise.all([
			...configFiles.map(function(config) { return L.resolveDefault(fs.read(config.path), null)})
		]);
	},

	handleFileSave: function(path, textareaId) {
		var value = document.getElementById(textareaId).value;
		return fs.write(path, value).then(function() {
			ui.addNotification(null, E('p',
				_('Contents of %s have been saved.').format(path)), 'info');

			var service = path.includes('crontabs') ? 'cron' :
						 path.includes('dhcp') ? 'dnsmasq' :
						 path.includes('wireless') ? 'wifi' :
						 path.includes('uhttpd') ? 'uhttpd' :
						 path.includes('network') ? 'network' :
						 path.includes('dnsmasq') ? 'dnsmasq' :
						 path.includes('firewall') ? 'firewall' : null;
			if (service) {
				var cmd = service === 'wifi' ? '/sbin/wifi' : '/etc/init.d/' + service;
				var args = service === 'wifi' ? ['reload'] : ['reload'];
				return fs.exec_direct(cmd, args).then(function() {
					ui.addNotification(null, E('p',
						_('Service %s reloaded successfully.').format(cmd)), 'info');
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
		var tabContents = configFiles.map(function(config, index) {
			var content = data[index];
			return content ?
				E('div', { 'class': 'cbi-tab', 'data-tab': config.data_tab, 'data-tab-title': _('%s Configuration File').format(config.title)}, [
					E('p', {}, _("This page contains the configuration file content for <code>%s</code>. After editing, click the <b><font color='red'>Save</font></b> button to apply changes immediately.").format(config.path)),
					E('div', { 'class': 'cbi-checkbox', 'style': 'display: flex; justify-content: flex-end; margin-bottom: 10px;' }, [
						E('label', { 'style': 'margin-right: 10px;' }, [
							E('font', { 'color': 'red' }, _('Enable editing')),
						]),
						E('input', {
							'type': 'checkbox',
							'id': 'edit_' + config.data_tab,
							'disabled': isReadonlyView,
							'change': function(ev) {
								var textarea = document.getElementById(config.data_tab);
								var saveButton = document.getElementById('save_' + config.data_tab);
								saveButton.style.display = ev.target.checked ? 'inline-block' : 'none';
								textarea.readOnly = !ev.target.checked;
							}
						})
					]),
					E('textarea', {
						'rows': 22,
						'id': config.data_tab,
						'readonly': true,
						'style': 'width:100%; background-color:#272626; color:#c5c5b2; border:1px solid #555; font-family:Consolas, monospace; font-size:14px;'
					}, [content]),
					E('div', { 'class': 'cbi-page-actions' }, [
						E('button', {
							'id': 'save_' + config.data_tab,
							'class': 'btn cbi-button-save',
							'disabled': isReadonlyView,
							'style': 'display: none;',
							'click': ui.createHandlerFn(self, 'handleFileSave', config.path, config.data_tab)
						}, _('Save'))
					])
				]) : null;
		}).filter(function(item) { return !!item; });

		var view = E('div', {}, [
			E('b', {}, [
				E('font', { 'color': 'red' }, _('The configuration file is directly edited and saved! Unless you know what you are doing, please do not modify these configuration files. Incorrect configurations may cause issues such as failure to boot or network errors.')),
				E('br'),
				E('font', { 'color': 'green' }, _('It is recommended to back up the file before making changes. Comments can be added by starting a line with #.'))
			]),
			E('div', { 'class': 'cbi-tab-container' }, tabContents)
		]);

		setTimeout(function() {
			document.querySelectorAll('input[id^="edit_"]').forEach(function(checkbox) {
				if (!checkbox.disabled) checkbox.checked = false;
			});
		}, 0);

		ui.tabs.initTabGroup(view.lastElementChild.childNodes);
		return view;
	},

	handleSave: null,
	handleReset: null,
	handleSaveApply: null
});
