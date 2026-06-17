import { cursor } from 'uci';
import { uci_bool, uci_int, uci_array, trim_all } from '/etc/nikki/ucode/include.uc';

const uci = cursor();

function map_utls(fp) {
	if (fp == null || fp == '') {
		return null;
	}
	if (fp == 'randomized') {
		return 'random';
	}
	return fp;
};

function build_reality_opts(section) {
	if (!uci_bool(section.tls_reality)) {
		return null;
	}
	const opts = {
		'public-key': section.tls_reality_public_key,
		'short-id': section.tls_reality_short_id,
	};
	return trim_all(opts);
};

function build_ws_opts(section) {
	const headers = {};
	const hosts = uci_array(section.ws_host);
	if (length(hosts) > 0) {
		headers['Host'] = join(',', hosts);
	}
	const opts = {
		path: section.ws_path,
		headers: length(keys(headers)) > 0 ? headers : null,
	};
	if (uci_bool(section.websocket_early_data) || section.websocket_early_data) {
		opts['max-early-data'] = uci_int(section.websocket_early_data);
		opts['early-data-header-name'] = section.websocket_early_data_header;
	}
	return trim_all(opts);
};

function build_grpc_opts(section) {
	const opts = {
		'grpc-service-name': section.grpc_servicename || 'grpc',
	};
	return trim_all(opts);
};

function build_h2_opts(section) {
	const opts = {
		host: uci_array(section.http_host),
		path: section.http_path,
	};
	return trim_all(opts);
};

function build_httpupgrade_opts(section) {
	const opts = {
		host: section.httpupgrade_host,
		path: section.http_path,
	};
	return trim_all(opts);
};

function apply_transport(target, section, allowed) {
	const transport = section.transport;
	if (transport == null || transport == '') {
		return;
	}
	if (index(allowed, transport) == -1) {
		return;
	}

	switch (transport) {
		case 'ws':
			target['network'] = 'ws';
			target['ws-opts'] = build_ws_opts(section);
			break;
		case 'grpc':
			target['network'] = 'grpc';
			target['grpc-opts'] = build_grpc_opts(section);
			break;
		case 'http':
			target['network'] = 'h2';
			target['h2-opts'] = build_h2_opts(section);
			break;
		case 'httpupgrade':
			target['network'] = 'http';
			target['http-opts'] = build_httpupgrade_opts(section);
			break;
	}
};

function apply_tls_common(target, section) {
	if (!uci_bool(section.tls)) {
		return;
	}
	target['tls'] = true;
	target['servername'] = section.tls_sni;

	const alpn = uci_array(section.tls_alpn);
	if (length(alpn) > 0) {
		target['alpn'] = alpn;
	}

	target['skip-cert-verify'] = uci_bool(section.tls_insecure);

	const fp = map_utls(section.tls_utls);
	if (fp != null) {
		target['client-fingerprint'] = fp;
	}

	const reality = build_reality_opts(section);
	if (reality != null) {
		target['reality-opts'] = reality;
	}

	if (uci_bool(section.tls_ech)) {
		target['ech-opts'] = trim_all({
			enable: true,
			config: section.tls_ech_config_path ? null : null,
		});
	}
};

function apply_multiplex(target, section) {
	if (!uci_bool(section.multiplex)) {
		return;
	}
	target['smux'] = trim_all({
		enabled: true,
		protocol: section.multiplex_protocol,
		'max-connections': uci_int(section.multiplex_max_connections),
		'min-streams': uci_int(section.multiplex_min_streams),
		'max-streams': uci_int(section.multiplex_max_streams),
		padding: uci_bool(section.multiplex_padding),
		statistic: false,
		'only-tcp': false,
		brutal: uci_bool(section.multiplex_brutal) ? trim_all({
			enabled: true,
			up: uci_int(section.multiplex_brutal_up),
			down: uci_int(section.multiplex_brutal_down),
		}) : null,
	});
};

function build_direct(section, base) {
	return null;
};

function build_http(section, base) {
	const proxy = base;
	proxy['type'] = 'http';
	proxy['username'] = section.username;
	proxy['password'] = section.password;
	apply_tls_common(proxy, section);
	return proxy;
};

function build_socks(section, base) {
	const proxy = base;
	proxy['type'] = 'socks5';
	proxy['username'] = section.username;
	proxy['password'] = section.password;
	proxy['udp'] = true;
	return proxy;
};

