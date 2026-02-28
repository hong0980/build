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

		/* ── QR pairing banner ── */
		var qrSection = E('div', {
			style: 'background:#161b22;border:1px solid #30363d;border-radius:12px;' +
			       'padding:20px 24px;margin-bottom:20px'
		}, [
			E('div', {
				style: 'display:flex;align-items:center;justify-content:space-between;margin-bottom:16px'
			}, [
				E('div', {}, [
					E('div', { style: 'font-weight:700;font-size:15px;margin-bottom:4px' },
						'📱 ' + _('Add New Node')),
					E('div', { style: 'font-size:12px;color:#7d8590' },
						_('Generate pairing code → slave scans → mesh configured automatically'))
				]),
				E('button', {
					id:    'btn-gen-qr',
					class: 'cbi-button cbi-button-action',
					style: 'white-space:nowrap;padding:8px 16px',
					click: L.bind(self.handleGenerateQR, self)
				}, _('Generate Pairing Code'))
			]),
			E('div', { id: 'qr-area', style: 'display:none' }, [
				E('div', { style: 'display:flex;gap:20px;align-items:flex-start;flex-wrap:wrap' }, [
					E('div', {
						id:    'qr-canvas-wrap',
						style: 'background:#fff;border-radius:8px;padding:10px;flex-shrink:0'
					}),
					E('div', { style: 'flex:1;min-width:200px' }, [
						E('ol', {
							style: 'padding-left:18px;font-size:13px;line-height:2.2;color:#e6edf3'
						}, [
							E('li', {}, _('Power on the new node')),
							E('li', {}, _('Connect phone to "EasyMesh-Setup" WiFi (no password)')),
							E('li', {}, [
								_('Open '),
								E('code', {
									style: 'background:#0d1117;padding:1px 6px;border-radius:4px'
								}, '192.168.2.1'),
								_(' in browser')
							]),
							E('li', {}, _('Scan this QR code')),
							E('li', {}, _('Wait ~10 seconds — done automatically ✓'))
						]),
						E('div', {
							id:    'qr-expire',
							style: 'margin-top:8px;font-size:12px;color:#e3b341'
						})
					])
				])
			])
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
		o.default = 'wireless';
		o.depends('enabled', '1');

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

	/* Load qrcode.min.js once, returns a Promise.
	   Installed by Makefile to /www/luci-static/resources/view/easymesh/qrcode.min.js
	   Served by uhttpd at /luci-static/resources/view/easymesh/qrcode.min.js */
	loadQRLib: function() {
		if (window.QRCode) return Promise.resolve();
		return new Promise(function(resolve, reject) {
			var s = document.createElement('script');
			s.src = '/easymesh-pair/qrcode.min.js';
			s.onload  = function() {
				if (window.QRCode) resolve();
				else reject(new Error(_('Failed to load qrcode.min.js')));
			};
			s.onerror = function() { reject(new Error(_('Failed to load qrcode.min.js'))); };
			document.head.appendChild(s);
		});
	},

	/* Called by the Generate Pairing Code button via L.bind */
	handleGenerateQR: function(ev) {
		var self     = this;
		var btn      = ev.currentTarget;
		var wrap     = document.getElementById('qr-canvas-wrap');
		var expireEl = document.getElementById('qr-expire');

		btn.disabled    = true;
		btn.textContent = _('Generating...');

		/* Load library and fetch token in parallel */
		Promise.all([
			self.loadQRLib(),
			fetch('http://' + window.location.hostname + ':' + MASTER_PORT + '/easymesh/generate-qr', {
				signal: AbortSignal.timeout(5000)
			}).then(function(r) { return r.json(); })
		])
		.then(function(results) {
			var data = results[1];
			if (!data.token)
				throw new Error(_('Master node returned no token. Save and apply EasyMesh config first.'));

			var qrPayload = JSON.stringify({
				ip:     data.ip,
				token:  data.token,
				expire: data.expire
			});

			wrap.innerHTML = '';
			new QRCode(wrap, {
				text:         qrPayload,
				width:        160,
				height:       160,
				correctLevel: QRCode.CorrectLevel.M
			});

			document.getElementById('qr-area').style.display = 'block';
			btn.textContent = _('Regenerate');
			btn.disabled    = false;

			if (qrTimer) clearInterval(qrTimer);
			var expire = data.expire;
			qrTimer = setInterval(function() {
				var left = Math.max(0, expire - Math.floor(Date.now() / 1000));
				var mm   = Math.floor(left / 60);
				var ss   = left % 60;
				expireEl.textContent = left > 0
					? _('Code valid for: ') + mm + ':' + (ss < 10 ? '0' : '') + ss
					: _('Code expired — click Regenerate');
				if (left === 0) {
					clearInterval(qrTimer);
					qrTimer = null;
					wrap.innerHTML =
						'<div style="color:#f85149;padding:20px;font-size:12px;text-align:center">' +
						_('Expired') + '</div>';
				}
			}, 1000);
		})
		.catch(function(e) {
			btn.disabled    = false;
			btn.textContent = _('Generate Pairing Code');
			ui.addNotification(null,
				E('p', {}, _('Failed to generate QR code: ') + e.message), 'error');
		});
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
