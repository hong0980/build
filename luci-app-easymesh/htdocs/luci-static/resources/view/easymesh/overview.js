'use strict';
'require view';
'require form';
'require uci';
'require ui';
'require rpc';

var MASTER_PORT = 4304;
var qrTimer     = null;   /* module-level variable, not a view property */

var callGetWirelessDevices = rpc.declare({
	object: 'network.wireless',
	method: 'status',
	expect: { '': {} }
});

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
		var self = this;
		var m, s, o;

		/* ── Wired onboarding banner ── */
		var qrSection = E('div', {
			style: 'background:#161b22;border:1px solid #30363d;border-radius:12px;' +
			       'padding:20px 24px;margin-bottom:20px'
		}, [
			E('div', { style: 'font-weight:700;font-size:15px;margin-bottom:12px' },
				'🔌 ' + _('Add New Node')),
			E('ol', {
				style: 'padding-left:20px;font-size:13px;line-height:2.4;color:#e6edf3;margin:0'
			}, [
				E('li', {}, _('Flash OpenWrt on the new node')),
				E('li', {}, _('Power it on and connect a LAN cable from this router to the new node')),
				E('li', {}, _('Wait ~30 seconds — the new node auto-discovers this master, pulls config and joins the mesh')),
				E('li', {}, _('Check the Nodes tab to confirm it appears'))
			]),
			E('div', {
				style: 'margin-top:14px;padding:10px 14px;background:#0d1117;' +
				       'border-radius:8px;font-size:12px;color:#7d8590'
			}, _('No app, QR code or manual configuration needed. Wired backhaul provides the most stable mesh connection.'))
		]);

		/* ── Form ── */
		m = new form.Map('easymesh',
			_('EasyMesh Configuration'),
			_('Wireless mesh network based on batman-adv + 802.11s.'));

		/* qrSection is plain DOM — insert before the form renders */
		m.on('render', function(node) {
			node.insertBefore(qrSection, node.firstChild);
		});

		/* Section 1: Basic */
		s = m.section(form.NamedSection, 'global', 'easymesh', _('Basic Settings'));
		s.addremove = false;
		s.anonymous = true;

		o = s.option(form.Flag, 'enabled', _('Enable EasyMesh'));
		o.rmempty = false;
		o.default = '0';

		o = s.option(form.ListValue, 'role', _('Node Role'),
			_('Master handles DHCP and uplink. Slave extends coverage only.'));
		o.value('master', _('Master (connected to modem/ISP)'));
		o.value('slave',  _('Slave (extends coverage)'));
		o.default = 'master';
		o.depends('enabled', '1');

		o = s.option(form.ListValue, 'backhaul', _('Backhaul Type'),
			_('Wired is more stable. Wireless uses a dedicated 5 GHz band.'));
		o.value('wired',    _('Wired (recommended)'));
		o.value('wireless', _('Wireless (5 GHz)'));
		o.value('auto',     _('Auto (wired preferred)'));
		o.default = 'wired';
		o.depends('enabled', '1');

		/* ── Wireless onboarding switch ── */
		o = s.option(form.Flag, 'wireless_onboard',
			_('Wireless Node Onboarding'),
			_('Broadcast a temporary open SSID so new nodes can join without a cable. Still requires approval in the Nodes tab.'));
		o.default = '0';
		o.depends({ enabled: '1', role: 'master' });

		o = s.option(form.Value, 'wireless_onboard_ssid',
			_('Onboarding SSID'),
			_('Leave empty to auto-generate from MAC address (e.g. EasyMesh-Setup-A1B2C3)'));
		o.placeholder = _('Auto (EasyMesh-Setup-XXXXXX)');
		o.depends({ enabled: '1', role: 'master', wireless_onboard: '1' });

		/* ── DFS / ACS ── */
		s.tab('advanced', _('Advanced / Radio'));

		o = s.option(form.Flag, 'dfs_enable',
			_('Enable DFS Channels'),
			_('Include radar-protected 5 GHz DFS channels (52–140) in ACS scan. ' +
			  'Daemon monitors for radar events and mesh-wide channel jump automatically.'));
		o.default = '1';
		o.depends('enabled', '1');

		/* ── Dedicated backhaul (tri-band) ── */
		o = s.option(form.Flag, 'dedicated_backhaul',
			_('Dedicated Backhaul Radio (Tri-band)'),
			_('Reserve the second 5 GHz radio exclusively for node-to-node backhaul. ' +
			  'Clients never connect to it, preserving full backhaul bandwidth. ' +
			  'Only effective on tri-band hardware (2.4 GHz + 5 GHz + 5 GHz).'));
		o.default = '0';
		o.depends('enabled', '1');

		o = s.option(form.ListValue, 'backhaul_band',
			_('Backhaul Radio Band'),
			_('Which 5 GHz radio to dedicate as backhaul (first or second).'));
		o.value('5g_2', _('Second 5 GHz radio (recommended)'));
		o.value('5g_1', _('First 5 GHz radio'));
		o.default = '5g_2';
		o.depends({ enabled: '1', dedicated_backhaul: '1' });

		o = s.option(form.Value, 'backhaul_channel',
			_('Backhaul Channel'),
			_('Fixed channel for dedicated backhaul radio. 149/153/157/161 recommended (non-DFS, 80 MHz clean).'));
		o.placeholder = '149';
		o.datatype = 'range(1,177)';
		o.depends({ enabled: '1', dedicated_backhaul: '1' });

		/* Section 2: Mesh backhaul */
		s = m.section(form.NamedSection, 'global', 'easymesh',
			_('Mesh Backhaul'),
			_('Internal wireless link between nodes, invisible to clients.'));
		s.addremove = false;
		s.anonymous = true;
		s.tab('mesh_basic',    _('Mesh Settings'));
		s.tab('mesh_advanced', _('Advanced'));

		o = s.taboption('mesh_basic', form.Value, 'mesh_id',
			_('Mesh Network ID'), _('Must be identical on all nodes'));
		o.placeholder = 'OpenWrt-Mesh';
		o.depends('enabled', '1');

		o = s.taboption('mesh_basic', form.Value, 'mesh_key',
			_('Mesh Password (SAE)'),
			_('Must be identical on all nodes. Leave empty to disable encryption (not recommended).'));
		o.datatype    = 'minlength(8)';
		o.password    = true;
		o.placeholder = _('Minimum 8 characters');
		o.depends('enabled', '1');

		o = s.taboption('mesh_basic', form.ListValue, 'mesh_band',
			_('Mesh Backhaul Band'));
		o.value('2g', _('2.4 GHz (better range, slower)'));
		o.value('5g', _('5 GHz (faster, recommended)'));
		o.default = '5g';
		o.depends([
			{ enabled: '1', backhaul: 'wireless' },
			{ enabled: '1', backhaul: 'auto' }
		]);

		o = s.taboption('mesh_advanced', form.ListValue, 'routing_algo',
			_('batman-adv Routing Algorithm'));
		o.value('BATMAN_IV', 'BATMAN IV ' + _('(default, best compatibility)'));
		o.value('BATMAN_V',  'BATMAN V '  + _('(more accurate, requires kernel support)'));
		o.default = 'BATMAN_IV';
		o.depends('enabled', '1');

		o = s.taboption('mesh_advanced', form.Flag, 'mesh_fwding',
			_('802.11s Native Forwarding'),
			_('Normally disabled — batman-adv handles forwarding.'));
		o.default = '0';
		o.depends('enabled', '1');

		/* Section 3: Client WiFi */
		s = m.section(form.NamedSection, 'global', 'easymesh',
			_('Client WiFi (AP)'),
			_('SSID visible to phones and laptops. Must be identical on all nodes for seamless roaming.'));
		s.addremove = false;
		s.anonymous = true;

		o = s.option(form.Value, 'ssid',
			_('WiFi Name (SSID)'), _('Must be identical on all nodes'));
		o.datatype    = 'maxlength(32)';
		o.placeholder = 'OpenWrt';
		o.depends('enabled', '1');

		o = s.option(form.Value, 'key',
			_('WiFi Password'),
			_('WPA2/WPA3. Leave empty for open network.'));
		o.datatype = 'minlength(8)';
		o.password = true;
		o.depends('enabled', '1');

		/* Section 4: Roaming */
		s = m.section(form.NamedSection, 'global', 'easymesh',
			_('Roaming (802.11r/k/v)'),
			_('Helps devices switch nodes quickly. Requires open-source mac80211 driver support.'));
		s.addremove = false;
		s.anonymous = true;
		s.tab('roam_basic',    _('Fast Roaming'));
		s.tab('roam_advanced', _('Advanced'));

		o = s.taboption('roam_basic', form.Flag, 'ieee80211r',
			_('802.11r Fast BSS Transition'),
			_('Greatly reduces disconnect time when switching nodes. Recommended.'));
		o.default = '1';
		o.depends('enabled', '1');

		o = s.taboption('roam_basic', form.Value, 'mobility_domain',
			_('Mobility Domain ID'),
			_('4-digit hex string. Must be identical on all nodes.'));
		o.datatype    = 'and(hexstring,rangelength(4,4))';
		o.placeholder = 'aabb';
		o.depends({ enabled: '1', ieee80211r: '1' });

		o = s.taboption('roam_basic', form.Flag, 'ieee80211k',
			_('802.11k Neighbor Report'),
			_('Informs devices about nearby nodes to assist proactive roaming.'));
		o.default = '1';
		o.depends('enabled', '1');

		o = s.taboption('roam_basic', form.Flag, 'ieee80211v',
			_('802.11v BSS Transition Management'),
			_('Actively steers weak-signal devices to a better node.'));
		o.default = '1';
		o.depends('enabled', '1');

		o = s.taboption('roam_advanced', form.Flag, 'ft_over_ds',
			_('FT over DS'),
			_('Pre-negotiate keys over wired backbone for faster transition. Disable if issues occur.'));
		o.default = '1';
		o.depends({ enabled: '1', ieee80211r: '1' });

		o = s.taboption('roam_advanced', form.Value, 'reassociation_deadline',
			_('Reassociation Deadline (ms)'));
		o.datatype    = 'range(1000,65535)';
		o.placeholder = '1000';
		o.depends({ enabled: '1', ieee80211r: '1' });

		return m.render();
	},



	handleSave: function(ev) {
		return this.map.save(null, true);
	},

	handleSaveApply: function(ev) {
		return this.handleSave(ev).then(function() {
			return ui.changes.apply(true);
		});
	},

	handleReset: function(ev) {
		return uci.revertAll().then(L.bind(this.render, this));
	}
});
