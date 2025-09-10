'use strict';
'require fs';
'require rpc';
'require uci';
'require view';
'require form';
'require tools.widgets as widgets';

function setFlagBool(o) {
	o.enabled = 'true';
	o.disabled = 'false';
};

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
		callServiceList('transmission', ['instances', 'instance1', 'running']).then(Boolean),

	load: function () {
		return Promise.all([
			fs.exec_direct('/bin/df', ['-h']),
			L.resolveDefault(fs.stat('/usr/share/transmission'), null),
			L.resolveDefault(fs.exec_direct('/usr/bin/transmission-daemon', ['-v']), '')
				.then(res => res.match(/Transmission\s+([^\s]+)/)?.[1]),
			L.resolveDefault(this.getStatus(), null),
			uci.load('transmission')
				.then(r => uci.get_first('transmission', 'transmission', 'rpc_port') || '9091'),
		]);
	},

	render: function ([diskList, iswebExists, ver, running, port]) {
		let m, s, o;
		var webinstalled = iswebExists !== null || !!uci.get_first('transmission', 'transmission', 'web_home');

		m = new form.Map('transmission', 'Transmission',
			'%s %s'.format(
				_('Transmission daemon is a simple bittorrent client, here you can configure the settings.'),
				_("Current version: <b style='color:red'>%s</b>").format(ver)
			)
		);
		var statusEl = E('b', { style: `color:${running ? 'green' : 'red'}` }, [
			'Transmission ' + (running ? _('RUNNING') : _('NOT RUNNING')),
		]);
		var btnEl = E('div', {
			class: 'btn cbi-button-apply', style: running ? '' : 'display:none',
			click: () => open(`${location.origin}:${port}`)
		}, _('Open Web Interface'));

		s = m.section(form.TypedSection);
		s.render = () => E('p', { style: 'display: flex; align-items: center; gap: 10px;' }, [statusEl, btnEl]);

		s = m.section(form.NamedSection, 'transmission', 'transmission');
		s.addremove = false;
		s.anonymous = true;

		s.tab("settings", _('Global settings'));
		s.tab("rpc", _('RPC'));
		s.tab("Locations", _('Files and Locations'));
		s.tab("bandwidth", _('Bandwidth settings'));
		s.tab("peer", _('Peer settings'));
		s.tab("queueing", _('Queueing'));
		s.tab("scheduling", _('Scheduling'));
		s.tab("miscellaneous", _('Miscellaneous'));

		o = s.taboption("settings", form.Flag, 'enabled', _('Enabled'));
		o.rmempty = false;

		o = s.taboption("settings", form.Value, 'config_dir', _('Config file directory'));
		o.default = '/etc/transmission';
		o = s.taboption("settings", widgets.UserSelect, 'user', _('Run daemon as user'));
		o.default = 'root';

		o = s.taboption("settings", widgets.GroupSelect, 'group', _('Run daemon as group'));
		o.default = 'root';

		o = s.taboption("settings", form.Value, 'download_dir', _('Download directory'));
		o.rmempty = false;
		var devMap = {};
		diskList?.trim().split('\n').slice(1).forEach(line => {
			var [dev, size, used, , usedPct, mount] = line.trim().split(/\s+/);
			if (!dev?.includes('dev') || !mount?.startsWith('/mnt') || devMap[dev]) return;
			devMap[dev] = true;
			o.value(mount + '/download',
				_('%s/download (size: %s) (used: %s/%s)').format(mount, size, used, usedPct));
		});

		o = s.taboption('settings', form.Flag, 'enable_logging', _('Enable logging'));
		o.rmempty = false;
		o.default = 1;

		o = s.taboption("settings", form.Value, 'log_file', _('Log file directory'));
		o.depends('enable_logging', '1');
		o.placeholder = '/var/log';
		o.description = _('Leave blank to record the log file in /var/log');

		o = s.taboption("settings", form.ListValue, 'log_level', _('Log level'));
		o.depends('enable_logging', '1');
		o.value('critical', _('Critical'));
		o.value('error', _('Error'));
		o.value('warn', _('Warning'));
		o.value('info', _('Info'));
		o.value('debug', _('Debug'));
		o.value('trace', _('Trace'));
		o.default = 'info';
		o.rmempty = false;

		o = s.taboption("settings", form.Flag, 'log_foreground', _('Run in foreground'));
		o.description = _('Output logs to console instead of running as daemon');
		o.depends('enable_logging', '1');
		o.default = 0;
		o.rmempty = false;

		o = s.taboption("settings", form.Value, 'web_home', _('Custom Web UI directory'));

		o = s.taboption("Locations", form.Flag, 'incomplete_dir_enabled', _('Incomplete directory enabled'));
		setFlagBool(o);

		o = s.taboption("Locations", form.Value, 'incomplete_dir', _('Incomplete directory'));
		o.depends('incomplete_dir_enabled', 'true');

		o = s.taboption("Locations", form.ListValue, 'preallocation', _('Preallocation'));
		o.value('0', _('Off'));
		o.value('1', _('Fast'));
		o.value('2', _('Full'));
		o.rmempty = false;
		o.default = '1';

		o = s.taboption("Locations", form.Flag, 'rename_partial_files', _('Rename partial files'));
		o.default = 'true';
		o.rmempty = false;
		setFlagBool(o);

		o = s.taboption("Locations", form.Flag, 'start_added_torrents', _('Automatically start added torrents'));
		o.default = 'true';
		o.rmempty = false;
		setFlagBool(o);

		o = s.taboption("Locations", form.Flag, 'trash_original_torrent_files', _('Trash original torrent files'));
		setFlagBool(o);

		o = s.taboption("Locations", form.Value, 'umask', 'umask');
		o.default = '18';
		o.datatype = 'uinteger';
		o.rmempty = false;

		o = s.taboption("Locations", form.Flag, 'watch_dir_enabled', _('Enable watch directory'));
		setFlagBool(o);

		o = s.taboption("Locations", form.Value, 'watch_dir', _('Watch directory'));
		o.depends('watch_dir_enabled', 'true');


		o = s.taboption("rpc", form.Flag, 'rpc_enabled', _('RPC enabled'));
		o.default = 'true';
		o.rmempty = false;
		setFlagBool(o);

		o = s.taboption("rpc", form.Value, 'rpc_bind_address', _('RPC bind address'));
		o.default = '0.0.0.0';
		o.rmempty = false;
		o.depends('rpc_enabled', 'true');

		o = s.taboption("rpc", form.Value, 'rpc_port', _('RPC port'));
		o.default = '9091';
		o.rmempty = false;
		o.depends('rpc_enabled', 'true');

		o = s.taboption("rpc", form.Value, 'rpc_url', _('RPC URL'));
		o.default = '/transmission/';
		o.rmempty = false;
		o.depends('rpc_enabled', 'true');

		o = s.taboption("rpc", form.Flag, 'rpc_host_whitelist_enabled', _('RPC host whitelist enabled'));
		setFlagBool(o);
		o.depends('rpc_enabled', 'true');

		o = s.taboption("rpc", form.Value, 'rpc_host_whitelist', _('RPC host whitelist'));
		o.depends('rpc_host_whitelist_enabled', 'true');
		o.default = '127.0.0.1,192.168.1.*';

		o = s.taboption("rpc", form.Flag, 'rpc_whitelist_enabled', _('RPC whitelist enabled'));
		setFlagBool(o);
		o.depends('rpc_enabled', 'true');

		o = s.taboption("rpc", form.Value, 'rpc_whitelist', _('RPC whitelist'));
		o.depends('rpc_whitelist_enabled', 'true');
		o.default = '127.0.0.1,192.168.1.*';

		o = s.taboption("rpc", form.Flag, 'rpc_authentication_required', _('RPC authentication required'));
		setFlagBool(o);
		o.depends('rpc_enabled', 'true');

		o = s.taboption("rpc", form.Value, 'rpc_username', _('RPC username'));
		o.depends('rpc_authentication_required', 'true');

		o = s.taboption("rpc", form.Value, 'rpc_password', _('RPC password'));
		o.depends('rpc_authentication_required', 'true');
		o.password = true;


		o = s.taboption("bandwidth", form.Flag, 'alt_speed_enabled', _('Alternative speed enabled'));
		setFlagBool(o);

		o = s.taboption("bandwidth", form.Value, 'alt_speed_up', _('Alternative upload speed'), 'KB/s');
		o.depends('alt_speed_enabled', 'true');
		o.datatype = 'uinteger';

		o = s.taboption("bandwidth", form.Value, 'alt_speed_down', _('Alternative download speed'), 'KB/s');
		o.depends('alt_speed_enabled', 'true');
		o.datatype = 'uinteger';

		o = s.taboption("bandwidth", form.Flag, 'speed_limit_down_enabled', _('Speed limit down enabled'));
		setFlagBool(o);

		o = s.taboption("bandwidth", form.Value, 'speed_limit_down', _('Speed limit down'), 'KB/s');
		o.depends('speed_limit_down_enabled', 'true');
		o.datatype = 'uinteger';

		o = s.taboption("bandwidth", form.Flag, 'speed_limit_up_enabled', _('Speed limit up enabled'));
		setFlagBool(o);

		o = s.taboption("bandwidth", form.Value, 'speed_limit_up', _('Speed limit up'), 'KB/s');
		o.depends('speed_limit_up_enabled', 'true');
		o.datatype = 'uinteger';

		o = s.taboption("bandwidth", form.Value, 'upload_slots_per_torrent', _('Upload slots per torrent'));
		o.datatype = 'uinteger';

		o = s.taboption("bandwidth", form.Flag, 'blocklist_enabled', _('Block list enabled'));
		setFlagBool(o);

		o = s.taboption("bandwidth", form.Value, 'blocklist_url', _('Blocklist URL'));
		o.depends('blocklist_enabled', 'true');
		o.placeholder = 'http://www.example.com/blocklist';


		o = s.taboption("miscellaneous", form.Value, 'cache_size_mb', _('Cache size in MB'));
		o.datatype = 'uinteger';

		o = s.taboption("miscellaneous", form.Flag, 'dht_enabled', _('DHT enabled'));
		setFlagBool(o);

		o = s.taboption("miscellaneous", form.ListValue, 'encryption', _('Encryption'));
		o.value('0', _('Prefer unencrypted'));
		o.value('1', _('Prefer encrypted'));
		o.value('2', _('Require encrypted'));

		o = s.taboption("miscellaneous", form.Flag, 'lazy_bitfield_enabled', _('Lazy bitfield enabled'));
		setFlagBool(o);

		o = s.taboption("miscellaneous", form.Flag, 'lpd_enabled', _('LPD enabled'));
		setFlagBool(o);

		o = s.taboption("miscellaneous", form.ListValue, 'message_level', _('Message level'));
		o.value('0', _('None'));
		o.value('1', _('Error'));
		o.value('2', _('Info'));
		o.value('3', _('Debug'));

		o = s.taboption("miscellaneous", form.Flag, 'pex_enabled', _('PEX enabled'));
		setFlagBool(o);

		o = s.taboption("miscellaneous", form.Flag, 'prefetch_enabled', _('Prefetch enabled'));

		o = s.taboption("miscellaneous", form.Flag, 'scrape_paused_torrents_enabled', _('Scrape paused torrents enabled'));
		setFlagBool(o);

		o = s.taboption("miscellaneous", form.Flag, 'script_torrent_done_enabled', _('Script torrent done enabled'));
		setFlagBool(o);

		o = s.taboption("miscellaneous", form.Value, 'script_torrent_done_filename', _('Script torrent done filename'));
		o.depends('script_torrent_done_enabled', 'true');

		o = s.taboption("miscellaneous", form.Flag, 'utp_enabled', _('uTP enabled'));
		setFlagBool(o);


		o = s.taboption("peer", form.Value, 'peer_port', _('Peer port'));
		o.default = '51413';
		o.rmempty = false;
		o.datatype = 'port';

		o = s.taboption("peer", form.Flag, 'peer_port_random_on_start', _('Peer port random on start'));
		setFlagBool(o);

		o = s.taboption("peer", form.Value, 'peer_port_random_high', _('Peer port random high'));
		o.datatype = 'port';
		o.depends('peer_port_random_on_start', 'true');

		o = s.taboption("peer", form.Value, 'peer_port_random_low', _('Peer port random low'));
		o.datatype = 'port';
		o.depends('peer_port_random_on_start', 'true');

		o = s.taboption("peer", form.Flag, 'port_forwarding_enabled', _('Port forwarding enabled'));
		o.default = 'true';
		o.rmempty = false;
		setFlagBool(o);

		o = s.taboption("peer", form.Value, 'bind_address_ipv4', _('Binding address IPv4'));
		o.datatype = 'ip4addr';

		o = s.taboption("peer", form.Value, 'bind_address_ipv6', _('Binding address IPv6'));
		o.datatype = 'ip6addr';

		o = s.taboption("peer", form.Value, 'peer_congestion_algorithm', _('Peer congestion algorithm'),
			_('This is documented on <a href="https://www.irif.fr/~jch/software/bittorrent/tcp-congestion-control.html" target="_blank" rel="noreferrer noopener">tcp-congestion-control</a>.'));

		// o = s.taboption("peer", form.Value, 'peer_id_ttl_hours', _('Recycle peer id after'), _('hours'));
		// o.datatype = 'uinteger';

		o = s.taboption("peer", form.Value, 'peer_limit_global', _('Global peer limit'));
		o.datatype = 'uinteger';

		o = s.taboption("peer", form.Value, 'peer_limit_per_torrent', _('Peer limit per torrent'));
		o.datatype = 'uinteger';

		o = s.taboption("peer", form.Value, 'peer_socket_tos', _('Peer socket <abbr title="Type of Service">TOS</abbr>'));


		o = s.taboption("queueing", form.Flag, 'download_queue_enabled', _('Download queue enabled'));
		setFlagBool(o);

		o = s.taboption("queueing", form.Flag, 'queue_stalled_enabled', _('Queue stalled enabled'));
		setFlagBool(o);

		o = s.taboption("queueing", form.Value, 'download_queue_size', _('Download queue size'));
		o.depends('download_queue_enabled', 'true');
		o.datatype = 'uinteger';

		o = s.taboption("queueing", form.Flag, 'seed_queue_enabled', _('Seed queue enabled'));
		setFlagBool(o);

		o = s.taboption("queueing", form.Value, 'queue_stalled_minutes', _('Queue stalled minutes'));
		o.depends('queue_stalled_enabled', 'true');
		o.datatype = 'uinteger';

		o = s.taboption("queueing", form.Value, 'seed_queue_size', _('Seed queue size'));
		o.depends('seed_queue_enabled', 'true');
		o.datatype = 'uinteger';


		o = s.taboption("scheduling", form.Flag, 'alt_speed_time_enabled', _('Alternative speed timing enabled'), _('When enabled, this will toggle the <b>alt-speed-enabled</b> setting'));
		setFlagBool(o);

		o = s.taboption("scheduling", form.Value, 'alt_speed_time_begin', _('Alternative speed time begin'), _('in minutes from midnight'));
		o.depends('alt_speed_time_enabled', 'true');
		o.datatype = 'uinteger';

		o = s.taboption("scheduling", form.Value, 'alt_speed_time_end', _('Alternative speed time end'), _('in minutes from midnight'));
		o.depends('alt_speed_time_enabled', 'true');
		o.datatype = 'uinteger';

		o = s.taboption("scheduling", form.Value, 'alt_speed_time_day', _('Alternative speed time day'), _('Number/bitfield. Start with 0, then for each day you want the scheduler enabled, add a value. For Sunday - 1, Monday - 2, Tuesday - 4, Wednesday - 8, Thursday - 16, Friday - 32, Saturday - 64'));
		o.depends('alt_speed_time_enabled', 'true');
		o.datatype = 'uinteger';

		o = s.taboption("scheduling", form.Flag, 'idle_seeding_limit_enabled', _('Idle seeding limit enabled'));
		setFlagBool(o);

		o = s.taboption("scheduling", form.Value, 'idle_seeding_limit', _('Idle seeding limit'));
		o.depends('idle_seeding_limit_enabled', 'true');
		o.datatype = 'uinteger';

		o = s.taboption("scheduling", form.Flag, 'ratio_limit_enabled', _('Ratio limit enabled'));
		setFlagBool(o);

		o = s.taboption("scheduling", form.Value, 'ratio_limit', _('Ratio limit'));
		o.depends('ratio_limit_enabled', 'true');

		L.Poll.add(L.bind(() => this.getStatus().then((running) => {
			if (statusEl) {
				statusEl.style.color = running ? 'green' : 'red';
				statusEl.textContent = 'Transmission ' + (running ? _('RUNNING') : _('NOT RUNNING'));
			};
			if (btnEl) btnEl.style.display = running ? '' : 'none';
		}), this));

		return m.render();
	}
});
