'use strict';
'require ui';
'require fs';
'require uci';
'require rpc';
'require view';
'require form';

var callIfaceDump = rpc.declare({
	object: 'network.interface',
	method: 'dump',
	expect: { interface: [] }
});

var callNetdevs = rpc.declare({
	object: 'luci-rpc',
	method: 'getNetworkDevices',
	expect: { '': {} }
});

var callLuciWirelessDevices = rpc.declare({
	object: 'luci-rpc',
	method: 'getWirelessDevices',
	expect: { '': {} }
});

function showMeshModal(title, text) {
	var PRE_STYLE = 'background:#1a1a1a;color:#dbe1e5;border-radius:4px;font-size:12px;' +
		'line-height:1.5;white-space:pre;overflow-x:auto;overflow-y:auto;max-height:70vh;' +
		'box-sizing:border-box;padding:10px;min-height:calc(1.5em * 10 + 20px);';

	var dlg = ui.showModal(_(title), [
		E('pre', { style: PRE_STYLE }, text),
		E('div', { 'class': 'right' }, [
			E('button', { 'class': 'btn', 'click': ui.hideModal }, _('Close'))
		])
	]);

	dlg.style.minWidth = getComputedStyle(dlg).width;
	dlg.style.maxWidth = '90vw';
	dlg.style.width    = 'max-content';

	return dlg;
}

