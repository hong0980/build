'use strict';
'require fs';
'require uci';
'require form';
'require view';

function parseMountedDisks(diskList, option) {
	var devMap = {};
	diskList.trim().split('\n').slice(1).forEach(line => {
		var [dev, size, used, , usedPct, mount] = line.trim().split(/\s+/);
		if (!dev?.includes('dev') || !mount?.startsWith('/mnt') || devMap[dev]) return;
		devMap[dev] = true;
		option.value(mount + '/download',
			_('%s/download (size: %s) (used: %s/%s)').format(mount, size, used, usedPct));
	});
};

return view.extend({
	load: () => Promise.all([
		fs.exec_direct('/bin/df', ['-h']),
		L.resolveDefault(fs.exec('/etc/init.d/qbittorrent', ['running']), null)
			.then(r => r.code === 0),
		uci.load('qbittorrent')
			.then(r => uci.get(r, 'main', 'port') || '8080'),
		fs.exec_direct('/usr/bin/env', ['HOME=/var/run/qbittorrent', '/usr/bin/qbittorrent-nox', '-v'])
			.then(r => r.trim().split('v')[1]),
	]),

	render([diskList, running, port, version]) {
		let m, s, o;

		m = new form.Map('qbittorrent', _('qBittorrent'),
			'%s   %s'.format(
				_('A cross-platform open source BitTorrent client based on QT.'),
				_("Current version: <b style='color:red'>%s</b>").format(version)
			));

		s = m.section(form.TypedSection);
		s.render = () =>
			E('p', { style: `font-weight:bold; color:${running ? 'green' : 'red'}` }, [
				_('qBittorrent ') + (running ? _('RUNNING') : _('NOT RUNNING')),
				running
					? E('div', {
						style: 'margin-left:10px;', class: 'btn cbi-button-apply',
						click: () => open(`${location.origin}:${port}`)
					}, _('Open Web Interface'))
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
		if (typeof diskList === 'string') parseMountedDisks(diskList, o);

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
			_("Use default credentials for first login: username: admin password: password<br>If disabled, temporary password can be obtained from system logs for WebUI login"));
		o.default = "8080";

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

		return m.render();
	}
});
