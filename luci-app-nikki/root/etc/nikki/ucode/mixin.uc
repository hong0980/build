#!/usr/bin/ucode
'use strict';

import { cursor }  from 'uci';
import { connect } from 'ubus';
import { build_proxies } from '/etc/nikki/ucode/node.uc';
import { uci_bool, uci_int, uci_array, trim_all, mirrorGithubUrl } from '/etc/nikki/ucode/include.uc';

const uci    = cursor();
const ubus   = connect();
const config = {};

const outbound_interface        = uci.get('nikki', 'mixin', 'outbound_interface');
const outbound_interface_status = ubus.call('network.interface', 'status', { 'interface': outbound_interface });
const outbound_device           = outbound_interface_status?.l3_device ?? outbound_interface_status?.device ?? '';

config['interface-name']        = outbound_device;
config['log-level']             = uci.get('nikki', 'mixin', 'log_level');
config['mode']                  = uci.get('nikki', 'mixin', 'mode');
config['find-process-mode']     = uci.get('nikki', 'mixin', 'match_process');
config['ipv6']                  = uci_bool(uci.get('nikki', 'mixin', 'ipv6'));
config['unified-delay']         = uci_bool(uci.get('nikki', 'mixin', 'unify_delay'));
config['tcp-concurrent']        = uci_bool(uci.get('nikki', 'mixin', 'tcp_concurrent'));
config['disable-keep-alive']    = uci_bool(uci.get('nikki', 'mixin', 'disable_tcp_keep_alive'));
config['keep-alive-idle']       = uci_int(uci.get('nikki', 'mixin', 'tcp_keep_alive_idle'));
config['keep-alive-interval']   = uci_int(uci.get('nikki', 'mixin', 'tcp_keep_alive_interval'));
config['external-ui']           = uci.get('nikki', 'mixin', 'ui_path');
config['external-ui-url']       = uci.get('nikki', 'mixin', 'ui_url');
config['external-ui-name']      = uci.get('nikki', 'mixin', 'ui_name');
config['external-controller']   = uci.get('nikki', 'mixin', 'api_listen');
config['external-controller-tls'] = uci.get('nikki', 'mixin', 'api_tls_listen');
config['secret']                = uci.get('nikki', 'mixin', 'api_secret');
config['allow-lan']             = uci_bool(uci.get('nikki', 'mixin', 'allow_lan'));
config['port']                  = uci_int(uci.get('nikki', 'mixin', 'http_port'));
config['socks-port']            = uci_int(uci.get('nikki', 'mixin', 'socks_port'));
config['mixed-port']            = uci_int(uci.get('nikki', 'mixin', 'mixed_port'));
config['redir-port']            = uci_int(uci.get('nikki', 'mixin', 'redir_port'));
config['tproxy-port']           = uci_int(uci.get('nikki', 'mixin', 'tproxy_port'));

config.tls = {
	"certificate":      uci.get('nikki', 'mixin', 'api_tls_cert'),
	"private-key":      uci.get('nikki', 'mixin', 'api_tls_key'),
	"ech-key":          uci.get('nikki', 'mixin', 'api_tls_ech_key')
};

config.tun = {
	"enable":           uci_bool(uci.get('nikki', 'mixin', 'tun_enabled')),
	"device":           uci.get('nikki', 'mixin', 'tun_device'),
	"stack":            uci.get('nikki', 'mixin', 'tun_stack'),
	"mtu":              uci_int(uci.get('nikki', 'mixin', 'tun_mtu')),
	"gso":              uci_bool(uci.get('nikki', 'mixin', 'tun_gso')),
	"gso-max-size":     uci_int(uci.get('nikki', 'mixin', 'tun_gso_max_size'))
};

if (uci_bool(uci.get('nikki', 'mixin', 'tun_dns_hijack'))) {
	config.tun['dns-hijack'] = uci_array(uci.get('nikki', 'mixin', 'tun_dns_hijacks'));
}