return view.extend({
	load: function() {
		return Promise.all([
			fs.exec('/etc/init.d/mesh11sd', ['running'])
				.then(function(r) { return r.code === 0; }),
			uci.load('mesh11sd')
		]);
	},

	render: function([running]) {
		var m, s, o;

		m = new form.Map('mesh11sd', _('Mesh11sd'), _('Configure the IEEE 802.11s mesh network daemon.'));

		s = m.section(form.TypedSection);
		s.render = function () {
			return E('p', { style: 'display: flex; align-items: center; gap: 10px;' }, [
				E('b', [
					'Mesh11sd ',
					E('span', { style: 'color:' + (running ? 'green' : 'red') }, running ? _('RUNNING') : _('NOT RUNNING'))
				]),
				E('div', {
					class: 'btn cbi-button-apply', style: running ? '' : 'display:none',
					click: ui.createHandlerFn(this, function() {
						return fs.exec_direct('/usr/sbin/mesh11sd', ['status']).then(function (out) {
							var text = (out || '').trim() || _('No output. The daemon may still be starting; please retry in a moment.');
							showMeshModal(_('mesh11sd Status'), text);
						}).catch(function (e) {
							showMeshModal(_('mesh11sd Status'), _('Execution failed: %s').format(e.message || e));
						})})
				}, _('Live Status')),
				E('div', {
					class: 'btn cbi-button-apply', style: running ? '' : 'display:none',
					click: ui.createHandlerFn(this, function() {
						return fs.exec_direct('/usr/sbin/iw', ['dev'])
							.then(function (res) {
								var ifaces = (res || '').split('\n')
									.filter(function (l) { return l.includes('Interface'); })
									.map(function (l) { return l.trim().split(/\s+/)[1]; })
									.filter(function (n) { return n && n.includes('mesh'); });
								if (!ifaces.length) {
									return showMeshModal(_('Mesh Status'), _('No active mesh interface found.'));
								}

								var ps = [];
								ifaces.forEach(function (iface) {
									ps.push(fs.exec_direct('/usr/sbin/iw', ['dev', iface, 'station', 'dump']));
									ps.push(fs.exec_direct('/usr/sbin/iw', ['dev', iface, 'mpath', 'dump']));
								});

								return Promise.all(ps).then(function (r) {
									var sep = '='.repeat(80);
									var text = '';
									ifaces.forEach(function (iface, i) {
										var sta = (r[i * 2] || '').trim()     || _('(No neighbor nodes connected)');
										var mp  = (r[i * 2 + 1] || '').trim();
										if (!mp || mp.split('\n').length <= 1) mp = _('(No mesh paths established)');
										text += '[ ' + _('Mesh Interface') + ': ' + iface + ' ]\n' + sep + '\n';
										text += '▶ ' + _('NEIGHBOR STATION DUMP') + ':\n' + sta + '\n\n';
										text += '▶ ' + _('FORWARDING PATH DUMP (mpath)') + ':\n' + mp + '\n' + sep + '\n\n';
									});
									showMeshModal(_('Mesh Status (802.11s)'), text);
								});
							}).catch(function (e) {
								showMeshModal(_('Mesh Status'), _('Execution failed: %s').format(e.message || e));
							})
						})
				}, _('Mesh Status')),
			]);
		};

		s = m.section(form.NamedSection, 'setup');
		s.anonymous  = true;
		s.addremove  = false;

		/* ── Enable / Debug ── */
		o = s.option(form.Flag, 'enabled', _('Enable Daemon'));
		o.default  = '0';
		o.rmempty  = false;

		o = s.option(form.ListValue, 'debuglevel', _('Debug Level'));
		o.value('0', _('Silent'));
		o.value('1', _('Notice'));
		o.value('2', _('Info'));
		o.value('3', _('Debug'));
		o.default = '1';

		o = s.option(form.Value, 'checkinterval', _('Check Interval (s)'),
			_('How often the daemon dynamically checks and updates the mesh configuration.'));
		o.datatype = 'uinteger';
		o.default  = '15';

		o = s.option(form.Value, 'interface_timeout', _('Interface Timeout (s)'),
			_('Seconds to wait for a wireless interface to become ready.'));
		o.datatype = 'uinteger';
		o.default  = '10';

		/* ── Auto Config ── */
		o = s.option(form.Flag, 'auto_config', _('Auto Config'),
			_('When enabled, the daemon automatically configures wireless interfaces for the mesh — no manual wireless config needed. '
			+ 'When disabled, the daemon only monitors an existing mesh configuration.<br>'
			+ '<b>Warning:</b> Incorrect manual mesh configuration can soft-brick the router.'));
		o.default  = '0';
		o.rmempty  = false;

		o = s.option(form.Value, 'auto_mesh_id', _('Mesh ID Seed'),
			_('Hashed to generate the actual mesh network ID. <b>Must match on all nodes.</b> Default: --__'));
		o.default  = '--__';
		o.depends('auto_config', '1');

		o = s.option(form.Value, 'auto_mesh_key', _('Mesh Encryption Key Seed'),
			_('SHA256-hashed to produce the mesh encryption key. <b>Must match on all nodes.</b>'));
		o.password = true;
		o.optional = true;
		o.depends('auto_config', '1');

		o = s.option(form.ListValue, 'auto_mesh_band', _('Mesh Band'),
			_('Wireless band used for the mesh backhaul. <b>Must match on all nodes.</b>'));
		o.value('2g',   _('2.4 GHz (20 MHz)'));
		o.value('2g40', _('2.4 GHz (40 MHz, default)'));
		o.value('5g',   _('5 GHz'));
		o.value('6g',   _('6 GHz'));
		o.value('60g',  _('60 GHz'));
		o.default = '2g40';
		o.depends('auto_config', '1');

		o = s.option(form.Value, 'mesh_phy_index', _('Force Radio Index'),
			_('Leave empty for auto-selection. Only needed on devices with multiple radios on the same band (e.g. enter 2 to force phy2).'));
		o.datatype = 'uinteger';
		o.optional = true;
		o.depends('auto_config', '1');

		o = s.option(form.Value, 'country', _('Country Code'),
			_('Overrides the country code in the wireless config (e.g. CN, US, DE). Defaults to DFS-ETSI if not set.'));
		o.optional = true;

		o = s.option(form.Value, 'mesh_basename', _('Mesh Interface Base Name'),
			_('Used to build the interface name m-<name>-0. Max 8 characters. Default: 11s → interface m-11s-0.'));
		o.default  = '11s';
		o.datatype = 'maxlength(8)';

		/* ── Node Role & Portal Detection ── */
		o = s.option(form.RichListValue, 'portal_detect', _('Node Mode'),
			_('Select the operating mode for this node in the mesh network')
		);
		o.value('1', _('Auto Detect (Recommended)'),
			_('Automatically detects WAN status:<br/>• WAN available = MRP (Routed Portal)<br/>• No WAN = MPE (Mesh Peer)')
		);
		o.value('0', _('Forced Routed Portal (MRP)'),
			_('Forces routed portal mode:<br/>• Always provides DHCP/NAT<br/>• Must have WAN connection')
		);
		o.value('3', _('Client Equipment (CPE)'),
			_('Peer mode, mesh as WAN:<br/>• Creates independent NAT subnet<br/>• Supports multiple IPv6 modes')
		);
		o.value('4', _('Bridged Portal (MBP)'),
			_('Bridge mode, WAN joins VXLAN:<br/>• No NAT translation<br/>• WAN port added to br-tun69')
		);
		o.value('5', _('Trunk Peer Node (TPN)'),
			_('Special peer node:<br/>• WAN port is VXLAN endpoint<br/>• Compatible with mode 0/1/4 portals')
		);
		o.default  = '1';
		o.depends('auto_config', '1');

		o = s.option(form.Value, 'portal_detect_threshold', _('Portal Detect Watchdog'),
			_('Number of check intervals a peer node can fail to detect the portal before the watchdog triggers a reboot. 0 = disabled.'));
		o.datatype = 'uinteger';
		o.default  = '10';
		o.depends('auto_config', '1');

		o = s.option(form.ListValue, 'portal_channel', _('Portal Channel (2.4 GHz only)'),
			_('Peer nodes automatically track the portal channel regardless of auto_mesh_band.'));
		o.value('default', _('Use channel from wireless config'));
		o.value('auto',    _('Auto select'));
		for (var ch = 1; ch <= 13; ch++) {
			o.value(String(ch), _('Channel ') + ch);
		}
		o.default = 'default';
		o.depends({ 'auto_config': '1', 'portal_detect': '0' });

		o = s.option(form.Value, 'channel_tracking_checkinterval', _('Channel Tracking Start Interval (s)'),
			_('Minimum interval after which channel tracking begins on peer nodes. Values less than checkinterval are ignored. Default: 30 s.'));
		o.datatype = 'uinteger';
		o.default  = '30';
		o.optional = true;

		o = s.option(form.Flag, 'portal_use_default_ipv4', _('Use Default IPv4 Address'),
			_('When enabled, the portal node uses the IPv4 address from /etc/config/network. '
			+ 'When disabled, the subnet is auto-calculated from the label MAC address.'));
		o.default = '0';
		o.depends({ 'auto_config': '1', 'portal_detect': '0' });
		o.depends({ 'auto_config': '1', 'portal_detect': '1' });
		o.depends({ 'auto_config': '1', 'portal_detect': '4' });

		/* ── CPE only ── */
		o = s.option(form.ListValue, 'cpe_mode', _('CPE IPv6 Mode'),
			_('Applies only when Node Role is CPE (3).'));
		o.value('nat66',             _('NAT66 (default, compatible with Android)'));
		o.value('prefix_delegation', _('Prefix Delegation'));
		o.value('relay',             _('Relay'));
		o.default = 'nat66';
		o.depends({ 'auto_config': '1', 'portal_detect': '3' });

		/* ── Access Point (Gate) ── */
		o = s.option(form.ListValue, 'mesh_gate_enable', _('AP Gate'),
			_('Controls whether this node creates a Wi-Fi access point (SSID).'));
		o.value('0', _('Disabled'));
		o.value('1', _('Enabled on all radios'));
		o.value('2', _('Enabled only on radios not shared with mesh'));
		o.default = '1';

		o = s.option(form.Value, 'mesh_gate_base_ssid', _('AP SSID'),
			_('Base SSID for the access point. Max 22 chars with suffix enabled, 30 without. '
			+ 'Leave empty to use the SSID from wireless config.'));
		o.optional = true;
		o.depends('mesh_gate_enable', '1');
		o.depends('mesh_gate_enable', '2');

		o = s.option(form.Flag, 'ssid_suffix_enable', _('SSID Suffix'),
			_('Append the last 4 digits of the mesh interface MAC to the SSID to distinguish nodes.'));
		o.default = '1';
		o.depends('mesh_gate_enable', '1');
		o.depends('mesh_gate_enable', '2');

		o = s.option(form.RichListValue, 'mesh_gate_encryption', _('AP Encryption'));
		o.value('0', _('None / OWE transition'));
		o.value('1', _('SAE (WPA3)'));
		o.value('2', _('SAE-Mixed (WPA2+WPA3)'));
		o.value('3', _('WPA2 PSK'));
		o.value('4', _('OWE — Opportunistic Wireless Encryption'));
		o.default = '4';
		o.depends('mesh_gate_enable', '1');
		o.depends('mesh_gate_enable', '2');

		o = s.option(form.Value, 'mesh_gate_key', _('AP Password'));
		o.password = true;
		o.optional = true;
		o.depends({ 'mesh_gate_enable': '1', 'mesh_gate_encryption': '1' });
		o.depends({ 'mesh_gate_enable': '1', 'mesh_gate_encryption': '2' });
		o.depends({ 'mesh_gate_enable': '1', 'mesh_gate_encryption': '3' });
		o.depends({ 'mesh_gate_enable': '2', 'mesh_gate_encryption': '1' });
		o.depends({ 'mesh_gate_enable': '2', 'mesh_gate_encryption': '2' });
		o.depends({ 'mesh_gate_enable': '2', 'mesh_gate_encryption': '3' });

		/* ── Path & Performance ── */
		o = s.option(form.Value, 'mesh_path_cost', _('Mesh Path Cost (STP)'),
			_('STP link cost for the mesh network. Range 0–65534. 0 disables STP. Default: 10.'));
		o.datatype = 'range(0,65534)';
		o.default  = '10';

		o = s.option(form.ListValue, 'mesh_node_mobility_level', _('Node Mobility Level'),
			_('Tunes path-selection aggressiveness. Use 1 for fixed deployments; increase for mobile nodes.'));
		o.value('0', _('Stationary (not recommended)'));
		o.value('1', _('Low (default, up to 1.5 m/s)'));
		o.value('2', _('Medium'));
		o.value('3', _('High'));
		o.value('4', _('Very High'));
		o.default = '1';

		o = s.option(form.Flag, 'mesh_path_stabilisation', _('Path Stabilisation'),
			_('Prevents path flapping caused by multipath signal-strength jitter. Usually not needed above mobility level 1. Default: disabled.'));
		o.default = '0';

		o = s.option(form.Value, 'reactive_path_stabilisation_threshold', _('Reactive Path Stabilisation Threshold'),
			_('Number of check intervals an unstable neighbour path must persist before path stabilisation activates. Default: 10.'));
		o.datatype = 'uinteger';
		o.default  = '10';
		o.optional = true;

		o = s.option(form.Flag, 'mesh_mac_forced_forwarding', _('MAC Forced Forwarding'),
			_('Enable MAC forced forwarding on the mesh interface to improve Layer 2 forwarding reliability. Default: enabled.'));
		o.default = '1';

		o = s.option(form.Flag, 'gateway_proxy_arp', _('Gateway Proxy ARP'),
			_('Enable proxy ARP on the gateway bridge interface to improve ARP resolution. Default: enabled.'));
		o.default = '1';

		o = s.option(form.Flag, 'mesh_leechmode_enable', _('Leech Mode'),
			_('Node acts as AP only: uses mesh backhaul but does not contribute to routing or forwarding. '
			+ 'Useful when the node is within range of 2+ peer nodes to avoid unstable multi-hop paths. '
			+ 'Requires mobility level 0 and non-portal role.'));
		o.default = '0';
		o.depends({ 'mesh_node_mobility_level': '0', 'auto_config': '0' });
		o.depends({ 'mesh_node_mobility_level': '0', 'auto_config': '1', 'portal_detect': '1' });
		o.depends({ 'mesh_node_mobility_level': '0', 'auto_config': '1', 'portal_detect': '3' });
		o.depends({ 'mesh_node_mobility_level': '0', 'auto_config': '1', 'portal_detect': '5' });

		o = s.option(form.Value, 'txpower', _('TX Power (dBm)'),
			_('Transmit power for the mesh radio. Values outside the regulatory domain are ignored. Leave empty for driver/wireless default.'));
		o.datatype = 'uinteger';
		o.optional = true;

		/* ── VXLAN Tunnel ── */
		o = s.option(form.Flag, 'vtun_enable', _('Enable VXLAN Tunnel'),
			_('Point-to-multipoint VXLAN tunnel between the portal and all compatible peers. '
			+ 'Requires <b>ip-full</b> and <b>vxlan</b> packages; ignored otherwise. '
			+ 'Disabled by default when Node Role is CPE (3).'));
		o.default = '0';
		o.depends({ 'auto_config': '0' });
		o.depends({ 'auto_config': '1', 'portal_detect': '0' });
		o.depends({ 'auto_config': '1', 'portal_detect': '1' });
		o.depends({ 'auto_config': '1', 'portal_detect': '4' });
		o.depends({ 'auto_config': '1', 'portal_detect': '5' });

		o = s.option(form.Value, 'tun_id', _('Tunnel ID'),
			_('VXLAN tunnel identifier. Decimal, range 1–16777216 (24-bit). Default: 69.'));
		o.datatype = 'range(1,16777216)';
		o.default  = '69';
		o.depends('vtun_enable', '1');

		o = s.option(form.Value, 'vtun_ip', _('VXLAN Tunnel IPv4 Gateway'),
			_('IPv4 gateway address for the vxlan tunnel bridge. Active only when this node becomes a portal. Default: auto-generated.'));
		o.datatype = 'ip4addr';
		o.optional = true;
		o.depends('vtun_enable', '1');

		o = s.option(form.Value, 'vtun_mask', _('VXLAN Tunnel Subnet Mask'),
			_('IPv4 subnet mask for the vxlan tunnel bridge. Active only when this node becomes a portal. Default: 255.255.255.0.'));
		o.datatype = 'ip4addr';
		o.default  = '255.255.255.0';
		o.optional = true;
		o.depends('vtun_enable', '1');

		o = s.option(form.Value, 'vtun_path_cost', _('VXLAN Path Cost (STP)'),
			_('STP link cost for the vxlan tunnel network. Range 0–65534. 0 disables STP. Default: 10.'));
		o.datatype = 'range(0,65534)';
		o.default  = '10';
		o.optional = true;
		o.depends('vtun_enable', '1');

		o = s.option(form.Value, 'vtun_base_ssid', _('VXLAN AP SSID'),
			_('Base SSID for the AP attached to the vxlan tunnel. Max 22 chars with suffix, 30 without. Default: VTunnel.'));
		o.optional = true;
		o.depends('vtun_enable', '1');

		o = s.option(form.RichListValue, 'vtun_gate_encryption', _('VXLAN AP Encryption'),
			_('Encryption for the AP attached to the vxlan tunnel.'));
		o.value('0', _('None / OWE transition'));
		o.value('1', _('SAE (WPA3)'));
		o.value('2', _('SAE-Mixed (WPA2+WPA3)'));
		o.value('3', _('WPA2 PSK'));
		o.value('4', _('OWE — Opportunistic Wireless Encryption'));
		o.default = '4';
		o.depends('vtun_enable', '1');

		o = s.option(form.Value, 'vtun_gate_key', _('VXLAN AP Password'),
			_('Encryption key for the vxlan-attached AP. Minimum 8 characters.'));
		o.password = true;
		o.optional = true;
		o.depends({ 'vtun_enable': '1', 'vtun_gate_encryption': '1' });
		o.depends({ 'vtun_enable': '1', 'vtun_gate_encryption': '2' });
		o.depends({ 'vtun_enable': '1', 'vtun_gate_encryption': '3' });

		/* ── Watchdog & Error Handling ── */
		o = s.option(form.Flag, 'reboot_on_error', _('Reboot on Error'),
			_('Reboot the node when the watchdog detects IPv4 communication failure with the portal. Default: enabled.'));
		o.default = '1';

		o = s.option(form.Flag, 'stop_on_error', _('Stop on Error (overrides Reboot on Error)'),
			_('When the watchdog detects a portal communication failure, the daemon goes idle instead of rebooting. '
			+ 'Useful for nodes without a reset button. Takes priority over Reboot on Error.'));
		o.default = '0';

		/* ── AP Monitor Daemon ── */
		o = s.option(form.Flag, 'apmond_enable', _('Enable AP Monitor (apmond)'),
			_('Collects AP interface data from this node and sends it to the portal. Requires uhttpd and px5g-mbedtls packages.'));
		o.default = '1';

		o = s.option(form.Value, 'apmond_cgi_dir', _('apmond CGI Directory'),
			_('Path for apmond CGI scripts when this node becomes a portal. Default: /www/cgi-bin.'));
		o.default  = '/www/cgi-bin';
		o.optional = true;
		o.depends('apmond_enable', '1');

		/* ── LED & Misc ── */
		o = s.option(form.Value, 'mesh_backhaul_led', _('Mesh Backhaul LED'),
			_('LED is solid when the mesh interface is up; switches to Linux heartbeat when peers are connected. '
			+ 'Set to <b>none</b> to disable, or enter an LED name from /sys/class/leds/ (e.g. blue:run). '
			+ 'Default: auto (uses power/system LED).'));
		o.default  = 'auto';
		o.optional = true;

		o = s.option(form.Flag, 'manage_opennds_startup', _('Manage openNDS Startup'),
			_('If openNDS is installed, mesh11sd manages its startup and synchronises nft rulesets. '
			+ 'Disabling may cause crash loops because the openNDS gateway interface may not be ready in time.'));
		o.default = '0';

		o = s.option(form.Flag, 'watchdog_nonvolatile_log', _('Watchdog Non-volatile Log (debug only)'),
			_('<b>Warning:</b> Writes watchdog actions to non-volatile storage (/mesh11sd_log/mesh11sd.log). '
			+ 'Leaving this enabled long-term may cause irreparable flash wear and consume storage. '
			+ '<b>Disable immediately after debugging.</b>'));
		o.default = '0';

		s = m.section(form.NamedSection, 'mesh_params');
		s.anonymous = true;
		s.addremove = false;

		o = s.option(form.Value, 'mesh_rssi_threshold', _('RSSI Threshold (dBm)'),
			_('Minimum signal strength required to establish a peer link (e.g. -70). Range: -100 to 0.'));
		o.datatype   = 'range(-100,0)';
		o.optional   = true;
		o.placeholder = '-70';

		o = s.option(form.Value, 'mesh_max_peer_links', _('Max Peer Links'),
			_('Maximum number of peer links allowed per node.'));
		o.datatype   = 'uinteger';
		o.optional   = true;
		o.placeholder = '20';

		return m.render();
	}
});
