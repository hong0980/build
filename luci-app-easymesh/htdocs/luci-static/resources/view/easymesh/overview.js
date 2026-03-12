'use strict';
'require ui';
'require rpc';
'require view';
'require form';
'require uci';
'require network';

var callGetWirelessDevices = rpc.declare({
	object: 'network.wireless',
	method: 'status',
	expect: { '': {} }
});

/* ── 角色引导块（按下拉框实时更新）─────────────────────────── */
function buildRoleGuide(isMaster) {
	var ac = isMaster ? '#58a6ff' : '#3fb950';
	var bc = isMaster ? '#2d5a8e' : '#2d6a40';
	var bg = isMaster ? 'rgba(31,58,95,.22)' : 'rgba(26,58,42,.22)';
	var steps = isMaster ? [
		_('Flash OpenWrt + install luci-app-easymesh on the new node'),
		_('Set role to Agent in its EasyMesh config, then enable EasyMesh'),
		_('Connect a LAN cable: this master LAN port ↔ new node LAN port'),
		_('Wait ~30 s — agent auto-discovers master via UDP broadcast'),
		_('Go to Nodes tab on this master and click Allow to join'),
		'💡 ' + _('Quick join: on the new node hold WPS button 2–10 s.')
	] : [
		_('Connect a LAN cable from this node to the master router'),
		_('Enable EasyMesh and set role to Agent, then Save & Apply'),
		_('This node broadcasts discovery packets to find the master'),
		_('Master shows this node in Nodes tab — approve it there'),
		_('Once approved, master pushes WiFi config automatically')
	];
	return E('div', {
		id: 'easymesh-role-guide',
		style: 'padding:14px 16px 10px;border-radius:8px;margin-bottom:2px;background:' + bg + ';border:1px solid ' + bc
	}, [
		E('div', { style: 'display:flex;align-items:center;gap:10px;margin-bottom:8px' }, [
			E('span', { style: 'padding:2px 10px;border-radius:12px;font-size:11px;font-weight:700;color:' + ac + ';border:1px solid ' + bc },
				isMaster ? ('🌐 ' + _('Master')) : ('📡 ' + _('Agent'))),
			E('span', { style: 'font-weight:700;font-size:14px' },
				isMaster ? _('Add New Node (Master Mode)') : _('Agent Mode — Joining Mesh'))
		]),
		E('ol', { style: 'padding-left:20px;font-size:13px;line-height:2.1;margin:0' },
			steps.map(function(s) { return E('li', {}, s); }))
	]);
}