config.sniffer = {
	"enable":            uci_bool(uci.get('nikki', 'mixin', 'sniffer')),
	"parse-pure-ip":     uci_bool(uci.get('nikki', 'mixin', 'sniffer_sniff_pure_ip')),
	"force-dns-mapping": uci_bool(uci.get('nikki', 'mixin', 'sniffer_sniff_dns_mapping')),
	"sniff":             {}
};

if (uci_bool(uci.get('nikki', 'mixin', 'sniffer_force_domain_name'))) {
	config.sniffer['force-domain'] = uci_array(uci.get('nikki', 'mixin', 'sniffer_force_domain_names'));
}
if (uci_bool(uci.get('nikki', 'mixin', 'sniffer_ignore_domain_name'))) {
	config.sniffer['skip-domain'] = uci_array(uci.get('nikki', 'mixin', 'sniffer_ignore_domain_names'));
}

if (uci_bool(uci.get('nikki', 'mixin', 'sniffer_sniff'))) {
	uci.foreach('nikki', 'sniff', (section) => {
		if (!uci_bool(section.enabled)) return;
		config.sniffer.sniff[section.protocol] = {
			"port":                 uci_array(section.port),
			"override-destination": uci_bool(section.overwrite_destination)
		};
	});
}

config.dns = {
	"enable":                    uci_bool(uci.get('nikki', 'mixin', 'dns_enabled')),
	"cache-algorithm":           uci.get('nikki', 'mixin', 'dns_cache_algorithm'),
	"listen":                    uci.get('nikki', 'mixin', 'dns_listen'),
	"ipv6":                      uci_bool(uci.get('nikki', 'mixin', 'dns_ipv6')),
	"enhanced-mode":             uci.get('nikki', 'mixin', 'dns_mode'),
	"fake-ip-range":             uci.get('nikki', 'mixin', 'fake_ip_range'),
	"fake-ip-range6":            uci.get('nikki', 'mixin', 'fake_ip6_range'),
	"fake-ip-ttl":               uci_int(uci.get('nikki', 'mixin', 'fake_ip_ttl')),
	"fake-ip-filter-mode":       uci.get('nikki', 'mixin', 'fake_ip_filter_mode'),
	"respect-rules":             uci_bool(uci.get('nikki', 'mixin', 'dns_respect_rules')),
	"prefer-h3":                 uci_bool(uci.get('nikki', 'mixin', 'dns_doh_prefer_http3')),
	"use-system-hosts":          uci_bool(uci.get('nikki', 'mixin', 'dns_system_hosts')),
	"use-hosts":                 uci_bool(uci.get('nikki', 'mixin', 'dns_hosts'))
};

if (uci_bool(uci.get('nikki', 'mixin', 'dns_nameserver'))) {
	map(['default-nameserver', 'proxy-server-nameserver', 'direct-nameserver', 'nameserver', 'fallback'], (k) => config.dns[k] = []);
	uci.foreach('nikki', 'nameserver', (section) => {
		if (!uci_bool(section.enabled)) return;
		push(config.dns[section.type], ...uci_array(section.nameserver));
	});
}

if (uci_bool(uci.get('nikki', 'mixin', 'fake_ip_filter'))) {
	config.dns['fake-ip-filter'] = uci_array(uci.get('nikki', 'mixin', 'fake_ip_filters'));
}

