'use strict';
'require fs';
'require ui';
'require uci';
'require rpc';
'require form';
'require view';

const callServiceList = rpc.declare({
	object: 'service',
	method: 'list',
	params: ['name'],
	expect: { '': {} },
	filter: (data, { name }, extra) =>
		extra.reduce((res, key) =>
			(res && typeof res === 'object' ? res[key] : null),
			data[name] || null
		)
});

return view.extend({
	getStatus: () =>
		callServiceList('qbittorrent', ['instances', 'instance1', 'running']).then(Boolean),

	load: function () {
		return Promise.all([
			fs.exec_direct('/bin/df', ['-h']),
			L.resolveDefault(this.getStatus(), false),
			fs.exec_direct('/usr/bin/env', ['HOME=/var/run/qbittorrent', '/usr/bin/qbittorrent-nox', '-v'])
				.then(r => r.trim().split('v').pop()),
			fs.exec_direct('/sbin/logread', ['-e', 'qbittorrent-nox'])
				.then(r => (r.match(/(?:临时密码：|password[^\n]*:\s*)(\w{9})/g) || []).pop()?.match(/\w{9}$/)?.[0] || null),
			uci.load('qbittorrent')
				.then(() => uci.get('qbittorrent', 'main', 'RootProfilePath') + '/qBittorrent/config/qBittorrent.conf')
				.then(confPath => fs.trimmed(confPath)
					.then(content => /^WebUI\\Password_PBKDF2=\s*$/m.test(content)))
		])
	},

	render([diskList, running, version, tempPassword, hasPersistentPassword]) {
		var m, s, o;
		var port = uci.get('qbittorrent', 'main', 'port') || '8080';
		m = new form.Map('qbittorrent', _('qBittorrent'),
			'%s  %s'.format(
				_('A cross-platform open source BitTorrent client based on QT.'),
				_("Current version: <b style='color:red'>%s</b>").format(version)
			));
		var statusEl = E('b', { style: `color:${running ? 'green' : 'red'}` }, [
			'qBittorrent ' + (running ? _('RUNNING') : _('NOT RUNNING')),
		]);
		var btnEl = E('div', {
			class: 'btn cbi-button-apply', style: running ? '' : 'display:none',
			click: ui.createHandlerFn(this, () => open(`${location.origin}:${port}`))
		}, _('Open Web Interface'));

		s = m.section(form.TypedSection);
		s.render = () =>
			E('p', { style: 'display: flex; align-items: center; gap: 10px;' }, [
				statusEl, btnEl,
				running && tempPassword && hasPersistentPassword
					? E('div', {
						class: 'btn cbi-button-apply',
						title: _("Log in to WebUI with temporary password %s").format(tempPassword),
						click: ui.createHandlerFn(this, () => {
							const textarea = document.createElement('textarea');
							textarea.value = tempPassword;
							textarea.style.position = 'fixed';
							textarea.style.opacity = '0';
							document.body.appendChild(textarea);
							textarea.select();
							const success = document.execCommand('copy');
							document.body.removeChild(textarea);
							success && L.bind(ui.addTimeLimitedNotification || ui.addNotification, ui)(null, E('p', _('Password %s Copyed to clipboard').format(tempPassword)), 3000, 'info');
						})
					}, _("Copy <b style='color:red'>%s</b> temporary password").format(tempPassword))
					: []
			]);

		s = m.section(form.NamedSection, 'main', 'qbittorrent');

		s.tab("basic", _("Basic Settings"));
		s.tab("advanced", _("Advanced Settings"));

		o = s.taboption("basic", form.Flag, "EnableService", _("Enabled"))
		o.default = 0;
		o.rmempty = false;

		o = s.taboption("basic", form.Value, "RootProfilePath",
			_("Root Path of the Profile"),
			_("Specify the root path of all profiles"))
		o.default = '/etc/qb';

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

		o = s.taboption("basic", form.Value, "Locale", _("Locale Language"),
			_("The supported language codes can be used to customize the setting."));
		o.value("zh_CN", _("Simplified Chinese"));
		o.value("en", _("English"));
		o.default = "zh_CN";

		o = s.taboption("basic", form.Value, "port", _("Listening Port"),
			_("The listening port for WebUI."));
		o.datatype = "port";
		o.default = '8080';

		o = s.taboption("basic", form.Flag, "PasswordEnabled", _("Enable"),
			_("Enable first login default login Username: admin Password: password"));
		o.rmempty = false;

		o = s.taboption("advanced", form.Flag, "AuthSubnetWhitelistEnabled", _("Subnet Whitelist"),
			_("Bypass authentication for clients in Whitelisted IP Subnets."));
		o.enabled = "true";
		o.disabled = "false";
		o.default = o.disabled;
		o.rmempty = false;

		o = s.taboption("advanced", form.DynamicList, "AuthSubnetWhitelist", _("Whitelisted Subnets"))
		o.placeholder = _('Example: 172.17.32.0/24, fdff:ffff:c8::/40');
		o.datatype = "ipaddr";
		o.depends("AuthSubnetWhitelistEnabled", "true");

		o = s.taboption("advanced", form.Flag, "PortForwardingEnabled", _("Use UPnP for WebUI"),
			_("Using the UPnP / NAT-PMP port of the router for connecting to WebUI."));
		o.enabled = "true";
		o.disabled = "false";
		o.default = "true";
		o.rmempty = false;

		o = s.taboption("advanced", form.Flag, "CSRFProtection", _("CSRF Protection"),
			_("Disable Cross-Site Request Forgery (CSRF) protection"));
		o.enabled = "false";
		o.disabled = "true";
		o.default = "false";
		o.rmempty = false;

		o = s.taboption('advanced', form.Flag, 'Enabled', _('Enable Log'),
			_('Enable logger to log file.'));
		o.enabled = 'true';
		o.disabled = 'false';
		o.default = "true";
		o.rmempty = false;

		o = s.taboption('advanced', form.Value, 'Path', _('Log Path'),
			_("Modify the path to save log files"));
		o.depends('Enabled', 'true');
		o.rmempty = true;

		o = s.taboption("advanced", form.Value, "BinaryLocation",
			_("Enable additional qBittorrent"),
			_("Specify the binary location of qBittorrent."));
		o.placeholder = "/usr/sbin/qbittorrent-nox";

		L.Poll.add(L.bind(() => this.getStatus().then((running) => {
			if (statusEl) {
				statusEl.style.color = running ? 'green' : 'red';
				statusEl.textContent = 'qBittorrent ' + (running ? _('RUNNING') : _('NOT RUNNING'));
			};
			if (btnEl) btnEl.style.display = running ? '' : 'none';
		}), this));

		return m.render();
	}
});
