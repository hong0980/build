'use strict';
'require view';
'require rpc';
'require uci';
'require poll';
'require ui';

/* ── RPC declarations ──────────────────────────────────────────────────── */
var callMeshPending   = rpc.declare({ object: 'easymesh', method: 'pending'   });
var callMeshApproved  = rpc.declare({ object: 'easymesh', method: 'approved'  });
var callMeshTopology  = rpc.declare({ object: 'easymesh', method: 'topology'  });
var callMeshNeighbors = rpc.declare({ object: 'easymesh', method: 'neighbors' });
var callMeshApprove   = rpc.declare({ object: 'easymesh', method: 'approve', params: ['mac'] });
var callMeshReject    = rpc.declare({ object: 'easymesh', method: 'reject',  params: ['mac'] });
var callMeshStatus    = rpc.declare({ object: 'easymesh', method: 'status'  });

/* ── TQ helpers ─────────────────────────────────────────────────────────── */
function tqColor(tq) {
	return tq / 255 >= 0.70 ? '#2ea44f' : tq / 255 >= 0.40 ? '#e3b341' : '#f85149';
}
function hexToRgb(hex) {
	return [parseInt(hex.slice(1,3),16), parseInt(hex.slice(3,5),16), parseInt(hex.slice(5,7),16)];
}

/* ── TQ bar widget ─────────────────────────────────────────────────────── */
function tqBar(tq) {
	var pct   = Math.round(tq / 255 * 100);
	var color = tqColor(tq);
	return E('div', { style: 'display:flex;align-items:center;gap:6px' }, [
		E('div', { style: 'width:60px;height:5px;background:#30363d;border-radius:3px;overflow:hidden' }, [
			E('div', { style: 'width:' + pct + '%;height:100%;background:' + color })
		]),
		E('span', { style: 'font-size:11px;color:#7d8590' }, pct + '%')
	]);
}

