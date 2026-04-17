'use strict';
'require view';
'require form';
'require uci';
'require ui';
'require fs';

return view.extend({
	load: function() {
		return Promise.all([
			fs.exec('/etc/init.d/mesh11sd', ['running'])
				.then(function (r) { return r.code === 0; }),
			uci.load('mesh11sd')
		]);
	},

	render: function([running]) {
		var m, s, o;
		m = new form.Map('mesh11sd', 'Mesh11sd', _('Configure 802.11s mesh network daemon'));

		s = m.section(form.TypedSection);
		s.render = function() {
			return E('p', { style: 'display:flex; align-items:center; gap:10px;' }, [
				E('b', { style: 'color:' + (running ? 'green' : 'red') }, [
					'mesh11sd ' + (running ? _('RUNNING') : _('NOT RUNNING'))
				])
			]);
		};

		s = m.section(form.NamedSection, 'setup');
		s.anonymous = true;
		s.addremove = false;

		o = s.option(form.Flag, 'enabled', _('Enable'));
		o.default = '1';
		o.rmempty = false;

		o = s.option(form.ListValue, 'debuglevel', _('Debug Level'));
		o.value('0', _('Silent'));
		o.value('1', _('Notice'));
		o.value('2', _('Info'));
		o.value('3', _('Debug'));
		o.default = '1';

		o = s.option(form.Value, 'checkinterval', _('Check Interval (s)'),
			_('How often the daemon checks and updates mesh status'));
		o.datatype = 'uinteger';
		o.default = '10';

		o = s.option(form.ListValue, 'auto_config', _('Auto Config'));
		o.value('0', _('Disabled (manual)'));
		o.value('1', _('Enabled'));
		o.value('2', _('Enabled + commit (locks config permanently)'));
		o.default = '0';

		o = s.option(form.Value, 'auto_mesh_id', _('Mesh ID Seed'),
			_('Hashed to produce the mesh network ID — must match on all nodes'));
		o.default = '--__';
		o.depends('auto_config', '1');
		o.depends('auto_config', '2');

		o = s.option(form.Value, 'auto_mesh_key', _('Mesh Key Seed'),
			_('SHA256 seed for mesh encryption — must match on all nodes'));
		o.password = true;
		o.optional = true;
		o.depends('auto_config', '1');
		o.depends('auto_config', '2');

		o = s.option(form.ListValue, 'auto_mesh_band', _('Mesh Band'),
			_('Must be the same on all nodes'));
		o.value('2g',   '2.4 GHz (20 MHz)');
		o.value('2g40', '2.4 GHz (40 MHz)');
		o.value('5g',   '5 GHz');
		o.value('6g',   '6 GHz');
		o.value('60g',  '60 GHz');
		o.default = '2g40';
		o.depends('auto_config', '1');
		o.depends('auto_config', '2');

		o = s.option(form.Value, 'mesh_phy_index', _('Force Radio Index'),
			_('Force a specific radio (phy index) for the mesh interface. Leave empty for auto.'));
		o.datatype = 'uinteger';
		o.optional = true;
		o.depends('auto_config', '1');
		o.depends('auto_config', '2');

		o = s.option(form.Value, 'country', _('Country Code'),
			_('Overrides the country code in wireless config (e.g. US, DE)'));
		o.optional = true;

		o = s.option(form.ListValue, 'portal_detect', _('Node Role'),
			_('Auto: portal if WAN is up, peer otherwise'));
		o.value('0', _('Force MRP (routed portal)'));
		o.value('1', _('Auto detect (recommended)'));
		o.value('3', _('CPE (client premises, mesh as WAN)'));
		o.value('4', _('MBP (bridge portal, adds WAN to vxlan)'));
		o.value('5', _('TPN (trunk peer, WAN as vxlan endpoint)'));
		o.default = '1';

		o = s.option(form.Value, 'portal_detect_threshold', _('Portal Detect Watchdog'),
			_('Number of check intervals before watchdog reboots the node. 0 = disabled.'));
		o.datatype = 'uinteger';
		o.default = '10';

		o = s.option(form.ListValue, 'portal_channel', _('Portal Channel'),
			_('2.4 GHz only. Peers auto-track the portal channel.'));
		o.value('default', _('Default (from wireless config)'));
		o.value('auto', _('Auto select'));
		o.default = 'default';

		o = s.option(form.ListValue, 'cpe_mode', _('CPE IPv6 Mode'),
			_('Applies only when Node Role is CPE (3)'));
		o.value('nat66', 'NAT66 (default, works with Android)');
		o.value('prefix_delegation', 'Prefix Delegation');
		o.value('relay', 'Relay');
		o.default = 'nat66';
		o.depends('portal_detect', '3');

		o = s.option(form.ListValue, 'mesh_gate_enable', _('AP Gate'));
		o.value('0', _('Disabled'));
		o.value('1', _('All radios'));
		o.value('2', _('Only radios not shared with mesh'));
		o.default = '1';

		o = s.option(form.Value, 'mesh_gate_base_ssid', _('AP SSID'),
			_('Base SSID — max 22 chars if suffix enabled, 30 if not'));
		o.optional = true;

		o = s.option(form.Flag, 'ssid_suffix_enable', _('SSID Suffix'),
			_('Append last 4 digits of mesh MAC to SSID'));
		o.default = '1';

		o = s.option(form.ListValue, 'mesh_gate_encryption', _('AP Encryption'));
		o.value('4', _('OWE (opportunistic, default)'));
		o.value('0', _('None / OWE transition'));
		o.value('1', _('SAE (WPA3)'));
		o.value('2', _('SAE-Mixed (WPA2+WPA3)'));
		o.value('3', _('WPA2 PSK'));
		o.default = '4';

		o = s.option(form.Value, 'mesh_gate_key', _('AP Password'));
		o.password = true;
		o.optional = true;
		o.depends('mesh_gate_encryption', '1');
		o.depends('mesh_gate_encryption', '2');
		o.depends('mesh_gate_encryption', '3');

		o = s.option(form.Value, 'mesh_basename', _('Mesh Base Name'),
			_('Constructs interface name m-<name>-0, max 8 chars'));
		o.default = '11s';
		o.datatype = 'maxlength(8)';

		o = s.option(form.Value, 'mesh_path_cost', _('Mesh Path Cost'),
			_('STP link cost 0–65534, 0 disables STP'));
		o.datatype = 'range(0,65534)';
		o.default = '10';

		o = s.option(form.Value, 'interface_timeout', _('Interface Timeout (s)'));
		o.datatype = 'uinteger';
		o.default = '10';

		o = s.option(form.ListValue, 'mesh_node_mobility_level', _('Node Mobility Level'),
			_('0=stationary (not recommended), 1=up to 1.5 m/s, 2–4=higher speeds with more overhead'));
		o.value('0', 'Stationary');
		o.value('1', 'Low (default)');
		o.value('2', 'Medium');
		o.value('3', 'High');
		o.value('4', 'Very High');
		o.default = '1';

		o = s.option(form.Flag, 'mesh_path_stabilisation', _('Path Stabilisation'),
			_('Prevents multi-hop path flapping. Usually not needed above mobility level 1.'));
		o.default = '0';

		o = s.option(form.Flag, 'mesh_leechmode_enable', _('Leech Mode'),
			_('AP-only node: uses mesh backhaul but does not route. Requires mobility level 0, non-portal.'));
		o.default = '0';

		o = s.option(form.Value, 'txpower', _('TX Power (dBm)'),
			_('Leave empty to use radio/regulatory default'));
		o.datatype = 'uinteger';
		o.optional = true;

		o = s.option(form.Flag, 'vtun_enable', _('VXLan Tunnel'),
			_('Requires ip-full and vxlan packages'));
		o.default = '1';

		o = s.option(form.Value, 'tun_id', _('Tunnel ID'),
			_('VXLAN tunnel ID, 1–16777216'));
		o.datatype = 'range(1,16777216)';
		o.default = '69';
		o.depends('vtun_enable', '1');

		o = s.option(form.Flag, 'reboot_on_error', _('Reboot on Error'));
		o.default = '1';

		o = s.option(form.Flag, 'stop_on_error', _('Stop on Error'),
			_('Overrides Reboot on Error — daemon goes idle instead of rebooting'));
		o.default = '0';

		s = m.section(form.NamedSection, 'mesh_params');
		s.anonymous = true;
		s.addremove = false;

		o = s.option(form.Value, 'mesh_rssi_threshold', _('RSSI Threshold (dBm)'),
			_('Minimum signal strength to establish a peer link (e.g. -70)'));
		o.datatype = 'range(-100,0)';
		o.optional = true;

		o = s.option(form.Value, 'mesh_max_peer_links', _('Max Peer Links'),
			_('Maximum number of peer links per node'));
		o.datatype = 'uinteger';
		o.optional = true;

		return m.render();
	}
});
