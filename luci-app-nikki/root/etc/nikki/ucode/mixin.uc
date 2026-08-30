#!/usr/bin/ucode
'use strict';
import { cursor }  from 'uci';
import { connect } from 'ubus';
import { build_proxies } from '/etc/nikki/ucode/node.uc';
import { uci_bool as ub, uci_int as ui, uci_array as ua, trim_all } from '/etc/nikki/ucode/include.uc';
const uci  = cursor();
const ubus = connect();

function g(o) { return uci.get('nikki', 'mixin', o); };
function i(o) { return ui(g(o)); };
function b(o) { return ub(g(o)); };
function a(o) { return ua(g(o)); };

const st   = ubus.call('network.interface', 'status', {'interface': g('outbound_interface')});
const cfg  = {
	'interface-name':          st?.l3_device ?? st?.device ?? '',
	'node':                    build_proxies(),
	'mode':                    g('mode'),
	'external-ui':             g('ui_path'),
	'external-ui-url':         g('ui_url'),
	'external-ui-name':        g('ui_name'),
	'log-level':               g('log_level'),
	'external-controller':     g('api_listen'),
	'secret':                  g('api_secret'),
	'find-process-mode':       g('match_process'),
	'external-controller-tls': g('api_tls_listen'),
	'geodata-loader':          g('geodata_loader'),
	'geodata-mode':            g('geoip_format') == 'dat',
	'port':                    i('http_port'),
	'socks-port':              i('socks_port'),
	'mixed-port':              i('mixed_port'),
	'redir-port':              i('redir_port'),
	'tproxy-port':             i('tproxy_port'),
	'geo-update-interval':     i('geox_update_interval'),
	'keep-alive-idle':         i('tcp_keep_alive_idle'),
	'keep-alive-interval':     i('tcp_keep_alive_interval'),
	'ipv6':                    b('ipv6'),
	'allow-lan':               b('allow_lan'),
	'unified-delay':           b('unify_delay'),
	'tcp-concurrent':          b('tcp_concurrent'),
	'unified-delay':           b('unified_delay'),
	'geo-auto-update':         b('geox_auto_update'),
	'disable-keep-alive':      b('disable_tcp_keep_alive'),
	'lan-allowed-ips':         a('lan_allowed_ips'),
	'lan-disallowed-ips':      a('lan_disallowed_ips'),
	'skip-auth-prefixes':      a('skip_auth_prefixes'),
	'profile': {
		"store-fake-ip":       b('fake_ip_cache'),
		"store-selected":      b('selection_cache')
	},
	'geox-url': {
		'geosite':             g('geosite_url'),
		'asn':                 g('geoip_asn_url'),
		'mmdb':                g('geoip_mmdb_url'),
		'geoip':               g('geoip_dat_url')
	},
	'tls': {
		"private-key":         g('api_tls_key'),
		"certificate":         g('api_tls_cert'),
		"ech-key":             g('api_tls_ech_key')
	},
	'tun': {
		"enable":              b('tun_enabled'),
		"gso":                 b('tun_gso'),
		"mtu":                 i('tun_mtu'),
		"gso-max-size":        i('tun_gso_max_size'),
		"stack":               g('tun_stack'),
		"device":              g('tun_device'),
		"dns-hijack":          b('tun_dns_hijack') ? a('tun_dns_hijacks') : ''
	},
	'sniffer': {
		"enable":              b('sniffer'),
		"skip-src-address":    a('skip_src_address'),
		"skip-dst-address":    a('skip_dst_address'),
		"parse-pure-ip":       b('sniffer_sniff_pure_ip'),
		"force-dns-mapping":   b('sniffer_sniff_dns_mapping'),
		"sniff":               {},
		"skip-domain":         b('sidm') ? a('sidms') : '',
		"force-domain":        b('sfdm') ? a('sfdms') : ''
	},
	'dns': {
		"enable":              b('dns_enabled'),
		"ipv6":                b('dns_ipv6'),
		"use-hosts":           b('dns_hosts'),
		"use-system-hosts":    b('dns_system_hosts'),
		"respect-rules":       b('dns_respect_rules'),
		"prefer-h3":           b('dns_doh_prefer_http3'),
		"fake-ip-ttl":         i('fake_ip_ttl'),
		"enhanced-mode":       g('dns_mode'),
		"listen":              g('dns_listen'),
		"fake-ip-range":       g('fake_ip_range'),
		"fake-ip-range6":      g('fake_ip6_range'),
		"cache-algorithm":     g('dns_cache_algorithm'),
		"fake-ip-filter-mode": g('fake_ip_filter_mode'),
		"fake-ip-filter":      b('fake_ip_filter') ? a('fake_ip_filters') : '',
		"direct-nameserver-follow-policy": b('dns_direct_nameserver_follow_policy'),
		'proxy-server-nameserver-policy': {},
		'fallback':            {},
		'fallback-filter':     {},
		'nameserver-policy':   {}
	},
};

