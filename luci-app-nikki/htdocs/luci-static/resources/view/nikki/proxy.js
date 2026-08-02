'use strict';
'require form';
'require view';
'require uci';
'require network';
'require tools.widgets as widgets';
'require tools.nikki as nikki';

return view.extend({
    load: function () {
        return Promise.all([
            uci.load('nikki'),
            network.getHostHints(),
            network.getNetworks(),
            nikki.getIdentifiers(),
        ]);
    },
    render: function (data) {
        const hosts = data[1].hosts;
        const networks = data[2];
        const users = data[3]?.users ?? [];
        const groups = data[3]?.groups ?? [];
        const cgroups = data[3]?.cgroups ?? [];

        let m, s, o, so;

        m = new form.Map('nikki');

        s = m.section(form.NamedSection, 'proxy', 'proxy', _('Proxy Config'));

        /* ==================== Proxy Tab ==================== */
        s.tab('proxy', _('Proxy Config'));

        o = s.taboption('proxy', form.Flag, 'enabled', _('Enable'));
        o.rmempty = false;
        o.description = _('Enable or disable the entire Nikki proxy subsystem.');

        /* --- TCP Mode (RichListValue: 3 choices, each with description) --- */
        o = s.taboption('proxy', form.RichListValue, 'tcp_mode', _('TCP Mode'));
        o.optional = true;
        o.placeholder = _('Disable');
        o.value('redirect',
            _('Redirect Mode'),
            _('Rewrite destination address in NAT prerouting chain. ') +
            _('Pros: best performance, no policy routing required. ') +
            _('Cons: TCP only, cannot handle UDP or QUIC. ') +
            _('nftables: counter redirect to :port. ') +
            _('Recommended for stable LAN HTTP/HTTPS proxy.')
        );
        o.value('tproxy',
            _('TPROXY Mode'),
            _('Transparent proxy without changing packet destination. ') +
            _('Pros: supports TCP and UDP, works with Fake-IP. ') +
            _('Cons: requires fwmark and policy routing (table 81). ') +
            _('nftables: meta mark set ... tproxy to :port accept. ') +
            _('This is the recommended mode for most home routers.')
        );
        o.value('tun',
            _('TUN Mode'),
            _('Route packets into a virtual tunnel device. ') +
            _('Pros: best compatibility, works in all environments. ') +
            _('Cons: slightly higher CPU usage than TPROXY. ') +
            _('nftables: meta mark set ... accept, then routed via tun device. ') +
            _('Use this when TPROXY causes issues with Docker or custom kernels.')
        );

        /* --- UDP Mode (RichListValue: 2 choices) --- */
        o = s.taboption('proxy', form.RichListValue, 'udp_mode', _('UDP Mode'));
        o.optional = true;
        o.placeholder = _('Disable');
        o.value('tproxy',
            _('TPROXY Mode'),
            _('Transparent UDP proxy without NAT. ') +
            _('Required for DNS-over-HTTPS, QUIC, VoIP and online games. ') +
            _('Requires fwmark and ip rule fwmark 0x81 lookup 81. ') +
            _('nftables: matches UDP in mangle prerouting, sets fwmark, redirects to TPROXY port.')
        );
        o.value('tun',
            _('TUN Mode'),
            _('Send UDP packets into TUN device. ') +
            _('Use this when TPROXY causes issues with Docker or special kernels. ') +
            _('Trade-off: slightly higher latency than TPROXY. ') +
            _('nftables: marks UDP packets, routed into tun interface by kernel routing table.')
        );

        /* --- Flags (keep as Flag, use description) --- */
        o = s.taboption('proxy', form.Flag, 'ipv4_dns_hijack', _('IPv4 DNS Hijack'));
        o.rmempty = false;
        o.description = _('Intercept IPv4 UDP/53 DNS requests and redirect them to Nikki built-in DNS. Prevents DNS leaks.');

        o = s.taboption('proxy', form.Flag, 'ipv6_dns_hijack', _('IPv6 DNS Hijack'));
        o.rmempty = false;
        o.description = _('Intercept IPv6 UDP/53 DNS requests. Critical to avoid IPv6 DNS leaks when IPv6 proxy is enabled.');

        o = s.taboption('proxy', form.Flag, 'ipv4_proxy', _('IPv4 Proxy'));
        o.rmempty = false;
        o.description = _('Apply proxy rules to IPv4 traffic. nftables uses meta nfproto ipv4 to match.');

        o = s.taboption('proxy', form.Flag, 'ipv6_proxy', _('IPv6 Proxy'));
        o.rmempty = false;
        o.description = _('Apply proxy rules to IPv6 traffic. Requires proper IPv6 routing. Disable if your ISP has unstable IPv6.');

        o = s.taboption('proxy', form.Flag, 'fake_ip_ping_hijack', _('Fake-IP Ping Hijack'));
        o.rmempty = false;
        o.description = _('Redirect ICMP Echo Request to Fake-IP range. Prevents Fake-IP detection by ping probes.');

        /* ==================== Router Proxy Tab ==================== */
        s.tab('router', _('Router Proxy'));

        o = s.taboption('router', form.Flag, 'router_proxy', _('Enable'));
        o.rmempty = false;
        o.description = _('Enable proxy for traffic originating from the router itself (e.g. opkg, curl, Docker containers).');

        o = s.taboption('router', form.Flag, 'default_router_dns_enable', _('Default DNS Hijack'));
        o.default = '1';
        o.rmempty = false;
        o.depends('router_proxy', '1');
        o.description = _('Enable DNS hijacking for users not explicitly configured in access control lists. nftables: jump router_dns_hijack.');

        o = s.taboption('router', form.Flag, 'default_router_proxy_enable', _('Default Proxy Enable'));
        o.default = '1';
        o.rmempty = false;
        o.depends('router_proxy', '1');
        o.description = _('Enable proxy for users not explicitly configured. nftables: jump router_tproxy or router_redirect.');

        /* Whitelist */
        o = s.taboption('router', form.SectionValue, '_router_access_control', form.TableSection, 'router_access_control', _('Whitelist Access Control'));
        o.retain = true;
        o.depends('router_proxy', '1');
        o.description = _('Matched users are forced to use proxy and DNS. Priority: after blacklist, before default policy. nftables: router_access_control chain.');

        o.subsection.addremove = true;
        o.subsection.anonymous = true;
        o.subsection.sortable = true;

        so = o.subsection.option(form.Flag, 'enabled', _('Enable'));
        so.default = '1';
        so.rmempty = false;

        so = o.subsection.option(form.DynamicList, 'user', _('User'));
        for (const user of users) {
            so.value(user);
        }
        so.description = _('Match by system user ID (UID). Example: force a specific service account to use proxy.');

        so = o.subsection.option(form.DynamicList, 'group', _('Group'));
        for (const group of groups) {
            so.value(group);
        }
        so.description = _('Match by system group ID (GID).');

        so = o.subsection.option(form.DynamicList, 'cgroup', _('CGroup'));
        for (const cgroup of cgroups) {
            so.value(cgroup);
        }
        so.description = _('Match by cgroup path. Useful for Docker containers or systemd services. Requires cgroup v2.');

        so = o.subsection.option(form.Flag, 'dns', _('DNS'));
        so.rmempty = false;
        so.description = _('Whether this whitelist entry should also hijack DNS.');

        so = o.subsection.option(form.Flag, 'proxy', _('Proxy'));
        so.rmempty = false;
        so.description = _('Whether this whitelist entry should be proxied.');

        /* Blacklist */
        o = s.taboption('router', form.SectionValue, '_router_bypass_control', form.TableSection, 'router_bypass_control', _('Blacklist Bypass Control'));
        o.retain = true;
        o.depends('router_proxy', '1');
        o.description = _('Highest priority. Matched users bypass proxy immediately. Add root or ubus here to prevent locking yourself out. nftables: router_bypass_control chain.');

        o.subsection.addremove = true;
        o.subsection.anonymous = true;
        o.subsection.sortable = true;

        so = o.subsection.option(form.Flag, 'enabled', _('Enable'));
        so.default = '1';
        so.rmempty = false;

        so = o.subsection.option(form.DynamicList, 'user', _('User'));
        for (const user of users) {
            so.value(user);
        }
        so.description = _('Bypass proxy for these system users.');

        so = o.subsection.option(form.DynamicList, 'group', _('Group'));
        for (const group of groups) {
            so.value(group);
        }

        so = o.subsection.option(form.DynamicList, 'cgroup', _('CGroup'));
        for (const cgroup of cgroups) {
            so.value(cgroup);
        }

        /* ==================== LAN Proxy Tab ==================== */
        s.tab('lan', _('LAN Proxy'));

        o = s.taboption('lan', form.Flag, 'lan_proxy', _('Enable'));
        o.rmempty = false;
        o.description = _('Enable transparent proxy for devices on the local network.');

        o = s.taboption('lan', form.DynamicList, 'lan_inbound_interface', _('Inbound Interface'));
        o.retain = true;
        o.rmempty = false;
        o.depends('lan_proxy', '1');
        o.description = _('Only intercept traffic entering from these interfaces. nftables: iifname @lan_inbound_device. IMPORTANT: never select wan or loopback.');
        for (const network of networks) {
            if (network.getName() === 'loopback') {
                continue;
            }
            o.value(network.getName());
        }

        o = s.taboption('lan', form.Flag, 'default_lan_dns_enable', _('Default DNS Hijack'));
        o.default = '1';
        o.rmempty = false;
        o.depends('lan_proxy', '1');
        o.description = _('Enable DNS hijacking for devices not explicitly configured. Prevents smart TVs and phones from using public DNS servers.');

        o = s.taboption('lan', form.Flag, 'default_lan_proxy_enable', _('Default Proxy Enable'));
        o.default = '1';
        o.rmempty = false;
        o.depends('lan_proxy', '1');
        o.description = _('Enable proxy for devices not explicitly configured. nftables: jump lan_tproxy or lan_redirect.');

        /* LAN Whitelist */
        o = s.taboption('lan', form.SectionValue, '_lan_access_control', form.TableSection, 'lan_access_control', _('Whitelist Access Control'));
        o.retain = true;
        o.depends('lan_proxy', '1');
        o.description = _('Force specific devices (by IP, IPv6 or MAC) to use proxy and DNS. Example: Apple TV, game console, specific PC.');

        o.subsection.addremove = true;
        o.subsection.anonymous = true;
        o.subsection.sortable = true;

        so = o.subsection.option(form.Flag, 'enabled', _('Enable'));
        so.default = '1';
        so.rmempty = false;

        so = o.subsection.option(form.DynamicList, 'ip', _('IP'));
        so.datatype = 'ip4addr';
        so.description = _('Match by IPv4 address. nftables: ip saddr.');
        for (const mac in hosts) {
            const host = hosts[mac];
            for (const ip of host.ipaddrs) {
                const hint = host.name ?? mac;
                so.value(ip, hint ? '%s (%s)'.format(ip, hint) : ip);
            }
        }

        so = o.subsection.option(form.DynamicList, 'ip6', _('IPv6'));
        so.datatype = 'ip6addr';
        so.description = _('Match by IPv6 address. nftables: ip6 saddr.');
        for (const mac in hosts) {
            const host = hosts[mac];
            for (const ip of host.ip6addrs) {
                const hint = host.name ?? mac;
                so.value(ip, hint ? '%s (%s)'.format(ip, hint) : ip);
            }
        }

        so = o.subsection.option(form.DynamicList, 'mac', _('MAC'));
        so.datatype = 'macaddr';
        so.description = _('Match by MAC address. nftables: ether saddr.');
        for (const mac in hosts) {
            const host = hosts[mac];
            const hint = host.name ?? host.ipaddrs[0];
            so.value(mac, hint ? '%s (%s)'.format(mac, hint) : mac);
        }

        so = o.subsection.option(form.Flag, 'dns', _('DNS'));
        so.rmempty = false;

        so = o.subsection.option(form.Flag, 'proxy', _('Proxy'));
        so.rmempty = false;

        /* LAN Blacklist */
        o = s.taboption('lan', form.SectionValue, '_lan_bypass_control', form.TableSection, 'lan_bypass_control', _('Blacklist Bypass Control'));
        o.retain = true;
        o.depends('lan_proxy', '1');
        o.description = _('Highest priority. Devices listed here bypass proxy. Example: NAS (SMB performance), printer, IoT devices, game console with NAT issues.');

        o.subsection.addremove = true;
        o.subsection.anonymous = true;
        o.subsection.sortable = true;

        so = o.subsection.option(form.Flag, 'enabled', _('Enable'));
        so.default = '1';
        so.rmempty = false;

        so = o.subsection.option(form.DynamicList, 'ip', _('IP'));
        so.datatype = 'ip4addr';
        so.description = _('Bypass proxy for these IPv4 addresses.');
        for (const mac in hosts) {
            const host = hosts[mac];
            for (const ip of host.ipaddrs) {
                const hint = host.name ?? mac;
                so.value(ip, hint ? '%s (%s)'.format(ip, hint) : ip);
            }
        }

        so = o.subsection.option(form.DynamicList, 'ip6', _('IPv6'));
        so.datatype = 'ip6addr';
        so.description = _('Bypass proxy for these IPv6 addresses.');
        for (const mac in hosts) {
            const host = hosts[mac];
            for (const ip of host.ip6addrs) {
                const hint = host.name ?? mac;
                so.value(ip, hint ? '%s (%s)'.format(ip, hint) : ip);
            }
        }

        so = o.subsection.option(form.DynamicList, 'mac', _('MAC'));
        so.datatype = 'macaddr';
        so.description = _('Bypass proxy for these MAC addresses.');
        for (const mac in hosts) {
            const host = hosts[mac];
            const hint = host.name ?? host.ipaddrs[0];
            so.value(mac, hint ? '%s (%s)'.format(mac, hint) : mac);
        }

        /* ==================== Bypass Tab ==================== */
        s.tab('bypass', _('Bypass'));

        o = s.taboption('bypass', form.Flag, 'bypass_china_mainland_ip', _('Bypass China Mainland IPv4'));
        o.rmempty = false;
        o.description = _('Skip proxy for Chinese mainland IPv4 addresses. nftables: ip daddr @china_ip counter return. Highly recommended for better performance.');

        o = s.taboption('bypass', form.Flag, 'bypass_china_mainland_ip6', _('Bypass China Mainland IPv6'));
        o.rmempty = false;
        o.description = _('Skip proxy for Chinese mainland IPv6 addresses. nftables: ip6 daddr @china_ip6 counter return.');

        /* TCP Port (RichListValue) */
        o = s.taboption('bypass', form.RichListValue, 'proxy_tcp_dport', _('Destination TCP Port to Proxy'));
        o.rmempty = false;
        o.value('0-65535',
            _('All Ports'),
            _('Proxy all TCP ports. Highest conntrack load. Use only when you need every TCP connection proxied.')
        );
        o.value('21 22 80 110 143 194 443 465 853 993 995 8080 8443',
            _('Commonly Used Ports'),
            _('Balanced option. Covers HTTP, HTTPS, FTP, SSH, SMTP, IMAP, POP3, DoH. Recommended for most users.')
        );
        o.description = _('Only proxy traffic destined to these TCP ports. nftables: meta l4proto . th dport != @proxy_dport return.');

        /* UDP Port (RichListValue) */
        o = s.taboption('bypass', form.RichListValue, 'proxy_udp_dport', _('Destination UDP Port to Proxy'));
        o.rmempty = false;
        o.value('0-65535',
            _('All Ports'),
            _('Proxy all UDP ports. High conntrack load. Use only when you need every UDP packet proxied.')
        );
        o.value('123 443 8443',
            _('Commonly Used Ports'),
            _('DNS (QUIC), DoH, gaming. Recommended. Keeps conntrack table small.')
        );
        o.description = _('Only proxy traffic destined to these UDP ports. nftables: meta l4proto . th dport != @proxy_dport return.');

        o = s.taboption('bypass', form.DynamicList, 'bypass_dscp', _('Bypass DSCP'));
        o.datatype = 'range(0, 63)';
        o.description = _('Packets with these DSCP values bypass proxy. Advanced usage for QoS integration. nftables: ip dscp @bypass_dscp return.');

        o = s.taboption('bypass', form.DynamicList, 'bypass_fwmark', _('Bypass FWMark'));
        o.description = _('Packets already marked with these fwmarks bypass proxy. Useful for Docker, WireGuard or other VPN coexistence. nftables: meta mark & mask == fwmark return.');

        /* ==================== Misc Tab ==================== */
        s.tab('misc', _('Misc'));

        o = s.taboption('misc', form.DynamicList, 'reserved_ip', _('Reserved IPv4'));
        o.datatype = 'ip4addr';
        o.description = _('Private and internal IPv4 addresses that always bypass proxy. nftables: ip daddr @reserved_ip counter return.');

        o = s.taboption('misc', form.DynamicList, 'reserved_ip6', _('Reserved IPv6'));
        o.datatype = 'ip6addr';
        o.description = _('Private and internal IPv6 addresses that always bypass proxy. nftables: ip6 daddr @reserved_ip6 counter return.');

        o = s.taboption('misc', form.Value, 'tun_timeout', _('TUN Timeout'));
        o.datatype = 'uinteger';
        o.rmempty = false;
        o.description = _('Idle timeout for TUN connections in seconds. Connections with no data for this long will be closed.');

        o = s.taboption('misc', form.Value, 'tun_interval', _('TUN Interval'));
        o.datatype = 'uinteger';
        o.rmempty = false;
        o.description = _('Interval in seconds for cleaning up dead TUN connections.');

        return m.render();
    }
});