return view.extend({
	load: function() {
		return Promise.all([
			uci.load('easymesh'),
			uci.load('wireless'),
			uci.load('network'),
			callGetWirelessDevices()
		]);
	},

	render: function(data) {
		var m, s, o;
		var initialRole   = uci.get('easymesh','global','role') || 'master';
		var bandMerge     = uci.get('easymesh','global','band_merge') !== '0'; // default merged

		m = new form.Map('easymesh', _('EasyMesh Configuration'), [
			E('p', { style: 'color:#8b949e;font-size:13px;margin:0 0 10px' },
				_('Multi-node mesh via batman-adv over wired Ethernet or 802.11s wireless backhaul.')),
			buildRoleGuide(initialRole !== 'agent')
		]);

		s = m.section(form.NamedSection, 'global', 'easymesh');
		s.addremove = false; s.anonymous = true;

		s.tab('basic',    _('Basic'));
		s.tab('backhaul', _('Mesh Backhaul'));
		s.tab('roaming',  _('Roaming'));
		s.tab('advanced', _('Advanced'));

		/* ── Basic ── */
		o = s.taboption('basic', form.Flag, 'enabled', _('Enable EasyMesh'));
		o.rmempty = false; o.default = '0';

		o = s.taboption('basic', form.ListValue, 'role', _('Node Role'),
			_('Master: gateway router with DHCP and uplink. Agent: extends coverage.'));
		o.value('master', _('Master (connected to modem/ISP)'));
		o.value('agent',  _('Agent (Slave, extends coverage)'));
		o.default = 'master';
		o.depends('enabled','1');

		o = s.taboption('basic', form.DummyValue, '_agent_info', ' ',
			_('Wi-Fi settings are automatically pushed by the master once approved. No manual Wi-Fi config needed on agents.'));
		o.rawhtml = true;
		o.depends({ enabled:'1', role:'agent' });

		/* ── WAN 口模式（仅 master）── */
		o = s.taboption('basic', form.ListValue, 'wan_mode', _('WAN Port Mode'),
			_('Router mode: WAN port connects to modem/ISP (PPPoE/DHCP). Switch mode: all ports become LAN (useful when uplink is through another router or when all ports are wired to mesh nodes).'));
		o.value('router', _('Router (PPPoE / DHCP — WAN port separate)'));
		o.value('switch', _('Switch (all ports as LAN — no separate WAN)'));
		o.default = 'router';
		o.depends({ enabled:'1', role:'master' });

		/* ── 双频合并 ── */
		o = s.taboption('basic', form.Flag, 'band_merge', _('Dual-band Merge (same SSID/password)'),
			_('Enabled: one SSID/password applied to both 2.4 GHz and 5 GHz radios. ' +
			  'Disabled: set different SSID and password for each band.'));
		o.default = '1';
		o.rmempty = false;
		o.depends({ enabled:'1', role:'master' });

		/* 合并模式：单组 SSID/Key */
		o = s.taboption('basic', form.Value, 'ssid', _('WiFi Name (SSID)'),
			_('Applied to both 2.4 GHz and 5 GHz radios. Pushed to all agent nodes.'));
		o.datatype = 'maxlength(32)';
		o.placeholder = 'HomeNetwork';
		o.depends({ enabled:'1', role:'master', band_merge:'1' });

		o = s.taboption('basic', form.Value, 'key', _('WiFi Password'),
			_('WPA2/WPA3. Min 8 chars. Leave empty for open network.'));
		o.datatype = 'minlength(8)';
		o.password = true;
		o.depends({ enabled:'1', role:'master', band_merge:'1' });

		/* 非合并模式：5G 单独 */
		o = s.taboption('basic', form.Value, 'ssid_5g', _('5 GHz WiFi Name (SSID)'));
		o.datatype = 'maxlength(32)';
		o.placeholder = 'HomeNetwork_5G';
		o.depends({ enabled:'1', role:'master', band_merge:'0' });

		o = s.taboption('basic', form.Value, 'key_5g', _('5 GHz WiFi Password'));
		o.datatype = 'minlength(8)';
		o.password = true;
		o.depends({ enabled:'1', role:'master', band_merge:'0' });

		/* 非合并模式：2.4G 单独 */
		o = s.taboption('basic', form.Value, 'ssid_2g', _('2.4 GHz WiFi Name (SSID)'));
		o.datatype = 'maxlength(32)';
		o.placeholder = 'HomeNetwork_2.4G';
		o.depends({ enabled:'1', role:'master', band_merge:'0' });

		o = s.taboption('basic', form.Value, 'key_2g', _('2.4 GHz WiFi Password'));
		o.datatype = 'minlength(8)';
		o.password = true;
		o.depends({ enabled:'1', role:'master', band_merge:'0' });

		o = s.taboption('basic', form.Flag, 'wireless_onboard', _('Wireless Node Onboarding'),
			_('Broadcast a temporary open SSID so new nodes can join without a cable.'));
		o.default = '0';
		o.depends({ enabled:'1', role:'master' });

		/* ── Mesh Backhaul ── */
		o = s.taboption('backhaul', form.ListValue, 'backhaul', _('Backhaul Type'),
			_('Wired: batman-adv over LAN cable (recommended). Wireless: dedicated 802.11s link.'));
		o.value('wired',    _('Wired (recommended)'));
		o.value('wireless', _('Wireless (802.11s)'));
		o.value('auto',     _('Auto (wired preferred)'));
		o.default = 'wired';
		o.depends({ enabled:'1', role:'master' });

		o = s.taboption('backhaul', form.Value, 'mesh_id', _('802.11s Mesh ID'),
			_('Internal mesh network name. Must be identical on all nodes.'));
		o.placeholder = 'OpenWrt-Mesh';
		o.depends({ enabled:'1', role:'master', backhaul:/^(wireless|auto)$/ });

		o = s.taboption('backhaul', form.Value, 'mesh_key', _('802.11s Mesh Password (SAE)'),
			_('Encryption key for wireless backhaul. Must match on all nodes.'));
		o.datatype = 'minlength(8)';
		o.password = true;
		o.placeholder = _('Min 8 characters');
		o.depends({ enabled:'1', role:'master', backhaul:/^(wireless|auto)$/ });

		o = s.taboption('backhaul', form.ListValue, 'mesh_band', _('802.11s Backhaul Band'));
		o.value('2g', _('2.4 GHz (better range, slower)'));
		o.value('5g', _('5 GHz (faster, recommended)'));
		o.default = '5g';
		o.depends({ enabled:'1', role:'master', backhaul:/^(wireless|auto)$/ });

		/* ── Roaming ── */
		o = s.taboption('roaming', form.Flag, 'ieee80211r', _('802.11r Fast BSS Transition'),
			_('Reduces disconnect time when roaming between nodes. Recommended.'));
		o.default = '1';
		o.depends({ enabled:'1', role:'master' });

		o = s.taboption('roaming', form.Value, 'mobility_domain', _('Mobility Domain ID'),
			_('4-digit hex. Must be identical on all nodes.'));
		o.datatype = 'and(hexstring,rangelength(4,4))';
		o.placeholder = 'aabb';
		o.depends({ enabled:'1', role:'master', ieee80211r:'1' });

		o = s.taboption('roaming', form.Flag, 'ieee80211k', _('802.11k Neighbor Report'),
			_('Tells devices about nearby nodes for proactive roaming.'));
		o.default = '1';
		o.depends({ enabled:'1', role:'master' });

		o = s.taboption('roaming', form.Flag, 'ieee80211v', _('802.11v BSS Transition Mgmt'),
			_('Actively steers weak-signal devices to a better node.'));
		o.default = '1';
		o.depends({ enabled:'1', role:'master' });

		o = s.taboption('roaming', form.Flag, 'ft_over_ds', _('FT over DS'));
		o.default = '1';
		o.depends({ enabled:'1', role:'master', ieee80211r:'1' });

		o = s.taboption('roaming', form.Value, 'reassociation_deadline', _('Reassociation Deadline (ms)'));
		o.datatype = 'range(1000,65535)';
		o.placeholder = '1000';
		o.depends({ enabled:'1', role:'master', ieee80211r:'1' });

		/* ── Advanced ── */
		o = s.taboption('advanced', form.Flag, 'dfs_enable', _('Enable DFS Channels'));
		o.default = '1';
		o.depends({ enabled:'1', role:'master' });

		o = s.taboption('advanced', form.ListValue, 'routing_algo', _('batman-adv Routing Algorithm'));
		o.value('BATMAN_IV', 'BATMAN IV (' + _('default, best compatibility') + ')');
		o.value('BATMAN_V',  'BATMAN V ('  + _('more accurate, needs kernel support') + ')');
		o.default = 'BATMAN_V';
		o.depends({ enabled:'1', role:'master' });

		o = s.taboption('advanced', form.Flag, 'mesh_fwding', _('802.11s Native Forwarding'),
			_('Enable 802.11s path selection alongside batman-adv. Normally off.'));
		o.default = '0';
		o.depends({ enabled:'1', role:'master', backhaul:/^(wireless|auto)$/ });

		o = s.taboption('advanced', form.Flag, 'dedicated_backhaul', _('Dedicated Backhaul Radio (Tri-band)'),
			_('Reserve second 5 GHz radio exclusively for backhaul.'));
		o.default = '0';
		o.depends({ enabled:'1', role:'master' });

		o = s.taboption('advanced', form.ListValue, 'backhaul_band', _('Backhaul Radio Band'));
		o.value('5g_2', _('Second 5 GHz radio (recommended)'));
		o.value('5g_1', _('First 5 GHz radio'));
		o.default = '5g_2';
		o.depends({ enabled:'1', role:'master', dedicated_backhaul:'1' });

		o = s.taboption('advanced', form.Value, 'backhaul_channel', _('Backhaul Channel'),
			_('Fixed channel for dedicated backhaul. 149/153/157/161 recommended.'));
		o.placeholder = '149';
		o.datatype = 'range(1,177)';
		o.depends({ enabled:'1', role:'master', dedicated_backhaul:'1' });

		/* ── 渲染后：绑 role 下拉框 change 事件实时刷新引导块 ── */
		return m.render().then(function(node) {
			var roleSelect = node.querySelector('select[id*="cbid.easymesh.global.role"]') ||
			                 node.querySelector('select[data-name="role"]');
			if (roleSelect) {
				roleSelect.addEventListener('change', function() {
					var g = document.getElementById('easymesh-role-guide');
					if (g) g.parentNode.replaceChild(buildRoleGuide(roleSelect.value !== 'agent'), g);
				});
			}
			return node;
		});
	}
});
