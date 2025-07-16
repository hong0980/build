'use strict';
'require fs';
'require form';
'require view';
'require network';
'require validation';
'require tools.firewall as fwtool';

var CSS = `
@media (min-width: 768px) {
	.cbi-section-table
	.cbi-input-text {
		max-width: 55px;
	}
	.table.cbi-section-table
	.cbi-dropdown {
		min-width: 160px;
		max-width: 160px;
	}
	.table.cbi-section-table
	td[data-name="monthdays"]
	.cbi-dropdown {
		min-width: 100px;
		max-width: 100px;
	}
}
`;
var fw4 = L.hasSystemFeature('firewall4');

return view.extend({
	load: function () {
		return Promise.all([
			network.getHostHints(),
			fs.exec_direct('/usr/sbin/iptables', ['-L', 'INPUT'])
				.then((res) => res.includes('MIAPLUS'))
				.catch(() => false)
		]);
	},

	render: function ([data, isRunning]) {
		const host = Object.entries(data.hosts);
		let m, s, o;

		m = new form.Map('miaplus', _('Internet Access Schedule Control Plus'), [
			E('style', { 'type': 'text/css' }, CSS),
			E('div', { 'style': 'margin-bottom: 1em;' }, _('Access Schedule Control Description')),
			E('font', { 'color': isRunning ? "green" : "red", 'style': "font-weight: bold;" },
				_(isRunning ? "%s RUNNING" : "%s NOT RUNNING").format(_("Internet Access Schedule Control Plus")))
		]);

		s = m.section(form.TypedSection, 'basic');
		s.anonymous = true;

		o = s.option(form.Flag, 'enable', _('Enable'));
		o.rmempty = false;

		o = s.option(form.Flag, 'strict', _('Strict Mode'),
			_('Better control but higher CPU usage'));
		o.rmempty = false;
		o.default = '1';

		o = s.option(form.Flag, 'ipv6enable', _('IPv6 Enabled'));
		o.rmempty = false;

		s = m.section(form.GridSection, 'macbind');
		s.anonymous = true;
		s.addremove = true;
		s.sortable = true;
		s.cloneable = true; //允许用户克隆（复制）现有的条目
		s.rowcolors = true; // 启用行交替颜色（斑马条纹）
		s.nodescriptions = true; //不显示每个选项的默认描述文本

		o = s.option(form.Flag, 'enable', _('Enable'));
		o.rmempty = false;
		o.editable = true;
		o.modalonly = false;

		o = s.option(form.Value, 'macaddr', _('MAC Address'), _('Default MAC priority'));
		host.sort(([a], [b]) => a.localeCompare(b))
			.forEach(([mac, host]) => {
				o.value(mac, E([], [mac, ' (', E('strong', {}, [
					host.name ||
					(host.ipaddrs?.[0] || host.ipv4?.[0]) ||
					(host.ip6addrs?.[0] || host.ipv6?.[0]) || '?'
				]), ')']));
			});
		o.editable = true;
		o.datatype = 'list(macaddr)';

		o = s.option(form.Value, 'ipaddr', _('IP Address'), _('If using IP, the MAC must be left blank'));
		host
			.map(([mac, host]) => ({
				mac, name: host.name, ip: host.ipaddrs?.[0] || host.ipv4?.[0]
			}))
			.filter(entry => entry.ip)
			.sort((a, b) => a.ip.localeCompare(b.ip, undefined, { numeric: true }))
			.forEach(({ ip, mac, name }) =>
				o.value(ip, E([], [ip, ' (', E('strong', {}, [name || mac]), ')'])));
		o.editable = true;
		o.datatype = 'list(ip4addr)';

		// o = s.option(form.Value, 'ip6addr', 'IP6');
		// var choices = fwtool.transformHostHints('ipv6', data.hosts);
		// for (var i = 0; i < choices[0].length; i++)
		// 	o.value(choices[0][i], choices[1][choices[0][i]]);
		// o.editable = true;
		// o.datatype = 'list(ip6addr)';

		o = s.option(form.MultiValue, 'weekdays', _('Week Days'));
		o.modalonly = true;
		o.multiple = true;
		o.display = 5;
		o.placeholder = _('Any day');
		o.value('Mon', _('mon'));
		o.value('Tue', _('tue'));
		o.value('Wed', _('wed'));
		o.value('Thu', _('thu'));
		o.value('Fri', _('fri'));
		o.value('Sat', _('sat'));
		o.value('Sun', _('sun'));
		o.write = function (section_id, value) {
			return this.super('write', [section_id, L.toArray(value).join(' ')]);
		};

		o = s.option(form.MultiValue, 'monthdays', _('Month Days'));
		// o.modalonly = true;
		o.multiple = true;
		o.editable = true;
		o.display_size = 15;
		o.placeholder = _('Any day');
		o.write = function (section_id, value) {
			return this.super('write', [section_id, L.toArray(value).join(' ')]);
		};
		for (var i = 1; i <= 31; i++)
			o.value(i);

		o = s.option(form.Value, 'start_time', _('Start time'));
		o.placeholder = '08:00';
		o.editable = true;
		o.validate = function (section_id, value) {
			return !value || /^([01]\d|2[0-3]):([0-5]\d)$/.test(value) || _('Invalid time format. Use HH:MM.');
		};

		o = s.option(form.Value, 'stop_time', _('Stop Time'));
		o.placeholder = '20:00';
		o.editable = true;
		o.validate = function (section_id, value) {
			return !value || /^([01]\d|2[0-3]):([0-5]\d)$/.test(value) || _('Invalid time format. Use HH:MM.');
		};

		o = s.option(form.Value, 'start_date', _('Start Date'));
		o.modalonly = true;
		o.datatype = 'dateyyyymmdd';

		o = s.option(form.Value, 'stop_date', _('Stop Date'));
		o.modalonly = true;
		o.datatype = 'dateyyyymmdd';

		o = s.option(form.ListValue, 'time_mode', _('Time Mode'),
			_('Combined mode: Active throughout the entire specified datetime period<br>Separated mode: Active daily during the specified time slot within the date range')
		);
		o.modalonly = true;
		o.value(1, _('Combined'));
		o.value(0, _('Separate'));
		o.depends({ 'stop_date': '', '!reverse': true });
		o.depends({ 'start_date': '', '!reverse': true });
		o.default = 1;

		return m.render();
	}
});
