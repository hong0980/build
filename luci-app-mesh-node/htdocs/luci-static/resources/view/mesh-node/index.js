'use strict';
'require fs';
'require ui';
'require uci';
'require rpc';
'require view';
'require form';
'require network';

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

function m11opt(s, tab, widget, name, section, title, desc) {
	var o = s.taboption(tab, widget, name, title, desc);
	o.ucisection = section || 'setup'; o.uciconfig = 'mesh11sd';
	o.depends('mesh_node.globals.m11_enable', '1');
	o.depends('use_batadv', '0');
	return o;
}

return view.extend({
	load: function () {
		return Promise.all([
			Promise.all([callLuciWirelessDevices(), callIfaceDump(), callNetdevs()])
				.then(function ([wifiDevs, ifaces, devs]) {
					var info = {
						ssid_2g: '', ssid_5g: '', key_2g: '', key_5g: '',
						mesh_id: '', wifi_pass: '', mesh_pass: '',
						lanIp: '', lanMac: '', lanProto: '',
						wanIfname: '', wanMac: '', wanProto: ''
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
								if (band === '5g' || band === '5GHz') {
									info.ssid_5g = ssid; info.key_5g  = key;
								} else {
									info.ssid_2g = ssid; info.key_2g  = key;
								}
							} else if (mode === 'Mesh Point' || mode === 'mesh') {
								info.mesh_id   = meshId;
								if (key) info.mesh_pass = key;
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
			uci.load('mesh_node')
		]);
	},

	render: function ([info, running]) {
		var m, s, o, so, ss;
		m = new form.Map('mesh_node', _('AP + Mesh Deployment'));
		m.chain('mesh11sd');
		m.chain('network');

		s = m.section(form.NamedSection, 'main');
		s.addremove = false;
		s.anonymous = true;

		s.tab('network',       _('Network'));
		s.tab('wireless',      _('Wireless'));
		s.tab('mesh',          _('Mesh Backhaul'));
		s.tab('miscellaneous', _('Miscellaneous'));

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
			'dhcp':   [{ combo_mode: 'custom' }, { combo_mode: 'dhcp_none' }],
			'bridge': [{ combo_mode: 'bridge_dhcp' }, { combo_mode: 'bridge_static' }]
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
			'none':   [{ combo_mode: 'custom' }, { combo_mode: 'dhcp_none' }, { combo_mode: 'pppoe_none' }],
		};

		o = s.taboption('network', form.Value, 'lan_ip', _('Node Static IP'),
			_('Static IPv4 address for this node\'s LAN bridge. Must be unique per node, e.g. 192.168.2.2 / .3 / .4'));
		o.datatype = 'ip4addr'; o.rmempty = false;
		o.depends({ combo_mode: 'custom' });
		o.depends({ lan_proto: 'static' });

		o = s.taboption('network', form.Value, 'gateway', _('Gateway / DNS'),
			_('Upstream router IP, used as the default gateway and DNS server for this node'));
		o.datatype = 'ip4addr'; o.rmempty = false;
		o.depends({ combo_mode: 'custom' });
		o.depends({ lan_proto: 'static' });

		o = s.taboption('network', form.DummyValue, '_lan_ip', _('DHCP Assigned IP'),
			_('IP address assigned to this node by the upstream DHCP server; shown for reference only'));
		o.default = info.lanIp || ''; o.depends({ lan_proto: 'dhcp' });

		o = s.taboption('wireless', form.Flag, 'band_merge', _('Dual-band Merge'),
			_('Enabled: one SSID/password applied to both 2.4 GHz and 5 GHz radios.'));
		o.default = '0';

		o = s.taboption('wireless', form.Flag, 'enable_usteer', _('Enable usteer Smart Steering'),
			_('Uses usteer to steer clients to the best radio for optimal performance.'));
		o.default = '0';

		o = s.taboption('wireless', form.Value, 'ssid_2g', _('2.4 GHz SSID'),
			_('Must exactly match the main router SSID to enable seamless roaming'));
		o.default = info.ssid_2g || 'HomeWiFi';
		o.rmempty = false; o.depends('band_merge', '0');

		o = s.taboption('wireless', form.Value, 'key_2g', _('2.4 GHz WiFi Password'),
			_('Encryption: psk2+ccmp (WPA2). Minimum 8 characters.'));
		o.datatype = 'wpakey'; o.password = true;
		o.rmempty = false; o.default = info.key_2g || '';
		o.depends('band_merge', '0');

		o = s.taboption('wireless', form.Value, 'ssid_5g', _('5 GHz SSID'),
			_('Must exactly match the main router SSID to enable seamless roaming'));
		o.default = info.ssid_5g || 'HomeWiFi-5G';
		o.rmempty = false; o.depends('band_merge', '0');

		o = s.taboption('wireless', form.Value, 'key_5g', _('5 GHz WiFi Password'),
			_('Encryption: psk2+ccmp (WPA2). Minimum 8 characters.'));
		o.datatype = 'wpakey'; o.password = true;
		o.rmempty = false; o.default = info.key_5g || '';
		o.depends('band_merge', '0');

		o = s.taboption('wireless', form.Value, 'wifi_ssid', _('WiFi SSID'),
			_('Shared by 2.4 GHz and 5 GHz'));
		o.rmempty = false; o.depends('band_merge', '1');

		o = s.taboption('wireless', form.Value, 'wifi_pass', _('WiFi Password'),
			_('Shared by 2.4 GHz and 5 GHz; minimum 8 characters'));
		o.datatype = 'wpakey'; o.password = true;
		o.rmempty = false; o.default = info.wifi_pass || '';
		o.depends('band_merge', '1');

		o = s.taboption('mesh', form.RichListValue, 'mesh_radio', _('Mesh Backhaul Band'),
			_('Select the radio band used for the 802.11s mesh backhaul link.'));
		o.value('5g',   _('5 GHz (recommended, best throughput)'));
		o.value('2g',   _('2.4 GHz (longer range, lower throughput)'));
		o.value('none', _('All bands (all radios participate in the mesh)'));
		o.default = '5g';

		o = s.taboption('mesh', form.Value, 'mesh_id', _('Mesh ID'),
			_('Must be identical on every mesh node'));
		o.default = info.mesh_id || 'HomeMesh'; o.rmempty = false;

		o = s.taboption('mesh', form.Value, 'mesh_pass', _('Mesh Password'),
			_('SAE (WPA3) passphrase; minimum 8 characters, must match on all nodes'));
		o.datatype = 'wpakey'; o.password = true;
		o.rmempty = false; o.default = info.mesh_pass || '';

		o = s.taboption('mesh', form.RichListValue, 'use_batadv', _('Mesh Protocol'),
			_('802.11s native: kernel-level forwarding, simpler setup. ' +
			  'batman-adv: advanced L2 routing on top of 802.11s, better multi-hop performance. ' +
			  'When switching modes, save and reboot all nodes.'));
		o.value('0', _('802.11s native — kernel mesh forwarding (default)'));
		o.value('1', _('batman-adv — 802.11s backhaul + batadv L2 routing'));
		o.default = '0';

		o = s.taboption('mesh', form.Button, '_mesh_status_btn', _('Mesh Status'));
		o.inputtitle = _('View Mesh Status'); o.inputstyle = 'positive';
		o.onclick = function () {
			if (uci.get_bool('mesh_node', 'main', 'use_batadv')) {
				var run = function (args) {
					return fs.exec_direct('/usr/sbin/batctl', args)
						.then(function (r) { return (r || '').trim(); })
						.catch(function (e) { return '(error: ' + (e.message || e) + ')'; });
				};

				return Promise.all([
					run(['meshif', 'bat0', 'mj']),
					run(['meshif', 'bat0', 'hj']),
					run(['meshif', 'bat0', 'nj']),
					run(['meshif', 'bat0', 'oj']),
					run(['meshif', 'bat0', 'gwj']),
					run(['meshif', 'bat0', 'statistics'])
				]).then(function (r) {
					var sep = '─'.repeat(72), text = '';
					var titles = [_('MESH INFO'), _('INTERFACES'), _('NEIGHBORS'), _('ORIGINATORS'), _('GATEWAYS'), _('STATISTICS')];
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

		o = s.taboption('mesh', form.SectionValue, '_batadv_config', form.NamedSection, 'globals');
		o.depends('mesh_node.main.use_batadv', '1');

		ss = o.subsection;
		ss.tab('general', _('General Settings'));
		ss.tab('advanced', _('Advanced Settings'));

		so = ss.taboption('general', form.RichListValue, 'routing_algo', _('Routing Algorithm'),
			_('BATMAN_IV: based on link quality (TQ), compatible with all devices. ' +
			'All nodes in the same mesh must use the same algorithm.'));
		so.value('BATMAN_IV', _('BATMAN_IV — link quality (recommended)'));
		so.value('BATMAN_V',  _('BATMAN_V — throughput based'));
		so.default = 'BATMAN_IV';
		so.uciconfig = 'network'; so.ucisection = 'bat0';

		so = ss.taboption('general', form.Flag, 'aggregated_ogms', _('Aggregate Originator Messages'),
			_('reduces overhead by collecting and aggregating originator messages in a single packet rather than many small ones'));
		so.default = '1';
		so.uciconfig = 'network'; so.ucisection = 'bat0';

		so = ss.taboption('general', form.Value, 'orig_interval', _('Originator Interval'),
			_('The value specifies the interval (milliseconds) in which batman-adv floods the network with its protocol information.'));
		so.default = '1000'; so.datatype = 'min(1)';
		so.uciconfig = 'network'; so.ucisection = 'bat0';

		so = ss.taboption('advanced', form.Flag, 'ap_isolation', _('Access Point Isolation'),
			_('Prevents one wireless client to talk to another. This setting only affects packets without any VLAN tag (untagged packets).'));
		so.default = '0';
		so.uciconfig = 'network'; so.ucisection = 'bat0';

		so = ss.taboption('advanced', form.Flag, 'bonding', _('Bonding Mode'),
			_('When running the mesh over multiple WiFi interfaces per node batman-adv is capable of optimizing the traffic flow to gain maximum performance.'));
		so.default = '0';
		so.uciconfig = 'network'; so.ucisection = 'bat0';

		so = ss.taboption('advanced', form.Flag, 'bridge_loop_avoidance', _('Avoid Bridge Loops'),
			_('In bridged LAN setups it is advisable to enable the bridge loop avoidance in order to avoid broadcast loops that can bring the entire LAN to a standstill.'));
		so.default = '1';
		so.uciconfig = 'network'; so.ucisection = 'bat0';

		so = ss.taboption('advanced', form.Flag, 'distributed_arp_table', _('Distributed ARP Table'),
			_('When enabled the distributed ARP table forms a mesh-wide ARP cache that helps non-mesh clients to get ARP responses much more reliably and without much delay.'));
		so.default = '1';
		so.uciconfig = 'network'; so.ucisection = 'bat0';

		so = ss.taboption('advanced', form.Flag, 'fragmentation', _('Fragmentation'),
			_('Batman-adv has a built-in layer 2 fragmentation for unicast data flowing through the mesh which will allow to run batman-adv over interfaces / connections that don\'t allow to increase the MTU beyond the standard Ethernet packet size of 1500 bytes. When the fragmentation is enabled batman-adv will automatically fragment over-sized packets and defragment them on the other end. Per default fragmentation is enabled and inactive if the packet fits but it is possible to deactivate the fragmentation entirely.'));
		so.default = '1';
		so.uciconfig = 'network'; so.ucisection = 'bat0';

		so = ss.taboption('advanced', form.Value, 'hop_penalty', _('Hop Penalty'),
			_('The hop penalty setting allows to modify batman-adv\'s preference for multihop routes vs. short routes. The value is applied to the TQ of each forwarded OGM, thereby propagating the cost of an extra hop (the packet has to be received and retransmitted which costs airtime)'));
		so.datatype = 'range(0,255)'; so.default = '30';
		so.uciconfig = 'network'; so.ucisection = 'bat0';

		so = ss.taboption('advanced', form.Flag, 'multicast_mode', _('Multicast Mode'),
			_('Enables more efficient, group aware multicast forwarding infrastructure in batman-adv.'));
		so.default = '1';
		so.uciconfig = 'network'; so.ucisection = 'bat0';

		so = ss.taboption('advanced', form.ListValue, 'log_level', _('Log Level'));
		so.value('0',  _('Disabled (no log)'));
		so.value('1',  _('Routing (OGM)'));
		so.value('2',  _('Routing table changes'));
		so.value('3',  _('Routing + table changes'));
		so.value('4',  _('Statistics'));
		so.value('15', _('All messages'));
		so.default = '0';
		so.uciconfig = 'network'; so.ucisection = 'bat0';

		so = ss.taboption('advanced', form.Value, 'isolation_mark', _('Isolation Mark'),
			_('Set the isolation mark for AP isolation'));
		so.placeholder = '0x00000000/0x00000000';
		so.uciconfig = 'network'; so.ucisection = 'bat0';

		so = ss.taboption('advanced', form.Value, 'multicast_fanout', _('Multicast Fanout'),
			_('Set the multicast fanout value'));
		so.datatype = 'min(1)'; so.default = '16';
		so.uciconfig = 'network'; so.ucisection = 'bat0';

		o = s.taboption('mesh', form.SectionValue, '_mesh11sd_config', form.NamedSection, 'globals');
		o.depends('use_batadv', '0');
		ss = o.subsection;
		ss.tab('daemon', _('General Settings'));
		ss.tab('advanced', _('Advanced Settings'));

		so = ss.taboption('daemon', form.DummyValue, '_m11_badge', _('Daemon Status'));
		so.rawhtml = true;
		so.cfgvalue = function () {
			return E('span', { style: 'display:inline-flex;align-items:center;gap:8px;' }, [
				E('strong', { style: `color:${running ? '#02a546ff' : '#FF3B30'};` }, running ? _('Running') : _('Stopped'))
			]);
		};

		so = ss.taboption('daemon', form.Flag, 'm11_enable', _('Enable mesh11sd Daemon'),
			_('the daemon continuously monitors mesh interfaces, synchronises ' +
			  'kernel parameters, removes phantom routes, and manages DHCP role selection ' +
			  'based on upstream connectivity.'));
		so.write = function (section_id, value) {
			this.super('write', [section_id, value]);
			return this.map.uci.set('mesh11sd', 'setup', 'enabled', value);
		};
		so.default = '0'; so.rmempty = false;

		o = m11opt(ss,'daemon', form.Value, 'checkinterval', null, _('Check Interval (seconds)'),
			_('How often the daemon checks and updates mesh configuration. Minimum: 10.'));
		o.datatype = 'min(10)'; o.default = '10';

		o = m11opt(ss,'daemon',  form.ListValue, 'debuglevel', null, _('Log Level'),
			_('Sets the debug log level.'));
		o.value('0', _('Silent'));
		o.value('1', _('Notification'));
		o.value('2', _('Info'));
		o.value('3', _('Debug'));
		o.default = '1';

		o = m11opt(ss,'daemon', form.Value, 'interface_timeout', null, _('Interface Timeout (seconds)'),
			_('Time to wait for a mesh interface to become ready before giving up.'));
		o.datatype = 'uinteger'; o.default = '10';

		o = m11opt(ss,'daemon', form.Value, 'mesh_path_cost', null, _('Mesh Path Cost'),
			_('STP cost assigned to the mesh network. Range: 0–65534. Set to 0 to disable STP.'));
		o.datatype = 'range(0,65534)'; o.default = '10';

		o = m11opt(ss, 'advanced',  form.Flag, 'auto_config', null, _('Auto Configuration'),
			_('Enables autonomous dynamic mesh configuration.<br>' +
			'<span style="color: #d63638; font-weight: bold;">⚠️ Warning: ' +
			'If an existing mesh configuration is found, it will be honoured even if it is incorrect.<br>' +
			'Manually configuring a mesh can soft brick the router if incorrectly done.<br></span>' +
			'Auto config can be tested using the command line function: <code>mesh11sd auto_config test</code>'));
		o.value('0', _('Disabled'));
		o.value('1', _('Enabled'));
		o.default = '0';

		o = m11opt(ss, 'advanced',  form.ListValue, 'portal_detect', null, _('Portal Detection Mode'),
			_('Controls how this node determines its role in the mesh.<br>' +
			'Force routed portal (MRP): always acts as IPv4 NAT gateway regardless of upstream.<br>' +
			'Auto detect (default): portal if upstream WAN is active, otherwise layer-2 bridge peer.<br>' +
			'CPE mode: treats mesh backhaul as upstream WAN; creates its own NAT subnet. Forces VXLAN tunnel off.<br>' +
			'Bridge VXLAN trunk portal (MBP): bridged (no-NAT) portal; adds WAN port to vxtunnel bridge.<br>' +
			'Bridge VXLAN trunk peer (TPN): peer node; adds WAN port to vxtunnel bridge.'));
		o.value('0', _('Forced Routed Portal (MRP)'));
		o.value('1', _('Auto Detect (default)'));
		o.value('3', _('Client Premises Equipment (CPE)'));
		o.value('4', _('Bridge VXLAN Trunk Portal (MBP)'));
		o.value('5', _('Bridge VXLAN Trunk Peer (TPN)'));
		o.default = '1'; o.deps = [];
		o.depends('auto_config', '1');

		o = m11opt(ss, 'advanced',  form.Value, 'portal_channel', null, _('Portal Channel (2.4 GHz)'),
			_('Forced portal channel for the 2.4 GHz band. All peer nodes will autonomously track this channel. ' +
			  'or a valid channel number 1–13.'));
		o.value('default', _('default'));
		o.value('auto', _('Auto-select'));
		o.default = 'default'; o.deps = [];
		o.depends({ portal_detect: '0' });

		o = m11opt(ss, 'advanced',  form.Flag, 'portal_use_default_ipv4', null, _('Use Default IPv4'),
			_('Only effective when this node is a portal. ' +
			  'When enabled, the IPv4 address from /etc/config/network is used as the portal address. ' +
			  'When disabled, an address is auto-calculated from the label MAC address.'));
		o.default = '0'; o.deps = [];
		o.depends({ auto_config: '1', portal_detect: /^(0|1|4)$/ });

		o = m11opt(ss, 'advanced',  form.Value, 'portal_detect_threshold', null, _('Portal Detect Threshold'),
			_('Number of consecutive check intervals without portal contact before the watchdog takes action ' +
			  '(attempts reconnection, then reboots). Set to 0 to disable the watchdog.'));
		o.datatype = 'uinteger'; o.default = '10';
		o.deps = []; o.depends('auto_config', '1');

		o = m11opt(ss, 'advanced',  form.Value, 'channel_tracking_checkinterval', null, _('Channel Tracking Checkinterval (seconds)'),
			_('Minimum interval after which peer nodes begin tracking the portal channel. ' +
			  'Values smaller than Check Interval are ignored.'));
		o.datatype = 'uinteger'; o.default = '30';

		o = m11opt(ss, 'advanced',  form.Value, 'auto_mesh_id', null, _('Auto Mesh ID'),
			_('A string that is hashed to produce a secure mesh ID. Must be identical on every mesh node. ' +
			  'Only used when Auto Configuration is enabled.'));
		o.datatype = 'string'; o.placeholder = 'MyMeshID';
		o.deps = []; o.depends('auto_config', '1');

		o = m11opt(ss, 'advanced',  form.ListValue, 'auto_mesh_band', null, _('Auto Mesh Band'),
			_('Radio band to use for the auto-configured mesh interface. ' +
			  'All peer nodes will autonomously track the portal channel regardless of this setting. ' +
			  'Must be identical on every mesh node.'));
		o.value('2g',   _('2.4 GHz'));
		o.value('2g40', _('2.4 GHz (40 MHz)'));
		o.value('5g',   _('5 GHz'));
		o.value('6g',   _('6 GHz'));
		o.value('60g',  _('60 GHz'));
		o.default = '2g40'; o.deps = [];
		o.depends('auto_config', '1');

		o = m11opt(ss, 'advanced',  form.Value, 'auto_mesh_key', null, _('Auto Mesh Key'),
			_('A string used to generate a secure SHA-256 mesh encryption key. ' +
			  'Must be identical on every mesh node when Auto Configuration is enabled.'));
		o.datatype = 'string'; o.password = true; o.placeholder = 'MySecretKey';
		o.deps = []; o.depends('auto_config', '1');

		o = m11opt(ss, 'advanced',  form.Value, 'mesh_phy_index', null, _('Mesh PHY Index'),
			_('Force the auto-config mesh interface onto a specific radio (e.g. 0 for phy0, 1 for phy1). ' +
			  'Useful on devices with multiple radios on the same band. Default: not set (first matching phy used).'));
		o.datatype = 'uinteger'; o.placeholder = '0';
		o.deps = []; o.depends('auto_config', '1');

		o = m11opt(ss, 'advanced',  form.Value, 'country', null, _('Country Code'),
			_('Set a valid ISO country code for all radios (e.g. US, CN, DE). ' +
			  'Overrides the country set in the wireless config. Defaults to DFS-ETSI if not set.'));
		o.datatype = 'string'; o.default = 'CN';

		o = m11opt(ss, 'advanced',  form.Value, 'mesh_basename', null, _('Mesh Basename'),
			_('String used to construct the mesh interface name in the form m-xxxx-n. ' +
			  'Non-alphanumeric characters are removed; only the first 4 characters are used. ' +
			  'Default: 11s (produces interface name m-11s-0).'));
		o.datatype = 'string'; o.placeholder = '11s';

		o = m11opt(ss, 'advanced',  form.Value, 'mesh_gate_base_ssid', null, _('Mesh Gate Base SSID'),
			_('Base SSID string for this node\'s gate (access point). ' +
			  'Maximum 30 characters (or 22 if SSID Suffix is enabled). ' +
			  'Overrides the SSID in the wireless config. Default: uses wireless config SSID.'));
		o.datatype = 'maxlength(30)'; o.placeholder = 'MeshGate';

		o = m11opt(ss, 'advanced',  form.ListValue, 'mesh_gate_encryption', null, _('Mesh Gate Encryption'),
			_('Encryption mode for this node\'s gate (access point).'));
		o.value('0', _('None / OWE-transition'));
		o.value('1', _('SAE (WPA3)'));
		o.value('2', _('SAE-mixed (WPA2/WPA3)'));
		o.value('3', _('PSK2 (WPA2)'));
		o.value('4', _('Opportunistic Wireless Encryption (OWE)'));
		o.default = '0';

		o = m11opt(ss, 'advanced',  form.Value, 'mesh_gate_key', null, _('Mesh Gate Key'),
			_('Encryption key for this node\'s gate. ' +
			  'Ignored when Mesh Gate Encryption is set to 0 (none) or 4 (OWE). Minimum 8 characters.'));
		o.password = true; o.datatype = 'minlength(8)';
		o.deps = []; o.depends('mesh_gate_encryption', /^(1|2|3)$/);

		o = m11opt(ss, 'advanced',  form.Flag, 'ssid_suffix_enable', null, _('SSID Suffix Enable'),
			_('Append a 4-digit suffix (last 4 hex digits of the mesh interface MAC address) to the SSID. ' +
			  'When enabled, limits Gate Base SSID to 22 characters.'));
		o.default = '1';

		o = m11opt(ss, 'advanced',  form.Flag, 'vtun_enable', null, _('VXLAN Tunnel Enable'),
			_('Enables point-to-multipoint VXLAN tunneling from the portal to all compatible peer nodes. ' +
			  'Forced to 0 when Portal Detection Mode is set to 3 (CPE).'));
		o.default = '1'; o.deps = [];
		o.depends('portal_detect', /^(0|1|4|5)$/);

		o = m11opt(ss, 'advanced',  form.Value, 'tun_id', null, _('Tunnel ID'),
			_('VXLAN tunnel identifier. A decimal number between 1 and 16777216 (24-bit).'));
		o.datatype = 'range(1,16777216)'; o.default = '69';
		o.deps = []; o.depends('vtun_enable', '1');

		o = m11opt(ss, 'advanced',  form.Value, 'vtun_ip', null, _('VXLAN Tunnel IPv4 Gateway'),
			_('IPv4 gateway address for the VXLAN tunnel subnet. ' +
			  'Becomes active when this node is a portal (Portal Detection Mode 0 or 1).'));
		o.datatype = 'ip4addr'; o.placeholder = '192.168.168.1';
		o.deps = []; o.depends({ vtun_enable: '1', portal_detect: /^(0|1)$/ });

		o = m11opt(ss, 'advanced',  form.Value, 'vtun_mask', null, _('VXLAN Tunnel IPv4 Mask'),
			_('Subnet mask for the VXLAN tunnel address.'));
		o.datatype = 'ip4addr'; o.placeholder = '255.255.255.0';
		o.deps = []; o.depends({ vtun_enable: '1', portal_detect: /^(0|1)$/ });

		o = m11opt(ss, 'advanced',  form.RichListValue, 'vtun_gate_encryption', null, _('VXLAN Tunnel Gate Encryption'),
			_('Encryption mode for access points connected to the VXLAN tunnel. ' +
			  'Default: 0 (None / OWE-transition).'));
		o.value('0', _('None / OWE-transition'));
		o.value('1', _('SAE (WPA3)'));
		o.value('2', _('SAE-mixed (WPA2/WPA3)'));
		o.value('3', _('PSK2 (WPA2)'));
		o.value('4', _('Opportunistic Wireless Encryption (OWE)'));
		o.default = '0'; o.deps = [];
		o.depends('vtun_enable', '1');

		o = m11opt(ss, 'advanced',  form.Value, 'vtun_gate_key', null, _('VXLAN Tunnel Gate Key'),
			_('Encryption key for VXLAN tunnel gate access points. ' +
			  'Ignored when Tunnel Gate Encryption is 0 or 4. Minimum 8 characters.'));
		o.password = true; o.datatype = 'minlength(8)'; o.deps = [];
		o.depends({ vtun_enable: '1', vtun_gate_encryption: /^(1|2|3)$/ });

		o = m11opt(ss, 'advanced',  form.Value, 'vtun_base_ssid', null, _('VXLAN Tunnel Base SSID'),
			_('Base SSID for access points connected to the VXLAN tunnel. ' +
			  'Maximum 30 characters (or 22 if SSID Suffix is enabled).'));
		o.datatype = 'maxlength(30)'; o.default = 'Guest';
		o.deps = []; o.depends('vtun_enable', '1');

		o = m11opt(ss, 'advanced',  form.Value, 'vtun_path_cost', null, _('VXLAN Tunnel Path Cost'),
			_('STP cost assigned to the VXLAN tunnel network. Range: 0–65534. Set to 0 to disable STP.'));
		o.datatype = 'range(0,65534)'; o.default = '10';
		o.deps = []; o.depends('vtun_enable', '1');

		o = m11opt(ss, 'advanced',  form.RichListValue, 'mesh_gate_enable', null, _('Mesh Gate Enable'),
			_('Controls whether this node provides a gate (access point) into the mesh.'));
		o.value('0', _('Disable all mesh gate access points'));
		o.value('1', _('Enable all mesh gate access points'));
		o.value('2', _('Enable only on radios NOT shared with mesh interface'));
		o.default = '1';

		o = m11opt(ss, 'advanced',  form.Flag, 'mesh_leechmode_enable', null, _('Leech Mode Enable'),
			_('When enabled, this node acts as an AP with mesh backhaul but does NOT contribute to mesh routing/forwarding.<br>' +
			'Useful when a node is within coverage of 2 or more peers and would otherwise create unstable multi-hop paths.<br>' +
			'Can also be toggled at runtime: <code>mesh11sd mesh_leechmode [enable/disable]</code>.'));
		o.default = '0';

		o = m11opt(ss, 'advanced',  form.Value, 'txpower', null, _('TX Power (dBm)'),
			_('Transmit power for the mesh radio in dBm. ' +
			  'Values outside the regulatory domain limits are ignored. Default: driver/wireless config default.'));
		o.datatype = 'uinteger'; o.placeholder = '20';

		o = m11opt(ss, 'advanced',  form.Flag, 'mesh_path_stabilisation', null, _('Mesh Path Stabilisation'),
			_('Prevents frequent multi-hop path changes caused by multipath signal strength jitter.'));
		o.default = '1';

		o = m11opt(ss, 'advanced',  form.Value, 'reactive_path_stabilisation_threshold', null, _('Reactive Path Stabilisation Threshold'),
			_('Number of consecutive check intervals with an unstable neighbour path before path stabilisation is activated.'));
		o.datatype = 'uinteger'; o.default = '10';

		o = m11opt(ss, 'advanced',  form.Flag, 'mesh_mac_forced_forwarding', null, _('MAC Forced Forwarding'),
			_('Enables MAC forced forwarding on the mesh interface to prevent ARP flooding.'));
		o.default = '1';

		o = m11opt(ss, 'advanced',  form.Flag, 'gateway_proxy_arp', null, _('Gateway Proxy ARP'),
			_('Enables proxy ARP on the gateway bridge interface.'));
		o.default = '1';

		o = m11opt(ss, 'advanced',  form.Flag, 'stop_on_error', null, _('Stop on Error'),
			_('When the watchdog detects an IPv4 communication failure with the portal, ' +
			  'the daemon enters idle mode instead of rebooting. ' +
			  'Useful on nodes without a reset button. Overrides Reboot on Error.'));
		o.default = '0';

		o = m11opt(ss, 'advanced',  form.Flag, 'reboot_on_error', null, _('Reboot on Error'),
			_('When the watchdog detects a persistent IPv4 communication failure with the portal, ' +
			  'the node is rebooted. Overridden by Stop on Error.'));
		o.default = '1'; o.deps = [];
		o.depends('stop_on_error', '0');

		o = m11opt(ss, 'advanced',  form.Flag, 'apmond_enable', null, _('AP Monitor Enable'),
			_('Enables the access point monitoring daemon (apmond). ' +
			  'Collects AP data and forwards it to the portal node.'));
		o.default = '0';

		o = m11opt(ss, 'advanced',  form.Value, 'apmond_cgi_dir', null, _('AP Monitor CGI Directory'),
			_('Directory for apmond CGI scripts. Takes effect when this node becomes a portal. Default: /www/cgi-bin.'));
		o.placeholder = '/www/cgi-bin'; o.deps = [];
		o.depends({ apmond_enable: '1', portal_detect: /^(0|1|4)$/ });

		o = m11opt(ss, 'advanced',  form.Value, 'mesh_backhaul_led', null, _('Mesh Backhaul LED'),
			_('LED used as a mesh backhaul heartbeat indicator. ' +
			  'LED is solid when the mesh interface is up, and switches to a heartbeat pattern when peers are connected. ' +
			  '"auto" uses the power/system LED if present. "none" disables. ' +
			  'Other LEDs are listed in /sys/class/leds as "color:function" (e.g. blue:run). Default: auto.'));
		o.placeholder = 'auto';

		o = m11opt(ss, 'advanced',  form.Value, 'mesh_rssi_threshold', 'mesh_params', _('RSSI Threshold (dBm)'),
			_('Minimum signal strength required to form a peer connection. ' +
			  'Range: −95 to −25 dBm. Default: −65. ' +
			  'Lower values permit weaker links; higher values enforce stronger connections.'));
		o.datatype = 'range(-95,-25)'; o.default = '-65';

		o = m11opt(ss, 'advanced',  form.Value, 'mesh_max_peer_links', 'mesh_params', _('Max Peer Links'),
			_('Maximum number of simultaneous direct peer connections per node. ' +
			  'Range: 0–32. Default: 16. ' +
			  'Reduce on dense deployments to lower protocol overhead.'));
		o.datatype = 'range(0,32)'; o.default = '16';

		o = m11opt(ss,'daemon', form.Button, '_mesh11sd_status_btn', null, _('Live Status'));
		o.inputtitle = _('Refresh Status'); o.inputstyle = 'positive'; o.addremove = false;
		o.onclick = function () {
			return fs.exec_direct('/usr/sbin/mesh11sd', ['status']).then(function (out) {
				var text = (out || '').trim() || _('No output. The daemon may still be starting; please retry in a moment.');
				showMeshModal(_('mesh11sd Status'), text);
			}).catch(function (e) {
				showMeshModal(_('mesh11sd Status'), _('Execution failed: %s').format(e.message || e));
			});
		};

		o = m11opt(ss,'daemon', form.Button, '_mesh11sd_log_btn', null, _('Daemon Log'));
		o.inputtitle = _('View Recent Log'); o.inputstyle = 'action'; o.addremove = false;
		o.onclick = function () {
			return fs.read('/tmp/mesh11sd/mesh11sd_log.log').then(function (content) {
				if (!content || !content.trim()) return Promise.reject('empty');
				var text = content.trim().split('\n').slice(-100).join('\n');
				showMeshModal(_('Daemon Log'), text);
			}).catch(function () {
				return fs.exec_direct('/sbin/logread', ['-e', 'mesh11sd']).then(function (out) {
					var text = (out || '').split('\n').slice(-80).join('\n') || _('No mesh11sd log entries found.');
					showMeshModal(_('Daemon Log'), text);
				});
			}).catch(function (e) {
				showMeshModal(_('Daemon Log'), _('Execution failed: %s').format(e.message || e));
			});
		};

		o = s.taboption('miscellaneous', form.Value, 'hostname', _('Hostname'));
		o.datatype = 'hostname';
		if (info.lanMac) o.default = 'OpenWrt-' + info.lanMac.replace(/:/g, '').slice(-6).toUpperCase();

		o = s.taboption('miscellaneous', form.MultiValue, 'init', _('Disabled Services'),
			_('Services selected here will be stopped and disabled on save'));
		var PROTECTED = new Set([
			'boot', 'bootcount', 'bridger', 'cron', 'done', 'dropbear', 'fstab', 'gpio_switch',
			'led', 'log', 'mesh_node', 'network', 'openssl', 'packet_steering', 'mesh11sd',
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
