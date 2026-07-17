'use strict';
'require form';
'require view';
'require uci';
'require fs';
'require ui';
'require network';
'require tools.widgets as widgets';
'require tools.nikki as nikki';

const RULE_TYPES = /^(RULE-SET|DOMAIN|DOMAIN-SUFFIX|DOMAIN-WILDCARD|DOMAIN-KEYWORD|DOMAIN-REGEX|IP-CIDR|DST-PORT|PROCESS-NAME|GEOSITE|GEOIP|MATCH)$/i;

function normalizePath(path) {
    if (!path) return path;

    path = path.trim();
    const isDir = /\/$/.test(path) || !path.includes('/');
    path = path.replace(/^\.?\/+/, '').replace(/\/+$/, '');

    if (!path) return path;
    return './' + path + (isDir ? '/' : '');
}

function parseRuleLine(line) {
    let l = line.trim();
    if (!l || /^#/.test(l)) return { skip: true };

    l = l.replace(/^-\s*/, '');
    l = l.replace(/\s*#.*$/, '');
    l = l.replace(/^["']|["']$/g, '');

    const parts = l.split(',').map(s => s.trim());
    if (parts.length < 2)
        return { error: _('At least 2 fields separated by commas are required (type,matcher[,node]).') };

    const type = parts[0].toUpperCase();
    if (!RULE_TYPES.test(type))
        return { error: _('Unknown rule type: %s').format(parts[0]) };

    let no_resolve = false;
    if (/^no-resolve$/i.test(parts[parts.length - 1])) {
        no_resolve = true;
        parts.pop();
    }

    if (parts.length < 3)
        return { error: _('Missing node/policy field (type,matcher,node).') };

    return { config: { type, matcher: parts[1], node: parts[2], no_resolve } };
}

function toRuleProviderConfig(cfg) {
    if (!cfg.name) return { error: _('Missing provider name.') };
    if (cfg.type !== 'http')
        return { error: _('Only "%s" type is supported here; "%s" will be skipped.').format('http', cfg.type || '(none)') };
    if (!cfg.url) return { error: _('Missing "url" field.') };

    const format = /^(text|yaml|mrs)$/.test(cfg.format);
    const behavior = /^(classical|domain|ipcidr)$/.test(cfg.behavior);

    return {
        config: {
            name: cfg.name,
            type: 'http',
            url: cfg.url,
            path: cfg.path,
            node: cfg.proxy || 'DIRECT',
            file_format: format || 'mrs',
            behavior: behavior || 'domain',
            file_size_limit: cfg['size-limit'] || '0',
            update_interval: cfg.interval || '86400'
        }
    };
}

function parseRuleProviderYaml(text) {
    const raw_lines = text.split('\n');

    let start = 0;
    while (start < raw_lines.length && !raw_lines[start].trim()) start++;
    if (/^rule-providers\s*:\s*$/.test(raw_lines[start] || '')) start++;

    const lines = raw_lines.slice(start).filter(l => l.trim() && !/^\s*#/.test(l));
    if (!lines.length) return [];

    const providers = [];
    let current = null;
    const nameRe = /^(\s*)([^\s:#][^:]*):\s*$/;
    const kvRe = /^(\s*)([\w-]+):\s*(.+?)\s*$/;
    const baseIndent = (lines[0].match(/^(\s*)/) || ['', ''])[1].length;

    for (const line of lines) {
        const indent = (line.match(/^(\s*)/) || ['', ''])[1].length;
        const nameMatch = line.match(nameRe);

        if (nameMatch && indent === baseIndent) {
            current = { name: nameMatch[2].trim() };
            providers.push(current);
            continue;
        }

        if (current && indent > baseIndent) {
            const kvMatch = line.match(kvRe);
            if (kvMatch) {
                let val = kvMatch[3].replace(/\s+#.*$/, '').replace(/^["']|["']$/g, '');
                current[kvMatch[2]] = val;
            }
        }
    }

    return providers;
}

return view.extend({
    load: function () {
        return Promise.all([
            network.getNetworks(),
            nikki.listfiles(nikki.profilesDir),
            nikki.listfiles(nikki.subscriptionsDir),
            uci.load('nikki')
        ]);
    },
    render: function ([networks, profiles, subfiles]) {
        let m, s, o, so;

        m = new form.Map('nikki');

        s = m.section(form.NamedSection, 'mixin', 'mixin', _('Mixin Option'));
        s.tab('general', _('General Config'));
        s.tab('external_control', _('External Control Config'));
        s.tab('dns', _('DNS Config'));
        s.tab('inbound', _('Inbound Config'));
        s.tab('tun', _('TUN Config'));
        s.tab('sniffer', _('Sniffer Config'));
        s.tab('geox', _('GeoX Config'));
        s.tab('rule', _('Rule Config'));

        o = s.taboption('general', form.ListValue, 'mode', _('Mode'));
        o.optional = true;
        o.placeholder = _('Unmodified');
        o.value('global', _('Global Mode'));
        o.value('rule', _('Rule Mode'));
        o.value('direct', _('Direct Mode'));

        o = s.taboption('general', form.ListValue, 'match_process', _('Match Process'));
        o.optional = true;
        o.placeholder = _('Unmodified');
        o.value('always', _('Enable'));
        o.value('strict', _('Auto'));
        o.value('off', _('Disable'));

        o = s.taboption('general', form.ListValue, 'log_level', _('Log Level'));
        o.optional = true;
        o.placeholder = _('Unmodified');
        o.value('silent', _('Silent'));
        o.value('error', _('Error'));
        o.value('warning', _('Warning'));
        o.value('info', _('Info'));
        o.value('debug', _('Debug'));

        o = s.taboption('general', form.ListValue, 'outbound_interface', _('Outbound Interface'));
        o.optional = true;
        o.placeholder = _('Unmodified');

        for (const network of networks) {
            if (network.getName() === 'loopback') continue;
            o.value(network.getName());
        }

        o = s.taboption('general', form.ListValue, 'ipv6', 'IPv6');
        o.optional = true;
        o.placeholder = _('Unmodified');
        o.value('0', _('Disable'));
        o.value('1', _('Enable'));

        o = s.taboption('general', form.ListValue, 'unify_delay', _('Unify Delay'));
        o.optional = true;
        o.placeholder = _('Unmodified');
        o.value('0', _('Disable'));
        o.value('1', _('Enable'));

        o = s.taboption('general', form.ListValue, 'tcp_concurrent', _('TCP Concurrent'));
        o.optional = true;
        o.placeholder = _('Unmodified');
        o.value('0', _('Disable'));
        o.value('1', _('Enable'));

        o = s.taboption('general', form.ListValue, 'disable_tcp_keep_alive', _('Disable TCP Keep Alive'));
        o.optional = true;
        o.placeholder = _('Unmodified');
        o.value('0', _('Disable'));
        o.value('1', _('Enable'));

        o = s.taboption('general', form.Value, 'tcp_keep_alive_idle', _('TCP Keep Alive Idle'), _('In seconds.'));
        o.datatype = 'uinteger';
        o.placeholder = _('Unmodified');

        o = s.taboption('general', form.Value, 'tcp_keep_alive_interval', _('TCP Keep Alive Interval'), _('In seconds.'));
        o.datatype = 'uinteger';
        o.placeholder = _('Unmodified');

        o = s.taboption('external_control', form.Value, 'ui_path', _('UI Path'));
        o.placeholder = _('Unmodified');

        o = s.taboption('external_control', form.Value, 'ui_name', _('UI Name'));
        o.placeholder = _('Unmodified');

        o = s.taboption('external_control', form.Value, 'ui_url', _('UI Url'));
        o.placeholder = _('Unmodified');
        nikki.ui_array.forEach(([url, name]) => o.value(url, name));
        o.onchange = function (ev, section_id, value) {
            var lEl = s.getUIElement(section_id, 'ui_name');
            if (!lEl) return;

            var matched = nikki.ui_array.find(([url]) => url === value);
            lEl.setValue(matched ? matched[1] : '');
        };

        o = s.taboption('external_control', form.Value, 'api_listen', _('API Listen'));
        o.datatype = 'ipaddrport(1)';
        o.placeholder = _('Unmodified');

        o = s.taboption('external_control', form.Value, 'api_tls_listen', _('API TLS Listen'));
        o.datatype = 'ipaddrport(1)';
        o.placeholder = _('Unmodified');

        o = s.taboption('external_control', form.Value, 'api_tls_cert', _('API TLS Cert'));
        o.placeholder = _('Unmodified');

        o = s.taboption('external_control', form.Value, 'api_tls_key', _('API TLS Key'));
        o.placeholder = _('Unmodified');

        o = s.taboption('external_control', form.Value, 'api_tls_ech_key', _('API TLS ECH Key'));
        o.placeholder = _('Unmodified');

        o = s.taboption('external_control', form.Value, 'api_secret', _('API Secret'));
        o.password = true;
        o.placeholder = _('Unmodified');

        o = s.taboption('external_control', form.ListValue, 'selection_cache', _('Save Proxy Selection'));
        o.optional = true;
        o.placeholder = _('Unmodified');
        o.value('0', _('Disable'));
        o.value('1', _('Enable'));

        o = s.taboption('inbound', form.ListValue, 'allow_lan', _('Allow Lan'));
        o.optional = true;
        o.placeholder = _('Unmodified');
        o.value('0', _('Disable'));
        o.value('1', _('Enable'));

        o = s.taboption('inbound', form.Value, 'http_port', _('HTTP Port'));
        o.datatype = 'port';
        o.placeholder = _('Unmodified');

        o = s.taboption('inbound', form.Value, 'socks_port', _('SOCKS Port'));
        o.datatype = 'port';
        o.placeholder = _('Unmodified');

        o = s.taboption('inbound', form.Value, 'mixed_port', _('Mixed Port'));
        o.datatype = 'port';
        o.placeholder = _('Unmodified');

        o = s.taboption('inbound', form.Value, 'redir_port', _('Redirect Port'));
        o.datatype = 'port';
        o.placeholder = _('Unmodified');

        o = s.taboption('inbound', form.Value, 'tproxy_port', _('TPROXY Port'));
        o.datatype = 'port';
        o.placeholder = _('Unmodified');

        o = s.taboption('inbound', form.Flag, 'authentication', _('Overwrite Authentication'));
        o.rmempty = false;

        o = s.taboption('inbound', form.SectionValue, '_authentications', form.TableSection, 'authentication', _('Edit Authentications'));
        o.retain = true;
        o.depends('authentication', '1');

        o.subsection.addremove = true;
        o.subsection.anonymous = true;
        o.subsection.sortable = true;

        so = o.subsection.option(form.Flag, 'enabled', _('Enable'));
        so.rmempty = false;

        so = o.subsection.option(form.Value, 'username', _('Username'));
        so.rmempty = false;

        so = o.subsection.option(form.Value, 'password', _('Password'));
        so.password = true;
        so.rmempty = false;

        o = s.taboption('tun', form.ListValue, 'tun_enabled', _('Enable'));
        o.optional = true;
        o.placeholder = _('Unmodified');
        o.value('0', _('Disable'));
        o.value('1', _('Enable'));

        o = s.taboption('tun', form.Value, 'tun_device', _('Device Name'));
        o.placeholder = _('Unmodified');

        o = s.taboption('tun', form.ListValue, 'tun_stack', _('Stack'));
        o.optional = true;
        o.placeholder = _('Unmodified');
        o.value('system', 'System');
        o.value('gvisor', 'gVisor');
        o.value('mixed', 'Mixed');

        o = s.taboption('tun', form.Value, 'tun_mtu', _('MTU'));
        o.datatype = 'uinteger';
        o.placeholder = _('Unmodified');

        o = s.taboption('tun', form.ListValue, 'tun_gso', _('GSO'));
        o.optional = true;
        o.placeholder = _('Unmodified');
        o.value('0', _('Disable'));
        o.value('1', _('Enable'));

        o = s.taboption('tun', form.Value, 'tun_gso_max_size', _('GSO Max Size'));
        o.datatype = 'uinteger';
        o.placeholder = _('Unmodified');

        o = s.taboption('tun', form.Flag, 'tun_dns_hijack', _('Overwrite DNS Hijack'));
        o.rmempty = false;

        o = s.taboption('tun', form.DynamicList, 'tun_dns_hijacks', _('Edit DNS Hijacks'));
        o.retain = true;
        o.depends('tun_dns_hijack', '1');
        o.value('tcp://any:53');
        o.value('any:53');


        o = s.taboption('dns', form.ListValue, 'dns_enabled', _('Enable'));
        o.optional = true;
        o.placeholder = _('Unmodified');
        o.value('0', _('Disable'));
        o.value('1', _('Enable'));

        o = s.taboption('dns', form.ListValue, 'dns_cache_algorithm', _('DNS Cache Algorithm'));
        o.optional = true;
        o.placeholder = _('Unmodified');
        o.value('lru', _('Least Recently Used (LRU)'));
        o.value('arc', _('Adaptive Replacement Cache (ARC)'));

        o = s.taboption('dns', form.Value, 'dns_listen', _('DNS Listen'));
        o.datatype = 'ipaddrport(1)';
        o.placeholder = _('Unmodified');

        o = s.taboption('dns', form.ListValue, 'dns_ipv6', 'IPv6');
        o.optional = true;
        o.placeholder = _('Unmodified');
        o.value('0', _('Disable'));
        o.value('1', _('Enable'));

        o = s.taboption('dns', form.ListValue, 'dns_mode', _('DNS Mode'));
        o.optional = true;
        o.placeholder = _('Unmodified');
        o.value('redir-host', 'Redir-Host');
        o.value('fake-ip', 'Fake-IP');

        o = s.taboption('dns', form.Value, 'fake_ip_range', _('Fake-IP Range'));
        o.datatype = 'cidr4';
        o.placeholder = _('Unmodified');

        o = s.taboption('dns', form.Value, 'fake_ip6_range', _('Fake-IP6 Range'));
        o.datatype = 'cidr6';
        o.placeholder = _('Unmodified');

        o = s.taboption('dns', form.Value, 'fake_ip_ttl', _('Fake-IP TTL'));
        o.datatype = 'uinteger';
        o.placeholder = _('Unmodified');

        o = s.taboption('dns', form.Flag, 'fake_ip_filter', _('Overwrite Fake-IP Filter'));
        o.rmempty = false;

        o = s.taboption('dns', form.DynamicList, 'fake_ip_filters', _('Edit Fake-IP Filters'));
        o.retain = true;
        o.depends('fake_ip_filter', '1');

        o = s.taboption('dns', form.ListValue, 'fake_ip_filter_mode', _('Fake-IP Filter Mode'));
        o.optional = true;
        o.placeholder = _('Unmodified');
        o.value('blacklist', _('Block Mode'));
        o.value('whitelist', _('Allow Mode'));
        o.value('rule', _('Rule Mode'));

        o = s.taboption('dns', form.ListValue, 'fake_ip_cache', _('Fake-IP Cache'));
        o.optional = true;
        o.placeholder = _('Unmodified');
        o.value('0', _('Disable'));
        o.value('1', _('Enable'));

        o = s.taboption('dns', form.ListValue, 'dns_respect_rules', _('Respect Rules'));
        o.optional = true;
        o.placeholder = _('Unmodified');
        o.value('0', _('Disable'));
        o.value('1', _('Enable'));

        o = s.taboption('dns', form.ListValue, 'dns_doh_prefer_http3', _('DoH Prefer HTTP/3'));
        o.optional = true;
        o.placeholder = _('Unmodified');
        o.value('0', _('Disable'));
        o.value('1', _('Enable'));

        o = s.taboption('dns', form.ListValue, 'dns_system_hosts', _('Use System Hosts'));
        o.optional = true;
        o.placeholder = _('Unmodified');
        o.value('0', _('Disable'));
        o.value('1', _('Enable'));

        o = s.taboption('dns', form.ListValue, 'dns_hosts', _('Use Hosts'));
        o.optional = true;
        o.placeholder = _('Unmodified');
        o.value('0', _('Disable'));
        o.value('1', _('Enable'));

        o = s.taboption('dns', form.Flag, 'hosts', _('Overwrite Hosts'));
        o.rmempty = false;

        o = s.taboption('dns', form.SectionValue, '_hosts', form.TableSection, 'hosts', _('Edit Hosts'));
        o.retain = true;
        o.depends('hosts', '1');

        o.subsection.addremove = true;
        o.subsection.anonymous = true;
        o.subsection.sortable = true;

        so = o.subsection.option(form.Flag, 'enabled', _('Enable'));
        so.rmempty = false;

        so = o.subsection.option(form.Value, 'domain_name', _('Domain Name'));
        so.rmempty = false;

        so = o.subsection.option(form.DynamicList, 'ip', 'IP');

        o = s.taboption('dns', form.Flag, 'dns_nameserver', _('Overwrite Nameserver'));
        o.rmempty = false;

        o = s.taboption('dns', form.SectionValue, '_dns_nameservers', form.TableSection, 'nameserver', _('Edit Nameservers'));
        o.retain = true;
        o.depends('dns_nameserver', '1');

        o.subsection.addremove = true;
        o.subsection.anonymous = true;
        o.subsection.sortable = true;

        so = o.subsection.option(form.Flag, 'enabled', _('Enable'));
        so.rmempty = false;

        so = o.subsection.option(form.ListValue, 'type', _('Type'));
        so.value('default-nameserver');
        so.value('proxy-server-nameserver');
        so.value('direct-nameserver');
        so.value('nameserver');
        so.value('fallback');

        so = o.subsection.option(form.DynamicList, 'nameserver', _('Nameserver'));

        o = s.taboption('dns', form.Flag, 'dns_proxy_server_nameserver_policy', _('Overwrite Proxy Server Nameserver Policy'));
        o.rmempty = false;

        o = s.taboption('dns', form.SectionValue, '_dns_proxy_server_nameserver_policies', form.TableSection, 'proxy_server_nameserver_policy', _('Edit Proxy Server Nameserver Policies'));
        o.retain = true;
        o.depends('dns_proxy_server_nameserver_policy', '1');

        o.subsection.addremove = true;
        o.subsection.anonymous = true;
        o.subsection.sortable = true;

        so = o.subsection.option(form.Flag, 'enabled', _('Enable'));
        so.rmempty = false;

        so = o.subsection.option(form.Value, 'matcher', _('Matcher'));
        so.rmempty = false;

        so = o.subsection.option(form.DynamicList, 'nameserver', _('Nameserver'));

        o = s.taboption('dns', form.ListValue, 'dns_direct_nameserver_follow_policy', _('Direct Nameserver Follow Policy'));
        o.optional = true;
        o.placeholder = _('Unmodified');
        o.value('0', _('Disable'));
        o.value('1', _('Enable'));

        o = s.taboption('dns', form.Flag, 'dns_nameserver_policy', _('Overwrite Nameserver Policy'));
        o.rmempty = false;

        o = s.taboption('dns', form.SectionValue, '_dns_nameserver_policies', form.TableSection, 'nameserver_policy', _('Edit Nameserver Policies'));
        o.retain = true;
        o.depends('dns_nameserver_policy', '1');

        o.subsection.addremove = true;
        o.subsection.anonymous = true;
        o.subsection.sortable = true;

        so = o.subsection.option(form.Flag, 'enabled', _('Enable'));
        so.rmempty = false;

        so = o.subsection.option(form.Value, 'matcher', _('Matcher'));
        so.rmempty = false;

        so = o.subsection.option(form.DynamicList, 'nameserver', _('Nameserver'));

        o = s.taboption('dns', form.Flag, 'wanDns', _('覆盖 nameserver'), _('使用运营商提供的 DNS 为 nameserver（优先）'));
        o.default = o.disabled;

        o = s.taboption('sniffer', form.ListValue, 'sniffer', _('Enable'));
        o.optional = true;
        o.placeholder = _('Unmodified');
        o.value('0', _('Disable'));
        o.value('1', _('Enable'));

        o = s.taboption('sniffer', form.ListValue, 'sniffer_sniff_dns_mapping', _('Sniff Redir-Host'));
        o.optional = true;
        o.placeholder = _('Unmodified');
        o.value('0', _('Disable'));
        o.value('1', _('Enable'));

        o = s.taboption('sniffer', form.ListValue, 'sniffer_sniff_pure_ip', _('Sniff Pure IP'));
        o.optional = true;
        o.placeholder = _('Unmodified');
        o.value('0', _('Disable'));
        o.value('1', _('Enable'));

        o = s.taboption('sniffer', form.Flag, 'sniffer_force_domain_name', _('Overwrite Force Sniff Domain Name'));
        o.rmempty = false;

        o = s.taboption('sniffer', form.DynamicList, 'sniffer_force_domain_names', _('Force Sniff Domain Name'));
        o.retain = true;
        o.depends('sniffer_force_domain_name', '1');

        o = s.taboption('sniffer', form.Flag, 'sniffer_ignore_domain_name', _('Overwrite Ignore Sniff Domain Name'));
        o.rmempty = false;

        o = s.taboption('sniffer', form.DynamicList, 'sniffer_ignore_domain_names', _('Ignore Sniff Domain Name'));
        o.retain = true;
        o.depends('sniffer_ignore_domain_name', '1');

        o = s.taboption('sniffer', form.Flag, 'sniffer_sniff', _('Overwrite Sniff By Protocol'));
        o.rmempty = false;

        o = s.taboption('sniffer', form.SectionValue, '_sniffer_sniffs', form.TableSection, 'sniff', _('Sniff By Protocol'));
        o.retain = true;
        o.depends('sniffer_sniff', '1');

        o.subsection.anonymous = true;
        o.subsection.addremove = false;

        so = o.subsection.option(form.Flag, 'enabled', _('Enable'));
        so.rmempty = false;

        so = o.subsection.option(form.ListValue, 'protocol', _('Protocol'));
        so.value('HTTP');
        so.value('TLS');
        so.value('QUIC');
        so.readonly = true;

        so = o.subsection.option(form.DynamicList, 'port', _('Port'));
        so.datatype = 'portrange';

        so = o.subsection.option(form.Flag, 'overwrite_destination', _('Overwrite Destination'));
        so.rmempty = false;

        o = s.taboption('rule', form.Flag, 'rule', _('Append Rule'));
        o.rmempty = false;

        o = s.taboption('rule', form.SectionValue, '_rules', form.TableSection, 'rule', _('Edit Rules'));
        o.retain = true;
        o.depends('rule', '1');

        o.subsection.anonymous = true;
        o.subsection.addremove = true;
        o.subsection.sortable = true;

        /* Import mihomo config START */
        o.subsection.handleRuleImport = function () {
            const section = this;
            const textarea = E('textarea', {
                'style': 'width:100%; height:260px; font-family: Consolas;',
                'placeholder':
                    'rules:\n' +
                    '  - RULE-SET,netflix_domain,流媒体\n' +
                    '  - DOMAIN-SUFFIX,google.com,DIRECT\n' +
                    '  - GEOIP,cn,DIRECT,no-resolve\n'
            });

            ui.showModal(_('Import mihomo config'), [
                E('p', {}, _('Please paste the %s field of a mihomo config, one rule per line.').format('<code>rules</code>')),
                textarea,
                E('div', { 'class': 'button-row' }, [
                    E('button', {
                        'class': 'btn cbi-button-action important',
                        'click': ui.createHandlerFn(section, function () {
                            const raw_lines = textarea.value.split('\n');
                            let count = 0, total = 0;
                            const errors = [];

                            raw_lines.forEach((line, idx) => {
                                if (!line.trim() || /^\s*rules\s*:\s*$/i.test(line)) return;
                                total++;

                                const result = parseRuleLine(line);
                                if (result.skip) { total--; return; }

                                if (result.error) {
                                    errors.push({ lineNo: idx + 1, text: line.trim(), reason: result.error });
                                    return;
                                }

                                const config = result.config;
                                const sid = uci.add('nikki', 'rule');
                                uci.set('nikki', sid, 'enabled', '1');
                                uci.set('nikki', 'mixin', 'rule', '1');
                                for (const k in config)
                                    uci.set('nikki', sid, k, config[k]);
                                if (config.no_resolve) uci.set('nikki', sid, 'no_resolve', '1');

                                count++;
                            });

                            if (count === 0 && errors.length === 0) {
                                ui.hideModal();
                                return ui.addNotification(null, E('p', _('No valid rule found.')));
                            }

                            if (count > 0) {
                                ui.addNotification(null, E('p',
                                    _('Successfully imported %s of %s line(s).').format(count, total)), 'info');
                            }

                            if (errors.length > 0) {
                                ui.addNotification(null, E('div', {}, [
                                    E('p', {}, _('%s line(s) failed:').format(errors.length)),
                                    E('ul', {}, errors.map(e => E('li', {},
                                        _('Line %s: %s — %s').format(e.lineNo, e.text, e.reason))))
                                ]), 'warning');
                            }

                            if (count === 0) return ui.hideModal();

                            return uci.save()
                                .then(L.bind(section.map.load, section.map))
                                .then(L.bind(section.map.reset, section.map))
                                .then(L.ui.hideModal)
                                .catch(() => {});
                        })
                    }, _('Import')),
                    E('button', { 'class': 'btn', 'click': ui.hideModal }, _('Dismiss'))
                ])
            ], 'cbi-modal');
        };

        o.subsection.renderSectionAdd = function (/* ... */) {
            let el = form.TableSection.prototype.renderSectionAdd.apply(this, arguments);

            el.appendChild(E('button', {
                'class': 'btn cbi-button-add',
                'title': _('Import mihomo config'),
                'click': ui.createHandlerFn(this, 'handleRuleImport')
            }, _('Import mihomo config')));

            return el;
        };
        /* Import mihomo config END */

        so = o.subsection.option(form.Flag, 'enabled', _('Enable'));
        so.default = 1;
        so.rmempty = false;

        so = o.subsection.option(form.RichListValue, 'type', _('Type'));
        so.rmempty = false;
        so.value('RULE-SET', _('RULE-SET'), _('Import external or local rule set files for batch matching.'));
        so.value('DOMAIN', _('DOMAIN'), _('Match the exact full domain name (e.g., google.com).'));
        so.value('DOMAIN-SUFFIX', _('DOMAIN-SUFFIX'), _('Match the domain and all its subdomains (e.g., google.com matches abc.google.com).'));
        so.value('DOMAIN-WILDCARD', _('DOMAIN-WILDCARD'), _('Match domains using wildcards (e.g., *.google.com).'));
        so.value('DOMAIN-KEYWORD', _('DOMAIN-KEYWORD'), _('Match if the domain contains this keyword (e.g., containing google).'));
        so.value('DOMAIN-REGEX', _('DOMAIN-REGEX'), _('Match domains using regular expressions.'));
        so.value('IP-CIDR', _('IP-CIDR'), _('Match specified IPv4 or IPv6 CIDR addresses (e.g., 192.168.1.0/24).'));
        so.value('DST-PORT', _('DST-PORT'), _('Match the target port number or range (e.g., 80 or 80-443).'));
        so.value('PROCESS-NAME', _('PROCESS-NAME'), _('Match the local process or application name that initiated the request.'));
        so.value('GEOSITE', _('GEOSITE'), _('Match predefined GeoSite categories (e.g., geosite:cn).'));
        so.value('GEOIP', _('GEOIP'), _('Match the country/region of the destination IP (e.g., geoip:cn).'));
        so.value('MATCH', _('MATCH'), _('Catch-all rule that matches any remaining traffic not handled by previous rules.'));

        so = o.subsection.option(form.Value, 'matcher', _('Matcher'));
        so.rmempty = false;
        so.depends({ 'type': /MATCH/i, '!reverse': true });

        so = o.subsection.option(form.RichListValue, 'node', _('Node'));
        so.default = 'GLOBAL';
        so.rmempty = false;
        so.value('GLOBAL', _('GLOBAL'), _('Route traffic to the Mihomo GLOBAL policy group.'));
        so.value('DIRECT', _('DIRECT'), _('Traffic bypasses the proxy and is sent directly via the local network.'));
        so.value('REJECT', _('REJECT'), _('Block the request immediately and return an error to the client (commonly used for ad blocking).'));
        so.value('REJECT-DROP', _('REJECT-DROP'), _('Silently drop the request packets, causing the client to wait until it times out.'));

        so = o.subsection.option(form.Flag, 'no_resolve', _('No Resolve'));
        so.rmempty = false;
        so.depends('type', /IP-CIDR6?/i);
        so.depends('type', /IP-ASN/i);
        so.depends('type', /RULE-SET/i);
        so.depends('type', /GEOIP/i);

        o = s.taboption('rule', form.Flag, 'rule_provider', _('Append Rule Provider'));
        o.rmempty = false;

        o = s.taboption('rule', form.SectionValue, '_rule_providers', form.GridSection, 'rule_provider', _('Edit Rule Providers'));
        o.retain = true;
        o.depends('rule_provider', '1');

        o.subsection.anonymous = true;
        o.subsection.addremove = true;
        o.subsection.sortable = true;

        /* Import mihomo config START */
        o.subsection.handleRuleImport = function () {
            const section = this;
            const textarea = E('textarea', {
                'style': 'width:100%; height:260px; font-family: Consolas;',
                'placeholder':
                    'rule-providers:\n' +
                    '  cn_domain:\n' +
                    '    type: http\n' +
                    '    behavior: domain\n' +
                    '    format: mrs\n' +
                    '    interval: 86400\n' +
                    '    size-limit: 0\n' +
                    '    proxy: DIRECT\n' +
                    '    url: "https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geo/geosite/cn.mrs"\n' +
                    '  ban_ad:\n' +
                    '    type: http\n' +
                    '    behavior: classical\n' +
                    '    format: yaml\n' +
                    '    interval: 600\n' +
                    '    proxy: GLOBAL\n' +
                    '    url: "https://raw.githubusercontent.com/ACL4SSR/ACL4SSR/master/Clash/BanAD.yaml"\n'
            });

            ui.showModal(_('Import mihomo config'), [
                E('p', {}, _('Please paste the %s field of a mihomo config.').format('<code>rule-providers</code>')),
                E('p', { 'class': 'alert-message warning' },
                    _('Only %s type entries can be imported this way; %s entries will be skipped (please add them manually).').format('http', 'file')),
                textarea,
                E('div', { 'class': 'button-row' }, [
                    E('button', {
                        'class': 'btn cbi-button-action important',
                        'click': ui.createHandlerFn(section, function () {
                            const parsed = parseRuleProviderYaml(textarea.value);
                            let count = 0;
                            const errors = [];

                            parsed.forEach(cfg => {
                                const result = toRuleProviderConfig(cfg);
                                if (result.error) {
                                    errors.push({ name: cfg.name || '(unnamed)', reason: result.error });
                                    return;
                                }

                                const config = result.config;
                                const sid = uci.add('nikki', 'rule_provider');
                                uci.set('nikki', 'mixin', 'rule_provider', '1');
                                uci.set('nikki', sid, 'enabled', '1');
                                for (const k in config) {
                                    if (config[k] == null) continue;
                                    if (k === 'path') config[k] = normalizePath(config[k]);
                                    uci.set('nikki', sid, k, config[k]);
                                }

                                count++;
                            });

                            if (count === 0 && errors.length === 0) {
                                ui.hideModal();
                                return ui.addNotification(null, E('p', _('No valid rule-provider entry found.')));
                            }

                            if (count > 0) {
                                ui.addTimeLimitedNotification(null, E('p',
                                    _('Successfully imported %s of %s entries.').format(count, parsed.length)), 4000, 'info');
                            }

                            if (errors.length > 0) {
                                ui.addNotification(null, E('div', {}, [
                                    E('p', {}, _('%s entry(ies) failed:').format(errors.length)),
                                    E('ul', {}, errors.map(e => E('li', {}, _('%s: %s').format(e.name, e.reason))))
                                ]), 'warning');
                            }

                            if (count === 0) return ui.hideModal();

                            return uci.save()
                                .then(L.bind(section.map.load, section.map))
                                .then(L.bind(section.map.reset, section.map))
                                .then(L.ui.hideModal)
                                .catch(() => {});
                        })
                    }, _('Import')),
                    E('button', { 'class': 'btn', 'click': ui.hideModal }, _('Dismiss'))
                ])
            ], 'cbi-modal');
        };

        o.subsection.renderSectionAdd = function (/* ... */) {
            let el = form.GridSection.prototype.renderSectionAdd.apply(this, arguments);

            el.appendChild(E('button', {
                'class': 'btn cbi-button-add',
                'title': _('Import mihomo config'),
                'click': ui.createHandlerFn(this, 'handleRuleImport')
            }, _('Import mihomo config')));

            return el;
        };
        /* Import mihomo config END */

        so = o.subsection.option(form.Flag, 'enabled', _('Enable'));
        so.default = 1;
        so.editable = true;
        so.modalonly = false;
        so.rmempty = false;

        so = o.subsection.option(form.Value, 'name', _('Name'));
        so.rmempty = false;

        so = o.subsection.option(form.ListValue, 'type', _('Type'));
        so.default = 'http';
        so.rmempty = false;
        so.value('http');
        so.value('file');

        so = o.subsection.option(form.Value, 'url', _('Url'));
        so.modalonly = true;
        so.rmempty = false;
        so.depends('type', 'http');

        so = o.subsection.option(form.Value, 'node', _('Node'));
        so.default = 'DIRECT';
        so.modalonly = true;
        so.depends('type', 'http');
        so.value('GLOBAL');
        so.value('DIRECT');

        so = o.subsection.option(form.Value, 'file_size_limit', _('File Size Limit'));
        so.datatype = 'uinteger';
        so.default = 0;
        so.modalonly = true;
        so.depends('type', 'http');

        so = o.subsection.option(form.FileUpload, 'file_path', _('File Path'));
        so.modalonly = true;
        so.rmempty = false;
        so.root_directory = nikki.ruleProvidersDir;
        so.depends('type', 'file');

        so = o.subsection.option(form.ListValue, 'file_format', _('File Format'));
        so.default = 'yaml';
        so.value('mrs');
        so.value('yaml');
        so.value('text');

        so = o.subsection.option(form.ListValue, 'behavior', _('Behavior'));
        so.default = 'classical';
        so.rmempty = false;
        so.value('classical');
        so.value('domain');
        so.value('ipcidr');

        so = o.subsection.option(form.Value, 'path', _('Path'));
        so.write = function (section_id, value) {
            return form.Value.prototype.write.call(
                this, section_id, normalizePath(value)
            );
        };

        so = o.subsection.option(form.Value, 'update_interval', _('Update Interval'), _('In seconds.'));
        so.datatype = 'uinteger';
        so.default = 86400;
        so.modalonly = true;
        so.depends('type', 'http');

        o = s.taboption('geox', form.ListValue, 'geoip_format', _('GeoIP Format'));
        o.optional = true;
        o.placeholder = _('Unmodified');
        o.value('dat', 'DAT');
        o.value('mmdb', 'MMDB');

        o = s.taboption('geox', form.ListValue, 'geodata_loader', _('GeoData Loader'));
        o.optional = true;
        o.placeholder = _('Unmodified');
        o.value('standard', _('Standard Loader'));
        o.value('memconservative', _('Memory Conservative Loader'));

        o = s.taboption('geox', form.Value, 'geosite_url', _('GeoSite Url'));
        o.placeholder = _('Unmodified');
        o.value('https://testingcf.jsdelivr.net/gh/MetaCubeX/meta-rules-dat@release/geosite.dat', _('MetaCubeX-Version'));

        o = s.taboption('geox', form.Value, 'geoip_mmdb_url', _('GeoIP(MMDB) Url'));
        o.placeholder = _('Unmodified');
        o.value('https://testingcf.jsdelivr.net/gh/MetaCubeX/meta-rules-dat@release/geoip.metadb', _('MetaCubeX-Version'));

        o = s.taboption('geox', form.Value, 'geoip_dat_url', _('GeoIP(DAT) Url'));
        o.placeholder = _('Unmodified');
        o.value('https://testingcf.jsdelivr.net/gh/MetaCubeX/meta-rules-dat@release/geoip.dat', _('MetaCubeX-Version'));

        o = s.taboption('geox', form.Value, 'geoip_asn_url', _('GeoIP(ASN) Url'));
        o.placeholder = _('Unmodified');
        o.value('https://testingcf.jsdelivr.net/gh/MetaCubeX/meta-rules-dat@release/GeoLite2-ASN.mmdb', _('MetaCubeX-Version'));

        o = s.taboption('geox', form.ListValue, 'geox_auto_update', _('GeoX Auto Update'));
        o.optional = true;
        o.placeholder = _('Unmodified');
        o.value('0', _('Disable'));
        o.value('1', _('Enable'));

        o = s.taboption('geox', form.Value, 'geox_update_interval', _('GeoX Update Interval'));
        o.datatype = 'uinteger';
        o.placeholder = _('Unmodified');

        return m.render();
    }
});
