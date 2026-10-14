'use strict';
'require fs';
'require form';
'require view';
'require network';
'require tools.widgets as widgets';
'require tools.firewall as fwtool';

function date(value) {
	if (value === '' || value == null) return true;
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

function timeValue(value) {
	if (value === '' || value == null) return true;
	return /^([01]\d|2[0-3]):([0-5]\d)$/.test(value)
		? true
		: _('Invalid time format. Use HH:MM.');
}

return view.extend({
	load: () => Promise.all([
		network.getHostHints(),
		L.resolveDefault(fs.exec_direct('/usr/sbin/iptables',  [ '-w', '-t', 'filter', '-S', 'MIAPLUS' ]), ''),
		L.resolveDefault(fs.exec_direct('/usr/sbin/ip6tables', [ '-w', '-t', 'filter', '-S', 'MIAPLUS' ]), '')
	]),

	render: ([ data, v4rules, v6rules ]) => {
		let m, s, o;
		const hosts = data.hosts;
		const isRunning = v4rules.includes('miaplus') || v6rules.includes('miaplus');

		m = new form.Map('miaplus', _('Internet Access Schedule Control Plus'), [
			E('p', {}, _('Access Schedule Control Description')),
			E('strong', {}, _('Service Status:')),
			E('font', { color: isRunning ? "green" : "red", style: "font-weight: bold;" },
				_(isRunning ? "RUNNING" : "NOT RUNNING"))
		]);

		s = m.section(form.TypedSection, 'basic');
		s.anonymous = true;

		o = s.option(form.Flag, 'enabled', _('Enable'));
		o.rmempty = false;

		o = s.option(form.Flag, 'strict', _('Strict Mode'),
			_('Better control but higher CPU usage'));
		o.rmempty = false;
		o.default = '1';

		o = s.option(form.Flag, 'ipv6enable', _('IPv6 Enabled'));
		o.rmempty = false;

		o = s.option(widgets.DeviceSelect, 'ifname', _('LAN Interface'),
			_('Select interface used for downstream control (LAN)'));
		o.multiple = false;
		o.noaliases = true;
		o.nocreate = true;
		o.rmempty = false;
		o.default = 'br-lan';
		o.filter = (d, v) => !/^(@|docker0|veth|teq|br-[0-9a-f]+)/.test(v);

		o = s.option(widgets.DeviceSelect, 'wan_interface', _('WAN Interface'),
			_('Select interface used for upstream control (WAN)'));
		o.multiple = false;
		o.noaliases = true;
		o.nocreate = true;
		o.rmempty = false;
		o.default = 'pppoe-wan';
		o.filter = (d, v) => !/^(@|docker0|veth|teq|br-[0-9a-f]+)/.test(v);

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
		o.width = '5%';

		o = s.option(form.Value, 'macaddr', _('MAC Address'), _('Default MAC priority'));
		L.sortedKeys(hosts).forEach(mac => {
			const host = hosts[mac];
			o.value(mac, E([], [mac, ' (', E('strong', {}, [
				host.name ||
				L.toArray(host.ipaddrs  || host.ipv4)[0] ||
				L.toArray(host.ip6addrs || host.ipv6)[0] || '?'
			]), ')']));
		});
		o.editable = true;
		o.datatype = 'macaddr';
		o.validate = function(d, v) {
			if (v !== '' && v != null) {
				const ip = s.formvalue(d, 'ipaddr');
				if (ip !== '' && ip != null)
					return _('MAC and IP cannot both be set; please leave one empty');
			}
			return true;
		};
		o.width = '20%';

		o = s.option(form.Value, 'ipaddr', _('IP Address'), _('If using IP, the MAC must be left blank'));
		const [ipv4Addrs, ipv4Labels] = fwtool.transformHostHints('ipv4', hosts);
		ipv4Addrs.forEach(ip => o.value(ip, ipv4Labels[ip]));
		o.editable = true;
		o.datatype = 'ip4addr';
		o.validate = function(d, v) {
			if (v !== '' && v != null) {
				const mac = s.formvalue(d, 'macaddr');
				if (mac !== '' && mac != null)
					return _('MAC and IP cannot both be set; please leave one empty');
			}
			return true;
		};
		o.width = '20%';

		o = s.option(form.Value, 'rate', _('Rate Limit'),
			_('Set the upper limit of traffic bandwidth (unit Mbps)'));
		o.rmempty = true;
		o.placeholder = '1';
		o.modalonly = true;
		o.validate = function(d, v) {
			if (v === '' || v == null)
				return true;
			const f = parseFloat(v);
			return (isFinite(f) && f > 0 && f <= 1000000)
				? true
				: _('Invalid rate: must be a positive number in Mbps');
		};

		o = s.option(form.Value, 'limit', _('Limit matching'),
			_('Limits traffic matching to the specified rate.'));
		o.modalonly = true;
		o.rmempty = true;
		o.placeholder = _('unlimited');
		o.value('10/second');
		o.value('60/minute');
		o.value('3/hour');
		o.value('500/day');
		o.validate = (d, v) => {
			if (v === '') return true;
			const m = String(v).toLowerCase().match(/^(?:0x[0-9a-f]{1,8}|[0-9]{1,10})\/([a-z]+)$/);
			return m && ['second', 'minute', 'hour', 'day'].some(u => u.startsWith(m[1]))
				? true
				: _('Invalid limit value');
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
		o.write = function (d, v) {
			return this.super('write', [d, L.toArray(v).join(' ')]);
		};
		o.width = '25%';

		o = s.option(form.MultiValue, 'monthdays', _('Month Days'));
		o.modalonly = true;
		o.multiple = true;
		o.editable = true;
		o.display_size = 15;
		o.placeholder = _('Any day');
		o.write = function (d, v) {
			return this.super('write', [d, L.toArray(v).join(' ')]);
		};
		for (let i = 1; i <= 31; i++) o.value(i);

		o = s.option(form.Value, 'start_time', _('Start time'));
		o.placeholder = '08:00';
		o.editable = true;
		o.validate = (d, v) => timeValue(v);
		o.width = '8%';

		o = s.option(form.Value, 'stop_time', _('Stop Time'));
		o.placeholder = '20:00';
		o.editable = true;
		o.validate = function(d, v) {
			const base = timeValue(v);
			if (base !== true) return base;
			if (v) {
				const st = s.formvalue(d, 'start_time');
				if (st && v <= st)
					return _('Stop time must be later than start time; cross-midnight ranges are not supported');
			}
			return true;
		};
		o.width = '8%';

		o = s.option(form.Value, 'start_date', _('Start Date'));
		o.modalonly = true;
		o.description = _('Date format: Year (required) → Month (optional) → Day (optional). <br>Examples: "2025", "2025-07", "2025-07-15"');
		o.validate = (d, v) => date(v);

		o = s.option(form.Value, 'stop_date', _('Stop Date'));
		o.modalonly = true;
		o.validate = (d, v) => date(v);

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
