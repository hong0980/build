#!/usr/bin/ucode
'use strict';
import { cursor }  from 'uci';
import { connect } from 'ubus';
import { build_proxies } from '/etc/nikki/ucode/node.uc';
import { uci_bool as ub, uci_int as ui, uci_array as ua, trim_all } from '/etc/nikki/ucode/include.uc';
const uci  = cursor();
const ubus = connect();
const cfg  = {};

function ug(o) {return uci.get('nikki', 'mixin', o)}

const ifname = ug('outbound_interface');
const st     = ubus.call('network.interface', 'status', {'interface': ifname});
const dev    = st?.l3_device ?? st?.device ?? '';

cfg['interface-name']          = dev;
cfg['mode']                    = ug('mode');
cfg['external-ui']             = ug('ui_path');
cfg['external-ui-url']         = ug('ui_url');
cfg['external-ui-name']        = ug('ui_name');
cfg['log-level']               = ug('log_level');
cfg['external-controller']     = ug('api_listen');
cfg['secret']                  = ug('api_secret');
cfg['find-process-mode']       = ug('match_process');
cfg['external-controller-tls'] = ug('api_tls_listen');
cfg['port']                    = ui(ug('http_port'));
cfg['socks-port']              = ui(ug('socks_port'));
cfg['mixed-port']              = ui(ug('mixed_port'));
cfg['redir-port']              = ui(ug('redir_port'));
cfg['tproxy-port']             = ui(ug('tproxy_port'));
cfg['keep-alive-idle']         = ui(ug('tcp_keep_alive_idle'));
cfg['keep-alive-interval']     = ui(ug('tcp_keep_alive_interval'));
cfg['ipv6']                    = ub(ug('ipv6'));
cfg['allow-lan']               = ub(ug('allow_lan'));
cfg['unified-delay']           = ub(ug('unify_delay'));
cfg['tcp-concurrent']          = ub(ug('tcp_concurrent'));
cfg['disable-keep-alive']      = ub(ug('disable_tcp_keep_alive'));

cfg.tls = {
	"certificate":  ug('api_tls_cert'),
	"private-key":  ug('api_tls_key'),
	"ech-key":      ug('api_tls_ech_key')
};

cfg.tun = {
	"enable":       ub(ug('tun_enabled')),
	"gso":          ub(ug('tun_gso')),
	"mtu":          ui(ug('tun_mtu')),
	"gso-max-size": ui(ug('tun_gso_max_size')),
	"stack":        ug('tun_stack'),
	"device":       ug('tun_device')
};

if (ub(ug('tun_dns_hijack'))) {
	cfg.tun['dns-hijack'] = ua(ug('tun_dns_hijacks'));
};

cfg.sniffer = {
	"enable":            ub(ug('sniffer')),
	"skip-src-address":  ua(ug('skip_src_address')),
	"skip-dst-address":  ua(ug('skip_dst_address')),
	"force-domain":      ua(ug('sniffer_force_domain_names')),
	"skip-domain":       ua(ug('sniffer_ignore_domain_names')),
	"parse-pure-ip":     ub(ug('sniffer_sniff_pure_ip')),
	"force-dns-mapping": ub(ug('sniffer_sniff_dns_mapping')),
	"sniff":             {},
};

if (ub(ug('sniffer_sniff'))) {
	uci.foreach('nikki', 'sniff', (s) => {
		if (!ub(s.enabled)) return;
		cfg.sniffer.sniff[s.protocol] = {
			"port":                 ua(s.port),
			"override-destination": ub(s.overwrite_destination) ? true : ''
		};
	});
};

cfg.dns = {
	"enable":              ub(ug('dns_enabled')),
	"ipv6":                ub(ug('dns_ipv6')),
	"respect-rules":       ub(ug('dns_respect_rules')),
	"prefer-h3":           ub(ug('dns_doh_prefer_http3')),
	"use-system-hosts":    ub(ug('dns_system_hosts')),
	"use-hosts":           ub(ug('dns_hosts')),
	"fake-ip-ttl":         ui(ug('fake_ip_ttl')),
	"listen":              ug('dns_listen'),
	"enhanced-mode":       ug('dns_mode'),
	"fake-ip-range":       ug('fake_ip_range'),
	"fake-ip-range6":      ug('fake_ip6_range'),
	"cache-algorithm":     ug('dns_cache_algorithm'),
	"fake-ip-filter-mode": ug('fake_ip_filter_mode')
};

