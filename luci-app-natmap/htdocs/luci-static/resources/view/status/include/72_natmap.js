'use strict';
'require baseclass';
'require fs';
'require uci';
'require rpc';

const conf = 'natmap';
const callServiceList = rpc.declare({
	object: 'service',
	method: 'list',
	params: ['name'],
	expect: { '': {} }
});

function getStatus() {
	const status = {};
	return L.resolveDefault(callServiceList(conf), {})
		.then(res => res[conf]?.instances ?? {})
		.then(instances => Promise.all(
			Object.entries(instances)
				.filter(([, i]) => i.running && i.pid)
				.map(([k, i]) =>
					fs.read(`/var/run/natmap/${i.pid}.json`)
						.then(r => {
							status[k] = Object.assign(
								JSON.parse(r), { running: i.running }
							);
						})
						.catch(() => {})
				)
		))
		.then(() => status);
}

return baseclass.extend({
	title: _('Active NATMap Portmap'),

	load() {
		return Promise.all([ getStatus() ]);
	},

	render([status]) {
		let table = E('table', { 'class': 'table cbi-section-table', 'id': 'natmap_status_table' }, [
			E('tr', { 'class': 'tr table-titles' }, [
				E('th', { 'class': 'th' }, _('Name')),
				E('th', { 'class': 'th' }, _('Protocol')),
				E('th', { 'class': 'th' }, _('Inner Addr')),
				E('th', { 'class': 'th' }, _('Inner Port')),
				E('th', { 'class': 'th' }, _('Outer Addr')),
				E('th', { 'class': 'th' }, _('Outer Port')),
				E('th', { 'class': 'th cbi-section-actions' }, '')
			])
		]);

        let rows = [];
		if (status) {
			Object.keys(status).forEach(sid => {
				rows.push([
					status[sid].comment ? status[sid].comment + ' (' + sid + ')' : sid,
					status[sid].protocol,
					status[sid].inner_ip,
					status[sid].inner_port,
					status[sid].ip,
					status[sid].port
				])
			})
		};

		cbi_update_table(table, rows.sort(), E('em', _('There are no active portmap')));
		return table;
	}
});
