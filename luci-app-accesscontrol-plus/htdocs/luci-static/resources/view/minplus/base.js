'use strict';
'require fs';
'require form';
'require view';
'require network';

var CSS = `<style>
@media (min-width: 768px) {
	[data-name="timeon"]   .cbi-input-text,
	[data-name="timeoff"] .cbi-input-text {
		max-width: 75px !important;
		width: 100% !important;
	}
	[data-name="macaddr"] .cbi-dropdown {
		min-width: 200px !important;
		max-width: 200px !important;
		width: 100% !important;
	}
}
</style>`;

return view.extend({
	load: function() {
		return Promise.all([
			network.getHostHints(),
			fs.exec_direct('/usr/sbin/iptables', ['-L', 'INPUT'])
				.then(function(res) {
					return res.includes('MIAPLUS');
				})
		]);
	},

	render: function(data) {
		var hosts = data[0].hosts || {};
		var status = data[1] || false;
		var m, s, o;

		m = new form.Map('miaplus', _('Internet Access Schedule Control Plus') + CSS, [
			E('dvi', {}, _('Access Schedule Control Description')),
			E('br'), E('br'),
			E('font', { 'color': status ? "green" : "red", 'style': "font-weight:bold;"},
				_(status ? "%s RUNNING" : "%s NOT RUNNING").format(_("Internet Access Schedule Control Plus"))),
		]);


		s = m.section(form.TypedSection, 'basic', _('Basic Settings'));
		s.anonymous = true;

		o = s.option(form.Flag, 'enable', _('Enabled'));
		o.rmempty = false;

		o = s.option(form.Flag, 'strict', _('Strict Mode'));
		o.description = _('Strict Mode will degrade CPU performance, but it can achieve better results');
		o.rmempty = false;

		o = s.option(form.Flag, 'ipv6enable', _('IPv6 Enabled'));
		o.rmempty = false;

		s = m.section(form.TableSection, 'macbind', _('Client Rules'));
		s.anonymous = true;
		s.addremove = true;
		s.sortable = true;

		o = s.option(form.Flag, 'enable', _('Enabled'));
		o.rmempty = false;
		o.default = '1';

		o = s.option(form.Value, 'macaddr', _('MAC address (Computer Name)'));
		for (var mac in hosts) {
			var host = hosts[mac];
			var ip = host.ipaddrs[0];
			var hint = host.name ?? ip;
			o.value(mac, hint ? '%s [ %s ] (%s)'.format(ip, mac, hint) : mac);
		};
		o.datatype = 'macaddr';
		// o.datatype = 'or(macaddr,ip4addr)';
		o.rmempty = false;

		o = s.option(form.Value, "timeon", _("Start time"));
		o.default = '08:00';
		o.rmempty  = false;
		o.validate = function(section_id, value) {
			return /^([01]\d|2[0-3]):([0-5]\d)$/.test(value) ? true : _('Invalid time format. Use HH:MM.');
		};

		o = s.option(form.Value, "timeoff", _("End time"));
		o.default = '20:00';
		o.rmempty = false;
		o.validate = function(section_id, value) {
			return /^([01]\d|2[0-3]):([0-5]\d)$/.test(value) ? true : _('Invalid time format. Use HH:MM.');
		};

		o = s.option(form.MultiValue, 'control_date', _('Control date'));
		o.value('1', _('Monday'));
		o.value('2', _('Tuesday'));
		o.value('3', _('Wednesday'));
		o.value('4', _('Thursday'));
		o.value('5', _('Friday'));
		o.value('6', _('Saturday'));
		o.value('7', _('Sunday'));
		o.rmempty = false;
		o.optional = false;
		o.default = ["1", "2", "3", "4", "5", "6", "7"];

		return m.render();
	}
});
