#!/usr/bin/ucode
'use strict';
import { cursor }  from 'uci';
import { connect } from 'ubus';
import { build_proxies } from '/etc/nikki/ucode/node.uc';
import { uci_bool, uci_int, uci_array, trim_all } from '/etc/nikki/ucode/include.uc';
const uci    = cursor();
const ubus   = connect();

function uci_get(p) {
	const c = p.c || 'nikki';
	const s = p.s || 'mixin';
	const o = p.o;
	return uci.get(c, s, o);
}

const config = {};
const outbound_interface        = uci_get({o:'outbound_interface'});
const outbound_interface_status = ubus.call('network.interface', 'status', { 'interface': outbound_interface });
const outbound_device           = outbound_interface_status?.l3_device ?? outbound_interface_status?.device ?? '';

config['interface-name']          = outbound_device;
config['mode']                    = uci_get({o:'mode'});
config['external-ui']             = uci_get({o:'ui_path'});
config['external-ui-url']         = uci_get({o:'ui_url'});
config['external-ui-name']        = uci_get({o:'ui_name'});
config['log-level']               = uci_get({o:'log_level'});
config['external-controller']     = uci_get({o:'api_listen'});
config['secret']                  = uci_get({o:'api_secret'});
config['external-controller-tls'] = uci_get({o:'api_tls_listen'});
config['find-process-mode']       = uci_get({o:'match_process'});
config['port']                    = uci_int(uci_get({o:'http_port'}));
config['socks-port']              = uci_int(uci_get({o:'socks_port'}));
config['mixed-port']              = uci_int(uci_get({o:'mixed_port'}));
config['redir-port']              = uci_int(uci_get({o:'redir_port'}));
config['tproxy-port']             = uci_int(uci_get({o:'tproxy_port'}));
config['keep-alive-idle']         = uci_int(uci_get({o:'tcp_keep_alive_idle'}));
config['keep-alive-interval']     = uci_int(uci_get({o:'tcp_keep_alive_interval'}));
config['ipv6']                    = uci_bool(uci_get({o:'ipv6'}));
config['allow-lan']               = uci_bool(uci_get({o:'allow_lan'}));
config['unified-delay']           = uci_bool(uci_get({o:'unify_delay'}));
config['tcp-concurrent']          = uci_bool(uci_get({o:'tcp_concurrent'}));
config['disable-keep-alive']      = uci_bool(uci_get({o:'disable_tcp_keep_alive'}));

config.tls = {
	"certificate":      uci_get({o:'api_tls_cert'}),
	"private-key":      uci_get({o:'api_tls_key'}),
	"ech-key":          uci_get({o:'api_tls_ech_key'})
};

config.tun = {
	"enable":           uci_bool(uci_get({o:'tun_enabled'})),
	"gso":              uci_bool(uci_get({o:'tun_gso'})),
	"mtu":              uci_int(uci_get({o:'tun_mtu'})),
	"gso-max-size":     uci_int(uci_get({o:'tun_gso_max_size'})),
	"stack":            uci_get({o:'tun_stack'}),
	"device":           uci_get({o:'tun_device'})
};

if (uci_bool(uci_get({o:'tun_dns_hijack'}))) {
	config.tun['dns-hijack'] = uci_array(uci_get({o:'tun_dns_hijacks'}));
}

config.sniffer = {
	"enable":            uci_bool(uci_get({o:'sniffer'})),
	"skip-src-address":  uci_array(uci_get({o:'skip_src_address'})),
	"skip-dst-address":  uci_array(uci_get({o:'skip_dst_address'})),
	"force-domain":      uci_array(uci_get({o:'sniffer_force_domain_names'})),
	"skip-domain":       uci_array(uci_get({o:'sniffer_ignore_domain_names'})),
	"parse-pure-ip":     uci_bool( uci_get({o:'sniffer_sniff_pure_ip'})),
	"force-dns-mapping": uci_bool( uci_get({o:'sniffer_sniff_dns_mapping'})),
	"sniff":             {},
};

