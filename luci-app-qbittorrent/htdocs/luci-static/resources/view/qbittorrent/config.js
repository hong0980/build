'use strict';
'require fs';
'require ui';
'require uci';
'require form';
'require view';

const callServiceStatus = L.rpc.declare({
	object: 'service',
	method: 'list',
	params: ['name'],
	filter: function (data) {
		for (const svcName in data) {
			const svc = data[svcName];
			if (!svc || !svc.instances) continue;
			for (const instName in svc.instances) {
				return !!svc.instances[instName].running;
			}
		}
		return false;
	}
});

return view.extend({
	load: function () {
		return Promise.all([
			fs.exec_direct('/bin/df', ['-h']),
			uci.load('qbittorrent')
				.then(() => uci.get('qbittorrent', 'main', 'BinaryFiles'))
				.then(c =>
					fs.exec_direct('/usr/bin/env', ['HOME=/tmp/qb', c || '/usr/bin/qbittorrent-nox', '-v'])
						.then(r => r.trim().split('v').pop()),
				),
			callServiceStatus('qbittorrent'),
		]);
	},

	render([diskList, version, running]) {
		let m, s, o;
		const port = uci.get('qbittorrent', 'main', 'webui_port') || '8080';
		const v = version.split('.').map(Number);
		const hasApiKeySupport = v[0] > 5 || (v[0] === 5 && v[1] > 2) || (v[0] === 5 && v[1] === 2 && (v[2] || 0) >= 0);
		const statusEl = E('b', { style: `color:${running ? 'green' : 'red'}` }, [
			'qBittorrent ' + (running ? _('RUNNING') : _('NOT RUNNING')),
		]);

		const btnEl = E('div', [
			E('div', {
				class: 'btn cbi-button-apply', style: running ? '' : 'display:none',
				click: ui.createHandlerFn(this, () => window.open(`http://${window.location.hostname}:${port}`, '_blank'))
			}, _('Open Web Interface'))
		]);

		m = new form.Map('qbittorrent', _('qBittorrent'),
			'%s  %s'.format(
				_('A cross-platform open source BitTorrent client based on QT.'),
				_("Current version: <b style='color:red'>%s</b>").format(version)
			));

		s = m.section(form.TypedSection);
		s.render = () =>
			E('p', { style: 'display: flex; align-items: center; gap: 10px;' }, [
				statusEl, btnEl,
			]);

		s = m.section(form.NamedSection, 'main');

		s.tab("basic", _("Basic Settings"));
		s.tab("advanced", _("Advanced Settings"));

		o = s.taboption("basic", form.Flag, "Enabled", _("Enabled"),
			_("All plugin configurations take precedence over WebUI settings."));

		o = s.taboption("basic", form.Value, "RootProfilePath", _("Root Path of the Profile"),
			_("Specify the root path of all profiles"));
		o.default = '/etc';
		o.rmempty = false;

		o = s.taboption("basic", form.Value, "DefaultSavePath", _("Save Path"),
			_("The files are stored in the download directory automatically created under the selected mounted disk"))
		var devMap = {};
		diskList.trim().split('\n').slice(1).forEach(line => {
			var [dev, size, used, , usedPct, mount] = line.trim().split(/\s+/);
			const isExternalDev = dev && (dev.startsWith('/dev/sd') || dev.startsWith('/dev/nvme') || dev.startsWith('/dev/mmcblk'));
			if (!isExternalDev || !mount?.startsWith('/mnt') || devMap[dev]) return;
			devMap[dev] = true;
			o.value(mount + '/download',
				_('%s/download (size: %s) (used: %s/%s)').format(mount, size, used, usedPct));
		});
		o.rmempty = false;

		o = s.taboption("basic", form.Value, "Locale", _("Locale Language"),
			_("The supported language codes can be used to customize the setting."));
		o.value("zh_CN", _("Simplified Chinese"));
		o.value("en", _("English"));
		o.default = "zh_CN";
		o.rmempty = false;

		o = s.taboption("basic", form.Value, "webui_port", _("Listening Port"),
			_("The listening port for WebUI."));
		o.datatype = "port";
		o.default  = '8080';
		o.rmempty  = false;

		const webAuthDesc = !hasApiKeySupport
			? _("If you change the settings in the WebUI, please sync them here, otherwise qBittorrent configurations cannot be synced.")
			: '';

		o = s.taboption("basic", form.Value, "webuser", _("WebUI Username"), webAuthDesc);
		o.default  = "admin";
		o.datatype = 'minlength(3)';
		o.rmempty  = false;

		o = s.taboption("basic", form.Value, "webpass", _("WebUI Password"), webAuthDesc);
		o.default  = "password";
		o.datatype = 'minlength(6)';
		o.rmempty  = false;

		if (hasApiKeySupport) {
			o = s.taboption('basic', form.Value, 'api_key', _('API Key'),
				_('Leave empty to let qBittorrent auto-generate and auto-fill; a custom key only takes effect on first configuration.'));
			// o.password = true;
			o.validate = function(section_id, value) {
				if (value && !/^qbt_[A-Za-z0-9]{28}$/.test(value))
					return _('Invalid format: must start with "qbt_" followed by 28 alphanumeric characters (32 characters total).');
				return true;
			};
			o.renderWidget = function(section_id, option_index, cfgvalue) {
				const node = form.Value.prototype.renderWidget.apply(this, arguments);
				const input = node.querySelector('input');
				node.classList.add('control-group');
				node.appendChild(E('button', {
					'class': 'btn cbi-button-add',
					'click': ui.createHandlerFn(this, function(ev) {
						if (!window.crypto || !window.crypto.getRandomValues) {
							ui.addNotification(null, E('p', _('Browser does not support secure random number generation.')), 'error');
							return;
						}

						const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
						const bytes = new Uint8Array(28);
						window.crypto.getRandomValues(bytes);

						input.value = 'qbt_' + Array.from(bytes, b => chars[b % chars.length]).join('');
						input.dispatchEvent(new Event('change', { bubbles: true }));
					})
				}, _('Generate Randomly')));
				return node;
			};
		};

		o = s.taboption("advanced", form.Flag, "ASWEnabled", _("Subnet Whitelist"),
			_("Bypass authentication for clients in Whitelisted IP Subnets."));
		o.enabled  = "true";
		o.disabled = "false";
		o.default  = o.disabled;
		o.rmempty  = false;

		o = s.taboption("advanced", form.DynamicList, "ASWlist", _("Whitelisted Subnets"))
		o.placeholder = _('Example: 172.17.32.0/24, fdff:ffff:c8::/40');
		o.datatype = "ipaddr";
		o.depends("ASWEnabled", "true");

		o = s.taboption("advanced", form.Flag, "PFEnabled", _("UPnP / NAT-PMP"),
			_("Use UPnP / NAT-PMP to forward the listening port on the router."));
		o.enabled  = "true";
		o.disabled = "false";
		o.default  = o.enabled;
		o.rmempty  = false;

		o = s.taboption("advanced", form.Value, "listen_port", _("Port used for incoming connections"));
		o.datatype = "port";
		o.default  = "8999";
		o.depends("PFEnabled", "true");

		o = s.taboption("advanced", form.Flag, "PreallocateAll", _("Preallocate disk space"),
			_("Preallocate all files when adding torrents."));
		o.enabled  = "true";
		o.disabled = "false";
		o.default  = o.enabled;
		o.rmempty  = false;

		o = s.taboption("advanced", form.Flag, "IncompleteFilesExt", _("Incomplete file extension"),
			_("Append .!qB to files that are not yet complete."));
		o.enabled  = "true";
		o.disabled = "false";
		o.default  = o.enabled;
		o.rmempty  = false;

		o = s.taboption("advanced", form.Flag, "CSRFProtection", _("CSRF Protection"),
			_("Disable Cross-Site Request Forgery (CSRF) protection"));
		o.enabled  = "false";
		o.disabled = "true";
		o.default  = o.enabled;
		o.rmempty  = false;

		o = s.taboption('advanced', form.Flag, 'log_Enabled', _('Enable Log'),
			_('Enable logger to log file.'));
		o.enabled  = 'true';
		o.disabled = 'false';
		o.default  = o.enabled;
		o.rmempty  = false;

		o = s.taboption('advanced', form.Value, 'Log_Path', _('Log Path'),
			_("Modify the path to save log files"));
		o.depends('log_Enabled', 'true');
		o.validate = function(section_id, value) {
			if (value && !/^\//.test(value)) return _('Must be an absolute path');
			return true;
		};

		o = s.taboption("advanced", form.FileUpload, "BinaryFiles", _("qBittorrent Binary"),
			_("Upload and select the static binary.<br /><a href='https://github.com/userdocs/qbittorrent-nox-static/releases' target='_blank'>Official (userdocs) GitHub</a> | <a href='https://github.com/c0re100/qBittorrent-Enhanced-Edition/releases' target='_blank'>Enhanced Edition (EE) GitHub</a>"));
		o.root_directory = '/usr/libexec';
		o.enable_remove  = false;
		o.enable_upload  = true;

		L.Poll.add(L.bind(() => callServiceStatus('qbittorrent').then(running => {
			statusEl.style.color = running ? 'green' : 'red';
			statusEl.textContent = 'qBittorrent ' + (running ? _('RUNNING') : _('NOT RUNNING'));
			btnEl.style.display = running ? '' : 'none';
		}), this));

		return m.render();
	}
});