/* ── Canvas topology ────────────────────────────────────────────────────── */
function drawTopo(topo, canvas) {
	if (!canvas) return {};
	var ctx = canvas.getContext('2d');
	var DPR = window.devicePixelRatio || 1;
	var cssW = canvas.offsetWidth || 900;
	/* 动态高度：1-2节点 min300，3-5节点 min400，6+节点 min500，节点多时更高 */
	var nodeCount = ((topo && topo.nodes) ? topo.nodes : []).length;
	var minH = nodeCount <= 2 ? 260 : nodeCount <= 5 ? 380 : nodeCount <= 8 ? 480 : 560;
	var cssH = Math.max(minH, Math.round(cssW * 0.38));
	if (canvas.width !== cssW * DPR || canvas.height !== cssH * DPR) {
		canvas.width  = cssW * DPR;
		canvas.height = cssH * DPR;
		ctx.scale(DPR, DPR);
	}
	var W = cssW, H = cssH;
	var nodes = (topo && topo.nodes) ? topo.nodes : [];
	var links = (topo && topo.links) ? topo.links : [];

	/* Deduplicate nodes by MAC — batctl orig + NODE_DB may overlap */
	var nodeMap = {};
	nodes.forEach(function(n) {
		if (!n.mac) return;
		var k = n.mac.toLowerCase();
		/* Prefer entries with more info (hostname/ip) */
		if (!nodeMap[k] || (!nodeMap[k].hostname && n.hostname)) nodeMap[k] = n;
	});
	nodes = Object.keys(nodeMap).map(function(k) { return nodeMap[k]; });

	/* Layout: 2 nodes → horizontal split; 3+ → master centre + agents on circle */
	var positions = {};
	var cx = W / 2, cy = H / 2, r = Math.min(W, H) * 0.33;
	var master = null, others = [];
	nodes.forEach(function(n) {
		if (n.role === 'master') master = n; else others.push(n);
	});
	if (master && others.length <= 1) {
		/* Horizontal layout: master left-centre, agent right-centre */
		var lx = W * 0.30, rx = W * 0.70;
		if (master) positions[master.mac.toLowerCase()] = { x: lx, y: cy, node: master };
		if (others.length === 1)
			positions[others[0].mac.toLowerCase()] = { x: rx, y: cy, node: others[0] };
	} else {
		/* Radial layout for 3+ nodes */
		if (master) positions[master.mac.toLowerCase()] = { x: cx, y: cy, node: master };
		others.forEach(function(n, i) {
			var angle = (2 * Math.PI * i / Math.max(others.length, 1)) - Math.PI / 2;
			positions[n.mac.toLowerCase()] = {
				x: cx + r * Math.cos(angle),
				y: cy + r * Math.sin(angle),
				node: n
			};
		});
	}

	/* Background + grid dots */
	ctx.fillStyle = '#0d1117';
	ctx.fillRect(0, 0, W, H);
	ctx.fillStyle = 'rgba(48,54,61,0.4)';
	for (var gx = 20; gx < W; gx += 30)
		for (var gy = 20; gy < H; gy += 30) {
			ctx.beginPath(); ctx.arc(gx, gy, 1, 0, Math.PI * 2); ctx.fill();
		}

	/* Links */
	links.forEach(function(link) {
		var a = positions[(link.src||'').toLowerCase()];
		var b = positions[(link.dst||'').toLowerCase()];
		if (!a || !b) return;
		var tq = link.tq || 0;
		var col = tqColor(tq), rgb = hexToRgb(col);
		var pct = Math.round(tq / 255 * 100);
		var mx = (a.x + b.x) / 2 + (b.y - a.y) * 0.08;
		var my = (a.y + b.y) / 2 - (b.x - a.x) * 0.08;
		var alpha = 0.35 + 0.65 * (tq / 255);
		var lw    = 1.5 + 4 * (tq / 255);

		ctx.save();
		ctx.shadowBlur = 8; ctx.shadowColor = col;
		ctx.strokeStyle = 'rgba(' + rgb[0] + ',' + rgb[1] + ',' + rgb[2] + ',' + alpha + ')';
		ctx.lineWidth = lw; ctx.lineCap = 'round';
		ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.quadraticCurveTo(mx, my, b.x, b.y); ctx.stroke();
		ctx.restore();

		ctx.save();
		ctx.font = 'bold 10px monospace'; ctx.fillStyle = col;
		ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
		ctx.shadowBlur = 4; ctx.shadowColor = '#0d1117';
		ctx.fillText(pct + '%', mx, my);
		ctx.restore();
	});

	/* Nodes */
	nodes.forEach(function(node) {
		var pos = positions[(node.mac||'').toLowerCase()];
		if (!pos) return;
		var isMaster = node.role === 'master';
		var radius = isMaster ? 32 : 24;
		var accent = isMaster ? '#58a6ff' : '#2ea44f';
		var argb   = hexToRgb(accent);

		ctx.save();
		ctx.shadowBlur = isMaster ? 24 : 16; ctx.shadowColor = accent;
		ctx.strokeStyle = 'rgba(' + argb[0] + ',' + argb[1] + ',' + argb[2] + ',0.3)';
		ctx.lineWidth = 6;
		ctx.beginPath(); ctx.arc(pos.x, pos.y, radius + 4, 0, Math.PI * 2); ctx.stroke();
		ctx.restore();

		var grad = ctx.createRadialGradient(pos.x - 4, pos.y - 4, 2, pos.x, pos.y, radius);
		grad.addColorStop(0, isMaster ? '#2d4a7a' : '#1a3a2a');
		grad.addColorStop(1, '#161b22');
		ctx.beginPath(); ctx.arc(pos.x, pos.y, radius, 0, Math.PI * 2);
		ctx.fillStyle = grad; ctx.fill();
		ctx.strokeStyle = accent; ctx.lineWidth = isMaster ? 2.5 : 1.5; ctx.stroke();
		ctx.font = (isMaster ? 18 : 14) + 'px serif';
		ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
		ctx.fillText(isMaster ? '🌐' : '📡', pos.x, pos.y - 3);

		/* Client badge */
		if (node.clients > 0) {
			ctx.save();
			ctx.beginPath(); ctx.arc(pos.x + radius * 0.7, pos.y - radius * 0.7, 9, 0, Math.PI * 2);
			ctx.fillStyle = '#e3b341'; ctx.fill();
			ctx.font = 'bold 9px monospace'; ctx.fillStyle = '#0d1117';
			ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
			ctx.fillText(node.clients, pos.x + radius * 0.7, pos.y - radius * 0.7);
			ctx.restore();
		}

		/* Label */
		var label = node.hostname || (node.mac ? node.mac.slice(-8) : '?');
		ctx.save();
		ctx.font = 'bold 11px monospace'; ctx.fillStyle = '#e6edf3';
		ctx.textAlign = 'center'; ctx.textBaseline = 'top';
		ctx.shadowBlur = 6; ctx.shadowColor = '#0d1117';
		ctx.fillText(label, pos.x, pos.y + radius + 6);
		if (node.ip) {
			ctx.font = '9px monospace'; ctx.fillStyle = '#7d8590';
			ctx.fillText(node.ip, pos.x, pos.y + radius + 19);
		}
		ctx.restore();
		pos.radius = radius;
	});

	return positions;
}