if (ub(ug('dns_nameserver'))) {
	map(['default-nameserver', 'proxy-server-nameserver', 'direct-nameserver', 'nameserver', 'fallback'], (k) => cfg.dns[k] = []);
	uci.foreach('nikki', 'nameserver', (s) => {
		if (!ub(s.enabled)) return;
		push(cfg.dns[s.type], ...ua(s.nameserver));
	});
};

if (ub(ug('fake_ip_filter'))) {
	cfg.dns['fake-ip-filter'] = ua(ug('fake_ip_filters'));
};

if (ub(ug('dns_proxy_server_nameserver_policy'))) {
	cfg.dns['fallback-filter']                = {};
	cfg.dns['proxy-server-nameserver-policy'] = {};
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
			if (s.nameserver) {
				cfg.dns[s.type][s.matcher] = ua(s.nameserver);
			}
		}
	});
};

cfg.dns['direct-nameserver-follow-policy'] = ub(ug('dns_direct_nameserver_follow_policy'));

if (ub(ug('dns_nameserver_policy'))) {
	cfg.dns['nameserver-policy'] = {};
	uci.foreach('nikki', 'nameserver_policy', (s) => {
		if (!ub(s.enabled)) return;
		let ns = ua(s.nameserver);
		cfg.dns['nameserver-policy'][s.matcher] = length(ns) == 1 ? ns[0] : ns;
	});
};

if (ub(ug('wanDns'))) {
	const wanDns = ubus.call('network.interface.wan', 'status')?.['dns-server'];
	if (wanDns && length(wanDns) > 0) {
		cfg.dns['nameserver'] = ua(wanDns);
	}
};

if (ub(ug('authentication'))) {
	cfg['authentication'] = [];
	uci.foreach('nikki', 'authentication', (s) => {
		if (!ub(s.enabled)) return;
		push(cfg['authentication'], `${s.username}:${s.password}`);
	});
};

if (ub(ug('hosts'))) {
	cfg['hosts'] = {};
	uci.foreach('nikki', 'hosts', (s) => {
		if (!ub(s.enabled)) return;
		cfg['hosts'][s.domain_name] = ua(s.ip);
	});
};

cfg['lan-allowed-ips']    = ua(ug('lan_allowed_ips'));
cfg['lan-disallowed-ips'] = ua(ug('lan_disallowed_ips'));
cfg['skip-auth-prefixes'] = ua(ug('skip_auth_prefixes'));

cfg.profile = {
	"store-fake-ip":  ub(ug('fake_ip_cache')),
	"store-selected": ub(ug('selection_cache'))
};

if (ub(ug('rule_provider'))) {
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

if (ub(ug('rule'))) {
	cfg['nikki-rules'] = [];
	uci.foreach('nikki', 'rule', (s) => {
		if (!ub(s.enabled)) return;
		const rule = filter([s.type, s.matcher, s.node, ub(s.no_resolve) ? 'no-resolve' : null], (item) => item != null && item != '');
		push(cfg['nikki-rules'], join(',', rule));
	});
};

const geoip_format         = ug('geoip_format');
cfg['geodata-mode']        = geoip_format == null ? null : geoip_format == 'dat';
cfg['geodata-loader']      = ug('geodata_loader');
cfg['geox-url']            = {
	'asn':     ug('geoip_asn_url'),
	'mmdb':    ug('geoip_mmdb_url'),
	'geoip':   ug('geoip_dat_url'),
	'geosite': ug('geosite_url')
};
cfg['unified-delay']       = ub(ug('unified_delay'));
cfg['geo-auto-update']     = ub(ug('geox_auto_update'));
cfg['geo-update-interval'] = ui(ug('geox_update_interval'));
cfg['node']                = build_proxies();

if (ub(uci.get('nikki', 'config', 'url_enabled'))) {
	let idx = 0;
	const hc_int = ui(ug('interval') || 600);
	const hc_url = ug('urltest_url') || 'https://cp.cloudflare.com/generate_204';
	cfg['nikki-proxy-providers'] = {};
	uci.foreach('nikki', 'subscription', (s) => {
		if (!ub(s.enabled)) return;
		cfg['nikki-proxy-providers'][`provider${idx + 1}`] = {
			type:     'http',
			proxy:    'DIRECT',
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
