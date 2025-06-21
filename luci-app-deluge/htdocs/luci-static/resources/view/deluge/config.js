'use strict';
'require form';
'require uci';
'require view';
'require fs';

return view.extend({
	load: function () {
		return Promise.all([
			uci.load('deluge'),
			fs.exec_direct('/bin/df', ['-h']),
			fs.exec_direct('/usr/bin/pgrep', ['deluge'])
				.then(r => r.trim()).catch(() => '')
		]);
	},

	render: function ([uciData, diskList, statusStr]) {
		var status = statusStr !== '';
		var port = uci.get('deluge', 'main', 'port') || '8112';
		var https = uci.get('deluge', 'main', 'https') === 'true';
		var m, s, o;

		m = new form.Map('deluge', _('Deluge Downloader'), [
			E('div', {}, _('Deluge is a BitTorrent client with a graphical interface built using PyGTK')),
			E('br'),
			E('div', { style: `font-weight:bold; color:${status ? 'green' : 'red'}` }, [
				_('Deluge ') + (status ? _('RUNNING') : _('NOT RUNNING')),
				this.renderWebUIButton(status, port, https)
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
		o.default = "0";
		o.rmempty = false;

		var user = s.taboption("settings", form.ListValue, 'user', _('Run daemon as user'));
		user.load = function (section_id) {
			return fs.read('/etc/passwd').then(data => {
				data.split('\n').forEach(line => {
					var parts = line.split(':');
					var name = parts[0];
					var uid = parseInt(parts[2], 10);

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
			this.parseMountedDisks(diskList, o);
		}

		o = s.taboption("settings", form.ListValue, 'language', _('Locale Language'));
		o.value('zh_CN', _('Simplified Chinese'));
		o.value('en_GB', _('English'));
		o.default = 'zh_CN';

		o = s.taboption("settings", form.Value, 'port', _('Listening Port'),
			_("Default port: 8112"));
		o.rmempty = false;
		o.default = "8112";
		o.datatype = 'port';

		o = s.taboption("settings", form.Value, 'password', _('WebUI Password'),
			_("Default password: deluge"));
		o.password = true;
		o.default = "deluge";
		o.datatype = 'and(rangelength(6, 10), string)'

		o = s.taboption("settings", form.ListValue, 'https', _('WebUI uses HTTPS'),
			_("Not used by default"));
		o.value('false', _('Not Used'));
		o.value('true', _('Use'));
		o.default = 'false';
		o.enabled = 'true';
		o.disabled = 'false';

		// download
		o = s.taboption("download", form.Flag, 'sequential_download', _('Sequential Download'));
		o.rmempty = false;
		o.default = 'true';
		o.enabled  = 'true';
		o.disabled = 'false';

		o = s.taboption("download", form.Flag, 'prioritize_first_last_pieces',
			_('Prioritize First and Last Pieces'));
		o.rmempty = false;
		o.default = 'false';
		o.enabled  = 'true';
		o.disabled = 'false';

		o = s.taboption("download", form.Flag, 'move_completed', _('Move Completed Tasks to'));
		o.rmempty  = false;        // 总是写入配置文件
		o.default  = 'false';       // 默认不勾选
		o.enabled  = 'true';       // 勾选时写入值
		o.disabled = 'false';      // 不勾选时写入值

		o = s.taboption("download", form.Value, 'move_completed_path', _('Path'));
		o.depends('move_completed', 'true');
		o.placeholder = "/mnt/sda3/download"

		o = s.taboption("download", form.Flag, 'copy_torrent_file', _('Copy Torrent File to'));
		o.rmempty  = false;
		o.default  = 'false';
		o.enabled  = 'true';
		o.disabled = 'false';

		o = s.taboption("download", form.Value, 'torrentfiles_location', _('Path'));
		o.depends('copy_torrent_file', 'true');
		o.placeholder = "/mnt/sda3/download"

		o = s.taboption("download", form.Flag, "speed_enable",
			_("Enable Bandwidth Control"),
			_("Settings rules:") + "\n" +
			"• " + _("-1 = No limit") + "\n" +
			"• " + _("0 = Disable") + "\n" +
			"• " + _("≥1 = Specific limit"));

		const speedOptions = [
			{
				name: 'max_connections_global',
				title: _('Max Connections'),
				description: _('Total connections for all torrents'),
				default: '200'
			},
			{
				name: 'max_download_speed',
				title: _('Max Download (KiB/s)'),
				description: _('Total download speed limit'),
				default: '-1'
			},
			{
				name: 'max_upload_speed',
				title: _('Max Upload (KiB/s)'),
				description: _('Total upload speed limit'),
				default: '-1'
			},
			{
				name: 'max_upload_slots_global',
				title: _('Max Upload Slots'),
				description: _('Simultaneous upload peers'),
				default: '-1'
			},
			{
				name: 'max_active_limit',
				title: _('Active Torrents'),
				description: _('Total downloading + seeding'),
				default: '-1'
			},
			{
				name: 'max_active_downloading',
				title: _('Downloading Torrents'),
				description: _('Max simultaneous downloads'),
				default: '-1'
			},
			{
				name: 'max_active_seeding',
				title: _('Seeding Torrents'),
				description: _('Max simultaneous seeds'),
				default: '-1'
			}
		];

		speedOptions.forEach(opt => {
			o = s.taboption("download", form.Value, opt.name, opt.title, opt.description);
			o.default = opt.default;
			o.depends("speed_enable", '1');
			o.datatype = 'integer';
			o.validate = function(section, value) {
				value = parseInt(value);
				if (isNaN(value)) {
					return _("Please enter a valid number");
				}
				return (value === -1 || value >= 0) ? true : _("Value must be -1 (no limit) or a positive number");
			};
		});

		// other
		o = s.taboption("other", form.Flag, 'enable_logging', _('Enable Log'));
		o.default = '1';
		o.rmempty = false;

		o = s.taboption("other", form.Value, 'log_dir', _('Log Path'),
			_("By default in the configuration directory"));
		o.depends('enable_logging', '1');

		o = s.taboption("other", form.ListValue, 'log_level', _('Log Level'));
		o.value('none', _('None'));
		o.value('error', _('Error'));
		o.value('warning', _('Warning'));
		o.value('info', _('Info'));
		o.value('debug', _('Debug'));
		o.depends('enable_logging', '1');
		o.default = 'error';

		o = s.taboption("other", form.Value, 'geoip_db_location', _('GeoIP Database Path'));
		o.default = '/usr/share/GeoIP';

		o = s.taboption("other", form.Value, 'cache_size', _('Cache Size'),
			_('Disk cache size in KiB (1024-65536)'));
		o.default = "32768";
		o.datatype = 'uinteger';
		o.validate = function(section_id, value) {
			const size = +value;
			if (size < 1024) return _('Minimum 1024 KiB');
			if (size > 65536) return _('Maximum 65536 KiB');
			return true;
		};

		return m.render();
	},

	renderWebUIButton: function (status, port, https) {
		if (!status) return '';
		var proto = https ? 'https' : 'http';
		var host = window.location.hostname;
		var url = `${proto}://${host}:${port}`;
		return E('button', {
			class: 'btn cbi-button cbi-button-apply',
			style: 'margin-left:10px;',
			click: () => window.open(url, '_blank')
		}, _('Open Web Interface'));
	},

	parseMountedDisks: function (diskList, option) {
		var devMap = {};
		diskList.trim().split('\n').slice(1).forEach(line => {
			var [dev, size, used, , usedPct, mount] = line.trim().split(/\s+/);
			if (!dev?.includes('dev') || !mount?.startsWith('/mnt') || devMap[dev]) return;
			devMap[dev] = true;
			option.value(mount + '/download',
				_('%s/download (size: %s) (used: %s/%s)').format(mount, size, used, usedPct));
		});
	}
});
