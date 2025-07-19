'use strict';
'require fs';
'require form';
'require view';
'require network';
'require tools.widgets as widgets';

var CSS = `
@media (min-width: 768px) {
	.cbi-section-table .cbi-input-text {
		max-width: 60px;
	}
	.table.cbi-section-table .cbi-dropdown {
		min-width: 170px;
		max-width: 170px;
	}
    .table.cbi-section-table
    td[data-name$="days"]
    .cbi-dropdown {
        min-width: 120px;
        max-width: 120px;
    }
}`;

function date(value) {
	if (value === '') return true;

	const match = value.match(/^(\d{4})(?:-(\d{2})(?:-(\d{2}))?)?$/);
	if (!match) return _('Valid formats: YYYY, YYYY-MM, or YYYY-MM-DD');

	const year = +match[1], month = +match[2], day = +match[3];

	if (month && (month < 1 || month > 12)) return _('Month must be between 01-12');

	if (day) {
		const daysInMonth = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
		const isLeapYear = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
		const maxDay = (month === 2 && isLeapYear) ? 29 : daysInMonth[month - 1];
		if (day < 1 || day > maxDay) return _('Day must be between 01-%d for the selected month').format(maxDay);
	};

	return true;
};

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
			E('style', { type: 'text/css' }, CSS),
			E('p', {}, _('Access Schedule Control Description')),
			E('strong', {}, _('Service Status:')),
			E('font', { color: isRunning ? "green" : "red", style: "font-weight: bold;" },
				_(isRunning ? "RUNNING" : "NOT RUNNING"))
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

		o = s.option(widgets.DeviceSelect, 'interface', _('LAN Interface'),
			_('Select interface used for downstream control (LAN)'));
		o.nobridges = false;
		o.rmempty = false;
		o.optional = false;
		o.default = 'br-lan';
		o.filter = function (section_id, value) {
			return !/^(@|docker0|veth|br-[0-9a-f]+)/.test(value);
		};

		o = s.option(widgets.DeviceSelect, 'wan_interface', _('WAN Interface'),
			_('Select interface used for upstream control (WAN)'));
		o.rmempty = true;
		o.default = 'pppoe-wan';
		o.filter = function (section_id, value) {
			return !/^(@|docker0|veth|br-[0-9a-f]+)/.test(value);
		};

		s = m.section(form.GridSection, 'bind');
		s.sortable = true;
		s.anonymous = true;
		s.addremove = true;
		// s.cloneable = true; // 克隆条目
		s.rowcolors = true; // 行交替颜色
		s.nodescriptions = true; // 隐藏选项描述

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

		o = s.option(form.Value, 'rate', _('Rate Limit'),
			_('Set traffic rate limit in Mbps (e.g. 1 for 1Mbps)'));
		o.rmempty = true;
		o.placeholder = '1';
		o.datatype = 'float';
		o.modalonly = true;

		o = s.option(form.Value, 'limit', _('Limit matching'),
			_('Limits traffic matching to the specified rate.'));
		o.modalonly = true;
		o.rmempty = true;
		o.placeholder = _('unlimited');
		o.value('10/second');
		o.value('60/minute');
		o.value('3/hour');
		o.value('500/day');
		o.validate = function (section_id, value) {
			if (value == '') return true;
			var m = String(value).toLowerCase().match(/^(?:0x[0-9a-f]{1,8}|[0-9]{1,10})\/([a-z]+)$/),
				u = ['second', 'minute', 'hour', 'day'], i = 0;
			if (m)
				for (i = 0; i < u.length; i++)
					if (u[i].indexOf(m[1]) == 0) break;
			if (!m || i >= u.length)
				return _('Invalid limit value');
			return true;
		};

		o = s.option(form.Value, 'limit_burst', _('Limit burst'),
			_('Maximum initial number of packets to match: this number gets recharged by one every time the limit specified above is not reached, up to this number.'));
		o.modalonly = true;
		o.rmempty = true;
		o.placeholder = '5';
		o.datatype = 'uinteger';
		o.depends({ limit: null, '!reverse': true });

		o = s.option(form.MultiValue, 'weekdays', _('Week Days'));
		// o.modalonly = true;
		o.editable = true;
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
		o.modalonly = true;
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
		o.description = _('Date format: Year (required) → Month (optional) → Day (optional). <br>Examples: "2025", "2025-07", "2025-07-15"');
		o.validate = function (section_id, value) {
			return date(value);
		};

		o = s.option(form.Value, 'stop_date', _('Stop Date'));
		o.modalonly = true;
		o.validate = function (section_id, value) {
			return date(value);
		};

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
