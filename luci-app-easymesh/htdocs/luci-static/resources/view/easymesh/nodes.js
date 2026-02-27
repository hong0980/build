'use strict';
'require view';
'require rpc';
'require poll';
'require ui';
'require uci';

/*
 * nodes.js — 节点管理页
 * - 实时显示待配对申请（来源：UDP广播/临时AP/配网Mesh）
 * - 一键批准/拒绝
 * - 显示已组网的 batman-adv 邻居
 */

var MASTER_PORT = 4304;

var callReadFile = rpc.declare({
	object: 'file', method: 'read', params: ['path'], expect: { data: '' }
});
var callNetworkDump = rpc.declare({
	object: 'network.interface', method: 'dump', expect: { interface: [] }
});

function masterFetch(path, method, body) {
	return fetch('http://' + window.location.hostname + ':' + MASTER_PORT + path, {
		method: method || 'GET',
		headers: body ? { 'Content-Type': 'application/json' } : {},
		body: body ? JSON.stringify(body) : null,
		signal: AbortSignal.timeout(4000)
	}).then(function(r) { return r.json(); }).catch(function() { return null; });
}

function parseOriginators(raw) {
	if (!raw) return [];
	return raw.trim().split('\n').slice(2).map(function(line) {
		var p = line.trim().split(/\s+/);
		return p.length >= 5 ? { mac: p[0], lastSeen: p[1], tq: parseInt(p[2]) || 0, nextHop: p[3], iface: p[4] } : null;
	}).filter(Boolean);
}

function tqBar(tq) {
	var pct = Math.round(tq / 255 * 100);
	var c = pct >= 70 ? '#2ea44f' : pct >= 40 ? '#e3b341' : '#f85149';
	return E('span', { style: 'display:inline-flex;align-items:center;gap:5px' }, [
		E('span', { style: 'display:inline-block;width:50px;height:5px;background:#eee;border-radius:3px;overflow:hidden' }, [
			E('span', { style: 'display:block;width:' + pct + '%;height:100%;background:' + c })
		]),
		E('small', { style: 'color:#888' }, pct + '%')
	]);
}

/* 发现来源标签 */
function sourceTag(source) {
	var map = {
		'udp_broadcast': ['🔌', '有线广播', '#1f6feb'],
		'http':          ['🌐', 'HTTP',     '#8250df'],
		'temp_ap':       ['📡', '临时AP',   '#d29922'],
		'provision_mesh':['🕸',  '配网Mesh', '#2ea44f']
	};
	var m = map[source] || ['❓', source, '#888'];
	return E('span', {
		style: 'font-size:11px;padding:2px 7px;border-radius:10px;background:' +
		       m[2] + '22;color:' + m[2] + ';border:1px solid ' + m[2] + '44'
	}, m[0] + ' ' + m[1]);
}

function renderPendingCard(node, onApprove, onReject) {
	var info = {};
	try { info = (typeof node.info === 'string') ? JSON.parse(node.info) : (node.info || {}); } catch(e) {}
	return E('div', {
		style: 'display:flex;align-items:center;gap:12px;padding:14px 16px;' +
		       'border:1px solid #e3b34166;border-radius:8px;background:#e3b34108;margin-bottom:8px'
	}, [
		E('span', { style: 'font-size:24px' }, '📡'),
		E('div', { style: 'flex:1;min-width:0' }, [
			E('div', { style: 'font-weight:600;margin-bottom:3px' },
				info.hostname || _('未知设备')),
			E('div', { style: 'font-size:12px;color:#888;font-family:monospace;margin-bottom:4px' },
				(info.ip || '-') + ' · ' + (info.mac || '-')),
			sourceTag(node.source || 'http')
		]),
		E('button', {
			class: 'cbi-button cbi-button-action',
			style: 'background:#2ea44f;color:#fff;border:none;padding:8px 20px;border-radius:6px;cursor:pointer;font-size:13px',
			click: onApprove
		}, '✓ ' + _('加入 Mesh')),
		E('button', {
			class: 'cbi-button',
			style: 'color:#f85149;border:1px solid #f8514966;background:transparent;' +
			       'padding:8px 12px;border-radius:6px;cursor:pointer;font-size:13px;margin-left:6px',
			click: onReject
		}, '✕')
	]);
}