function build_ssh(section, base) {
	const proxy = base;
	proxy['type'] = 'ssh';
	proxy['username'] = section.username;
	proxy['private-key'] = length(uci_array(section.ssh_priv_key)) > 0
		? join('\n', uci_array(section.ssh_priv_key))
		: null;
	proxy['private-key-passphrase'] = section.ssh_priv_key_pp;
	const hostKeys = uci_array(section.ssh_host_key);
	if (length(hostKeys) > 0) {
		proxy['host-key'] = hostKeys;
	}
	const hostKeyAlgos = uci_array(section.ssh_host_key_algo);
	if (length(hostKeyAlgos) > 0) {
		proxy['host-key-algorithms'] = hostKeyAlgos;
	}
	proxy['client-version'] = section.ssh_client_version;
	return proxy;
};

function build_shadowsocks(section, base) {
	const proxy = base;
	proxy['type'] = 'ss';
	proxy['cipher'] = section.shadowsocks_encrypt_method;
	proxy['password'] = section.password;
	proxy['udp'] = true;

	if (section.shadowsocks_plugin) {
		proxy['plugin'] = section.shadowsocks_plugin == 'v2ray-plugin' ? 'v2ray-plugin' : 'obfs';
		const opts = {};
		const raw = section.shadowsocks_plugin_opts ?? '';
		for (let kv in split(raw, ';')) {
			const pair = split(kv, '=');
			if (length(pair) == 2) {
				opts[pair[0]] = pair[1];
			}
		}
		if (section.shadowsocks_plugin == 'obfs-local') {
			proxy['plugin'] = 'obfs';
			proxy['plugin-opts'] = trim_all({
				mode: opts['obfs'],
				host: opts['obfs-host'],
			});
		} else {
			proxy['plugin-opts'] = trim_all({
				mode: opts['mode'],
				host: opts['host'],
				path: opts['path'],
				tls: opts['tls'] != null,
			});
		}
	}

	apply_multiplex(proxy, section);
	return proxy;
};

function build_shadowtls(section, base) {
	const proxy = base;
	proxy['type'] = 'ss';
	proxy['cipher'] = section.shadowsocks_encrypt_method ?? 'none';
	proxy['password'] = section.password;
	proxy['plugin'] = 'shadow-tls';
	proxy['plugin-opts'] = trim_all({
		host: section.tls_sni,
		password: section.password,
		version: uci_int(section.shadowtls_version),
	});
	return proxy;
};

function build_trojan(section, base) {
	const proxy = base;
	proxy['type'] = 'trojan';
	proxy['password'] = section.password;
	proxy['udp'] = true;
	apply_tls_common(proxy, section);
	apply_transport(proxy, section, ['ws', 'grpc']);
	apply_multiplex(proxy, section);
	return proxy;
};

function build_vmess(section, base) {
	const proxy = base;
	proxy['type'] = 'vmess';
	proxy['uuid'] = section.uuid;
	proxy['alterId'] = uci_int(section.vmess_alterid) ?? 0;
	proxy['cipher'] = section.vmess_encrypt ?? 'auto';
	proxy['udp'] = true;

	const pe = section.packet_encoding;
	if (pe == 'xudp') {
		proxy['xudp'] = true;
	} else if (pe == 'packetaddr') {
		proxy['packet-addr'] = true;
	}

	apply_tls_common(proxy, section);
	apply_transport(proxy, section, ['ws', 'grpc', 'http', 'httpupgrade']);
	apply_multiplex(proxy, section);
	return proxy;
};

function build_vless(section, base) {
	const proxy = base;
	proxy['type'] = 'vless';
	proxy['uuid'] = section.uuid;
	proxy['udp'] = true;
	if (section.vless_flow) {
		proxy['flow'] = section.vless_flow;
	}

	const pe = section.packet_encoding;
	if (pe == 'xudp') {
		proxy['xudp'] = true;
	} else if (pe == 'packetaddr') {
		proxy['packet-addr'] = true;
	}

	apply_tls_common(proxy, section);
	apply_transport(proxy, section, ['ws', 'grpc', 'http', 'httpupgrade']);
	apply_multiplex(proxy, section);
	return proxy;
};

function build_hysteria(section, base) {
	const proxy = base;
	proxy['type'] = 'hysteria';
	proxy['auth-str'] = section.hysteria_auth_type == 'string' ? section.hysteria_auth_payload : null;
	proxy['auth_str'] = proxy['auth-str'];
	proxy['up'] = uci_int(section.hysteria_up_mbps);
	proxy['down'] = uci_int(section.hysteria_down_mbps);
	proxy['obfs'] = section.hysteria_obfs_password ? 'xplus' : null;
	proxy['obfs-param'] = section.hysteria_obfs_password;
	proxy['protocol'] = section.hysteria_protocol ?? 'udp';
	proxy['disable_mtu_discovery'] = uci_bool(section.hysteria_disable_mtu_discovery);
	proxy['recv-window-conn'] = uci_int(section.hysteria_recv_window_conn);
	proxy['recv-window'] = uci_int(section.hysteria_revc_window);

	const hop = uci_array(section.hysteria_hopping_port);
	if (length(hop) > 0) {
		proxy['ports'] = join(',', hop);
		proxy['hop-interval'] = uci_int(section.hysteria_hop_interval);
	}

	proxy['sni'] = section.tls_sni;
	const alpn = uci_array(section.tls_alpn);
	if (length(alpn) > 0) {
		proxy['alpn'] = alpn;
	}
	proxy['skip-cert-verify'] = uci_bool(section.tls_insecure);

	return proxy;
};

