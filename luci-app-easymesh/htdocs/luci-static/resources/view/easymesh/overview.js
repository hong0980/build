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
			E('strong', {}, _('Wireless mesh network based on batman-adv + 802.11s.')));

		s = m.section(form.NamedSection, 'global', 'easymesh');
		s.addremove = false;
		s.anonymous = true;

		s.tab('basic',    _('Basic'));
		s.tab('backhaul', _('Mesh Backhaul'));
		s.tab('roaming',  _('Roaming'));
		s.tab('advanced', _('Advanced'));

		/* ── Basic tab ─────────────────────────────────────────────── */
		o = s.taboption('basic', form.Flag, 'enabled', _('Enable EasyMesh'));
		o.rmempty = false;
		o.default = '0';

		o = s.taboption('basic', form.ListValue, 'role', _('Node Role'),
			_('Master handles DHCP and uplink. Agent extends coverage as a slave node.'));
		o.value('master', _('Master (connected to modem/ISP)'));
		o.value('agent',  _('Agent (Slave, extends coverage)'));
		o.default = 'master';
		o.depends('enabled', '1');

		/* Agent info banner */
		o = s.taboption('basic', form.DummyValue, '_agent_info', ' ');
		o.rawhtml = true;
		o.default =
			'<div style="background:rgba(88,166,255,.08);border:1px solid #58a6ff;' +
			'border-radius:8px;padding:14px 18px;font-size:13px;color:#e6edf3;margin-top:8px">' +
			'<strong>ℹ️ ' + _('Agent configuration is managed by the Master') + '</strong><br>' +
			'<span style="color:#7d8590">' +
			_('WiFi name, password, channel, roaming settings and all other mesh parameters ' +
			  'are pushed automatically by the master router after approval. ' +
			  'No manual configuration is needed here — just enable EasyMesh above.') +
			'</span></div>';
		o.depends({ enabled: '1', role: 'agent' });

		/* ── Backhaul type (master only, in Basic tab) ──────────────── */
		o = s.taboption('basic', form.ListValue, 'backhaul', _('Backhaul Type'),
			_('Wired is more stable. Wireless uses a dedicated 5 GHz band.'));
		o.value('wired',    _('Wired (recommended)'));
		o.value('wireless', _('Wireless (5 GHz)'));
		o.value('auto',     _('Auto (wired preferred)'));
		o.default = 'wired';
		o.depends({ enabled: '1', role: 'master' });

		/* ── WiFi settings (master only, in Basic tab) ──────────────── */
		o = s.taboption('basic', form.Value, 'ssid',
			_('WiFi Name (SSID)'),
			_('Applied on all radios (2.4 GHz + 5 GHz). Pushed to all agent nodes automatically.'));
		o.datatype = 'maxlength(32)';
		o.placeholder = 'OpenWrt';
		o.depends({ enabled: '1', role: 'master' });

		o = s.taboption('basic', form.Value, 'key',
			_('WiFi Password'),
			_('WPA2/WPA3. Leave empty for open network. Will be pushed to all agents.'));
		o.datatype = 'minlength(8)';
		o.password = true;
		o.depends({ enabled: '1', role: 'master' });

		/* ── Wireless onboarding (master only) ──────────────────────── */
		o = s.taboption('basic', form.Flag, 'wireless_onboard',
			_('Wireless Node Onboarding'),
			_('Broadcast a temporary open SSID so new nodes can join without a cable.'));
		o.default = '0';
		o.depends({ enabled: '1', role: 'master' });

		/* ── Mesh Backhaul tab (master only) ───────────────────────── */
		o = s.taboption('backhaul', form.Value, 'mesh_id',
			_('Mesh Network ID'), _('Must be identical on all nodes'));
		o.placeholder = 'OpenWrt-Mesh';
		o.depends({ enabled: '1', role: 'master' });

		o = s.taboption('backhaul', form.Value, 'mesh_key',
			_('Mesh Password (SAE)'),
			_('Must be identical on all nodes. Leave empty to disable encryption.'));
		o.datatype = 'minlength(8)';
		o.password = true;
		o.placeholder = _('Minimum 8 characters');
		o.depends({ enabled: '1', role: 'master' });

		o = s.taboption('backhaul', form.ListValue, 'mesh_band',
			_('Mesh Backhaul Band'));
		o.value('2g', _('2.4 GHz (better range, slower)'));
		o.value('5g', _('5 GHz (faster, recommended)'));
		o.default = '5g';
		o.depends({ enabled: '1', role: 'master', backhaul: 'wireless' });
		o.depends({ enabled: '1', role: 'master', backhaul: 'auto' });

		/* ── Roaming tab (master only) ──────────────────────────────── */
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

		/* ── Advanced tab (master only) ────────────────────────────── */
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
			_('Normally disabled — batman-adv handles forwarding.'));
		o.default = '0';
		o.depends({ enabled: '1', role: 'master' });

		o = s.taboption('advanced', form.Flag, 'dedicated_backhaul',
			_('Dedicated Backhaul Radio (Tri-band)'),
			_('Reserve the second 5 GHz radio exclusively for node-to-node backhaul.'));
		o.default = '0';
		o.depends({ enabled: '1', role: 'master' });

		o = s.taboption('advanced', form.ListValue, 'backhaul_band',
			_('Backhaul Radio Band'));
		o.value('5g_2', _('Second 5 GHz radio (recommended)'));
		o.value('5g_1', _('First 5 GHz radio'));
		o.default = '5g_2';
		o.depends({ enabled: '1', role: 'master', dedicated_backhaul: '1' });

		o = s.taboption('advanced', form.Value, 'backhaul_channel',
			_('Backhaul Channel'),
			_('Fixed channel for dedicated backhaul radio. 149/153/157/161 recommended.'));
		o.placeholder = '149';
		o.datatype = 'range(1,177)';
		o.depends({ enabled: '1', role: 'master', dedicated_backhaul: '1' });

		return m.render();
	},
});