return view.extend({
	load: function() {
		return Promise.all([
			uci.load('easymesh'),
			callMeshTopology(),
			callMeshPending(),
			callMeshApproved(),
			callMeshNeighbors(),
			callMeshStatus()
		]);
	},

	render: function(data) {
		var self = this;
		var _positions = {};

		if (!uci.get_bool('easymesh', 'global', 'enabled')) {
			return E('div', { class: 'cbi-section' }, [
				E('div', { class: 'alert-message warning' }, [
					E('h4', {}, _('EasyMesh is disabled')),
					E('p', {}, _('Enable EasyMesh in the Overview tab and save to start the service.'))
				])
			]);
		}

		var root = E('div', { id: 'easymesh-nodes-root' });
		root.appendChild(self._buildInner(data[1], data[2], data[3], data[4], data[5]));

		poll.add(function() {
			return Promise.all([
				callMeshTopology(),
				callMeshPending(),
				callMeshApproved(),
				callMeshNeighbors(),
				callMeshStatus()
			]).then(function(r) {
				var topo = r[0];
				var old = document.getElementById('easymesh-nodes-inner');
				if (old) old.replaceWith(self._buildInner(topo, r[1], r[2], r[3], r[4]));

				if (!topo || !topo.nodes) return;
				var canvas  = document.getElementById('easymesh-topo-canvas');
				var tooltip = document.getElementById('easymesh-topo-tooltip');
				_positions  = drawTopo(topo, canvas) || {};
				if (canvas && !canvas._tipBound) {
					canvas._tipBound = true;
					canvas.addEventListener('mousemove', function(e) {
						var rect = canvas.getBoundingClientRect();
						var mx = e.clientX - rect.left, my = e.clientY - rect.top;
						var hit = null;
						Object.keys(_positions).forEach(function(mac) {
							var p = _positions[mac];
							var dx = mx - p.x, dy = my - p.y;
							if (Math.sqrt(dx*dx + dy*dy) < (p.radius || 24) * 1.4) hit = p.node;
						});
						if (hit) {
							var frag = document.createDocumentFragment();
							var lines = [
								(hit.role === 'master' ? '🌐 ' + _('Master') : '📡 ' + _('Agent')),
								_('Hostname') + ': ' + (hit.hostname || '—'),
								_('MAC') + ': ' + (hit.mac || '—'),
								_('IP')  + ': ' + (hit.ip  || '—'),
								_('Clients') + ': ' + (hit.clients || 0),
								_('Backhaul') + ': ' + (hit.backhaul || _('wired'))
							];
							if (hit.tq) lines.push(_('TQ') + ': ' + Math.round(hit.tq / 255 * 100) + '%');
							lines.forEach(function(l) {
								var d = document.createElement('div');
								d.textContent = l;
								frag.appendChild(d);
							});
							tooltip.innerHTML = '';
							tooltip.appendChild(frag);
							tooltip.style.display = 'block';
							tooltip.style.left = (mx + 16) + 'px';
							tooltip.style.top  = (my - 10) + 'px';
						} else {
							tooltip.style.display = 'none';
						}
					});
					canvas.addEventListener('mouseleave', function() { tooltip.style.display = 'none'; });
				}
			}).catch(function() {});
		}, 5);

		return root;
	},

	_buildInner: function(topology, pendingResp, approvedResp, neighborsResp, statusResp) {
		var self = this;
		var el   = E('div', { id: 'easymesh-nodes-inner' });
		var pending  = (pendingResp  && Array.isArray(pendingResp.nodes))  ? pendingResp.nodes  :
					   Array.isArray(pendingResp)  ? pendingResp  : [];
		var approved = (approvedResp && Array.isArray(approvedResp.nodes)) ? approvedResp.nodes :
					   Array.isArray(approvedResp) ? approvedResp : [];
		var neighbors = (neighborsResp && Array.isArray(neighborsResp.neighbors)) ?
					   neighborsResp.neighbors : [];

		if (pending.length) {
			el.appendChild(E('div', { class: 'cbi-section' }, [
				E('h3', { style: 'color:#e3b341;margin-bottom:4px' },
					'⚡ ' + pending.length + ' ' + _('device(s) requesting to join Mesh')),
				E('p', { class: 'cbi-section-descr', style: 'margin-bottom:14px' },
					_('Review and approve each device before it receives mesh configuration.')),
				E('div', { class: 'table' },
					[E('div', { class: 'tr table-titles' }, [
						E('div', { class: 'td' }, _('Hostname')),
						E('div', { class: 'td' }, _('IP')),
						E('div', { class: 'td' }, _('MAC')),
						E('div', { class: 'td' }, _('Source')),
						E('div', { class: 'td' }, _(''))
					])].concat(pending.map(function(n) {
						return E('div', { class: 'tr' }, [
							E('div', { class: 'td' }, n.hostname || _('Unknown device')),
							E('div', { class: 'td' }, n.ip|| '—'),
							E('div', { class: 'td' }, n.mac || '—'),
							E('div', { class: 'td' }, n.source === 'wireless' ? '📶 ' + _('Wireless') : '🔌 ' + _('Wired')),
							E('div', { class: 'td' }, [
								E('div', { style: 'display: flex; gap: 8px;' }, [
									E('button', {
										class: 'btn cbi-button-add',
										click: ui.createHandlerFn(self, function(ev) {
											var btn = ev.currentTarget;
											btn.disabled    = true;
											btn.textContent = _('Approving...');
											return callMeshApprove(n.mac)
												.then(function(res) {
													if (res && res.error) {
														ui.addNotification(null,
															E('p', {}, _('Approval failed: ') + res.error), 'error');
														btn.disabled    = false;
														btn.textContent = '✓ ' + _('Allow to join');
													} else {
														ui.addNotification(null,
															E('p', {}, _('Approved. Node will receive config shortly.')), 'info');
													}
												})
												.catch(function(err) {
													ui.addNotification(null,
														E('p', {}, _('RPC error: ') + (err.message || String(err))), 'error');
													btn.disabled    = false;
													btn.textContent = '✓ ' + _('Allow to join');
												});
										})
									}, _('Allow to join')),
									E('button', {
										class: 'btn cbi-button-remove',
										click: ui.createHandlerFn(self, function(ev) {
											var btn = ev.currentTarget;
											btn.disabled = true;
											return callMeshReject(n.mac)
												.catch(function() {})
												.then(function() { btn.disabled = false; });
										})
									}, _('Reject'))
								])
							])
						]);
					}))
				),
			]));
		}

		if (approved.length) {
			el.appendChild(E('div', { class: 'cbi-section' }, [
				E('h3', {}, _('Approved Nodes') + ' (' + approved.length + ')'),
				E('div', { class: 'table' },
					[E('div', { class: 'tr table-titles' }, [
						E('div', { class: 'td' }, _('Hostname')),
						E('div', { class: 'td' }, _('IP')),
						E('div', { class: 'td' }, _('MAC')),
						E('div', { class: 'td' }, _('Source'))
					])].concat(approved.map(function(n) {
						return E('div', { class: 'tr' }, [
							E('div', { class: 'td' }, n.hostname || _('Unknown device')),
							E('div', { class: 'td' }, n.ip
								? E('a', { href: `//${n.ip}`, target: '_blank' }, n.ip)
								: '—'
							),
							E('div', { class: 'td' }, n.mac || '—'),
							E('div', { class: 'td' }, n.source === 'wireless' ? '📶 ' + _('Wireless') : '🔌 ' + _('Wired'))
						]);
					}))
				)
			]));
		}

		var bat0Up     = topology && topology.bat0_up;
		var svc        = statusResp || {};
		var daemonUp   = svc.daemon_running === true;
		el.appendChild(E('div', { class: 'cbi-section' }, [
			E('h3', {}, _('Mesh Status')),
			E('div', { class: 'table' }, [
				E('div', { class: 'tr' }, [
					E('div', { class: 'td left', style: 'width:160px' }, 'bat0'),
					E('div', { class: 'td' }, bat0Up
						? E('span', { style: 'background:#2ea44f;color:#fff;padding:2px 8px;border-radius:4px' }, _('Running'))
						: E('span', { style: 'background:#f85149;color:#fff;padding:2px 8px;border-radius:4px' }, _('Not running')))
				]),
				E('div', { class: 'tr' }, [
					E('div', { class: 'td left' }, _('Daemon')),
					E('div', { class: 'td' }, daemonUp
						? E('span', { style: 'background:#2ea44f;color:#fff;padding:2px 8px;border-radius:4px' },
							_('Running') + (svc.role ? ' (' + svc.role + ')' : ''))
						: E('span', { style: 'background:#f85149;color:#fff;padding:2px 8px;border-radius:4px' }, _('Not running')))
				]),
				E('div', { class: 'tr' }, [
					E('div', { class: 'td left' }, _('Neighbor nodes')),
					E('div', { class: 'td' }, neighbors.length + ' ' + _('found'))
				])
			])
		]));

		el.appendChild(E('div', { class: 'cbi-section' }, [
			E('h3', {}, _('Mesh Neighbors')),
			E('p', { class: 'cbi-section-descr' },
				_('Real-time batman-adv originator table. TQ: 255 = best. Refreshes every 5 seconds.')),
			neighbors.length === 0
				? E('div', { class: 'alert-message' },
					!daemonUp ? _('EasyMesh daemon is not running. Enable EasyMesh and restart the service.')
					: !bat0Up ? _('bat0 is not running. Try restarting the EasyMesh service.')
					: _('No neighbors found. Verify all nodes share the same Mesh ID and password.'))
				: E('div', { class: 'table' },
					[E('div', { class: 'tr table-titles' }, [
						E('div', { class: 'td', style: 'width:160px' }, _('MAC')),
						E('div', { class: 'td', style: 'width:140px' }, _('Link Quality (TQ)')),
						E('div', { class: 'td', style: 'width:160px' }, _('Next Hop')),
						E('div', { class: 'td', style: 'width:80px' }, _('Interface')),
						E('div', { class: 'td', style: 'width:80px' }, _('Last Seen'))
					])].concat(neighbors.map(function(n) {
						var isSameHop = n.mac === n.nexthop || !n.nexthop;
						return E('div', { class: 'tr' }, [
							E('div', { class: 'td', style: 'color:#d2a8ff' }, n.mac || '—'),
							E('div', { class: 'td' }, tqBar(n.tq || 0)),
							E('div', { class: 'td', style: 'color:' +
								(isSameHop ? '#7d8590' : '#79c0ff') },
								n.nexthop || n.mac),
							E('div', { class: 'td', style: 'color:#7d8590' }, n.iface || 'bat0'),
							E('div', { class: 'td', style: 'color:#7d8590' },
								(n.last_seen != null ? n.last_seen : '—') + 's')
						]);
					}))
				)
		]));

		var topoNodes = (topology && Array.isArray(topology.nodes)) ? topology.nodes : [];
		el.appendChild(E('div', { class: 'cbi-section' }, [
			E('h3', {}, '🌐 ' + _('Mesh Topology')),
			E('p', { class: 'cbi-section-descr' },
				_('Live topology map. Link color = signal quality: green ≥70%, yellow ≥40%, red <40%. Hover nodes for details.')),
			topoNodes.length === 0
				? E('div', { class: 'alert-message' },
					_('No topology data yet. Waiting for mesh to form...'))
				: E('div', {
					style: 'background:#0d1117;border:1px solid #30363d;border-radius:12px;' +
						   'padding:8px;overflow:hidden;position:relative'
				}, [
					E('canvas', {
						id: 'easymesh-topo-canvas', width: '900', height: '400',
						style: 'width:100%;display:block;border-radius:8px'
					}),
					E('div', {
						id: 'easymesh-topo-tooltip',
						style: 'display:none;position:absolute;background:rgba(22,27,34,.95);' +
							   'border:1px solid #30363d;border-radius:8px;padding:10px 14px;' +
							   'font-size:12px;color:#e6edf3;pointer-events:none;' +
							   'line-height:1.7;max-width:220px'
					})
				]),
			E('div', { style: 'display:flex;gap:20px;padding:10px 12px 4px;flex-wrap:wrap' },
				[['#2ea44f', _('≥ 70% (Good)')],
				 ['#e3b341', _('40–69% (Fair)')],
				 ['#f85149', _('< 40% (Weak)')]].map(function(item) {
					return E('div', { style: 'display:flex;align-items:center;gap:6px;font-size:11px;color:#7d8590' }, [
						E('div', { style: 'width:24px;height:3px;background:' + item[0] + ';border-radius:2px' }),
						item[1]
					]);
				})
			)
		]));

		if (topoNodes.length > 0) {
			setTimeout(function() {
				var canvas = document.getElementById('easymesh-topo-canvas');
				if (canvas) drawTopo(topology, canvas);
			}, 50);
		}

		return el;
	},

	handleSaveApply: null,
	handleSave:      null,
	handleReset:     null
});