function build_hysteria2(section, base) {
	const proxy = base;
	proxy['type'] = 'hysteria2';
	proxy['password'] = section.password;
	proxy['up'] = uci_int(section.hysteria_up_mbps);
	proxy['down'] = uci_int(section.hysteria_down_mbps);

	if (section.hysteria_obfs_type) {
		proxy['obfs'] = section.hysteria_obfs_type;
		proxy['obfs-password'] = section.hysteria_obfs_password;
	}

	const hop = uci_array(section.hysteria_hopping_port);
	if (length(hop) > 0) {
		proxy['ports'] = join(',', hop);
		proxy['hop-interval'] = uci_int(section.hysteria_hop_interval);
	}

	proxy['sni'] = section.tls_sni;
	proxy['skip-cert-verify'] = uci_bool(section.tls_insecure);

	return proxy;
};

function build_tuic(section, base) {
	const proxy = base;
	proxy['type'] = 'tuic';
	proxy['uuid'] = section.uuid;
	proxy['password'] = section.password;
	proxy['udp'] = true;
	proxy['congestion-controller'] = section.tuic_congestion_control ?? 'cubic';
	proxy['udp-relay-mode'] = section.tuic_udp_relay_mode ?? 'native';
	proxy['udp-over-stream'] = uci_bool(section.tuic_udp_over_stream);
	proxy['reduce-rtt'] = uci_bool(section.tuic_enable_zero_rtt);
	proxy['heartbeat-interval'] = uci_int(section.tuic_heartbeat);

	proxy['sni'] = section.tls_sni;
	const alpn = uci_array(section.tls_alpn);
	if (length(alpn) > 0) {
		proxy['alpn'] = alpn;
	}

	return proxy;
};

function build_anytls(section, base) {
	const proxy = base;
	proxy['type'] = 'anytls';
	proxy['password'] = section.password;
	proxy['udp'] = true;
	proxy['idle-session-check-interval'] = uci_int(section.anytls_idle_session_check_interval);
	proxy['idle-session-timeout'] = uci_int(section.anytls_idle_session_timeout);
	proxy['min-idle-session'] = uci_int(section.anytls_min_idle_session);

	apply_tls_common(proxy, section);
	return proxy;
};

function build_wireguard(section, base) {
	const proxy = base;
	proxy['type'] = 'wireguard';
	proxy['private-key'] = section.wireguard_private_key;
	proxy['public-key'] = section.wireguard_peer_public_key;
	proxy['pre-shared-key'] = section.wireguard_pre_shared_key;
	proxy['udp'] = true;

	const addrs = uci_array(section.wireguard_local_address);
	for (let addr in addrs) {
		if (match(addr, /:/)) {
			proxy['ipv6'] = split(addr, '/')[0];
		} else {
			proxy['ip'] = split(addr, '/')[0];
		}
	}

	const reserved = uci_array(section.wireguard_reserved);
	if (length(reserved) == 3) {
		proxy['reserved'] = map(reserved, (x) => int(x));
	}

	proxy['mtu'] = uci_int(section.wireguard_mtu);
	proxy['persistent-keepalive'] = uci_int(section.wireguard_persistent_keepalive_interval);

	return proxy;
};

const builders = {
	direct: build_direct,
	http: build_http,
	socks: build_socks,
	ssh: build_ssh,
	shadowsocks: build_shadowsocks,
	shadowtls: build_shadowtls,
	trojan: build_trojan,
	vmess: build_vmess,
	vless: build_vless,
	hysteria: build_hysteria,
	hysteria2: build_hysteria2,
	tuic: build_tuic,
	anytls: build_anytls,
	wireguard: build_wireguard,
};

export function build_proxies() {
	const proxies = [];

	uci.foreach('nikki', 'node', (section) => {
		if (uci_bool(section.enabled) === false) {
			return;
		}

		const builder = builders[section.type];
		if (!builder) {
			return;
		}

		const base = {
			name: section.label ?? `${section.address}:${section.port}`,
			server: section.address,
			port: uci_int(section.port),
		};

		if (uci_bool(section.tcp_fast_open)) {
			base['tfo'] = true;
		}
		if (uci_bool(section.tcp_multi_path)) {
			base['mptcp'] = true;
		}

		const proxy = builder(section, base);
		if (proxy != null) {
			push(proxies, trim_all(proxy));
		}
	});

	return proxies;
};