return view.extend({
	load: function() {
		return Promise.all([
			L.resolveDefault(callReadFile({ path: '/sys/kernel/debug/batman_adv/bat0/originators' }), ''),
			L.resolveDefault(callNetworkDump(), []),
			masterFetch('/easymesh/nodes')
		]);
	},

	render: function(data) {
		var self = this;
		var root = E('div', { id: 'em-root' });
		root.appendChild(self._build(data[0], data[1], data[2]));

		poll.add(function() {
			return Promise.all([
				L.resolveDefault(callReadFile({ path: '/sys/kernel/debug/batman_adv/bat0/originators' }), ''),
				L.resolveDefault(callNetworkDump(), []),
				masterFetch('/easymesh/nodes')
			]).then(function(r) {
				var old = document.getElementById('em-inner');
				if (old) old.replaceWith(self._build(r[0], r[1], r[2]));
			});
		}, 5);
		return root;
	},

	_build: function(raw, ifaces, pendingRaw) {
		var self = this;
		var el        = E('div', { id: 'em-inner' });
		var bat0      = (ifaces || []).filter(function(i) { return i.interface === 'bat0'; })[0];
		var neighbors = parseOriginators(raw);
		var pending   = (Array.isArray(pendingRaw) ? pendingRaw : []).filter(function(n) {
			return n && n.status === 'pending';
		});

		/* ── 配对申请通知区 ── */
		if (pending.length > 0) {
			el.appendChild(E('div', { class: 'cbi-section' }, [
				E('h3', { style: 'color:#e3b341;margin-bottom:6px' },
					'⚡ ' + _('发现') + ' ' + pending.length + ' ' + _('台设备申请加入')),
				E('p', { class: 'cbi-section-descr', style: 'margin-bottom:12px' },
					_('确认后配置将自动推送至从节点，无需任何手动操作。')),
				E('div', {}, pending.map(function(node) {
					return renderPendingCard(node,
						function() {
							masterFetch('/easymesh/approve', 'POST', { token: node.token }).then(function() {
								ui.addNotification(null,
									E('p', {}, _('已批准，正在推送配置到从节点...')), 'info');
							});
						},
						function() { masterFetch('/easymesh/reject', 'POST', { token: node.token }); }
					);
				}))
			]));
		} else {
			/* 无待配对时显示等待提示 */
			el.appendChild(E('div', { class: 'cbi-section' }, [
				E('div', {
					style: 'padding:16px;background:#f6f8fa;border-radius:8px;color:#888;font-size:13px;text-align:center'
				}, [
					E('div', { style: 'font-size:28px;margin-bottom:8px' }, '📶'),
					_('等待从节点上电自动连接...'),
					E('br'),
					E('small', {}, _('从节点刷完 OpenWrt 上电后将自动发现本主节点'))
				])
			]));
		}

		/* ── 三种发现方式状态 ── */
		el.appendChild(E('div', { class: 'cbi-section' }, [
			E('h3', {}, _('自动发现状态')),
			E('div', { class: 'table' }, [
				[ '🔌', _('有线 UDP 广播'),  _('监听中'), '#2ea44f' ],
				[ '📡', _('临时 AP 扫描'),   _('扫描中'), '#2ea44f' ],
				[ '🕸',  _('配网 Mesh AP'),  _('广播中'), '#2ea44f' ]
			].map(function(row) {
				return E('div', { class: 'tr' }, [
					E('div', { class: 'td left', style: 'width:200px' }, row[0] + ' ' + row[1]),
					E('div', { class: 'td' }, E('span', {
						style: 'font-size:12px;padding:2px 8px;border-radius:10px;background:' +
						       row[3] + '22;color:' + row[3]
					}, row[2]))
				]);
			})
		]));

		/* ── batman-adv 邻居 ── */
		el.appendChild(E('div', { class: 'cbi-section' }, [
			E('h3', {}, _('已组网邻居节点')),
			E('p', { class: 'cbi-section-descr' }, 'TQ 链路质量 · ' + _('5秒自动刷新')),
			neighbors.length === 0
				? E('p', { style: 'color:#888' }, bat0 ? _('暂无邻居，等待从节点完成配置后自动加入') : _('bat0 未启动，请先完成主节点配置'))
				: E('table', { class: 'table' }, [
					E('tr', { class: 'tr table-titles' }, ['MAC', 'TQ', _('下一跳'), _('接口'), _('上次seen')].map(function(h) {
						return E('th', { class: 'th' }, h);
					}))
				].concat(neighbors.map(function(n) {
					return E('tr', { class: 'tr' }, [
						E('td', { class: 'td', style: 'font-family:monospace' }, n.mac),
						E('td', { class: 'td' }, tqBar(n.tq)),
						E('td', { class: 'td', style: 'font-family:monospace;color:#888' }, n.nextHop),
						E('td', { class: 'td' }, n.iface),
						E('td', { class: 'td' }, n.lastSeen + 's')
					]);
				})))
		]));

		return el;
	},

	handleSaveApply: null, handleSave: null, handleReset: null
});