if (uci_bool(uci_get({o:'sniffer_sniff'}))) {
	uci.foreach('nikki', 'sniff', (section) => {
		if (!uci_bool(section.enabled)) return;
		config.sniffer.sniff[section.protocol] = {
			"port":                 uci_array(section.port),
			"override-destination": uci_bool(section.overwrite_destination) ? true : ''
		};
	});
}

config.dns = {
	"enable":                    uci_bool(uci_get({o:'dns_enabled'})),
	"ipv6":                      uci_bool(uci_get({o:'dns_ipv6'})),
	"respect-rules":             uci_bool(uci_get({o:'dns_respect_rules'})),
	"prefer-h3":                 uci_bool(uci_get({o:'dns_doh_prefer_http3'})),
	"use-system-hosts":          uci_bool(uci_get({o:'dns_system_hosts'})),
	"use-hosts":                 uci_bool(uci_get({o:'dns_hosts'})),
	"fake-ip-ttl":               uci_int(uci_get({o:'fake_ip_ttl'})),
	"listen":                    uci_get({o:'dns_listen'}),
	"enhanced-mode":             uci_get({o:'dns_mode'}),
	"fake-ip-range":             uci_get({o:'fake_ip_range'}),
	"fake-ip-range6":            uci_get({o:'fake_ip6_range'}),
	"cache-algorithm":           uci_get({o:'dns_cache_algorithm'}),
	"fake-ip-filter-mode":       uci_get({o:'fake_ip_filter_mode'})
};

if (uci_bool(uci_get({o:'dns_nameserver'}))) {
	map(['default-nameserver', 'proxy-server-nameserver', 'direct-nameserver', 'nameserver', 'fallback'], (k) => config.dns[k] = []);
	uci.foreach('nikki', 'nameserver', (section) => {
		if (!uci_bool(section.enabled)) return;
		push(config.dns[section.type], ...uci_array(section.nameserver));
	});
}

if (uci_bool(uci_get({o:'fake_ip_filter'}))) {
	config.dns['fake-ip-filter'] = uci_array(uci_get({o:'fake_ip_filters'}));
}

if (uci_bool(uci_get({o:'dns_proxy_server_nameserver_policy'}))) {
	config.dns['fallback-filter']                = {};
	config.dns['proxy-server-nameserver-policy'] = {};
	uci.foreach('nikki', 'proxy_server_nameserver_policy', (section) => {
		if (!uci_bool(section.enabled)) return;

		if (section.type == 'fallback-filter') {
			if (section.nameserver) {
				config.dns['fallback-filter'][section.matcher] = uci_array(section.nameserver);
			} else if (section.matcher) {
				let pos = index(section.matcher, ':');
				if (pos > 0) {
					let key = trim(substr(section.matcher, 0, pos));
					let val = trim(substr(section.matcher, pos + 1));
					map([['true', true], ['false', false]], (p) => { if (val == p[0]) val = p[1]; });
					if (match(val, /^[0-9]+$/)) val = int(val);
					config.dns['fallback-filter'][key] = val;
				} else {
					config.dns['fallback-filter'][section.matcher] = true;
				}
			}
		} else {
			if (section.nameserver) {
				config.dns[section.type][section.matcher] = uci_array(section.nameserver);
			}
		}
	});
}

config.dns['direct-nameserver-follow-policy'] = uci_bool(uci_get({o:'dns_direct_nameserver_follow_policy'}));

if (uci_bool(uci_get({o:'dns_nameserver_policy'}))) {
	config.dns['nameserver-policy'] = {};
	uci.foreach('nikki', 'nameserver_policy', (section) => {
		if (!uci_bool(section.enabled)) return;
		let ns = uci_array(section.nameserver);
		config.dns['nameserver-policy'][section.matcher] = length(ns) == 1 ? ns[0] : ns;
	});
}

if (uci_bool(uci_get({o:'wanDns'}))) {
	const wanDns = ubus.call('network.interface.wan', 'status')?.['dns-server'];
	if (wanDns && length(wanDns) > 0) {
		config.dns['nameserver'] = uci_array(wanDns);
	}
}

