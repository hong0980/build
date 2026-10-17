'use strict';
'require form';
'require view';
'require uci';
'require network';
'require tools.firewall as fwtool';
'require tools.nikki as nikki';

return view.extend({
    load: function () {
        return Promise.all([
            network.getHostHints(),
            network.getNetworks(),
            nikki.getIdentifiers(),
            uci.load('nikki'),
        ]);
    },
    render: function (data) {
        let m, s, o, so;
        const hosts    = data[0].hosts;
        const networks = data[1];
        const users    = data[2]?.users ?? [];
        const groups   = data[2]?.groups ?? [];
        const cgroups  = data[2]?.cgroups ?? [];

        m = new form.Map('nikki');
        s = m.section(form.NamedSection, 'proxy', 'proxy', _('Proxy Config'));

        s.tab('proxy', _('Proxy Config'));
        s.tab('router', _('Router Proxy'));
        s.tab('lan', _('LAN Proxy'));
        s.tab('bypass', _('Bypass'));
        s.tab('misc', _('Misc'));

        o = s.taboption('proxy', form.Flag, 'enabled', _('Enable'));
        o.rmempty = false;

        o = s.taboption('proxy', form.ListValue, 'tcp_mode', _('TCP Mode'));
        o.optional = true;
        o.placeholder = _('Disable');
        o.value('redirect', _('Redirect Mode'));
        o.value('tproxy', _('TPROXY Mode'));
        o.value('tun', _('TUN Mode'));

        o = s.taboption('proxy', form.ListValue, 'udp_mode', _('UDP Mode'));
        o.optional = true;
        o.placeholder = _('Disable');
        o.value('tproxy', _('TPROXY Mode'));
        o.value('tun', _('TUN Mode'));

        o = s.taboption('proxy', form.Flag, 'ipv4_dns_hijack', _('IPv4 DNS Hijack'));
        o.rmempty = false;

        o = s.taboption('proxy', form.Flag, 'ipv6_dns_hijack', _('IPv6 DNS Hijack'));
        o.rmempty = false;

        o = s.taboption('proxy', form.Flag, 'ipv4_proxy', _('IPv4 Proxy'));
        o.rmempty = false;

        o = s.taboption('proxy', form.Flag, 'ipv6_proxy', _('IPv6 Proxy'));
        o.rmempty = false;

        o = s.taboption('proxy', form.Flag, 'fake_ip_ping_hijack', _('Fake-IP Ping Hijack'));
        o.rmempty = false;

        o = s.taboption('router', form.Flag, 'router_proxy', _('Enable'));
        o.rmempty = false;

        o = s.taboption('router', form.SectionValue, '_router_access_control', form.TableSection, 'router_access_control', _('Access Control'));
        o.retain = true;
        o.depends('router_proxy', '1');

        o.subsection.addremove = true;
        o.subsection.anonymous = true;
        o.subsection.sortable = true;

        so = o.subsection.option(form.Flag, 'enabled', _('Enable'));
        so.default = '1';
        so.rmempty = false;

        so = o.subsection.option(form.DynamicList, 'user', _('User'));
        for (const user of users) so.value(user);

        so = o.subsection.option(form.DynamicList, 'group', _('Group'));
        for (const group of groups) so.value(group);

        so = o.subsection.option(form.DynamicList, 'cgroup', _('CGroup'));
        for (const cgroup of cgroups) so.value(cgroup);

        so = o.subsection.option(form.Flag, 'dns', _('DNS'));
        so.rmempty = false;

        so = o.subsection.option(form.Flag, 'proxy', _('Proxy'));
        so.rmempty = false;

        o = s.taboption('lan', form.Flag, 'lan_proxy', _('Enable'));
        o.rmempty = false;

        o = s.taboption('lan', form.DynamicList, 'lan_inbound_interface', _('Inbound Interface'));
        o.retain = true;
        o.rmempty = false;
        o.depends('lan_proxy', '1');
        for (const network of networks) {
            if (network.getName() === 'loopback') continue;
            o.value(network.getName());
        }

        o = s.taboption('lan', form.SectionValue, '_lan_access_control', form.TableSection, 'lan_access_control', _('Access Control'));
        o.retain = true;
        o.depends('lan_proxy', '1');

        o.subsection.addremove = true;
        o.subsection.anonymous = true;
        o.subsection.sortable = true;

        so = o.subsection.option(form.Flag, 'enabled', _('Enable'));
        so.default = '1';
        so.rmempty = false;

        so = o.subsection.option(form.DynamicList, 'mac', 'MAC');
        so.datatype = 'macaddr';
        L.sortedKeys(hosts).forEach(function(mac) {
            so.value(mac, E([], [ mac, ' (', E('strong', {}, [
                hosts[mac].name ||
                L.toArray(hosts[mac].ipaddrs  || hosts[mac].ipv4)[0] ||
                L.toArray(hosts[mac].ip6addrs || hosts[mac].ipv6)[0] ||
                '?'
            ]), ')' ]));
        });

        so = o.subsection.option(form.DynamicList, 'ip', 'IP4');
        so.datatype = 'ip4addr';
        const [ipv4Addrs, ipv4Labels] = fwtool.transformHostHints('ipv4', hosts);
        ipv4Addrs.forEach(ip => so.value(ip, ipv4Labels[ip]));

        so = o.subsection.option(form.DynamicList, 'ip6', 'IP6');
        so.datatype = 'ip6addr';
        const [ipv6Addrs, ipv6Labels] = fwtool.transformHostHints('ipv6', hosts);
        ipv6Addrs.forEach(ip => so.value(ip, ipv6Labels[ip]));

        so = o.subsection.option(form.Flag, 'dns', _('DNS'));
        so.rmempty = false;

        so = o.subsection.option(form.Flag, 'proxy', _('Proxy'));
        so.rmempty = false;

        o = s.taboption('bypass', form.Flag, 'bypass_china_mainland_ip', _('Bypass China Mainland IP'));
        o.rmempty = false;

        o = s.taboption('bypass', form.Flag, 'bypass_china_mainland_ip6', _('Bypass China Mainland IP6'));
        o.rmempty = false;

        o = s.taboption('bypass', form.Value, 'proxy_tcp_dport', _('Destination TCP Port to Proxy'));
        o.rmempty = false;
        o.value('0-65535', _('All Port'));
        o.value('21 22 80 110 143 194 443 465 853 993 995 8080 8443', _('Commonly Used Port'));

        o = s.taboption('bypass', form.Value, 'proxy_udp_dport', _('Destination UDP Port to Proxy'));
        o.rmempty = false;
        o.value('0-65535', _('All Port'));
        o.value('123 443 8443', _('Commonly Used Port'));

        o = s.taboption('bypass', form.DynamicList, 'bypass_dscp', _('Bypass DSCP'));
        o.datatype = 'range(0, 63)';

        o = s.taboption('bypass', form.DynamicList, 'bypass_fwmark', _('Bypass FWMark'));

        o = s.taboption('misc', form.Value, 'tun_timeout', _('TUN Timeout'));
        o.datatype = 'uinteger';
        o.rmempty = false;

        o = s.taboption('misc', form.Value, 'tun_interval', _('TUN Interval'));
        o.datatype = 'uinteger';
        o.rmempty = false;

        o = s.taboption('misc', form.DynamicList, 'reserved_ip', _('Reserved IP'));
        o.datatype = 'ip4addr';

        o = s.taboption('misc', form.DynamicList, 'reserved_ip6', _('Reserved IP6'));
        o.datatype = 'ip6addr';

        return m.render();
    }
});
