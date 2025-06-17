'use strict';
'require form';
'require uci';
'require view';
'require fs';

function renderWebUIButton(status, port, https) {
	if (!status) return '';
	const proto = https ? 'https' : 'http';
	const host = window.location.hostname;
	const url = `${proto}://${host}:${port}`;
	return E('button', {
		class: 'btn cbi-button cbi-button-apply',
		style: 'margin-left:10px;',
		click: () => window.open(url, '_blank')
	}, _('Open Web Interface'));
}

function parseMountedDisks(diskList, option) {
	const devMap = {};
	diskList.trim().split('\n').slice(1).forEach(line => {
		const [dev, size, used, , usedPct, mount] = line.trim().split(/\s+/);
		if (!dev?.includes('dev') || !mount?.startsWith('/mnt') || devMap[dev]) return;
		devMap[dev] = true;
		const path = mount + '/download';
		option.value(path, _('%s/download (size: %s) (used: %s/%s)').format(path, size, used, usedPct));
	});
}

return view.extend({
	load: function () {
		return Promise.all([
			uci.load('deluge'),
			fs.exec_direct('/usr/bin/pgrep', ['deluge']).then(res => res.trim()).catch(() => ''),
			fs.exec_direct('/bin/df', ['-h'])
		]);
	},

	render: function ([uciData, statusStr, diskList]) {
		const status = statusStr !== '';
		const port = uci.get('deluge', 'main', 'port') || '8112';
		const https = uci.get('deluge', 'main', 'https') === 'true';
		var m, s, o;

		m = new form.Map('deluge', _('Deluge Downloader'), [
			E('div', {}, _('Deluge is a BitTorrent client with a graphical interface built using PyGTK<br>')),
			E('br'),
			E('div', { style: `font-weight:bold; color:${status ? 'green' : 'red'}` }, [
				_('Deluge ') + (status ? _('RUNNING') : _('NOT RUNNING')),
				renderWebUIButton(status, port, https)
			])
		]);

		s = m.section(form.NamedSection, 'main', 'deluge');
		s.addremove = false;
		s.anonymous = true;

		s.tab("settings", _('Basic Settings'));
		s.tab("download", _('Download Settings'));
		s.tab("other", _('Other Settings'));

		// settings
		o = s.taboption("settings", form.Flag, 'enabled', _('Enabled'));
		o.default = "0"
		o.rmempty = false

		var user = s.taboption("settings", form.ListValue, 'user', _('Run daemon as user'));
		user.load = function (section_id) {
			return fs.read('/etc/passwd').then(data => {
				data.split('\n').forEach(line => {
					const parts = line.split(':');
					const name = parts[0];
					const uid = parseInt(parts[2], 10);

					if (name && (name === 'root' || uid >= 100)) {
						user.value(name);
					}
				});
				return uci.get('deluge', section_id, 'user');
			});
		};
		user.default = 'root';

		o = s.taboption("settings", form.Value, 'profile_dir', _('Root Path of the Profile'),
			_("Saved by default in /etc/deluge"));
		o.default = '/etc/deluge';

		o = s.taboption("settings", form.ListValue, 'download_location', _('Download File Path'),
			_('The files are stored in the download directory automatically created under the selected mounted disk'));
		o.default = '/mnt/sda3/download';
		o.rmempty = false;
		if (typeof diskList === 'string') {
			parseMountedDisks(diskList, o);
		}

		o = s.taboption("settings", form.ListValue, 'language', _('Locale Language'));
		o.value('zh_CN', _('Simplified Chinese'));
		o.value('en_GB', _('English'));
		o.default = 'zh_CN';

		o = s.taboption("settings", form.Value, 'port', _('Listening Port'),
			_("Default port: 8112"));
		o.default = "8112";
		o.datatype = 'port';

		o = s.taboption("settings", form.Value, 'password', _('WebUI Password'),
			_("Default password: deluge"));
		o.password = true;

		o = s.taboption("settings", form.ListValue, 'https', _('WebUI uses HTTPS'),
			_("Not used by default"));
		o.value('false', _('Not Used'));
		o.value('true', _('Use'));
		o.default = 'false';

		// download
		o = s.taboption("download", form.Flag, 'sequential_download', _('Sequential Download'));
		o.enabled = 'true';
		o.disabled = 'false';

		o = s.taboption("download", form.Flag, 'prioritize_first_last_pieces',
			_('Prioritize First and Last Pieces'));
		o.enabled = 'true';

		o = s.taboption("download", form.Flag, 'move_completed', _('Move Completed Tasks to'));
		o.enabled = 'true';

		o = s.taboption("download", form.Value, 'move_completed_path', _('Path'));
		o.depends('move_completed', '1');

		o = s.taboption("download", form.Flag, 'copy_torrent_file', _('Copy Torrent File to'));
		o.enabled = 'true';

		o = s.taboption("download", form.Value, 'torrentfiles_location', _('Path'));
		o.depends('copy_torrent_file', '1');

		o = s.taboption("download", form.Flag, "speed", _("Global Bandwidth Usage"));

		o = s.taboption("download", form.Value, 'max_connections_global', _('Max Connections'));
		o.default = '200';
		o.depends("speed", '1');

		o = s.taboption("download", form.Value, 'max_download_speed', _('Maximum Download Speed (KiB/s)'));
		o.default = '-1';
		o.depends("speed", '1');

		o = s.taboption("download", form.Value, 'max_upload_speed', _('Maximum Upload Speed (KiB/s)'));
		o.default = '-1';
		o.depends("speed", '1');

		o = s.taboption("download", form.Value, 'max_upload_slots_global', _('Maximum Upload Slots'));
		o.default = '-1';
		o.depends("speed", '1');

		// other
		o = s.taboption("other", form.Flag, 'enable_logging', _('Enable Log'));
		o.default = '1';

		o = s.taboption("other", form.Value, 'log_dir', _('Log Path'),
			_("By default in the configuration directory"));
		o.depends('enable_logging', '1');

		o = s.taboption("other", form.ListValue, 'log_level', _('Log Level'));
		o.value('none', _('None'));
		o.value('error', _('Error'));
		o.value('warning', _('Warning'));
		o.value('info', _('Info'));
		o.value('debug', _('Debug'));
		o.default = 'error';

		o = s.taboption("other", form.Value, 'geoip_db_location', _('GeoIP Database Path'));
		o.default = '/usr/share/GeoIP';

		o = s.taboption("other", form.Value, 'cache_size', _('Cache Size'), _('Unit: KiB'));
		o.default = "32768";
		o.datatype = 'uinteger';

		return m.render();
	}
});
