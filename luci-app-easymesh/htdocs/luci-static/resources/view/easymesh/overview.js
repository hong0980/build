'use strict';
'require ui';
'require rpc';
'require view';
'require form';
'require uci';

var callGetWirelessDevices = rpc.declare({
	object: 'network.wireless',
	method: 'status',
	expect: { '': {} }
});

return view.extend({
	load: function () {
		return Promise.all([
			uci.load('easymesh'),
			uci.load('wireless'),
			uci.load('network'),
			callGetWirelessDevices()
		]);
	},

	render: function (data) {
		var m, s, o;

		m = new form.Map('easymesh', _('EasyMesh Configuration'),
			E('strong', {}, _('Multi-node mesh using batman-adv routing over wired Ethernet or 802.11s wireless backhaul.')));

		s = m.section(form.NamedSection, 'global', 'easymesh');
		s.addremove = false;
		s.anonymous = true;

		s.tab('basic',    _('Basic'));
		s.tab('backhaul', _('Mesh Backhaul'));
		s.tab('roaming',  _('Roaming'));
		s.tab('advanced', _('Advanced'));

		o = s.taboption('basic', form.Flag, 'enabled', _('Enable EasyMesh'));
		o.rmempty = false;
		o.default = '0';

		o = s.taboption('basic', form.ListValue, 'role', _('Node Role'),
			_('Master handles DHCP and uplink. Agent extends coverage as a slave node.'));
		o.value('master', _('Master (connected to modem/ISP)'));
		o.value('agent',  _('Agent (Slave, extends coverage)'));
		o.default = 'master';
		o.depends('enabled', '1');

		o = s.taboption('basic', form.DummyValue, '_agent_info', ' ');
		o.rawhtml = true;
		o.default =
			'<div style="background:rgba(88,166,255,.08);border:1px solid #58a6ff;' +
			'border-radius:8px;padding:14px 18px;font-size:13px;margin-top:8px">' +
			'<strong>ℹ️ ' + _('Agent configuration is managed by the Master') + '</strong><br>' +
			'<span style="color:#7d8590;font-size:12px">' +
			_('All Wi-Fi settings (SSID, password, channel, roaming, etc.) are automatically ' +
			  'applied according to the master node\'s configuration once the agent is approved. ' +
			  'No manual configuration required.') +
			'</span></div>';
		o.depends({ enabled: '1', role: 'agent' });

		o = s.taboption('basic', form.ListValue, 'backhaul', _('Backhaul Type'),
			_('Wired uses LAN cable between nodes (batman-adv over Ethernet). ' +
			  'Wireless uses a dedicated 802.11s link (batman-adv over 802.11s).'));
		o.value('wired',    _('Wired (recommended)'));
		o.value('wireless', _('Wireless (802.11s)'));
		o.value('auto',     _('Auto (wired preferred)'));
		o.default = 'wired';
		o.depends({ enabled: '1', role: 'master' });

		o = s.taboption('basic', form.Value, 'ssid',
			_('Client WiFi Name (SSID)'),
			_('Name of the WiFi network that phones and computers connect to. ' +
			  'Applied on all radios (2.4 GHz + 5 GHz). Pushed to all agent nodes.'));
		o.datatype = 'maxlength(32)';
		o.placeholder = 'OpenWrt';
		o.depends({ enabled: '1', role: 'master' });

		o = s.taboption('basic', form.Value, 'key',
			_('Client WiFi Password'),
			_('WPA2/WPA3. Leave empty for open network. Will be pushed to all agents.'));
		o.datatype = 'minlength(8)';
		o.password = true;
		o.depends({ enabled: '1', role: 'master' });

		o = s.taboption('basic', form.Flag, 'wireless_onboard',
			_('Wireless Node Onboarding'),
			_('Broadcast a temporary open SSID so new nodes can join without a cable.'));
		o.default = '0';
		o.depends({ enabled: '1', role: 'master' });

		o = s.taboption('backhaul', form.Value, 'mesh_id',
			_('802.11s Mesh ID'),
			_('Network name used by the wireless mesh backhaul (802.11s). ' +
			  'Must be identical on all nodes. Not the same as the client WiFi SSID.'));
		o.placeholder = 'OpenWrt-Mesh';
		o.depends({ enabled: '1', role: 'master', backhaul: 'wireless' });
		o.depends({ enabled: '1', role: 'master', backhaul: 'auto' });

		o = s.taboption('backhaul', form.Value, 'mesh_key',
			_('802.11s Mesh Password (SAE)'),
			_('Encryption key for the wireless mesh backhaul. Must match on all nodes. ' +
			  'Leave empty to disable mesh encryption (not recommended on wireless backhaul).'));
		o.datatype = 'minlength(8)';
		o.password = true;
		o.placeholder = _('Minimum 8 characters');
		o.depends({ enabled: '1', role: 'master', backhaul: 'wireless' });
		o.depends({ enabled: '1', role: 'master', backhaul: 'auto' });

		o = s.taboption('backhaul', form.ListValue, 'mesh_band',
			_('802.11s Backhaul Band'),
			_('Radio band used for the 802.11s mesh backhaul link between nodes.'));
		o.value('2g', _('2.4 GHz (better range, slower)'));
		o.value('5g', _('5 GHz (faster, recommended)'));
		o.default = '5g';
		o.depends({ enabled: '1', role: 'master', backhaul: 'wireless' });
		o.depends({ enabled: '1', role: 'master', backhaul: 'auto' });

		o = s.taboption('backhaul', form.DummyValue, '_wired_info', ' ');
		o.rawhtml = true;
		o.default =
			'<div style="background:rgba(46,164,79,.06);border:1px solid #2ea44f44;' +
			'border-radius:8px;padding:12px 16px;font-size:13px">' +
			'<strong>🔌 ' + _('Wired backhaul active') + '</strong><br>' +
			'<span style="color:#7d8590;font-size:12px">' +
			_('batman-adv routes mesh traffic over the LAN cable between nodes. ' +
			  'No 802.11s configuration is needed — the wireless radio is fully available for client traffic.') +
			'</span></div>';
		o.depends({ enabled: '1', role: 'master', backhaul: 'wired' });

		o = s.taboption('roaming', form.Flag, 'ieee80211r',
			_('802.11r Fast BSS Transition'),
			_('Greatly reduces disconnect time when switching nodes. Recommended.'));
		o.default = '1';
		o.depends({ enabled: '1', role: 'master' });

		o = s.taboption('roaming', form.Value, 'mobility_domain',
			_('Mobility Domain ID'),
			_('4-digit hex string. Must be identical on all nodes.'));
		o.datatype = 'and(hexstring,rangelength(4,4))';
		o.placeholder = 'aabb';
		o.depends({ enabled: '1', role: 'master', ieee80211r: '1' });

		o = s.taboption('roaming', form.Flag, 'ieee80211k',
			_('802.11k Neighbor Report'),
			_('Informs devices about nearby nodes to assist proactive roaming.'));
		o.default = '1';
		o.depends({ enabled: '1', role: 'master' });

		o = s.taboption('roaming', form.Flag, 'ieee80211v',
			_('802.11v BSS Transition Management'),
			_('Actively steers weak-signal devices to a better node.'));
		o.default = '1';
		o.depends({ enabled: '1', role: 'master' });

		o = s.taboption('roaming', form.Flag, 'ft_over_ds',
			_('FT over DS'),
			_('Pre-negotiate keys over wired backbone for faster transition.'));
		o.default = '1';
		o.depends({ enabled: '1', role: 'master', ieee80211r: '1' });

		o = s.taboption('roaming', form.Value, 'reassociation_deadline',
			_('Reassociation Deadline (ms)'));
		o.datatype = 'range(1000,65535)';
		o.placeholder = '1000';
		o.depends({ enabled: '1', role: 'master', ieee80211r: '1' });

		o = s.taboption('advanced', form.Flag, 'dfs_enable',
			_('Enable DFS Channels'),
			_('Include radar-protected 5 GHz DFS channels in ACS scan.'));
		o.default = '1';
		o.depends({ enabled: '1', role: 'master' });

		o = s.taboption('advanced', form.ListValue, 'routing_algo',
			_('batman-adv Routing Algorithm'));
		o.value('BATMAN_IV', 'BATMAN IV ' + _('(default, best compatibility)'));
		o.value('BATMAN_V',  'BATMAN V '  + _('(more accurate, requires kernel support)'));
		o.default = 'BATMAN_IV';
		o.depends({ enabled: '1', role: 'master' });

		o = s.taboption('advanced', form.Flag, 'mesh_fwding',
			_('802.11s Native Forwarding'),
			_('Enable 802.11s path selection in addition to batman-adv. Normally disabled.'));
		o.default = '0';
		o.depends({ enabled: '1', role: 'master', backhaul: 'wireless' });
		o.depends({ enabled: '1', role: 'master', backhaul: 'auto' });

		o = s.taboption('advanced', form.Flag, 'dedicated_backhaul',
			_('Dedicated Backhaul Radio (Tri-band)'),
			_('Reserve the second 5 GHz radio exclusively for node-to-node backhaul.'));
		o.default = '0';
		o.depends({ enabled: '1', role: 'master' });

		o = s.taboption('advanced', form.Value, 'backhaul_channel',
			_('Backhaul Channel'),
			_('Fixed channel for dedicated backhaul radio. 149/153/157/161 recommended.'));
		o.placeholder = '149';
		o.datatype = 'range(1,177)';
		o.depends({ enabled: '1', role: 'master', dedicated_backhaul: '1' });

		return m.render();
	},
});