if (b('sniffer_sniff')) {
	uci.foreach('nikki', 'sniff', (s) => {
		if (!ub(s.enabled)) return;
		cfg.sniffer.sniff[s.protocol] = {
			"port":                 ua(s.port),
			"override-destination": ub(s.overwrite_destination) ? true : ''
		};
	});
};

if (b('dns_nameserver')) {
	map(['default-nameserver', 'proxy-server-nameserver', 'direct-nameserver', 'nameserver', 'fallback'], (k) => cfg.dns[k] = []);
	uci.foreach('nikki', 'nameserver', (s) => {
		if (!ub(s.enabled)) return;
		push(cfg.dns[s.type], ...ua(s.nameserver));
	});
};

if (b('dns_proxy_server_nameserver_policy')) {
	uci.foreach('nikki', 'proxy_server_nameserver_policy', (s) => {
		if (!ub(s.enabled)) return;
		if (s.type == 'fallback-filter') {
			if (s.nameserver) {
				cfg.dns['fallback-filter'][s.matcher] = ua(s.nameserver);
			} else if (s.matcher) {
				let pos = index(s.matcher, ':');
				if (pos > 0) {
					let key = trim(substr(s.matcher, 0, pos));
					let val = trim(substr(s.matcher, pos + 1));
					map([['true', true], ['false', false]], (p) => { if (val == p[0]) val = p[1]; });
					if (match(val, /^[0-9]+$/)) val = int(val);
					cfg.dns['fallback-filter'][key] = val;
				} else {
					cfg.dns['fallback-filter'][s.matcher] = true;
				}
			}
		} else {
			if (s.nameserver) cfg.dns[s.type][s.matcher] = ua(s.nameserver);
		}
	});
};

if (b('dns_nameserver_policy')) {
	uci.foreach('nikki', 'nameserver_policy', (s) => {
		if (!ub(s.enabled)) return;
		let ns = ua(s.nameserver);
		cfg.dns['nameserver-policy'][s.matcher] = length(ns) == 1 ? ns[0] : ns;
	});
};

if (b('wanDns')) {
	const wanDns = ubus.call('network.interface.wan', 'status')?.['dns-server'];
	if (wanDns && length(wanDns) > 0) cfg.dns['nameserver'] = ua(wanDns);
};

if (b('authentication')) {
	cfg['authentication'] = [];
	uci.foreach('nikki', 'authentication', (s) => {
		if (!ub(s.enabled)) return;
		push(cfg['authentication'], `${s.username}:${s.password}`);
	});
};

if (b('hosts')) {
	cfg['hosts'] = {};
	uci.foreach('nikki', 'hosts', (s) => {
		if (!ub(s.enabled)) return;
		cfg['hosts'][s.domain_name] = ua(s.ip);
	});
};

if (b('rule_provider')) {
	cfg['rule-providers'] = {};
	uci.foreach('nikki', 'rule_provider', (s) => {
		if (!ub(s.enabled)) return;
		cfg['rule-providers'][s.name] = {
			proxy:      s.node,
			url:        s.url,
			type:       s.type,
			format:     s.file_format,
			behavior:   s.behavior,
			interval:   ui(s.update_interval),
			size_limit: ui(s.file_size_limit),
			path:       s.path || s.file_path
		};
	});
};

if (b('rule')) {
	cfg['nikki-rules'] = [];
	uci.foreach('nikki', 'rule', (s) => {
		if (!ub(s.enabled)) return;
		const rule = filter([s.type, s.matcher, s.node, ub(s.no_resolve) ? 'no-resolve' : null], (item) => item != null && item != '');
		push(cfg['nikki-rules'], join(',', rule));
	});
};

if (ub(uci.get('nikki', 'config', 'url_enabled'))) {
	let idx = 0;
	const hc_int = i('interval') || 600;
	const hc_url = g('urltest_url') || 'https://cp.cloudflare.com/generate_204';
	cfg['nikki-proxy-providers'] = {};
	uci.foreach('nikki', 'subscription', (s) => {
		if (!ub(s.enabled)) return;
		cfg['nikki-proxy-providers'][`provider${idx + 1}`] = {
			type:     'http',
			// proxy:    'DIRECT',
			interval: 86400,
			path:     `./proxies/provider${idx + 1}.yaml`,
			url:      s.url,
			filter:   '^(?!.*(群|邀请|返利|循环|官网|客服|网站|网址|获取|订阅|流量|到期|机场|下次|版本|官址|备用|过期|已用|联系|邮箱|工单|贩卖|通知|倒卖|防止|国内|地址|频道|无法|说明|使用|提示|特别|访问|支持|教程|关注|更新|作者|加入|剩余|套餐|重置|域名|USE|USED|TOTAL|EXPIRE|EMAIL|Panel|Channel|Author))',
			'health-check': {
				enable:   true,
				interval: hc_int,
				url:      hc_url
			}
		};
		idx++;
	});
};

print(sprintf("%J", trim_all(cfg)));
