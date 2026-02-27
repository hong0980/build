'use strict';
'require view';
'require rpc';
'require poll';
'require ui';
'require fs';

/*
 * luci-app-easymesh - nodes.js
 * 节点状态页：实时显示 Mesh 拓扑和节点信息
 */

/* 读取 batman-adv originators 表（已发现邻居） */
var callGetOriginators = rpc.declare({
	object: 'file',
	method: 'read',
	params: [ 'path' ],
	expect: { data: '' }
});

/* 读取 bat0 接口状态 */
var callNetworkStatus = rpc.declare({
	object: 'network.interface',
	method: 'dump',
	expect: { interface: [] }
});

function parseOriginators(raw) {
	var nodes = [];
	if (!raw) return nodes;

	var lines = raw.trim().split('\n');
	/* 跳过表头（前2行） */
	for (var i = 2; i < lines.length; i++) {
		var parts = lines[i].trim().split(/\s+/);
		if (parts.length >= 5) {
			nodes.push({
				mac:       parts[0],
				lastSeen:  parts[1],
				tq:        parseInt(parts[2]) || 0,  /* TQ = link quality 0-255 */
				nextHop:   parts[3],
				iface:     parts[4]
			});
		}
	}
	return nodes;
}

function tqToBar(tq) {
	/* TQ 255 = 最好，0 = 最差；转换为百分比 */
	var pct = Math.round((tq / 255) * 100);
	var color = pct >= 70 ? '#2ea44f' : pct >= 40 ? '#d29922' : '#f85149';
	return E('div', { 'style': 'display:flex;align-items:center;gap:8px' }, [
		E('div', {
			'style': [
				'height:6px;border-radius:3px;background:' + color,
				'width:' + pct + 'px;max-width:80px;transition:width 0.5s'
			].join(';')
		}),
		E('span', { 'style': 'font-size:12px;color:#7d8590' }, pct + '%')
	]);
}

function renderNodeTable(nodes) {
	if (!nodes.length) {
		return E('div', { 'class': 'alert-message' }, [
			_('未发现 Mesh 邻居节点。请确认：'),
			E('ul', {}, [
				E('li', {}, _('其他节点已通电并启用 EasyMesh')),
				E('li', {}, _('所有节点的 Mesh ID 和密码完全一致')),
				E('li', {}, _('bat0 接口已正常启动'))
			])
		]);
	}

	var rows = nodes.map(function(n) {
		return E('tr', { 'class': 'tr' }, [
			E('td', { 'class': 'td', 'style': 'font-family:monospace' }, n.mac),
			E('td', { 'class': 'td' }, tqToBar(n.tq)),
			E('td', { 'class': 'td', 'style': 'font-family:monospace;color:#7d8590' }, n.nextHop),
			E('td', { 'class': 'td' }, n.iface),
			E('td', { 'class': 'td' }, n.lastSeen + 's')
		]);
	});

	return E('div', { 'class': 'table-wrapper' }, [
		E('table', { 'class': 'table' }, [
			E('tr', { 'class': 'tr table-titles' }, [
				E('th', { 'class': 'th' }, _('邻居 MAC 地址')),
				E('th', { 'class': 'th' }, _('链路质量')),
				E('th', { 'class': 'th' }, _('下一跳')),
				E('th', { 'class': 'th' }, _('接口')),
				E('th', { 'class': 'th' }, _('最后seen'))
			])
		].concat(rows))
	]);
}

return view.extend({

	load: function() {
		return Promise.all([
			L.resolveDefault(
				callGetOriginators({ path: '/sys/kernel/debug/batman_adv/bat0/originators' }),
				''
			),
			callNetworkStatus()
		]);
	},

	render: function(data) {
		var originatorRaw = data[0];
		var interfaces    = data[1];

		var nodes = parseOriginators(originatorRaw);

		/* 找到 bat0 接口状态 */
		var bat0 = (interfaces || []).filter(function(i) {
			return i.interface === 'bat0';
		})[0];

		var bat0Status = bat0
			? E('span', { 'class': 'label', 'style': 'background:#2ea44f;color:#fff' }, _('运行中'))
			: E('span', { 'class': 'label', 'style': 'background:#f85149;color:#fff' }, _('未启动'));

		var view = E('div', {}, [

			/* 状态卡片 */
			E('div', { 'class': 'cbi-section' }, [
				E('h3', {}, _('Mesh 网络状态')),
				E('div', { 'class': 'table' }, [
					E('div', { 'class': 'tr' }, [
						E('div', { 'class': 'td left', 'style': 'width:200px' }, _('bat0 接口')),
						E('div', { 'class': 'td' }, [ bat0Status ])
					]),
					E('div', { 'class': 'tr' }, [
						E('div', { 'class': 'td left' }, _('发现邻居节点')),
						E('div', { 'class': 'td' }, String(nodes.length) + _(' 台'))
					]),
					bat0 ? E('div', { 'class': 'tr' }, [
						E('div', { 'class': 'td left' }, _('bat0 IPv4')),
						E('div', { 'class': 'td', 'style': 'font-family:monospace' },
							(bat0['ipv4-address'] && bat0['ipv4-address'][0])
								? bat0['ipv4-address'][0].address
								: '-'
						)
					]) : E([])
				])
			]),

			/* 邻居节点列表 */
			E('div', { 'class': 'cbi-section' }, [
				E('h3', {}, _('Mesh 邻居节点')),
				E('p', { 'class': 'cbi-section-descr' },
					_('链路质量（TQ）越高越好，255 为满分。数据每 5 秒自动刷新。')),
				renderNodeTable(nodes)
			])
		]);

		/* 自动轮询刷新 */
		poll.add(L.bind(function() {
			return Promise.all([
				L.resolveDefault(
					callGetOriginators({ path: '/sys/kernel/debug/batman_adv/bat0/originators' }),
					''
				),
				callNetworkStatus()
			]).then(L.bind(function(refreshed) {
				var newNodes = parseOriginators(refreshed[0]);
				var tableDiv = document.querySelector('.table-wrapper');
				if (tableDiv) tableDiv.replaceWith(renderNodeTable(newNodes));
			}, this));
		}, this), 5);

		return view;
	},

	handleSaveApply: null,
	handleSave:      null,
	handleReset:     null
});
