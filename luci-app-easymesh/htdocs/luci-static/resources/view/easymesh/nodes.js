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

function sourceIcon(src) {
	return src === 'wireless' ? '📶 ' + _('Wireless') : '🔌 ' + _('Wired');
}

function pendingCard(node, onApprove, onReject) {
	return E('div', {
		style: 'border:1px solid #e3b341;border-radius:10px;padding:16px;' +
		       'background:rgba(210,153,34,.07);display:flex;align-items:center;' +
		       'gap:14px;margin-bottom:10px;flex-wrap:wrap'
	}, [
		E('div', { style: 'font-size:28px;flex-shrink:0' },
			node.source === 'wireless' ? '📶' : '🔌'),
		E('div', { style: 'flex:1;min-width:160px' }, [
			E('div', { style: 'font-weight:600;font-size:14px' },
				node.hostname || _('Unknown device')),
			E('div', { style: 'font-size:12px;color:#7d8590;font-family:monospace;margin-top:2px' },
				(node.ip || '—') + ' · ' + (node.mac || '—')),
			E('div', { style: 'font-size:11px;color:#7d8590;margin-top:2px' },
				_('via ') + sourceIcon(node.source))
		]),
		E('button', {
			class: 'cbi-button',
			style: 'background:#2ea44f;color:#fff;border:none;padding:8px 18px;' +
			       'border-radius:6px;cursor:pointer;font-size:13px',
			click: onApprove
		}, '✓ ' + _('Allow to join')),
		E('button', {
			class: 'cbi-button',
			style: 'background:transparent;color:#f85149;border:1px solid #f85149;' +
			       'padding:8px 14px;border-radius:6px;cursor:pointer;font-size:13px;margin-left:6px',
			click: onReject
		}, '✕ ' + _('Reject'))
	]);
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
			masterFetch('/nodes/pending'),
			masterFetch('/nodes/approved')
		]);
	},

	render: function(data) {
		var self = this;
		var root = E('div', { id: 'easymesh-nodes-root' });
		root.appendChild(self._build(data[0], data[1] || [], data[2], data[3]));

		poll.add(function() {
			return Promise.all([
				L.resolveDefault(
					callReadFile({ path: '/sys/kernel/debug/batman_adv/bat0/originators' }), ''),
				callNetworkDump(),
				masterFetch('/nodes/pending'),
				masterFetch('/nodes/approved')
			]).then(function(r) {
				var old = document.getElementById('easymesh-nodes-inner');
				if (old) old.replaceWith(self._build(r[0], r[1] || [], r[2], r[3]));
			});
		}, 5);

		return root;
	},

	_build: function(originatorRaw, interfaces, pendingRaw, approvedRaw) {
		var el        = E('div', { id: 'easymesh-nodes-inner' });
		var bat0      = interfaces.filter(function(i) { return i.interface === 'bat0'; })[0];
		var meshNodes = parseOriginators(originatorRaw);
		var pending   = Array.isArray(pendingRaw)  ? pendingRaw  : [];
		var approved  = Array.isArray(approvedRaw) ? approvedRaw : [];

		/* ── Pending approval cards ── */
		if (pending.length) {
			el.appendChild(E('div', { class: 'cbi-section' }, [
				E('h3', { style: 'color:#e3b341;margin-bottom:4px' },
					'⚡ ' + pending.length + ' ' + _('device(s) requesting to join Mesh')),
				E('p', { class: 'cbi-section-descr', style: 'margin-bottom:14px' },
					_('Review and approve each device before it receives mesh configuration.')),
				E('div', {}, pending.map(function(node) {
					return pendingCard(node,
						function() {
							masterFetch('/nodes/approve', 'POST', { mac: node.mac })
								.then(function() {
									ui.addNotification(null,
										E('p', {}, _('Approved. Node will receive config shortly.')), 'info');
								});
						},
						function() {
							masterFetch('/nodes/reject', 'POST', { mac: node.mac });
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

		/* ── Topology Canvas ── */
		el.appendChild(E('div', { class: 'cbi-section' }, [
			E('h3', {}, '🌐 ' + _('Mesh Topology')),
			E('p', { class: 'cbi-section-descr' },
				_('Live topology. Link color = signal quality: green ≥70%, yellow ≥40%, red <40%.')),
			E('div', {
				style: 'background:#0d1117;border:1px solid #30363d;border-radius:12px;' +
				       'padding:8px;overflow:hidden;position:relative'
			}, [
				E('canvas', {
					id: 'easymesh-topo-canvas',
					style: 'width:100%;display:block;border-radius:8px',
					width: '900',
					height: '400'
				}),
				E('div', {
					id: 'easymesh-topo-tooltip',
					style: 'display:none;position:absolute;background:rgba(22,27,34,.95);' +
					       'border:1px solid #30363d;border-radius:8px;padding:10px 14px;' +
					       'font-size:12px;color:#e6edf3;pointer-events:none;' +
					       'font-family:monospace;line-height:1.7;max-width:220px'
				})
			]),
			/* Legend */
			E('div', {
				style: 'display:flex;gap:20px;padding:10px 12px 4px;flex-wrap:wrap'
			}, [
				['#2ea44f', '≥ 70% (Good)'],
				['#e3b341', '40–69% (Fair)'],
				['#f85149', '< 40% (Weak)']
			].map(function(item) {
				return E('div', { style: 'display:flex;align-items:center;gap:6px;font-size:11px;color:#7d8590' }, [
					E('div', { style: 'width:24px;height:3px;background:' + item[0] + ';border-radius:2px' }),
					item[1]
				]);
			}))
		]));

		/* ── Topology renderer ── */
		(function() {
			function tqColor(tq) {
				var p = tq / 255;
				if (p >= 0.70) return '#2ea44f';
				if (p >= 0.40) return '#e3b341';
				return '#f85149';
			}
			function tqAlpha(tq) { return 0.35 + 0.65 * (tq / 255); }
			function tqWidth(tq) { return 1.5 + 4 * (tq / 255); }

			// Layout: spread nodes in an arc/circle with master at centre
			function layoutNodes(nodes, W, H) {
				var master = null;
				var others = [];
				nodes.forEach(function(n) {
					if (n.role === 'master') master = n;
					else others.push(n);
				});
				var positions = {};
				var cx = W / 2, cy = H / 2;
				var r  = Math.min(W, H) * 0.33;
				// Master at centre
				if (master) positions[master.mac] = { x: cx, y: cy, node: master };
				// Others in a circle
				others.forEach(function(n, i) {
					var angle = (2 * Math.PI * i / Math.max(others.length, 1)) - Math.PI / 2;
					positions[n.mac] = {
						x: cx + r * Math.cos(angle),
						y: cy + r * Math.sin(angle),
						node: n
					};
				});
				// Fallback: any node without a mac
				nodes.forEach(function(n, i) {
					if (!positions[n.mac]) {
						var angle = (2 * Math.PI * i / nodes.length) - Math.PI / 2;
						positions[n.mac] = { x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle), node: n };
					}
				});
				return positions;
			}

			function drawTopo(topo, prevPositions) {
				var canvas = document.getElementById('easymesh-topo-canvas');
				if (!canvas) return;
				var ctx = canvas.getContext('2d');
				var W = canvas.width, H = canvas.height;
				var DPR = window.devicePixelRatio || 1;
				// HiDPI
				var cssW = canvas.offsetWidth || W;
				var cssH = H * (cssW / W);
				if (canvas.width !== cssW * DPR) {
					canvas.width  = cssW * DPR;
					canvas.height = cssH * DPR;
					ctx.scale(DPR, DPR);
					W = cssW; H = cssH;
				} else { W = cssW; H = cssH; }

				var nodes = (topo && topo.nodes) ? topo.nodes : [];
				var links = (topo && topo.links) ? topo.links : [];

				var positions = layoutNodes(nodes, W, H);

				// Clear with dark bg
				ctx.fillStyle = '#0d1117';
				ctx.fillRect(0, 0, W, H);

				// Draw grid dots for atmosphere
				ctx.fillStyle = 'rgba(48,54,61,0.4)';
				for (var gx = 20; gx < W; gx += 30)
					for (var gy = 20; gy < H; gy += 30)
						{ ctx.beginPath(); ctx.arc(gx, gy, 1, 0, Math.PI*2); ctx.fill(); }

				// Draw links
				links.forEach(function(link) {
					var a = positions[link.src], b = positions[link.dst];
					if (!a || !b) return;
					var tq  = link.tq || 0;
					var col = tqColor(tq);
					var pct = Math.round(tq / 255 * 100);

					// Glow effect
					ctx.save();
					ctx.shadowBlur  = 8;
					ctx.shadowColor = col;
					ctx.strokeStyle = col.replace(')', ',' + tqAlpha(tq) + ')').replace('rgb(','rgba(').replace('#', '');

					// Parse hex color for rgba
					var r = parseInt(col.slice(1,3),16),
					    g = parseInt(col.slice(3,5),16),
					    bv= parseInt(col.slice(5,7),16);
					ctx.strokeStyle = 'rgba(' + r + ',' + g + ',' + bv + ',' + tqAlpha(tq) + ')';
					ctx.lineWidth   = tqWidth(tq);
					ctx.lineCap     = 'round';
					ctx.beginPath();
					ctx.moveTo(a.x, a.y);
					// Slight curve using midpoint offset
					var mx = (a.x + b.x) / 2 + (b.y - a.y) * 0.08;
					var my = (a.y + b.y) / 2 - (b.x - a.x) * 0.08;
					ctx.quadraticCurveTo(mx, my, b.x, b.y);
					ctx.stroke();
					ctx.restore();

					// TQ percentage label on link
					ctx.save();
					ctx.font         = 'bold 10px monospace';
					ctx.fillStyle    = col;
					ctx.textAlign    = 'center';
					ctx.textBaseline = 'middle';
					ctx.shadowBlur   = 4;
					ctx.shadowColor  = '#0d1117';
					ctx.fillText(pct + '%', mx, my);
					ctx.restore();
				});

				// Draw nodes
				nodes.forEach(function(node) {
					var pos = positions[node.mac];
					if (!pos) return;
					var isMaster = node.role === 'master';
					var radius   = isMaster ? 32 : 24;
					var accent   = isMaster ? '#58a6ff' : '#2ea44f';

					// Outer glow ring
					ctx.save();
					ctx.shadowBlur  = isMaster ? 24 : 16;
					ctx.shadowColor = accent;
					ctx.beginPath();
					ctx.arc(pos.x, pos.y, radius + 4, 0, Math.PI*2);
					ctx.strokeStyle = accent.replace('#','');  // fallback
					// proper rgba
					var ar = parseInt(accent.slice(1,3),16),
					    ag = parseInt(accent.slice(3,5),16),
					    ab = parseInt(accent.slice(5,7),16);
					ctx.strokeStyle = 'rgba('+ar+','+ag+','+ab+',0.3)';
					ctx.lineWidth   = 6;
					ctx.stroke();
					ctx.restore();

					// Node circle
					var grad = ctx.createRadialGradient(pos.x-4, pos.y-4, 2, pos.x, pos.y, radius);
					grad.addColorStop(0, isMaster ? '#2d4a7a' : '#1a3a2a');
					grad.addColorStop(1, '#161b22');
					ctx.beginPath();
					ctx.arc(pos.x, pos.y, radius, 0, Math.PI*2);
					ctx.fillStyle = grad;
					ctx.fill();
					ctx.strokeStyle = accent;
					ctx.lineWidth   = isMaster ? 2.5 : 1.5;
					ctx.stroke();

					// Icon
					ctx.font         = (isMaster ? 18 : 14) + 'px serif';
					ctx.textAlign    = 'center';
					ctx.textBaseline = 'middle';
					ctx.fillText(isMaster ? '🌐' : '📡', pos.x, pos.y - 3);

					// Client count badge
					if (node.clients > 0) {
						ctx.save();
						ctx.beginPath();
						ctx.arc(pos.x + radius*0.7, pos.y - radius*0.7, 9, 0, Math.PI*2);
						ctx.fillStyle = '#e3b341';
						ctx.fill();
						ctx.font         = 'bold 9px monospace';
						ctx.fillStyle    = '#0d1117';
						ctx.textAlign    = 'center';
						ctx.textBaseline = 'middle';
						ctx.fillText(node.clients, pos.x + radius*0.7, pos.y - radius*0.7);
						ctx.restore();
					}

					// Label below node
					var label = node.hostname || (node.mac ? node.mac.slice(-8) : '?');
					var ipLabel = node.ip || '';
					ctx.save();
					ctx.font         = 'bold 11px monospace';
					ctx.fillStyle    = '#e6edf3';
					ctx.textAlign    = 'center';
					ctx.textBaseline = 'top';
					ctx.shadowBlur   = 6;
					ctx.shadowColor  = '#0d1117';
					ctx.fillText(label, pos.x, pos.y + radius + 6);
					if (ipLabel) {
						ctx.font      = '9px monospace';
						ctx.fillStyle = '#7d8590';
						ctx.fillText(ipLabel, pos.x, pos.y + radius + 19);
					}
					ctx.restore();

					// Store pos for tooltip hit-test
					pos.radius = radius;
				});

				return positions;
			}

			// Tooltip hit-test on mouse move
			var _lastPositions = {};
			var _lastTopo      = null;
			var canvas = document.getElementById('easymesh-topo-canvas');
			var tooltip = document.getElementById('easymesh-topo-tooltip');

			if (canvas) {
				canvas.addEventListener('mousemove', function(e) {
					var rect = canvas.getBoundingClientRect();
					var scaleX = canvas.offsetWidth  ? canvas.width  / window.devicePixelRatio / canvas.offsetWidth  : 1;
					var scaleY = canvas.offsetHeight ? canvas.height / window.devicePixelRatio / canvas.offsetHeight : 1;
					var mx = (e.clientX - rect.left);
					var my = (e.clientY - rect.top);
					var hit = null;
					Object.keys(_lastPositions).forEach(function(mac) {
						var p = _lastPositions[mac];
						var dx = mx - p.x * (canvas.offsetWidth / canvas.width * window.devicePixelRatio);
						var dy = my - p.y * (canvas.offsetHeight/ canvas.height* window.devicePixelRatio);
						if (Math.sqrt(dx*dx+dy*dy) < (p.radius || 24) * 1.4) hit = p.node;
					});
					if (hit) {
						var lines = [
							(hit.role === 'master' ? '🌐 Master' : '📡 Agent'),
							'MAC: '      + (hit.mac      || '—'),
							'IP:  '      + (hit.ip       || '—'),
							'Clients: '  + (hit.clients  || 0),
							'Backhaul: ' + (hit.backhaul || 'wired')
						];
						if (hit.tq) lines.push('TQ: ' + Math.round(hit.tq/255*100) + '%');
						tooltip.innerHTML = lines.map(function(l){
							return '<div>' + l + '</div>';
						}).join('');
						tooltip.style.display = 'block';
						tooltip.style.left = (e.clientX - rect.left + 16) + 'px';
						tooltip.style.top  = (e.clientY - rect.top  - 10) + 'px';
					} else {
						tooltip.style.display = 'none';
					}
				});
				canvas.addEventListener('mouseleave', function() {
					if (tooltip) tooltip.style.display = 'none';
				});
			}

			function refreshTopo() {
				masterFetch('/topology').then(function(topo) {
					if (!topo || !topo.nodes) return;
					_lastTopo = topo;
					_lastPositions = drawTopo(topo, _lastPositions) || {};
				});
			}
			refreshTopo();
			setInterval(refreshTopo, 5000);
		})();

		return el;
	},

	handleSaveApply: null,
	handleSave:      null,
	handleReset:     null
});