if (uci_bool(uci.get('nikki', 'mixin', 'dns_proxy_server_nameserver_policy'))) {
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

config.dns['direct-nameserver-follow-policy'] = uci_bool(uci.get('nikki', 'mixin', 'dns_direct_nameserver_follow_policy'));

if (uci_bool(uci.get('nikki', 'mixin', 'dns_nameserver_policy'))) {
	config.dns['nameserver-policy'] = {};
	uci.foreach('nikki', 'nameserver_policy', (section) => {
		if (!uci_bool(section.enabled)) return;
		let ns = uci_array(section.nameserver);
		config.dns['nameserver-policy'][section.matcher] = length(ns) == 1 ? ns[0] : ns;
	});
}

if (uci_bool(uci.get('nikki', 'mixin', 'wanDns'))) {
	const wanDns = ubus.call('network.interface.wan', 'status')?.['dns-server'];
	if (wanDns && length(wanDns) > 0) {
		config.dns['nameserver'] = uci_array(wanDns);
	}
}

if (config.dns["respect-rules"] == true && (!config.dns["proxy-server-nameserver"] || length(config.dns["proxy-server-nameserver"]) == 0)) {
	config.dns["proxy-server-nameserver"] = ["https://dns.alidns.com/dns-query", "https://doh.pub/dns-query"];
}

if (uci_bool(uci.get('nikki', 'mixin', 'authentication'))) {
	config['authentication'] = [];
	uci.foreach('nikki', 'authentication', (section) => {
		if (!uci_bool(section.enabled)) return;
		push(config['authentication'], `${section.username}:${section.password}`);
	});
}

if (uci_bool(uci.get('nikki', 'mixin', 'hosts'))) {
	config['hosts'] = {};
	uci.foreach('nikki', 'hosts', (section) => {
		if (!uci_bool(section.enabled)) return;
		config['hosts'][section.domain_name] = uci_array(section.ip);
	});
}

config['profile'] = {
	"store-fake-ip":  uci_bool(uci.get('nikki', 'mixin', 'fake_ip_cache')),
	"store-selected": uci_bool(uci.get('nikki', 'mixin', 'selection_cache'))
};

if (uci_bool(uci.get('nikki', 'mixin', 'rule_provider'))) {
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

if (uci_bool(uci.get('nikki', 'mixin', 'rule'))) {
	config['nikki-rules'] = [];
	uci.foreach('nikki', 'rule', (section) => {
		if (!uci_bool(section.enabled)) return;
		const rule = filter([section.type, section.matcher, section.node, uci_bool(section.no_resolve) ? 'no-resolve' : null], (item) => item != null && item != '');
		push(config['nikki-rules'], join(',', rule));
	});
}

const geoip_format            = uci.get('nikki', 'mixin', 'geoip_format');
config['geodata-mode']        = geoip_format == null ? null : geoip_format == 'dat';
config['geodata-loader']      = uci.get('nikki', 'mixin', 'geodata_loader');
config['geox-url']            = {};
config['geox-url']['asn']     = uci.get('nikki', 'mixin', 'geoip_asn_url');
config['geox-url']['mmdb']    = uci.get('nikki', 'mixin', 'geoip_mmdb_url');
config['geox-url']['geoip']   = uci.get('nikki', 'mixin', 'geoip_dat_url');
config['geox-url']['geosite'] = uci.get('nikki', 'mixin', 'geosite_url');
config['unified-delay']       = uci_bool(uci.get('nikki', 'mixin', 'unified_delay'));
config['geo-auto-update']     = uci_bool(uci.get('nikki', 'mixin', 'geox_auto_update'));
config['geo-update-interval'] = uci_int(uci.get('nikki', 'mixin', 'geox_update_interval'));
config['node']                = build_proxies();

const profile_name = uci.get('nikki', 'config', 'profile');
const raw = (profile_name && index(profile_name, 'file:') == 0) ? uci.get('nikki', 'config', 'file_url') : null;
const urls = filter(
	type(raw) == 'string' ? split(raw, ' ') : uci_array(raw),
	(u) => length(trim(u)) > 0
);

if (length(urls) > 0) {
	const hc_url = uci.get('nikki', 'mixin', 'urltest_url') || 'https://cp.cloudflare.com/generate_204';
	const hc_int = uci_int(uci.get('nikki', 'mixin', 'interval') || 600);
	config['nikki-proxy-providers'] = {};
	map(urls, (url, idx) => {
		config['nikki-proxy-providers'][`provider${idx + 1}`] = {
			type:           'http',
			url:            url,
			interval:       86400,
			proxy:          'DIRECT',
			'health-check': {
				url:      hc_url,
				enable:   true,
				interval: hc_int
			}
		};
	});
}

print(trim_all(config));
