'use strict';
'require view';
'require rpc';
'require poll';
'require ui';

var MASTER_PORT = 4304;

var callReadFile = rpc.declare({
	object: 'file',
	method: 'read',
	params: ['path'],
	expect: { data: '' }
});

var callNetworkDump = rpc.declare({
	object: 'network.interface',
	method: 'dump',
	expect: { interface: [] }
});

function masterFetch(path, method, body) {
	return fetch('http://' + window.location.hostname + ':' + MASTER_PORT + path, {
		method:  method || 'GET',
		headers: body ? { 'Content-Type': 'application/json' } : {},
		body:    body ? JSON.stringify(body) : undefined,
		signal:  AbortSignal.timeout(5000)
	}).then(function(r) { return r.json(); }).catch(function() { return null; });
}

function parseOriginators(raw) {
	var nodes = [];
	if (!raw) return nodes;
	raw.trim().split('\n').slice(2).forEach(function(line) {
		var p = line.trim().split(/\s+/);
		if (p.length >= 5)
			nodes.push({ mac: p[0], lastSeen: p[1], tq: parseInt(p[2]) || 0, nextHop: p[3], iface: p[4] });
	});
	return nodes;
}

function tqBar(tq) {
	var pct   = Math.round(tq / 255 * 100);
	var color = pct >= 70 ? '#2ea44f' : pct >= 40 ? '#e3b341' : '#f85149';
	return E('div', { style: 'display:flex;align-items:center;gap:6px' }, [
		E('div', { style: 'width:60px;height:5px;background:#30363d;border-radius:3px;overflow:hidden' }, [
			E('div', { style: 'width:' + pct + '%;height:100%;background:' + color })
		]),
		E('span', { style: 'font-size:11px;color:#7d8590' }, pct + '%')
	]);
}

function pendingCard(node, onApprove, onReject) {
	var info = node.node || {};
	return E('div', {
		style: 'border:1px solid #e3b341;border-radius:8px;padding:16px;' +
		       'background:rgba(210,153,34,0.06);display:flex;' +
		       'align-items:center;gap:12px;margin-bottom:10px'
	}, [
		E('div', { style: 'font-size:22px' }, '📡'),
		E('div', { style: 'flex:1' }, [
			E('strong', {}, info.hostname || _('Unknown device')),
			E('div', { style: 'font-size:12px;color:#7d8590;font-family:monospace;margin-top:2px' },
				(info.ip || '—') + ' · ' + (info.mac || '—'))
		]),
		E('button', {
			class: 'cbi-button cbi-button-action',
			style: 'background:#2ea44f;color:#fff;border:none;' +
			       'padding:8px 18px;border-radius:6px;cursor:pointer',
			click: onApprove
		}, '✓ ' + _('Join Mesh')),
		E('button', {
			class: 'cbi-button',
			style: 'color:#f85149;border:1px solid #f85149;background:transparent;' +
			       'padding:8px 14px;border-radius:6px;cursor:pointer;margin-left:6px',
			click: onReject
		}, '✕ ' + _('Reject'))
	]);
}

