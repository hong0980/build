'use strict';
'require fs';
'require ui';
'require uci';
'require rpc';
'require view';
'require form';
'require network';
'require tools.widgets as widgets';

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

var COMBO_MODES = {
	bridge_dhcp: {
		wan_proto: 'bridge', lan_proto: 'dhcp',
		label: 'Bridge + DHCP (AP/Mesh node: WAN bridged to LAN, IP assigned by upstream router)'
	},
	bridge_static: {
		wan_proto: 'bridge', lan_proto: 'static',
		label: 'Bridge + Static IP (AP/Mesh node: WAN bridged to LAN, fixed node IP)'
	},
	pppoe_none: {
		wan_proto: 'pppoe', lan_proto: 'none',
		label: 'PPPoE + Default (Gateway: dial-up on this device, LAN managed by system)'
	},
	dhcp_none: {
		wan_proto: 'dhcp', lan_proto: 'none',
		label: 'DHCP WAN + Default (Gateway: WAN via DHCP, LAN managed by system)'
	},
	custom: {
		wan_proto: 'dhcp', lan_proto: 'none',
		label: 'Custom (configure WAN and LAN manually)'
	}
};

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

function m11opt(ss, widget, name, section, title, desc) {
	var s = ss.taboption('mesh11sd', widget, name, title, desc);
	s.uciconfig = 'mesh11sd'; s.ucisection = section || 'setup';
	return s;
}

function m11dep(o, conditions) {
	if (!conditions || conditions.length === 0) {
		o.depends('mesh_node.main.band_mode', '2');
	} else {
		conditions.forEach(function(cond) {
			var merged = { 'mesh_node.main.band_mode': '2' };
			Object.keys(cond).forEach(function(k) { merged[k] = cond[k]; });
			o.depends(merged);
		});
	}
}

function usteeropt(ss, widget, name, title, desc) {
	var s = ss.taboption('usteer', widget, name, title, desc);
	s.depends('mesh_node.globals.enable_usteer', '1');
	s.uciconfig = 'usteer'; s.ucisection = '@usteer[0]';
	return s;
}

