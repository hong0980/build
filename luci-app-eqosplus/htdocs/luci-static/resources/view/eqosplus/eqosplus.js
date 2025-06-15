'use strict';
'require fs';
'require view';
'require form';
'require network';
'require tools.widgets as widgets';

var CSS = `<style>
@media (min-width: 768px) {
    [data-name="upload"]   .cbi-input-text,
    [data-name="download"]  .cbi-input-text,
    [data-name="timeend"]  .cbi-input-text,
    [data-name="timestart"] .cbi-input-text {
        max-width: 55px !important;
        width: 100% !important;
    }
    [data-name="comment"] .cbi-input-text {
        max-width: 120px !important;
        width: 100% !important;
    }
    [data-name="week"] .cbi-dropdown {
        min-width: 80px !important;
        max-width: 80px !important;
        width: 100% !important;
    }
    [data-name="mac"] .cbi-dropdown {
        min-width: 160px !important;
        max-width: 160px !important;
        width: 100% !important;
    }
    td:has(.cbi-button-remove) {
        width: 50px !important;
    }
}
</style>`;

return view.extend({
    load: function() {
        return Promise.all([
            network.getHostHints(),
            network.getNetworks(),
            fs.exec_direct('/usr/bin/pgrep', ['eqosplus'])
        ])
    },

    render: function(data) {
        var hosts = data[0].hosts;
        var networks = data[1];
        var status = data[2];
        var m, s, o;

        m = new form.Map('eqosplus', _('Network speed limit') + CSS, [
            E('dvi', {},
                _('Users can limit the network speed for uploading/downloading through MAC, IP.The speed unit is MB/second.') +
                _("Suggested feedback:") +
                _("<a href=\'https://github.com/sirpdboy/luci-app-eqosplus.git' target=\'_blank\'>GitHub @sirpdboy/luci-app-eqosplus </a>"),
                E('a', { 'target': '_blank', 'style': 'margin-left: 10px;',
                    'href': 'https://github.com/sirpdboy/luci-app-eqosplus'
                }, _('GitHub @sirpdboy/luci-app-eqosplus'))
            ),
            E('br'),
            E('br'),
            E('font', { 'color': status ? "green" : "red", 'style': "font-weight:bold;"},
                _(status ? "Eqosplus RUNNING" : "Eqosplus NOT RUNNING")),
        ]);

        s = m.section(form.NamedSection, 'config', 'eqosplus');

        o = s.option(widgets.DeviceSelect, 'ifname', _("Interface"),
            _("Set the interface used for restriction, use pppoe-wan for dialing, use WAN hardware interface for DHCP mode (such as eth1), and use br-lan for bypass mode") +
            _('<br><font color=\"red\"><b>Not specified, automatically obtained</b></font>'));
        o.multiple = false;
        o.noaliases = true;
        o.modalonly = true;
        o.default = '';

        o = s.option(form.Value, "time", _("Inspection Interval"),
            _("Set the frequency for checking device status and applying rules. Shorter intervals provide quicker response but consume more system resources."));
        for (var i = 1; i <= 7; i++) {
            o.value(i.toString(), _("%d minute(s)").format(i));
        }
        o.default = '2';

        s = m.section(form.TableSection, 'device');
        s.addremove = true;
        s.anonymous = true;

        o = s.option(form.Flag, "enable", _("Enable"));
        o.rmempty = false;

        o = s.option(form.Value, "mac", _("IP/MAC"));
        for (var mac in hosts) {
            var host = hosts[mac];
            var ip = host.ipaddrs[0];
            var hint = host.name ?? ip;
            o.value(mac, hint ? '%s [ %s ] (%s)'.format(ip, mac, hint) : mac);
        };
        o.datatype = 'or(macaddr,ip4addr)';

        o = s.option(form.Value, "download", _("Downloads"));
        o.default = '0.1';
        o.datatype = "ufloat";

        o = s.option(form.Value, "upload", _("Uploads"));
        o.default = '0.1';
        o.datatype = "ufloat";

        o = s.option(form.Value, "timestart", _("Start control time"));
        o.placeholder = '00:00';
        o.default = '00:00';
        o.rmempty = true;
        o.validate = function(section_id, value) {
            return /^([01]\d|2[0-3]):([0-5]\d)$/.test(value) ? true : _('Invalid time format. Use HH:MM.');
        };

        o = s.option(form.Value, "timeend", _("Stop control time"));
        o.placeholder = '00:00';
        o.default = '00:00';
        o.rmempty = true;
        o.validate = function(section_id, value) {
            return /^([01]\d|2[0-3]):([0-5]\d)$/.test(value) ? true : _('Invalid time format. Use HH:MM.');
        };

        o=s.option(form.Value, "week", _("Week Day(1~7)"));
        o.rmempty = true;
        o.value('0', _("Everyday"));
        o.value('1', _("Monday"));
        o.value('2', _("Tuesday"));
        o.value('3', _("Wednesday"));
        o.value('4', _("Thursday"));
        o.value('5', _("Friday"));
        o.value('6', _("Saturday"));
        o.value('7', _("Sunday"));
        o.value('1,2,3,4,5', _("Workday"));
        o.value('0,6', _("Rest Day"));
        o.default='0';

        o= s.option(form.Value, "comment", _("Comment"));

        return m.render();
    }
});