return view.extend({

	load: function() {
		return Promise.all([
			L.resolveDefault(
				callReadFile({ path: '/sys/kernel/debug/batman_adv/bat0/originators' }), ''),
			callNetworkDump(),
			masterFetch('/easymesh/nodes')
		]);
	},

	render: function(data) {
		var self = this;
		var root = E('div', { id: 'easymesh-nodes-root' });
		root.appendChild(self._build(data[0], data[1] || [], data[2]));

		poll.add(function() {
			return Promise.all([
				L.resolveDefault(
					callReadFile({ path: '/sys/kernel/debug/batman_adv/bat0/originators' }), ''),
				callNetworkDump(),
				masterFetch('/easymesh/nodes')
			]).then(function(r) {
				var old = document.getElementById('easymesh-nodes-inner');
				if (old) old.replaceWith(self._build(r[0], r[1] || [], r[2]));
			});
		}, 5);

		return root;
	},

	_build: function(originatorRaw, interfaces, pendingRaw) {
		var el        = E('div', { id: 'easymesh-nodes-inner' });
		var bat0      = interfaces.filter(function(i) { return i.interface === 'bat0'; })[0];
		var meshNodes = parseOriginators(originatorRaw);
		var pending   = Array.isArray(pendingRaw)
			? pendingRaw.filter(function(n) { return n.status === 'pending'; }) : [];

		/* Pending pairing requests */
		if (pending.length) {
			el.appendChild(E('div', { class: 'cbi-section' }, [
				E('h3', { style: 'color:#e3b341' },
					'⚡ ' + pending.length + ' ' + _('device(s) requesting to join Mesh')),
				E('p', { class: 'cbi-section-descr' },
					_('Approve to push config automatically. No action needed on the slave.')),
				E('div', {}, pending.map(function(node) {
					return pendingCard(node,
						function() {
							masterFetch('/easymesh/approve', 'POST', { token: node.token })
								.then(function() {
									ui.addNotification(null,
										E('p', {}, _('Approved. Pushing config to slave...')), 'info');
								});
						},
						function() {
							masterFetch('/easymesh/reject', 'POST', { token: node.token });
						}
					);
				}))
			]));
		}

		/* Status card */
		el.appendChild(E('div', { class: 'cbi-section' }, [
			E('h3', {}, _('Mesh Status')),
			E('div', { class: 'table' }, [
				E('div', { class: 'tr' }, [
					E('div', { class: 'td left', style: 'width:160px' }, 'bat0'),
					E('div', { class: 'td' }, bat0
						? E('span', {
							class: 'label',
							style: 'background:#2ea44f;color:#fff;padding:2px 8px;border-radius:4px'
						  }, _('Running'))
						: E('span', {
							class: 'label',
							style: 'background:#f85149;color:#fff;padding:2px 8px;border-radius:4px'
						  }, _('Not running'))
					)
				]),
				E('div', { class: 'tr' }, [
					E('div', { class: 'td left' }, _('Neighbor nodes')),
					E('div', { class: 'td' }, meshNodes.length + ' ' + _('found'))
				])
			])
		]));

		/* Neighbor table */
		el.appendChild(E('div', { class: 'cbi-section' }, [
			E('h3', {}, _('Mesh Neighbors')),
			E('p', { class: 'cbi-section-descr' },
				_('TQ link quality: 255 = best. Refreshes every 5 seconds.')),
			meshNodes.length === 0
				? E('div', { class: 'alert-message' },
					_('No neighbors found. Verify all nodes share the same Mesh ID and password.'))
				: E('table', { class: 'table' }, [
					E('tr', { class: 'tr table-titles' }, [
						E('th', { class: 'th' }, 'MAC'),
						E('th', { class: 'th' }, _('Link Quality (TQ)')),
						E('th', { class: 'th' }, _('Next Hop')),
						E('th', { class: 'th' }, _('Interface')),
						E('th', { class: 'th' }, _('Last Seen'))
					])
				].concat(meshNodes.map(function(n) {
					return E('tr', { class: 'tr' }, [
						E('td', { class: 'td', style: 'font-family:monospace' }, n.mac),
						E('td', { class: 'td' }, tqBar(n.tq)),
						E('td', { class: 'td', style: 'font-family:monospace;color:#7d8590' }, n.nextHop),
						E('td', { class: 'td' }, n.iface),
						E('td', { class: 'td' }, n.lastSeen + 's')
					]);
				})))
		]));

		/* Topology JSON card */
		el.appendChild(E('div', { class: 'cbi-section' }, [
			E('h3', {}, _('Mesh Topology')),
			E('p', { class: 'cbi-section-descr' }, _('Live topology from batman-adv. Refreshes every 5 seconds.')),
			E('div', { id: 'easymesh-topo' }, [
				E('pre', {
					id: 'easymesh-topo-json',
					style: 'background:#0d1117;border:1px solid #30363d;border-radius:8px;' +
					       'padding:12px;font-size:11px;color:#e6edf3;overflow-x:auto;' +
					       'white-space:pre-wrap;max-height:300px;overflow-y:auto',
				}, _('Loading topology...'))
			])
		]));

		/* Fetch topology JSON and render it */
		masterFetch('/easymesh/topology').then(function(topo) {
			var el2 = document.getElementById('easymesh-topo-json');
			if (!el2) return;
			if (!topo || topo.error) {
				el2.textContent = _('Topology unavailable — master node not reachable.');
				return;
			}
			el2.textContent = JSON.stringify(topo, null, 2);
		});

		return el;
	},

	handleSaveApply: null,
	handleSave:      null,
	handleReset:     null
});