if (uci_bool(uci_get({o:'authentication'}))) {
	config['authentication'] = [];
	uci.foreach('nikki', 'authentication', (section) => {
		if (!uci_bool(section.enabled)) return;
		push(config['authentication'], `${section.username}:${section.password}`);
	});
}

if (uci_bool(uci_get({o:'hosts'}))) {
	config['hosts'] = {};
	uci.foreach('nikki', 'hosts', (section) => {
		if (!uci_bool(section.enabled)) return;
		config['hosts'][section.domain_name] = uci_array(section.ip);
	});
}

config['lan-allowed-ips']    = uci_array(uci_get({o:'lan_allowed_ips'}));
config['lan-disallowed-ips'] = uci_array(uci_get({o:'lan_disallowed_ips'}));
config['skip-auth-prefixes'] = uci_array(uci_get({o:'skip_auth_prefixes'}));

config.profile = {
	"store-fake-ip":  uci_bool(uci_get({o:'fake_ip_cache'})),
	"store-selected": uci_bool(uci_get({o:'selection_cache'}))
};

if (uci_bool(uci_get({o:'rule_provider'}))) {
	config['rule-providers'] = {};
	uci.foreach('nikki', 'rule_provider', (section) => {
		if (!uci_bool(section.enabled)) return;

		let path = section.path;
		if (!path || length(path) == 0) {
			path = './rule_provider/' + section.name;
		} else if (substr(path, -1) == '/') {
			path = path + section.name;
		}

		config['rule-providers'][section.name] = (section.type == 'http') ? {
			type:       section.type,
			interval:   uci_int(section.update_interval),
			behavior:   section.behavior,
			format:     section.file_format,
			proxy:      section.node,
			size_limit: uci_int(section.file_size_limit),
			url:        section.url,
			path:       path,
		} : {
			type:     section.type,
			format:   section.file_format,
			behavior: section.behavior,
			path:     section.file_path,
		};
	});
}

if (uci_bool(uci_get({o:'rule'}))) {
	config['nikki-rules'] = [];
	uci.foreach('nikki', 'rule', (section) => {
		if (!uci_bool(section.enabled)) return;
		const rule = filter([section.type, section.matcher, section.node, uci_bool(section.no_resolve) ? 'no-resolve' : null], (item) => item != null && item != '');
		push(config['nikki-rules'], join(',', rule));
	});
}

const geoip_format            = uci_get({o:'geoip_format'});
config['geodata-mode']        = geoip_format == null ? null : geoip_format == 'dat';
config['geodata-loader']      = uci_get({o:'geodata_loader'});
config['geox-url']            = {
	'asn':     uci_get({o:'geoip_asn_url'}),
	'mmdb':    uci_get({o:'geoip_mmdb_url'}),
	'geoip':   uci_get({o:'geoip_dat_url'}),
	'geosite': uci_get({o:'geosite_url'})
};
config['unified-delay']       = uci_bool(uci_get({o:'unified_delay'}));
config['geo-auto-update']     = uci_bool(uci_get({o:'geox_auto_update'}));
config['geo-update-interval'] = uci_int(uci_get({o:'geox_update_interval'}));
config['node']                = build_proxies();

if (uci_bool(uci_get({s:'config', o:'url_enabled'}))) {
	let idx = 0;
	const hc_int = uci_int(uci_get({o:'interval'}) || 600);
	const hc_url = uci_get({o:'urltest_url'}) || 'https://cp.cloudflare.com/generate_204';
	config['nikki-proxy-providers'] = {};
	uci.foreach('nikki', 'subscription', (section) => {
		if (!uci_bool(section.enabled)) return;
		config['nikki-proxy-providers'][`provider${idx + 1}`] = {
			type:     'http',
			proxy:    'DIRECT',
			interval: 86400,
			url:      section.url,
			filter:   '^(?!.*(到期|过期|剩余|网址|官网|邮箱|订阅|套餐|流量|说明|重置|域名)).*$',
			'health-check': {
				enable:   true,
				interval: hc_int,
				url:      hc_url
			}
		};
		idx++;
	});
};

print(trim_all(config));