return view.extend({
	load: function () {
		return Promise.all([
			Promise.all([callLuciWirelessDevices(), callIfaceDump(), callNetdevs()])
				.then(function ([wifiDevs, ifaces, devs]) {
					var info = {
						ssid_2g: '', ssid_5g: '', key_2g: '', key_5g: '',
						ssid_6g: '', key_6g: '', mesh_id: '', mesh_pass: '',
						wifi_ssid: '', wifi_pass: '', lanIp: '', lanMac: '',
						lanProto: '', wanIfname: '', wanMac: '', wanProto: ''
					};
					Object.keys(wifiDevs).forEach(function (rn) {
						var dev = wifiDevs[rn] || {};
						var band = dev.config?.band || '';
						var interfaces = dev.interfaces || {};

						Object.keys(interfaces).forEach(function (ifname) {
							var net = interfaces[ifname] || {}, cfg = net.config || {};
							var mode = cfg.mode || '', ssid = cfg.ssid  || '';
							var key  = cfg.key  || '', meshId = cfg.mesh_id || '';

							if (mode === 'Master' || mode === 'ap') {
								if (band === '2g') {
									info.ssid_2g = ssid; info.key_2g = key;
								} else if (band === '5g') {
									info.ssid_5g = ssid; info.key_5g = key;
								} else if (band === '6g') {
									info.ssid_6g = ssid; info.key_6g = key;
								}
							} else if (mode === 'Mesh Point' || mode === 'mesh') {
								info.mesh_id = meshId; info.mesh_pass = key;
							}
						});
					});
					ifaces.forEach(function (iface) {
						var name = iface.interface;
						if (name !== 'lan' && name !== 'wan') return;
						info[name + 'Proto'] = iface.proto;
						var addrs = iface['ipv4-address'];
						info[name + 'Ip'] = (addrs && addrs[0]) ? addrs[0].address : '';
					});
					if (devs['br-lan']) info.lanMac = devs['br-lan'].mac;
					if (devs.wan) { info.wanMac = devs.wan.mac; info.wanIfname = devs.wan.name; }
					return info;
				}),
			fs.exec('/etc/init.d/mesh11sd', ['running'])
				.then(function (r) { return r.code === 0; }),
			fs.exec('/etc/init.d/usteer', ['running'])
				.then(function (r) { return r.code === 0; }),
			uci.load('mesh_node'),
			uci.load('network')
		]);
	},

	render: function ([info, m_running, u_running]) {
		var m, s, o, so, ss;
		m = new form.Map('mesh_node', _('AP + Mesh Deployment'), _('Quickly create a Mesh'));
		m.chain('mesh11sd');
		m.chain('network');
		m.chain('usteer');

		s = m.section(form.NamedSection, 'main');
		s.addremove = false;
		s.anonymous = true;

		s.tab('network',  _('Network'));
		s.tab('wireless', _('Wireless'));
		s.tab('mesh',     _('Mesh Backhaul'));
		s.tab('mesh11sd', _('mesh11sd Settings'));
		s.tab('other',    _('Other'));

		o = s.taboption('network', form.RichListValue, 'combo_mode', _('Network Mode'));
		Object.keys(COMBO_MODES).forEach(function (k) { o.value(k, _(COMBO_MODES[k].label)); });
		o.default = 'bridge_static';
		o.onchange = function (ev, section_id, value) {
			var combo = COMBO_MODES[value];
			if (!combo) return;
			var wOpts = this.map.lookupOption('wan_proto', section_id);
			if (wOpts && wOpts[0]) {
				var wEl = wOpts[0].getUIElement(section_id);
				if (wEl) wEl.setValue(combo.wan_proto);
			}
			var lOpts = this.map.lookupOption('lan_proto', section_id);
			if (lOpts && lOpts[0]) {
				var lEl = lOpts[0].getUIElement(section_id);
				if (lEl) lEl.setValue(combo.lan_proto);
			}
		};

		o = s.taboption('network', form.ListValue, 'wan_proto', _('WAN Protocol'));
		o.value('bridge', _('Bridge to LAN'));
		o.value('pppoe',  _('PPPoE'));
		o.value('dhcp',   _('Default'));
		o.defaults = {
			'pppoe':  [{ combo_mode: 'pppoe_none' }],
			'dhcp':   [{ combo_mode: /(custom|dhcp_none)/ }],
			'bridge': [{ combo_mode: /(bridge_dhcp|bridge_static)/ }]
		};
		o.rmempty = false;

		o = s.taboption('network', form.Value, 'wan_pppoe_user', _('PPPoE Username'));
		o.datatype = 'minlength(1)'; o.rmempty = false;
		o.depends('wan_proto', 'pppoe');

		o = s.taboption('network', form.Value, 'wan_pppoe_pass', _('PPPoE Password'));
		o.datatype = 'minlength(1)'; o.rmempty = false; o.password = true;
		o.depends('wan_proto', 'pppoe');

		o = s.taboption('network', form.ListValue, 'lan_proto', _('LAN Mode'));
		o.value('dhcp',   _('DHCP client'));
		o.value('static', _('Static address'));
		o.value('none',   _('Default'));
		o.defaults = {
			'dhcp':   [{ combo_mode: 'bridge_dhcp' }],
			'static': [{ combo_mode: 'bridge_static' }],
			'none':   [{ combo_mode: /(custom|dhcp_none|pppoe_none)/ }],
		};

		o = s.taboption('network', form.Value, 'lan_ip', _('Node Static IP'),
			_('Static IPv4 address for this node\'s LAN bridge. Must be unique per node, e.g. 192.168.2.2 / .3 / .4'));
		o.datatype = 'ip4addr'; o.rmempty = false;
		o.depends({ combo_mode: 'custom'  });
		o.depends({ lan_proto: 'static'  });

		o = s.taboption('network', form.Value, 'gateway', _('Gateway / DNS'),
			_('Upstream router IP, used as the default gateway and DNS server for this node'));
		o.datatype = 'ip4addr'; o.rmempty = false;
		o.depends({ combo_mode: 'custom'  });
		o.depends({ lan_proto: 'static'  });

		o = s.taboption('network', form.ListValue, 'band_mode', _('Backhaul Mode'));
		o.value('0', _('Wireless + Wired'));
		o.value('1', _('Wired Only'));
		o.value('2', _('mesh11sd'));
		o.default = '0';

		o = s.taboption('network', form.DummyValue, '_lan_ip', _('DHCP Assigned IP'),
			_('IP address assigned to this node by the upstream DHCP server; shown for reference only'));
		o.default = info.lanIp;
		o.depends({ lan_proto: 'dhcp' });
		o.depends('band_mode', /(0|1)/);

		o = s.taboption('wireless', form.Flag, 'band_merge', _('Dual-band Merge'),
			_('Enabled: one SSID/password applied to both 2.4 GHz and 5 GHz %s radios.').format(info.ssid_6g ? ' 6 GHz' : ''));
		o.default = '0';
		o.depends('band_mode', /(0|1)/);

		o = s.taboption('wireless', form.ListValue, 'log_level', _('Hostapd Log Level'),
			_('Global setting for all Wi-Fi radios'));
		o.value('0', _('Verbose'));
		o.value('1', _('Debug'));
		o.value('2', _('Info'));
		o.value('3', _('Notice'));
		o.value('4', _('Warning'));
		o.default = '2';
		o.depends('band_mode', /(0|1)/);

		var BAND_DEFS = [
			{ key: '2g', label: '2.4 GHz', ssid: info.ssid_2g, pass: info.key_2g },
			{ key: '5g', label: '5 GHz',   ssid: info.ssid_5g, pass: info.key_5g },
		];
		if (info.ssid_6g || info.key_6g)
			BAND_DEFS.push({ key: '6g', label: '6 GHz', ssid: info.ssid_6g, pass: info.key_6g });

		BAND_DEFS.forEach(function(band) {
			o = s.taboption('wireless', form.Value, 'ssid_' + band.key, _('%s SSID').format(band.label),
				_('Must exactly match the main router SSID to enable seamless roaming'));
			o.default  = band.ssid || 'HomeWiFi';
			o.rmempty  = false;
			o.depends('band_merge', '0');

			o = s.taboption('wireless', form.Value, 'key_' + band.key, _('%s WiFi Password').format(band.label),
				_('Encryption: psk2+ccmp (WPA2). Minimum 8 characters.'));
			o.datatype = 'wpakey';
			o.password = true;
			o.rmempty  = false;
			o.default  = band.pass || '';
			o.depends('band_merge', '0');
		});

		o = s.taboption('wireless', form.Value, 'wifi_ssid', _('WiFi SSID'));
		o.default = info.wifi_ssid;
		o.rmempty = false; o.depends('band_merge', '1');

		o = s.taboption('wireless', form.Value, 'wifi_pass', _('WiFi Password'));
		o.datatype = 'wpakey'; o.password = true;
		o.rmempty = false; o.default = info.wifi_pass;
		o.depends('band_merge', '1');

		o = m11opt(s, form.DummyValue, '_m11_badge', '', _('mesh11sd Status'));
		o.rawhtml = true;
		o.cfgvalue = function () {
			return E('div', { style: 'display:flex; gap:10px;' }, [
				E('span', { style: 'display:inline-flex;align-items:center;gap:8px;' }, [
					E('strong', { style: `color:${m_running ? '#02a546ff' : '#FF3B30'};` }, m_running ? _('Running') : _('Stopped'))
				]),
				E('div', {
					class: 'btn cbi-button-apply', style: m_running ? '' : 'display:none',
					click: ui.createHandlerFn(this, function() {
						return fs.exec_direct('/usr/sbin/mesh11sd', ['status']).then(function (out) {
							var text = (out || '').trim() || _('No output. The daemon may still be starting; please retry in a moment.');
							showMeshModal(_('mesh11sd Status'), text);
						}).catch(function (e) {
							showMeshModal(_('mesh11sd Status'), _('Execution failed: %s').format(e.message || e));
						})})
				}, _('Live Status'))
			]);
		};
		m11dep(o, []);

		o = m11opt(s, form.Flag, 'enabled', '',  _('Enable Daemon'));
		o.default  = '0';
		o.rmempty  = false;
		o.write = function (section_id, value) {
			uci.set('mesh_node', 'main', 'm11_enable', value);
			return this.super('write', [section_id, value]);
		};
		m11dep(o, []);

		o = m11opt(s, form.ListValue, 'debuglevel', '',  _('Debug Level'));
		o.value('0', _('Silent'));
		o.value('1', _('Notice'));
		o.value('2', _('Info'));
		o.value('3', _('Debug'));
		o.default = '1';
		m11dep(o, []);

		o = m11opt(s, form.Value, 'checkinterval', '',  _('Check Interval (s)'),
			_('How often the daemon dynamically checks and updates the mesh configuration.'));
		o.datatype = 'uinteger';
		o.default  = '15';
		m11dep(o, []);

		o = m11opt(s, form.Value, 'interface_timeout', '',  _('Interface Timeout (s)'),
			_('Seconds to wait for a wireless interface to become ready.'));
		o.datatype = 'uinteger';
		o.default  = '10';
		m11dep(o, []);

		/* ── Auto Config ── */
		o = m11opt(s, form.Flag, 'auto_config', '',  _('Auto Config'),
			_('When enabled, the daemon automatically configures wireless interfaces for the mesh — no manual wireless config needed. '
			+ 'When disabled, the daemon only monitors an existing mesh configuration.<br>'
			+ '<b>Warning:</b> Incorrect manual mesh configuration can soft-brick the router.'));
		o.default  = '0';
		o.rmempty  = false;
		m11dep(o, []);

		o = m11opt(s, form.ListValue, 'auto_mesh_band', '', _('Mesh Backhaul Band'),
			_('Select the radio band used for the 802.11s mesh backhaul link. <b>Must match on all nodes.</b>'));
		var bands = [];
		if (info.ssid_2g) bands.push(['2g', '2.4 GHz']);
		if (info.ssid_5g) bands.push(['5g', '5 GHz']);
		if (info.ssid_6g) bands.push(['6g', '6 GHz']);
		bands.forEach(function(b) { o.value(b[0], _(b[1])); });
		o.rmempty = false;
		m11dep(o, [{ 'auto_config': '1' }]);

		o = m11opt(s, form.Value, 'auto_mesh_id', '',  _('Mesh ID'),
			_('Hashed to generate the actual mesh network ID. <b>Must match on all nodes.</b>'));
		o.default  = '--__';
		m11dep(o, [{ 'auto_config': '1' }]);

		o = m11opt(s, form.Value, 'auto_mesh_key', '',  _('Mesh Password'),
			_('SHA256-hashed to produce the mesh encryption key. <b>Must match on all nodes.</b>'));
		o.password = true;
		o.optional = true;
		m11dep(o, [{ 'auto_config': '1' }]);

		o = m11opt(s, widgets.NetworkSelect, 'auto_mesh_network', '',  _('specifies the firewall zone used for the mesh.'),
			_('This can be set differently on each meshnode as required.'));
		o.default = 'lan';
		m11dep(o, [{ 'auto_config': '1' }]);

		o = m11opt(s, form.Value, 'country', '',  _('Country Code'),
			_('Overrides the country code in the wireless config (e.g. CN, US, DE). Defaults to DFS-ETSI if not set.'));
		o.optional = true; o.placeholder = 'CN';
		m11dep(o, []);

		o = m11opt(s, form.Value, 'mesh_phy_index', '',  _('Force Radio Index'),
			_('Leave empty for auto-selection. Only needed on devices with multiple radios on the same band (e.g. enter 2 to force phy2).'));
		o.datatype = 'uinteger';
		o.optional = true;
		m11dep(o, [{ 'auto_config': '1' }]);

		o = m11opt(s, form.Value, 'mesh_basename', '',  _('Mesh Interface Base Name'),
			_('Used to build the interface name m-<name>-0. Max 8 characters. Default: 11s → interface m-11s-0.'));
		o.default  = '11s';
		o.datatype = 'maxlength(8)';
		m11dep(o, []);

		/* ── Node Role & Portal Detection ── */
		o = m11opt(s, form.RichListValue, 'portal_detect', '',  _('Node Mode'),
			_('Select the operating mode for this node in the mesh network'));
		o.value('0', _('Forced Routed Portal (MRP)'),
			_('Forces routed portal mode:<br/>• Always provides DHCP/NAT<br/>• Must have WAN connection'));
		o.value('1', _('Auto Detect (Recommended)'),
			_('Automatically detects WAN status:<br/>• WAN available = MRP (Routed Portal)<br/>• No WAN = MPE (Mesh Peer)'));
		o.value('3', _('Client Equipment (CPE)'),
			_('Peer mode, mesh as WAN:<br/>• Creates independent NAT subnet<br/>• Supports multiple IPv6 modes'));
		o.value('4', _('Bridged Portal (MBP)'),
			_('Bridge mode, WAN joins VXLAN:<br/>• No NAT translation<br/>• WAN port added to br-tun69'));
		o.value('5', _('Trunk Peer Node (TPN)'),
			_('Special peer node:<br/>• WAN port is VXLAN endpoint<br/>• Compatible with mode 0/1/4 portals'));
		o.default  = '1';
		m11dep(o, [{ 'auto_config': '1' }]);

		o = m11opt(s, form.Value, 'portal_detect_threshold', '',  _('Portal Detect Watchdog'),
			_('Number of check intervals a peer node can fail to detect the portal before the watchdog triggers a reboot. 0 = disabled.'));
		o.datatype = 'uinteger';
		o.default  = '10';
		m11dep(o, [{ 'auto_config': '1' }]);

		o = m11opt(s, form.ListValue, 'portal_channel', '',  _('Portal Channel (2.4 GHz only)'),
			_('Peer nodes automatically track the portal channel regardless of auto_mesh_band.'));
		o.value('default', _('Use channel from wireless config'));
		o.value('auto',    _('Auto select'));
		for (var ch = 1; ch <= 13; ch++) {
			o.value(String(ch), _('Channel ') + ch);
		}
		o.default = 'default';
		m11dep(o, [{ 'portal_detect': '0' }]);

		o = m11opt(s, form.Value, 'channel_tracking_checkinterval', '',  _('Channel Tracking Start Interval (s)'),
			_('Minimum interval after which channel tracking begins on peer nodes. Values less than checkinterval are ignored. Default: 30 s.'));
		o.datatype = 'uinteger';
		o.default  = '30';
		o.optional = true;
		m11dep(o, []);

		o = m11opt(s, form.Flag, 'portal_use_default_ipv4', '',  _('Use Default IPv4 Address'),
			_('When enabled, the portal node uses the IPv4 address from /etc/config/network. '
			+ 'When disabled, the subnet is auto-calculated from the label MAC address.'));
		o.default = '0';
		m11dep(o, [{ 'portal_detect': /(0|1|4)/ }]);

		/* ── CPE only ── */
		o = m11opt(s, form.ListValue, 'cpe_mode', '',  _('CPE IPv6 Mode'),
			_('Applies only when Node Role is CPE (3).'));
		o.value('nat66',             _('NAT66 (default, compatible with Android)'));
		o.value('prefix_delegation', _('Prefix Delegation'));
		o.value('relay',             _('Relay'));
		o.default = 'nat66';
		m11dep(o, [{ 'portal_detect': '3' }]);

		o = m11opt(s, form.ListValue, 'mesh_gate_enable', '',  _('AP Gate'),
			_('Controls whether this node creates a Wi-Fi access point (SSID).'));
		o.value('0', _('Disabled'));
		o.value('1', _('Enabled on all radios'));
		o.value('2', _('Enabled only on radios not shared with mesh'));
		o.default = '1';
		m11dep(o, []);

		o = m11opt(s, form.Value, 'mesh_gate_base_ssid', '',  _('AP SSID'),
			_('Base SSID for the access point. Max 22 chars with suffix enabled, 30 without. '
			+ 'Leave empty to use the SSID from wireless config.'));
		o.optional = true; o.rmempty = false; o.default = 'HomeWiFi'; o.default = 'HomeWiFi';
		m11dep(o, [{ 'mesh_gate_enable': /(1|2)/ } ]);

		o = m11opt(s, form.Flag, 'ssid_suffix_enable', '',  _('SSID Suffix'),
			_('Append the last 4 digits of the mesh interface MAC to the SSID to distinguish nodes.'));
		o.default = '1';
		m11dep(o, [{ 'mesh_gate_enable': /(1|2)/ } ]);

		o = m11opt(s, form.RichListValue, 'mesh_gate_encryption', '',  _('AP Encryption'));
		o.value('0', _('None / OWE transition'));
		o.value('1', _('SAE (WPA3)'));
		o.value('2', _('SAE-Mixed (WPA2+WPA3)'));
		o.value('3', _('WPA2 PSK'));
		o.value('4', _('OWE — Opportunistic Wireless Encryption'));
		o.default = '4';
		m11dep(o, [{ 'mesh_gate_enable': /(1|2)/ } ]);

		o = m11opt(s, form.Value, 'mesh_gate_key', '',  _('AP Password'));
		o.password = true;
		o.optional = true;
		m11dep(o, [{ 'mesh_gate_encryption': /(1|2|3)/ }]);

		o = m11opt(s, form.Value, 'mesh_path_cost', '',  _('Mesh Path Cost (STP)'),
			_('STP link cost for the mesh network. Range 0–65534. 0 disables STP. Default: 10.'));
		o.datatype = 'range(0,65534)';
		o.default  = '10';
		m11dep(o, []);

		o = m11opt(s, form.ListValue, 'mesh_node_mobility_level', '',  _('Node Mobility Level'),
			_('Tunes path-selection aggressiveness. Use 1 for fixed deployments; increase for mobile nodes.'));
		o.value('0', _('Stationary (not recommended)'));
		o.value('1', _('Low (default, up to 1.5 m/s)'));
		o.value('2', _('Medium'));
		o.value('3', _('High'));
		o.value('4', _('Very High'));
		o.default = '1';
		m11dep(o, []);

		o = m11opt(s, form.Flag, 'mesh_path_stabilisation', '',  _('Path Stabilisation'),
			_('Prevents path flapping caused by multipath signal-strength jitter. Usually not needed above mobility level 1. Default: disabled.'));
		o.default = '0';
		m11dep(o, []);

		o = m11opt(s, form.Value, 'reactive_path_stabilisation_threshold', '',  _('Reactive Path Stabilisation Threshold'),
			_('Number of check intervals an unstable neighbour path must persist before path stabilisation activates. Default: 10.'));
		o.datatype = 'uinteger';
		o.default  = '10';
		o.optional = true;
		m11dep(o, []);

		o = m11opt(s, form.Flag, 'mesh_mac_forced_forwarding', '',  _('MAC Forced Forwarding'),
			_('Enable MAC forced forwarding on the mesh interface to improve Layer 2 forwarding reliability. Default: enabled.'));
		o.default = '1';
		m11dep(o, []);

		o = m11opt(s, form.Flag, 'gateway_proxy_arp', '',  _('Gateway Proxy ARP'),
			_('Enable proxy ARP on the gateway bridge interface to improve ARP resolution. Default: enabled.'));
		o.default = '1';
		m11dep(o, []);

		o = m11opt(s, form.Flag, 'mesh_leechmode_enable', '',  _('Leech Mode'),
			_('Node acts as AP only: uses mesh backhaul but does not contribute to routing or forwarding. '
			+ 'Useful when the node is within range of 2+ peer nodes to avoid unstable multi-hop paths. '
			+ 'Requires mobility level 0 and non-portal role.'));
		o.default = '0';
		m11dep(o, [{ 'mesh_node_mobility_level': '0', 'auto_config': '0' }, { 'mesh_node_mobility_level': '0', 'portal_detect': /(1|3|5)/ }]);

		o = m11opt(s, form.Value, 'txpower', '',  _('TX Power (dBm)'),
			_('Transmit power for the mesh radio. Values outside the regulatory domain are ignored. Leave empty for driver/wireless default.'));
		o.datatype = 'uinteger';
		o.optional = true;
		m11dep(o, []);

		o = m11opt(s, form.Flag, 'vtun_enable', '',  _('Enable VXLAN Tunnel'),
			_('Point-to-multipoint VXLAN tunnel between the portal and all compatible peers. '
			+ 'Requires <b>ip-full</b> and <b>vxlan</b> packages; ignored otherwise. '
			+ 'Disabled by default when Node Role is CPE (3).'));
		o.default = '0';
		m11dep(o, [{ 'auto_config': '0' }, { 'portal_detect': /(0|1|4|5)/ }]);

		o = m11opt(s, form.Value, 'tun_id', '',  _('Tunnel ID'),
			_('VXLAN tunnel identifier. Decimal, range 1–16777216 (24-bit). Default: 69.'));
		o.datatype = 'range(1,16777216)';
		o.default  = '69';
		m11dep(o, [{ 'vtun_enable': '1' }]);

		o = m11opt(s, form.Value, 'vtun_ip', '',  _('VXLAN Tunnel IPv4 Gateway'),
			_('IPv4 gateway address for the vxlan tunnel bridge. Active only when this node becomes a portal. Default: auto-generated.'));
		o.datatype = 'ip4addr';
		o.optional = true;
		m11dep(o, [{ 'vtun_enable': '1' }]);

		o = m11opt(s, form.Value, 'vtun_mask', '',  _('VXLAN Tunnel Subnet Mask'),
			_('IPv4 subnet mask for the vxlan tunnel bridge. Active only when this node becomes a portal. Default: 255.255.255.0.'));
		o.datatype = 'ip4addr';
		o.default  = '255.255.255.0';
		o.optional = true;
		m11dep(o, [{ 'vtun_enable': '1' }]);

		o = m11opt(s, form.Value, 'vtun_path_cost', '',  _('VXLAN Path Cost (STP)'),
			_('STP link cost for the vxlan tunnel network. Range 0–65534. 0 disables STP. Default: 10.'));
		o.datatype = 'range(0,65534)';
		o.default  = '10';
		o.optional = true;
		m11dep(o, [{ 'vtun_enable': '1' }]);

		o = m11opt(s, form.Value, 'vtun_base_ssid', '',  _('VXLAN AP SSID'),
			_('Base SSID for the AP attached to the vxlan tunnel. Max 22 chars with suffix, 30 without. Default: VTunnel.'));
		o.optional = true;
		m11dep(o, [{ 'vtun_enable': '1' }]);

		o = m11opt(s, form.RichListValue, 'vtun_gate_encryption', '',  _('VXLAN AP Encryption'),
			_('Encryption for the AP attached to the vxlan tunnel.'));
		o.value('0', _('None / OWE transition'));
		o.value('1', _('SAE (WPA3)'));
		o.value('2', _('SAE-Mixed (WPA2+WPA3)'));
		o.value('3', _('WPA2 PSK'));
		o.value('4', _('OWE — Opportunistic Wireless Encryption'));
		o.default = '4';
		m11dep(o, [{ 'vtun_enable': '1' }]);

		o = m11opt(s, form.Value, 'vtun_gate_key', '',  _('VXLAN AP Password'),
			_('Encryption key for the vxlan-attached AP. Minimum 8 characters.'));
		o.password = true;
		o.optional = true;
		m11dep(o, [{ 'vtun_gate_encryption': /(1|2|3)/ }]);

		/* ── Watchdog & Error Handling ── */
		o = m11opt(s, form.Flag, 'reboot_on_error', '',  _('Reboot on Error'),
			_('Reboot the node when the watchdog detects IPv4 communication failure with the portal. Default: enabled.'));
		o.default = '1';
		m11dep(o, []);

		o = m11opt(s, form.Flag, 'stop_on_error', '',  _('Stop on Error (overrides Reboot on Error)'),
			_('When the watchdog detects a portal communication failure, the daemon goes idle instead of rebooting. '
			+ 'Useful for nodes without a reset button. Takes priority over Reboot on Error.'));
		o.default = '0';
		m11dep(o, []);

		/* ── AP Monitor Daemon ── */
		o = m11opt(s, form.Flag, 'apmond_enable', '',  _('Enable AP Monitor (apmond)'),
			_('Collects AP interface data from this node and sends it to the portal. Requires uhttpd and px5g-mbedtls packages.'));
		o.default = '1';
		m11dep(o, []);

		o = m11opt(s, form.Value, 'apmond_cgi_dir', '',  _('apmond CGI Directory'),
			_('Path for apmond CGI scripts when this node becomes a portal. Default: /www/cgi-bin.'));
		o.default  = '/www/cgi-bin';
		o.optional = true;
		m11dep(o, [{ 'apmond_enable': '1' }]);

		/* ── LED & Misc ── */
		o = m11opt(s, form.Value, 'mesh_backhaul_led', '',  _('Mesh Backhaul LED'),
			_('LED is solid when the mesh interface is up; switches to Linux heartbeat when peers are connected. '
			+ 'Set to <b>none</b> to disable, or enter an LED name from /sys/class/leds/ (e.g. blue:run). '
			+ 'Default: auto (uses power/system LED).'));
		o.default  = 'auto';
		o.optional = true;
		m11dep(o, []);

		o = m11opt(s, form.Flag, 'manage_opennds_startup', '',  _('Manage openNDS Startup'),
			_('If openNDS is installed, mesh11sd manages its startup and synchronises nft rulesets. '
			+ 'Disabling may cause crash loops because the openNDS gateway interface may not be ready in time.'));
		o.default = '0';
		m11dep(o, []);

		o = m11opt(s, form.Flag, 'watchdog_nonvolatile_log', '',  _('Watchdog Non-volatile Log (debug only)'),
			_('<b>Warning:</b> Writes watchdog actions to non-volatile storage (/mesh11sd_log/mesh11sd.log). '
			+ 'Leaving this enabled long-term may cause irreparable flash wear and consume storage. '
			+ '<b>Disable immediately after debugging.</b>'));
		o.default = '0';
		m11dep(o, []);

		o = m11opt(s, form.Value, 'mesh_rssi_threshold', 'mesh_params',  _('RSSI Threshold (dBm)'),
			_('Minimum signal strength required to establish a peer link (e.g. -70). Range: -100 to 0.'));
		o.datatype   = 'range(-100,0)';
		o.optional   = true;
		o.placeholder = '-70';
		m11dep(o, []);

		o = m11opt(s, form.Value, 'mesh_max_peer_links', 'mesh_params',  _('Max Peer Links'),
			_('Maximum number of peer links allowed per node.'));
		o.datatype   = 'uinteger';
		o.optional   = true;
		o.placeholder = '20';
		m11dep(o, []);

		o = s.taboption('mesh', form.RichListValue, 'mesh_radio', _('Mesh Backhaul Band'),
			_('Select the radio band used for the 802.11s mesh backhaul link.'));
		o.value('5g',   _('5 GHz (recommended, best throughput)'));
		o.value('2g', _('2.4 GHz (longer range, lower throughput)'));
		if (info.ssid_6g) o.value('6g', _('6 GHz'));
		o.value('none', _('All bands (all radios participate in the mesh)'));
		o.default = '5g';
		o.depends('band_mode', '0');

		o = s.taboption('mesh', widgets.NetworkSelect, 'mesh_network', _('Mesh Network'),
			_('Choose the network(s) you want to attach to this wireless interface or fill out the <em>custom</em> field to define a new network.'));
		o.default = 'lan';
		o.depends('band_mode', '0');

		o = s.taboption('mesh', form.Value, 'mesh_id', _('Mesh ID'),
			_('Must be identical on every mesh node'));
		o.depends('band_mode', '0');
		o.default = info.mesh_id || 'HomeMesh'; o.rmempty = false;

		o = s.taboption('mesh', form.Value, 'mesh_pass', _('Mesh Password'),
			_('SAE (WPA3) passphrase; minimum 8 characters, must match on all nodes'));
		o.datatype = 'wpakey'; o.password = true;
		o.depends('band_mode', '0');
		o.rmempty = false; o.default = info.mesh_pass || '';

		o = s.taboption('mesh', form.RichListValue, 'use_batadv', _('Mesh Protocol'),
			_('802.11s native: kernel-level forwarding, simpler setup. ' +
			  'batman-adv: advanced L2 routing on top of 802.11s, better multi-hop performance. ' +
			  'When switching modes, save and reboot all nodes.'));
		o.value('0', _('802.11s native — kernel mesh forwarding (default)'));
		o.value('1', _('batman-adv — 802.11s backhaul + batadv L2 routing'));
		o.default = '0';
		o.depends('band_mode', '0');
		o.onchange = function (ev, section_id, value) {
			["usteer", "batadv"].find(function(t) {
				var el = document.querySelector('[data-tab="' + t + '"].cbi-tab-disabled');
				if (el && el.offsetWidth > 0) return el.querySelector('a').click() || true;
			});
		};

		o = s.taboption('mesh', form.Button, '_mesh_status_btn', _('Mesh Status'));
		o.inputtitle = _('View Mesh Status'); o.inputstyle = 'positive';
		o.depends('band_mode', '0');
		o.onclick = function (ev, section_id) {
			var proto  = this.section.formvalue(section_id, 'batadv_proto') || 'bat0';
			if (uci.get_bool('mesh_node', 'main', 'use_batadv')) {
				var run = function (args) {
					return fs.exec_direct('/usr/sbin/batctl', args)
						.then(function (r) { return (r || '').trim(); })
						.catch(function (e) { return '(error: ' + (e.message || e) + ')'; });
				};

				return Promise.all([
					run(['meshif', proto, 'mj']),
					run(['meshif', proto, 'hj']),
					run(['meshif', proto, 'nj']),
					run(['meshif', proto, 'oj']),
					run(['meshif', proto, 'statistics'])
				]).then(function (r) {
					var sep = '─'.repeat(72), text = '';
					var titles = [_('MESH INFO'), _('INTERFACES'), _('NEIGHBORS'), _('ORIGINATORS'), _('STATISTICS')];
					r.forEach(function (item, i) {
						var content = item || _('none');
						try { content = JSON.stringify(JSON.parse(item), null, 2); } catch {}
						text += `▶ ${titles[i]}\n${sep}\n${content}\n\n`;
					});
					showMeshModal(_('Mesh Status (batman-adv)'), text);
				}).catch(function (e) {
					showMeshModal(_('Mesh Status'), _('Execution failed: %s').format(e.message || e));
				});
			} else {
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
					});
			}
		};

		o = s.taboption('mesh', form.SectionValue, '_config', form.NamedSection, 'globals');
		ss = o.subsection;
		o.depends('band_mode', '0');
		ss.tab('batadv', _('batadv Settings'));
		ss.tab('usteer', _('Usteer Settings'));

		// batadv
		so = ss.taboption('batadv', form.Value, 'batadv_proto', _('Batman Device'));
		so.default = 'bat0'; so.rmempty = false;
		so.depends('mesh_node.main.use_batadv', '1');
		so.titleref = L.url('admin/network/network');

		so = ss.taboption('batadv', form.Value, 'batadv_hardif', _('Batman Interface'));
		so.default = 'batmesh'; so.rmempty = false;
		so.depends('mesh_node.main.use_batadv', '1');

		so = ss.taboption('batadv', form.RichListValue, 'routing_algo', _('Routing Algorithm'),
			_('BATMAN_IV: based on link quality (TQ), compatible with all devices. ' +
			'All nodes in the same mesh must use the same algorithm.'));
		so.value('BATMAN_IV', _('BATMAN_IV — link quality (recommended)'));
		so.value('BATMAN_V',  _('BATMAN_V — throughput based'));
		so.default = 'BATMAN_IV';
		so.depends('mesh_node.main.use_batadv', '1');
		so.write = function (section_id, value) {
			var proto  = this.section.formvalue(section_id, 'batadv_proto') || 'bat0';
			var hardif = this.section.formvalue(section_id, 'batadv_hardif') || 'batmesh';
			if (!uci.get('network', proto)) {
				uci.add('network', 'interface', proto);
				uci.set('network', proto, 'proto',     'batadv');
				uci.set('network', proto, 'gw_mode',   'off');
				uci.set('network', proto, 'multipath', 'off');
			}
			if (!uci.get('network', hardif)) {
				uci.add('network', 'interface', hardif);
				uci.set('network', hardif, 'proto',  'batadv_hardif');
				uci.set('network', hardif, 'master', proto);
				uci.set('network', hardif, 'mtu',    '1536');
			}
			uci.set('network', proto, 'routing_algo', value);
			// return this.super('write', [section_id, value]);
		};

		function batadvOpt(widget, name, title, desc) {
			var so = ss.taboption('batadv', widget, name, title, desc);
			so.depends('mesh_node.main.use_batadv', '1');
			function proto(self, section_id) {
				return self.section.formvalue(section_id, 'batadv_proto') || 'bat0';
			}
			so.load = function(section_id) {
				return uci.get('network', proto(this, section_id), this.option);
			};
			so.write = function(section_id, value) {
				uci.set('network', proto(this, section_id), this.option, value);
			};
			so.remove = function(section_id) {
				uci.unset('network', proto(this, section_id), this.option);
			};

			return so;
		}

		so = batadvOpt(form.Flag, 'aggregated_ogms', _('Aggregate Originator Messages'),
			_('reduces overhead by collecting and aggregating originator messages in a single packet rather than many small ones'));
		so.default = '1';

		so = batadvOpt(form.Value, 'orig_interval', _('Originator Interval'),
			_('The value specifies the interval (milliseconds) in which batman-adv floods the network with its protocol information.'));
		so.default = '1000'; so.datatype = 'min(1)';

		so = batadvOpt(form.Flag, 'ap_isolation', _('Access Point Isolation'),
			_('Prevents one wireless client to talk to another. This setting only affects packets without any VLAN tag (untagged packets).'));
		so.default = '0';

		so = batadvOpt(form.Flag, 'bonding', _('Bonding Mode'),
			_('When running the mesh over multiple WiFi interfaces per node batman-adv is capable of optimizing the traffic flow to gain maximum performance.'));
		so.default = '0';

		so = batadvOpt(form.Flag, 'bridge_loop_avoidance', _('Avoid Bridge Loops'),
			_('In bridged LAN setups it is advisable to enable the bridge loop avoidance in order to avoid broadcast loops that can bring the entire LAN to a standstill.'));
		so.default = '1';

		so = batadvOpt(form.Flag, 'distributed_arp_table', _('Distributed ARP Table'),
			_('When enabled the distributed ARP table forms a mesh-wide ARP cache that helps non-mesh clients to get ARP responses much more reliably and without much delay.'));
		so.default = '0';

		so = batadvOpt(form.Flag, 'fragmentation', _('Fragmentation'),
			_('Batman-adv has a built-in layer 2 fragmentation for unicast data flowing through the mesh which will allow to run batman-adv over interfaces / connections that don\'t allow to increase the MTU beyond the standard Ethernet packet size of 1500 bytes. When the fragmentation is enabled batman-adv will automatically fragment over-sized packets and defragment them on the other end. Per default fragmentation is enabled and inactive if the packet fits but it is possible to deactivate the fragmentation entirely.'));
		so.default = '0';

		so = batadvOpt(form.Value, 'hop_penalty', _('Hop Penalty'),
			_('The hop penalty setting allows to modify batman-adv\'s preference for multihop routes vs. short routes. The value is applied to the TQ of each forwarded OGM, thereby propagating the cost of an extra hop (the packet has to be received and retransmitted which costs airtime)'));
		so.datatype = 'range(0,255)'; so.default = '30';

		so = batadvOpt(form.Flag, 'multicast_mode', _('Multicast Mode'),
			_('Enables more efficient, group aware multicast forwarding infrastructure in batman-adv.'));
		so.default = '0';

		// usteer
		so = ss.taboption('usteer', form.Flag, 'enable_usteer', _('Enable usteer Smart Steering'),
			_('Uses usteer to steer clients to the best radio for optimal performance.'));
		so.default = '0'; so.rmempty = false;
		so.depends({ 'mesh_node.main.use_batadv': '0' });
		so.write = function (section_id, value) {
			uci.set('usteer', '@usteer[0]', 'enabled', value);
			return this.super('write', [section_id, value]);
		};

		so = usteeropt(ss, form.DummyValue, '_usteer_badge', _('Usteer Status'));
		so.rawhtml = true;
		so.cfgvalue = function () {
			return E('span', { style: 'display:inline-flex;align-items:center;gap:8px;' }, [
				E('strong', { style: `color:${u_running ? '#02a546ff' : '#FF3B30'};` }, u_running ? _('Running') : _('Stopped'))
			]);
		};

		so = usteeropt(ss, form.Flag, 'syslog', _('Log messages to syslog'),
			_('default true'));
		so.default = '1'; so.rmempty = false;

		so = usteeropt(ss, form.Flag, 'local_mode', _('Local mode'),
			_('Disable network communication') + ' (' + _('default false') + ')');
		so.default = '0'; so.rmempty = false;

		so = usteeropt(ss, form.Flag, 'ipv6', _('IPv6 mode'),
			_('Use IPv6 for remote exchange') + ' (' + _('default false') + ')');
		so.default = '0'; so.rmempty = false;

		so = usteeropt(ss, form.ListValue, 'debug_level', _('Debug level'));
		so.value('0', _('Fatal'));
		so.value('1', _('Info'));
		so.value('2', _('Verbose'));
		so.value('3', _('Some debug'));
		so.value('4', _('Network packet info'));
		so.value('5', _('All debug messages'));
		so.default = '2'; so.rmempty = false; so.editable = true;

		so = usteeropt(ss, form.Value, 'max_neighbor_reports', _('Max neighbor reports'),
			_('Maximum number of neighbor reports set for a node'));
		so.optional = true; so.placeholder = 8;

		so = usteeropt(ss, form.Value, 'sta_block_timeout', _('Sta block timeout'),
			_('Maximum amount of time (ms) a station may be blocked due to policy decisions'));
		so.optional = true; so.placeholder = 30000;

		so = usteeropt(ss, form.Value, 'local_sta_timeout', _('Local sta timeout'),
			_('Maximum amount of time (ms) a local unconnected station is tracked'));
		so.optional = true; so.placeholder = 120000;

		so = usteeropt(ss, form.Value, 'measurement_report_timeout', _('Measurement report timeout'),
			_('Maximum amount of time (ms) a measurement report is stored'));
		so.optional = true; so.placeholder = 120000;

		so = usteeropt(ss, form.Value, 'local_sta_update', _('Local sta update'),
			_('Local station information update interval (ms)'));
		so.optional = true; so.placeholder = 1000;

		so = usteeropt(ss, form.Value, 'max_retry_band', _('Max retry band'),
			_('Maximum number of consecutive times a station may be blocked by policy'));
		so.optional = true; so.placeholder = 5;

		so = usteeropt(ss, form.Value, 'seen_policy_timeout', _('Seen policy timeout'),
			_('Maximum idle time of a station entry (ms) to be considered for policy decisions'));
		so.optional = true; so.placeholder = 30000;

		so = usteeropt(ss, form.Value, 'load_balancing_threshold', _('Load balancing threshold'),
			_('Minimum number of stations delta between APs before load balancing policy is active'));
		so.optional = true; so.placeholder = 0;

		so = usteeropt(ss, form.Value, 'band_steering_threshold', _('Band steering threshold'),
			_('Minimum number of stations delta between bands before band steering policy is active'));
		so.optional = true; so.placeholder = 5;

		so = usteeropt(ss, form.Value, 'remote_update_interval', _('Remote update interval'),
			_('Interval (ms) between sending state updates to other APs'));
		so.optional = true; so.placeholder = 1000;

		so = usteeropt(ss, form.Value, 'remote_node_timeout', _('Remote node timeout'),
			_('Number of remote update intervals after which a remote-node is deleted'));
		so.optional = true; so.placeholder = 10;

		so = usteeropt(ss, form.Flag, 'assoc_steering', _('Assoc steering'),
			_('Allow rejecting assoc requests for steering purposes') + ' (' + _('default false') + ')');
		so.default = '0'; so.optional = true;

		so = usteeropt(ss, form.Flag, 'probe_steering', _('Probe steering'),
			_('Allow ignoring probe requests for steering purposes') + ' (' + _('default false') + ')');
		so.default = '0'; so.optional = true;

		so = usteeropt(ss, form.Value, 'min_connect_snr', _('Min connect SNR'),
			_('Minimum signal-to-noise ratio or signal level (dBm) to allow connections'));
		so.optional = true; so.placeholder = 0; so.datatype = 'integer';

		so = usteeropt(ss, form.Value, 'min_snr', _('Min SNR'),
			_('Minimum signal-to-noise ratio or signal level (dBm) to remain connected'));
		so.optional = true; so.placeholder = 0; so.datatype = 'integer';

		so = usteeropt(ss, form.Value, 'min_snr_kick_delay', _('Min SNR kick delay'),
			_('Timeout after which a station with SNR < min_SNR will be kicked'));
		so.optional = true; so.placeholder = 5000; so.datatype = 'uinteger';

		so = usteeropt(ss, form.Value, 'steer_reject_timeout', _('Steer reject timeout'),
			_('Timeout (ms) for which a client will not be steered after rejecting a BSS-transition-request'));
		so.optional = true; so.placeholder = 60000; so.datatype = 'uinteger';

		so = usteeropt(ss, form.Value, 'roam_process_timeout', _('Roam process timeout'),
			_('Timeout (in ms) after which a association following a disassociation is not seen as a roam'));
		so.optional = true; so.placeholder = 5000; so.datatype = 'uinteger';

		so = usteeropt(ss, form.Value, 'roam_scan_snr', _('Roam scan SNR'),
			_('Minimum signal-to-noise ratio or signal level (dBm) before attempting to trigger client scans for roam'));
		so.optional = true; so.placeholder = 0; so.datatype = 'integer';

		so = usteeropt(ss, form.Value, 'roam_scan_tries', _('Roam scan tries'),
			_('Maximum number of client roaming scan trigger attempts'));
		so.optional = true; so.placeholder = 3; so.datatype = 'uinteger';

		so = usteeropt(ss, form.Value, 'roam_scan_timeout', _('Roam scan timeout'),
			_('Retry scanning when roam_scan_tries is exceeded after this timeout (in ms).') +
			_(' In case this option is disabled, the client is kicked instead')
		);
		so.optional = true; so.placeholder = 0; so.datatype = 'uinteger';

		so = usteeropt(ss, form.Value, 'roam_scan_interval', _('Roam scan interval'),
			_('Minimum time (ms) between client roaming scan trigger attempts'));
		so.optional = true; so.placeholder = 10000; so.datatype = 'uinteger';

		so = usteeropt(ss, form.Value, 'roam_trigger_snr', _('Roam trigger SNR'),
			_('Minimum signal-to-noise ratio or signal level (dBm) before attempting to trigger forced client roaming'));
		so.optional = true; so.placeholder = 0; so.datatype = 'integer';

		so = usteeropt(ss, form.Value, 'roam_trigger_interval', _('Roam trigger interval'),
			_('Minimum time (ms) between client roaming trigger attempts'));
		so.optional = true; so.placeholder = 60000; so.datatype = 'uinteger';

		so = usteeropt(ss, form.Value, 'roam_kick_delay', _('Roam kick delay'),
			_('Timeout (ms) for client roam requests. usteer will kick the client after this times out.'));
		so.optional = true; so.placeholder = 10000; so.datatype = 'uinteger';

		so = usteeropt(ss, form.Value, 'signal_diff_threshold', _('Signal diff threshold'),
			_('Minimum signal strength difference until AP steering policy is active'));
		so.optional = true; so.placeholder = 0; so.datatype = 'uinteger';

		so = usteeropt(ss, form.Value, 'initial_connect_delay', _('Initial connect delay'),
			_('Initial delay (ms) before responding to probe requests (to allow other APs to see packets as well)'));
		so.optional = true; so.placeholder = 0; so.datatype = 'uinteger';

		so = usteeropt(ss, form.Flag, 'load_kick_enabled', _('Load kick enabled'),
			_('Enable kicking client on excessive channel load') + ' (' + _('default false') + ')');
		so.default = '0'; so.optional = true;

		so = usteeropt(ss, form.Value, 'load_kick_threshold', _('Load kick threshold'),
			_('Minimum channel load (%) before kicking clients'));
		so.optional = true; so.placeholder = 75; so.datatype = 'uinteger';

		so = usteeropt(ss, form.Value, 'load_kick_delay', _('Load kick delay'),
			_('Minimum amount of time (ms) that channel load is above threshold before starting to kick clients'));
		so.optional = true; so.placeholder = 10000; so.datatype = 'uinteger';

		so = usteeropt(ss, form.Value, 'load_kick_min_clients', _('Load kick min clients'),
			_('Minimum number of connected clients before kicking based on channel load'));
		so.optional = true; so.placeholder = 10; so.datatype = 'uinteger';

		so = usteeropt(ss, form.Value, 'load_kick_reason_code', _('Load kick reason code'),
			_('Reason code on client kick based on channel load.') + ' Default: WLAN_REASON_DISASSOC_AP_BUSY)'
		);
		so.optional = true; so.placeholder = 5; so.datatype = 'uinteger';

		so = usteeropt(ss, form.Value, 'band_steering_interval', _('Band steering interval'),
			_('Attempting to steer clients to a higher frequency-band every n ms. A value of 0 disables band-steering.'));
		so.optional = true; so.placeholder = 120000; so.datatype = 'uinteger';

		so = usteeropt(ss, form.Value, 'band_steering_min_snr', _('Band steering min SNR'),
			_('Minimal SNR or absolute signal a device has to maintain over band_steering_interval to be steered to a higher frequency band.'));
		so.optional = true; so.placeholder = -60; so.datatype = 'integer';

		so = usteeropt(ss, form.Value, 'link_measurement_interval', _('Link measurement interval'),
			_('Interval (ms) the device is sent a link-measurement request to help assess the bi-directional link quality.') +
			_('Setting the interval to 0 disables link-measurements.')
		);
		so.optional = true; so.placeholder = 30000; so.datatype = 'uinteger';

		so = usteeropt(ss, form.Value, 'node_up_script', _('Node up script'),
			_('Script to run after bringing up a node'));
		so.optional = true; so.datatype = 'string';

		so = usteeropt(ss, form.MultiValue, 'event_log_types', _('Event log types'),
			_('Message types to include in log.'));
		so.value('probe_req_accept');
		so.value('probe_req_deny');
		so.value('auth_req_accept');
		so.value('auth_req_deny');
		so.value('assoc_req_accept');
		so.value('assoc_req_deny');
		so.value('load_kick_trigger');
		so.value('load_kick_reset');
		so.value('load_kick_min_clients');
		so.value('load_kick_no_client');
		so.value('load_kick_client');
		so.value('signal_kick');
		so.optional = true; so.datatype = 'list(string)';

		o = s.taboption('other', form.Value, 'hostname', _('Hostname'));
		o.datatype = 'hostname';
		if (info.lanMac) o.default = 'OpenWrt-' + info.lanMac.replace(/:/g, '').slice(-6).toUpperCase();

		o = s.taboption('other', form.MultiValue, 'init', _('Disabled Services'),
			_('Services selected here will be stopped and disabled on save'));
		var PROTECTED = new Set([
			'boot', 'bootcount', 'bridger', 'cron', 'done', 'dropbear', 'fstab', 'gpio_switch',
			'led', 'log', 'mesh_node', 'network', 'openssl', 'packet_steering',
			'radius', 'rpcd', 'sysctl', 'sysfixtime', 'sysntpd', 'system', 'ttyd',
			'ubihealthd', 'ucitrack', 'uhttpd', 'umount', 'urandom_seed', 'urngd', 'wpad'
		]);
		fs.list('/etc/init.d').then(function (entries) {
			entries.filter(function (e) { return e.name[0] !== '.' && !PROTECTED.has(e.name); })
				.map(function (e) { return e.name; }).sort()
				.forEach(function (name) { o.value(name, name); });
		});
		o.default = 'arpbind dnsmasq firewall miniupnpd odhcpd';

		return m.render();
	}
});
