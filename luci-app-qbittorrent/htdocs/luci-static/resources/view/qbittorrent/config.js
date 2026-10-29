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
				.then(() => uci.get('qbittorrent', 'main', 'BinaryLocation'))
				.then(c =>
					fs.exec_direct('/usr/bin/env', ['HOME=/var/run/qbittorrent', c || '/usr/bin/qbittorrent-nox', '-v'])
						.then(r => r.trim().split('v').pop()),
				),
			callServiceStatus('qbittorrent'),
		]);
	},

	render([diskList, version, running]) {
		let m, s, o;
		const port = uci.get('qbittorrent', 'main', 'port') || '8080';
		const statusEl = E('b', { style: `color:${running ? 'green' : 'red'}` }, [
			'qBittorrent ' + (running ? _('RUNNING') : _('NOT RUNNING')),
		]);

		const btnEl = E('div', [
			E('div', {
				class: 'btn cbi-button-apply', style: running ? '' : 'display:none',
				click: ui.createHandlerFn(this, () => open(`${location.origin}:${port}`))
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

		o = s.taboption("basic", form.Flag, "EnableService", _("Enabled"));

		o = s.taboption("basic", form.Value, "RootProfilePath", _("Root Path of the Profile"),
			_("Specify the root path of all profiles"))
		o.default = '/etc';
		o.rmempty = false;

		o = s.taboption("basic", form.Value, "DefaultSavePath", _("Save Path"),
			_("The files are stored in the download directory automatically created under the selected mounted disk"))
		var devMap = {};
		diskList.trim().split('\n').slice(1).forEach(line => {
			var [dev, size, used, , usedPct, mount] = line.trim().split(/\s+/);
			if (!dev?.includes('dev') || !mount?.startsWith('/mnt') || devMap[dev]) return;
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

		o = s.taboption("basic", form.Value, "port", _("Listening Port"),
			_("The listening port for WebUI."));
		o.datatype = "port";
		o.default = '8080';
		o.rmempty = false;

		o = s.taboption("basic", form.Value, "webuser", _("web 用户名"),
			_("如果在 WebUI 端修改过这个值并且不一致，在这里不能修改"));
		o.default = "admin";
		o.rmempty = false;

		o = s.taboption("basic", form.Value, "webpass", _("web 密码"),
			_("如果在 WebUI 端修改过这个值并且不一致，在这里不能修改"));
		o.default = "adminadmin";
		o.rmempty = false;

		o = s.taboption("advanced", form.Flag, "ASWEnabled", _("Subnet Whitelist"),
			_("Bypass authentication for clients in Whitelisted IP Subnets."));
		o.enabled = "true";
		o.disabled = "false";
		o.default = o.disabled;
		o.rmempty = false;

		o = s.taboption("advanced", form.DynamicList, "ASWlist", _("Whitelisted Subnets"))
		o.placeholder = _('Example: 172.17.32.0/24, fdff:ffff:c8::/40');
		o.datatype = "ipaddr";
		o.depends("ASWEnabled", "true");

		o = s.taboption("advanced", form.Flag, "PFEnabled", _("Use UPnP for WebUI"),
			_("Using the UPnP / NAT-PMP port of the router for connecting to WebUI."));
		o.enabled = "true";
		o.disabled = "false";
		o.default = o.enabled;
		o.rmempty = false;

		o = s.taboption("advanced", form.Flag, "CSRFProtection", _("CSRF Protection"),
			_("Disable Cross-Site Request Forgery (CSRF) protection"));
		o.enabled = "false";
		o.disabled = "true";
		o.default = o.enabled;
		o.rmempty = false;

		o = s.taboption('advanced', form.Flag, 'logEnabled', _('Enable Log'),
			_('Enable logger to log file.'));
		o.enabled = 'true';
		o.disabled = 'false';
		o.default = o.enabled;
		o.rmempty = false;

		o = s.taboption('advanced', form.Value, 'Path', _('Log Path'),
			_("Modify the path to save log files"));
		o.depends('logEnabled', 'true');

		o = s.taboption("advanced", form.FileUpload, "BinaryLocation",
			_("Enable additional qBittorrent"),
			_("Specify the binary location of qBittorrent."));
		o.root_directory = '/usr/libexec/';
		o.enable_remove = false;
		o.enable_upload = true;

		L.Poll.add(L.bind(() => callServiceStatus('qbittorrent').then(running => {
			statusEl.style.color = running ? 'green' : 'red';
			statusEl.textContent = 'qBittorrent ' + (running ? _('RUNNING') : _('NOT RUNNING'));
			btnEl.style.display = running ? '' : 'none';
		}), this));

		return m.render();
	}
});
