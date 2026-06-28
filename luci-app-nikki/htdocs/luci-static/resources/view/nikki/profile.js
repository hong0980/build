'use strict';
'require form';
'require view';
'require uci';
'require ui';
'require fs';
'require tools.nikki as nikki';

const shadowsocks_encrypt_methods = [
    'none',
    '2022-blake3-aes-128-gcm',
    '2022-blake3-aes-256-gcm',
    '2022-blake3-chacha20-poly1305',
    'aes-128-gcm',
    'aes-192-gcm',
    'aes-256-gcm',
    'aes-128-gcm-siv',
    'aes-256-gcm-siv',
    'chacha20-ietf-poly1305',
    'xchacha20-ietf-poly1305',
];

const tls_versions = [
    'TLS 1.0',
    'TLS 1.1',
    'TLS 1.2',
    'TLS 1.3',
];

const tls_cipher_suites = [
    'TLS_RSA_WITH_AES_128_CBC_SHA',
    'TLS_RSA_WITH_AES_256_CBC_SHA',
    'TLS_RSA_WITH_AES_128_GCM_SHA256',
    'TLS_RSA_WITH_AES_256_GCM_SHA384',
    'TLS_AES_128_GCM_SHA256',
    'TLS_AES_256_GCM_SHA384',
    'TLS_CHACHA20_POLY1305_SHA256',
    'TLS_ECDHE_ECDSA_WITH_AES_128_CBC_SHA',
    'TLS_ECDHE_ECDSA_WITH_AES_256_CBC_SHA',
    'TLS_ECDHE_RSA_WITH_AES_128_CBC_SHA',
    'TLS_ECDHE_RSA_WITH_AES_256_CBC_SHA',
    'TLS_ECDHE_ECDSA_WITH_AES_128_GCM_SHA256',
    'TLS_ECDHE_ECDSA_WITH_AES_256_GCM_SHA384',
    'TLS_ECDHE_RSA_WITH_AES_128_GCM_SHA256',
    'TLS_ECDHE_RSA_WITH_AES_256_GCM_SHA384',
    'TLS_ECDHE_ECDSA_WITH_CHACHA20_POLY1305_SHA256',
    'TLS_ECDHE_RSA_WITH_CHACHA20_POLY1305_SHA256',
];

function decodeBase64Str(str) {
    if (!str) return null;
    str = str.replace(/-/g, '+').replace(/_/g, '/');
    while (str.length % 4) str += '=';
    try {
        return decodeURIComponent(
            atob(str).split('').map(c =>
                '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)
            ).join('')
        );
    } catch (e) {
        return atob(str);
    }
}

function getRandom() {
    return Math.random().toString(36).slice(2, 12);
}

function loadDefaultLabel(uciconfig, section_id) {
    return uci.get(uciconfig, section_id, 'label')
        || uci.get(uciconfig, section_id, 'address') + ':' + uci.get(uciconfig, section_id, 'port')
        || section_id;
}

function loadModalTitle(defaultTitle, addTitle, uciconfig, section_id) {
    let label = uci.get(uciconfig, section_id, 'label');
    return label ? '%s: %s'.format(defaultTitle, label) : addTitle;
}

function validateUniqueValue(uciconfig, ucisection_type, ucifield, section_id, value) {
    if (!section_id || !value) return true;
    let found = false;
    uci.sections(uciconfig, ucisection_type, s => {
        if (s['.name'] !== section_id && s[ucifield] === value)
            found = true;
    });
    return found ? _('Expecting: %s').format(_('unique value')) : true;
}

function validateUUID(section_id, value) {
    if (!value) return true;
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
        ? true
        : _('Expecting: %s').format(_('valid UUID'));
}

function validateBase64Key(expectedLen, section_id, value) {
    if (!value) return true;
    try {
        let decoded = atob(value.replace(/-/g, '+').replace(/_/g, '/'));
        if (decoded.length === expectedLen / (4 / 3 * (4 / 3)) || true) {
            let bytes = Math.floor(value.replace(/=+$/, '').length * 3 / 4);
            if (Math.abs(bytes - (expectedLen === 44 ? 32 : expectedLen)) <= 2)
                return true;
        }
    } catch (e) {}
    return _('Expecting: %s').format(_('valid base64 key'));
}

function validatePortRange(section_id, value) {
    if (!value) return true;
    let parts = value.split('-');
    if (parts.length > 2) return _('Expecting: %s').format(_('valid port range'));
    for (let p of parts) {
        let n = parseInt(p);
        if (isNaN(n) || n < 1 || n > 65535)
            return _('Expecting: %s').format(_('valid port (1-65535)'));
    }
    if (parts.length === 2 && parseInt(parts[0]) > parseInt(parts[1]))
        return _('Expecting: %s').format(_('start port ≤ end port'));
    return true;
}

function validateCertificatePath(section_id, value) {
    if (!value) return true;
    return /^\//.test(value) ? true : _('Expecting: %s').format(_('absolute path'));
}

function uploadCertificate(type, name, ev) {
    return ui.uploadFile('/etc/nikki/certs/%s.pem'.format(name),
        _('Upload %s').format(type)
    ).then(btn => {
        ui.addNotification(null, E('p', _('Successfully uploaded %s.').format(type)));
    }).catch(e => {
        ui.addNotification(null, E('p', _('Failed to upload %s: %s').format(type, e.message)));
    });
}

const CBIStaticList = form.Value.extend({
    renderWidget: function (section_id, option_index, cfgvalue) {
        let values = L.toArray(cfgvalue);
        let choices = this.transformChoices();

        let widget = new ui.Dropdown(values, choices, {
            id: this.cbid(section_id),
            sort: true,
            multiple: true,
            optional: this.optional,
            select_placeholder: _('-- Please choose --'),
        });

        let el = widget.render();
        return el;
    },
});

function allowInsecureConfirm(ev, _section_id, value) {
    if (value === '1' && !confirm(_('Are you sure to allow insecure?')))
        ev.target.firstElementChild.checked = null;
}

function renderNodeSettings(section) {
    let s = section, o;
    s.rowcolors = true;
    s.sortable = true;
    s.nodescriptions = true;

    s.modaltitle = function (section_id) {
        return loadModalTitle(_('Node'), _('Add a node'), 'nikki', section_id);
    };
    s.sectiontitle = function (section_id) {
        return loadDefaultLabel('nikki', section_id);
    };

    o = s.option(form.Value, 'label', _('Label'));
    o.load = function (section_id) {
        return loadDefaultLabel('nikki', section_id);
    };
    o.validate = function (section_id, value) {
        return validateUniqueValue('nikki', 'node', 'label', section_id, value);
    };
    o.modalonly = true;

    o = s.option(form.ListValue, 'type', _('Type'));
    o.value('direct', _('Direct'));
    o.value('anytls', _('AnyTLS'));
    o.value('http', _('HTTP'));
    o.value('hysteria', _('Hysteria'));
    o.value('hysteria2', _('Hysteria2'));
    o.value('shadowsocks', _('Shadowsocks'));
    o.value('shadowtls', _('ShadowTLS'));
    o.value('socks', _('Socks'));
    o.value('ssh', _('SSH'));
    o.value('trojan', _('Trojan'));
    o.value('tuic', _('TUIC'));
    o.value('wireguard', _('WireGuard'));
    o.value('vless', _('VLESS'));
    o.value('vmess', _('VMess'));
    o.rmempty = false;

    o = s.option(form.Value, 'address', _('Address'));
    o.datatype = 'host';
    o.depends({ 'type': 'direct', '!reverse': true });
    o.rmempty = false;

    o = s.option(form.Value, 'port', _('Port'));
    o.datatype = 'port';
    o.depends({ 'type': 'direct', '!reverse': true });
    o.rmempty = false;

    o = s.option(form.Value, 'username', _('Username'));
    o.depends('type', 'http');
    o.depends('type', 'socks');
    o.depends('type', 'ssh');
    o.modalonly = true;

    o = s.option(form.Value, 'password', _('Password'));
    o.password = true;
    o.depends('type', 'anytls');
    o.depends('type', 'http');
    o.depends('type', 'hysteria2');
    o.depends('type', 'shadowsocks');
    o.depends('type', 'shadowtls');
    o.depends('type', 'ssh');
    o.depends('type', 'trojan');
    o.depends('type', 'tuic');
    o.depends({ 'type': 'socks', 'socks_version': '5' });
    o.validate = function (section_id, value) {
        if (section_id) {
            let type = this.section.formvalue(section_id, 'type');
            let required_type = ['anytls', 'shadowsocks', 'shadowtls', 'trojan'];
            if (required_type.includes(type)) {
                if (type === 'shadowsocks' || type === 'shadowtls') {
                    let encmode = this.section.formvalue(section_id, 'shadowsocks_encrypt_method');
                    if (encmode === 'none') return true;
                }
                if (!value)
                    return _('Expecting: %s').format(_('non-empty value'));
            }
        }
        return true;
    };
    o.modalonly = true;

    o = s.option(form.ListValue, 'proxy_protocol', _('Proxy protocol'),
        _('Write proxy protocol in the connection header.'));
    o.value('', _('Disable'));
    o.value('1', _('v1'));
    o.value('2', _('v2'));
    o.depends('type', 'direct');
    o.modalonly = true;

    o = s.option(form.Value, 'anytls_idle_session_check_interval', _('Idle session check interval'),
        _('Interval checking for idle sessions, in seconds.'));
    o.datatype = 'uinteger';
    o.placeholder = '30';
    o.depends('type', 'anytls');
    o.modalonly = true;

    o = s.option(form.Value, 'anytls_idle_session_timeout', _('Idle session check timeout'),
        _('In the check, close sessions that have been idle for longer than this, in seconds.'));
    o.datatype = 'uinteger';
    o.placeholder = '30';
    o.depends('type', 'anytls');
    o.modalonly = true;

    o = s.option(form.Value, 'anytls_min_idle_session', _('Minimum idle sessions'),
        _('In the check, at least the first <code>n</code> idle sessions are kept open.'));
    o.datatype = 'uinteger';
    o.placeholder = '0';
    o.depends('type', 'anytls');
    o.modalonly = true;

    o = s.option(form.DynamicList, 'hysteria_hopping_port', _('Hopping port'));
    o.depends('type', 'hysteria');
    o.depends('type', 'hysteria2');
    o.validate = function (section_id, value) { return validatePortRange(section_id, value); };
    o.modalonly = true;

    o = s.option(form.Value, 'hysteria_hop_interval', _('Hop interval'),
        _('Port hopping interval in seconds.'));
    o.datatype = 'uinteger';
    o.placeholder = '30';
    o.depends({ 'type': 'hysteria', 'hysteria_hopping_port': /[\s\S]/ });
    o.depends({ 'type': 'hysteria2', 'hysteria_hopping_port': /[\s\S]/ });
    o.modalonly = true;

    o = s.option(form.ListValue, 'hysteria_protocol', _('Protocol'));
    o.value('udp');
    o.default = 'udp';
    o.depends('type', 'hysteria');
    o.rmempty = false;
    o.modalonly = true;

    o = s.option(form.ListValue, 'hysteria_auth_type', _('Authentication type'));
    o.value('', _('Disable'));
    o.value('base64', _('Base64'));
    o.value('string', _('String'));
    o.depends('type', 'hysteria');
    o.modalonly = true;

    o = s.option(form.Value, 'hysteria_auth_payload', _('Authentication payload'));
    o.password = true;
    o.depends({ 'type': 'hysteria', 'hysteria_auth_type': /[\s\S]/ });
    o.rmempty = false;
    o.modalonly = true;

    o = s.option(form.ListValue, 'hysteria_obfs_type', _('Obfuscate type'));
    o.value('', _('Disable'));
    o.value('salamander', _('Salamander'));
    o.depends('type', 'hysteria2');
    o.modalonly = true;

    o = s.option(form.Value, 'hysteria_obfs_password', _('Obfuscate password'));
    o.password = true;
    o.depends('type', 'hysteria');
    o.depends({ 'type': 'hysteria2', 'hysteria_obfs_type': /[\s\S]/ });
    o.modalonly = true;

    o = s.option(form.Value, 'hysteria_down_mbps', _('Max download speed'),
        _('Max download speed in Mbps.'));
    o.datatype = 'uinteger';
    o.depends('type', 'hysteria');
    o.depends('type', 'hysteria2');
    o.modalonly = true;

    o = s.option(form.Value, 'hysteria_up_mbps', _('Max upload speed'),
        _('Max upload speed in Mbps.'));
    o.datatype = 'uinteger';
    o.depends('type', 'hysteria');
    o.depends('type', 'hysteria2');
    o.modalonly = true;

    o = s.option(form.Value, 'hysteria_recv_window_conn', _('QUIC stream receive window'),
        _('The QUIC stream-level flow control window for receiving data.'));
    o.datatype = 'uinteger';
    o.depends('type', 'hysteria');
    o.modalonly = true;

    o = s.option(form.Value, 'hysteria_revc_window', _('QUIC connection receive window'),
        _('The QUIC connection-level flow control window for receiving data.'));
    o.datatype = 'uinteger';
    o.depends('type', 'hysteria');
    o.modalonly = true;

    o = s.option(form.Flag, 'hysteria_disable_mtu_discovery', _('Disable Path MTU discovery'),
        _('Disables Path MTU Discovery (RFC 8899). Packets will then be at most 1252 (IPv4) / 1232 (IPv6) bytes in size.'));
    o.depends('type', 'hysteria');
    o.modalonly = true;

    o = s.option(form.ListValue, 'shadowsocks_encrypt_method', _('Encrypt method'));
    for (let i of shadowsocks_encrypt_methods) o.value(i);
    o.value('aes-128-ctr');
    o.value('aes-192-ctr');
    o.value('aes-256-ctr');
    o.value('aes-128-cfb');
    o.value('aes-192-cfb');
    o.value('aes-256-cfb');
    o.value('chacha20');
    o.value('chacha20-ietf');
    o.value('rc4-md5');
    o.default = 'aes-128-gcm';
    o.depends('type', 'shadowsocks');
    o.depends('type', 'shadowtls');
    o.rmempty = false;
    o.modalonly = true;

    o = s.option(form.ListValue, 'shadowsocks_plugin', _('Plugin'));
    o.value('', _('none'));
    o.value('obfs-local');
    o.value('v2ray-plugin');
    o.depends('type', 'shadowsocks');
    o.modalonly = true;

    o = s.option(form.Value, 'shadowsocks_plugin_opts', _('Plugin opts'));
    o.depends('shadowsocks_plugin', 'obfs-local');
    o.depends('shadowsocks_plugin', 'v2ray-plugin');
    o.modalonly = true;

    o = s.option(form.ListValue, 'shadowtls_version', _('ShadowTLS version'));
    o.value('1', _('v1'));
    o.value('2', _('v2'));
    o.value('3', _('v3'));
    o.default = '1';
    o.depends('type', 'shadowtls');
    o.rmempty = false;
    o.modalonly = true;

    o = s.option(form.Value, 'shadowtls_password', _('ShadowTLS tunnel password'),
        _('Authentication password for the shadow-tls plugin layer itself, separate from the underlying Shadowsocks password above.'));
    o.password = true;
    o.depends({ 'type': 'shadowtls', 'shadowtls_version': '2' });
    o.depends({ 'type': 'shadowtls', 'shadowtls_version': '3' });
    o.modalonly = true;

    o = s.option(form.ListValue, 'socks_version', _('Socks version'));
    o.value('4', _('Socks4'));
    o.value('4a', _('Socks4A'));
    o.value('5', _('Socks5'));
    o.default = '5';
    o.depends('type', 'socks');
    o.rmempty = false;
    o.modalonly = true;

    o = s.option(form.Value, 'ssh_client_version', _('Client version'),
        _('Random version will be used if empty.'));
    o.depends('type', 'ssh');
    o.modalonly = true;

    o = s.option(form.DynamicList, 'ssh_host_key', _('Host key'),
        _('Accept any if empty.'));
    o.depends('type', 'ssh');
    o.modalonly = true;

    o = s.option(form.DynamicList, 'ssh_host_key_algo', _('Host key algorithms'));
    o.depends('type', 'ssh');
    o.modalonly = true;

    o = s.option(form.DynamicList, 'ssh_priv_key', _('Private key'));
    o.password = true;
    o.depends('type', 'ssh');
    o.modalonly = true;

    o = s.option(form.Value, 'ssh_priv_key_pp', _('Private key passphrase'));
    o.password = true;
    o.depends('type', 'ssh');
    o.modalonly = true;

    o = s.option(form.Value, 'uuid', _('UUID'));
    o.password = true;
    o.depends('type', 'tuic');
    o.depends('type', 'vless');
    o.depends('type', 'vmess');
    o.validate = function (section_id, value) { return validateUUID(section_id, value); };
    o.modalonly = true;

    o = s.option(form.ListValue, 'tuic_congestion_control', _('Congestion control algorithm'),
        _('QUIC congestion control algorithm.'));
    o.value('cubic', _('CUBIC'));
    o.value('new_reno', _('New Reno'));
    o.value('bbr', _('BBR'));
    o.default = 'cubic';
    o.depends('type', 'tuic');
    o.rmempty = false;
    o.modalonly = true;

    o = s.option(form.ListValue, 'tuic_udp_relay_mode', _('UDP relay mode'),
        _('UDP packet relay mode.'));
    o.value('', _('Default'));
    o.value('native', _('Native'));
    o.value('quic', _('QUIC'));
    o.depends('type', 'tuic');
    o.modalonly = true;

    o = s.option(form.Flag, 'tuic_udp_over_stream', _('UDP over stream'),
        _('QUIC stream based UDP relay mode.'));
    o.depends({ 'type': 'tuic', 'tuic_udp_relay_mode': '' });
    o.modalonly = true;

    o = s.option(form.Flag, 'tuic_enable_zero_rtt', _('Enable 0-RTT handshake'),
        _('Enable 0-RTT QUIC connection handshake on the client side. ' +
            'Disabling this is highly recommended, as it is vulnerable to replay attacks.'));
    o.depends('type', 'tuic');
    o.modalonly = true;

    o = s.option(form.Value, 'tuic_heartbeat', _('Heartbeat interval'),
        _('Interval for sending heartbeat packets for keeping the connection alive (in seconds).'));
    o.datatype = 'uinteger';
    o.default = '10';
    o.depends('type', 'tuic');
    o.modalonly = true;

    o = s.option(form.ListValue, 'vless_flow', _('Flow'));
    o.value('', _('None'));
    o.value('xtls-rprx-vision');
    o.depends('type', 'vless');
    o.modalonly = true;

    o = s.option(form.Value, 'vmess_alterid', _('Alter ID'),
        _('Legacy protocol support (VMess MD5 Authentication) is provided for compatibility purposes only, ' +
            'use of alterId > 1 is not recommended.'));
    o.datatype = 'uinteger';
    o.depends('type', 'vmess');
    o.modalonly = true;

    o = s.option(form.ListValue, 'vmess_encrypt', _('Encrypt method'));
    o.value('auto');
    o.value('none');
    o.value('zero');
    o.value('aes-128-gcm');
    o.value('chacha20-poly1305');
    o.default = 'auto';
    o.depends('type', 'vmess');
    o.rmempty = false;
    o.modalonly = true;

    o = s.option(form.Flag, 'vmess_global_padding', _('Global padding'),
        _('Protocol parameter. Will waste traffic randomly if enabled.'));
    o.default = o.enabled;
    o.depends('type', 'vmess');
    o.rmempty = false;
    o.modalonly = true;

    o = s.option(form.Flag, 'vmess_authenticated_length', _('Authenticated length'),
        _('Protocol parameter. Enable length block encryption.'));
    o.depends('type', 'vmess');
    o.modalonly = true;

    o = s.option(form.ListValue, 'transport', _('Transport'),
        _('No TCP transport, plain HTTP is merged into the HTTP transport.'));
    o.value('', _('None'));
    o.value('grpc', _('gRPC'));
    o.value('httpupgrade', _('HTTPUpgrade'));
    o.value('ws', _('WebSocket'));
    o.depends('type', 'trojan');
    o.modalonly = true;

    o = s.option(form.ListValue, 'transport', _('Transport'),
        _('No TCP transport, plain HTTP is merged into the HTTP transport.'));
    o.value('', _('None'));
    o.value('grpc', _('gRPC'));
    o.value('http', _('HTTP'));
    o.value('httpupgrade', _('HTTPUpgrade'));
    o.value('ws', _('WebSocket'));
    o.depends('type', 'vless');
    o.depends('type', 'vmess');
    o.onchange = function (ev, section_id, value) {
        let desc = this.map.findElement('id', 'cbid.nikki.%s.transport'.format(section_id)).nextElementSibling;
        if (value === 'http')
            desc.innerHTML = _('TLS is not enforced. If TLS is not configured, plain HTTP 1.1 is used.');
        else
            desc.innerHTML = _('No TCP transport, plain HTTP is merged into the HTTP transport.');

        let tls = this.map.findElement('id', 'cbid.nikki.%s.tls'.format(section_id)).firstElementChild;
        if (value === 'http' && tls.checked) {
            this.map.findElement('id', 'cbid.nikki.%s.http_idle_timeout'.format(section_id)).nextElementSibling.innerHTML =
                _('Specifies the period of time (in seconds) after which a health check will be performed using a ping frame if no frames have been received on the connection.');
            this.map.findElement('id', 'cbid.nikki.%s.http_ping_timeout'.format(section_id)).nextElementSibling.innerHTML =
                _('Specifies the timeout duration (in seconds) after sending a PING frame, within which a response must be received.');
        } else if (value === 'grpc') {
            this.map.findElement('id', 'cbid.nikki.%s.http_idle_timeout'.format(section_id)).nextElementSibling.innerHTML =
                _('If the transport doesn\'t see any activity after a duration of this time (in seconds), it pings the client to check if the connection is still active.');
            this.map.findElement('id', 'cbid.nikki.%s.http_ping_timeout'.format(section_id)).nextElementSibling.innerHTML =
                _('The timeout (in seconds) that after performing a keepalive check, the client will wait for activity. If no activity is detected, the connection will be closed.');
        }
    };
    o.modalonly = true;

    o = s.option(form.Value, 'grpc_servicename', _('gRPC service name'),
        _('Required by mihomo — leaving this empty will cause the connection to fail.'));
    o.depends('transport', 'grpc');
    o.modalonly = true;

    o = s.option(form.Flag, 'grpc_permit_without_stream', _('gRPC permit without stream'),
        _('If enabled, the client transport sends keepalive pings even with no active connections.'));
    o.depends('transport', 'grpc');
    o.modalonly = true;

    o = s.option(form.DynamicList, 'http_host', _('Host'));
    o.datatype = 'hostname';
    o.depends('transport', 'http');
    o.modalonly = true;

    o = s.option(form.Value, 'httpupgrade_host', _('Host'));
    o.datatype = 'hostname';
    o.depends('transport', 'httpupgrade');
    o.modalonly = true;

    o = s.option(form.Value, 'http_path', _('Path'));
    o.depends('transport', 'http');
    o.depends('transport', 'httpupgrade');
    o.modalonly = true;

    o = s.option(form.Value, 'http_method', _('Method'));
    o.value('GET', _('GET'));
    o.value('PUT', _('PUT'));
    o.depends('transport', 'http');
    o.modalonly = true;

    o = s.option(form.Value, 'http_idle_timeout', _('Idle timeout'),
        _('Specifies the period of time (in seconds) after which a health check will be performed using a ping frame if no frames have been received on the connection.'));
    o.datatype = 'uinteger';
    o.depends('transport', 'grpc');
    o.depends({ 'transport': 'http', 'tls': '1' });
    o.modalonly = true;

    o = s.option(form.Value, 'http_ping_timeout', _('Ping timeout'),
        _('Specifies the timeout duration (in seconds) after sending a PING frame, within which a response must be received.'));
    o.datatype = 'uinteger';
    o.depends('transport', 'grpc');
    o.depends({ 'transport': 'http', 'tls': '1' });
    o.modalonly = true;

    o = s.option(form.Value, 'ws_host', _('Host'));
    o.depends('transport', 'ws');
    o.modalonly = true;

    o = s.option(form.Value, 'ws_path', _('Path'));
    o.depends('transport', 'ws');
    o.modalonly = true;

    o = s.option(form.Value, 'websocket_early_data', _('Early data'),
        _('Allowed payload size is in the request.'));
    o.datatype = 'uinteger';
    o.value('2048');
    o.depends('transport', 'ws');
    o.modalonly = true;

    o = s.option(form.Value, 'websocket_early_data_header', _('Early data header name'));
    o.value('Sec-WebSocket-Protocol');
    o.depends('transport', 'ws');
    o.modalonly = true;

    o = s.option(form.ListValue, 'packet_encoding', _('Packet encoding'));
    o.value('', _('none'));
    o.value('packetaddr', _('packet addr (v2ray-core v5+)'));
    o.value('xudp', _('Xudp (Xray-core)'));
    o.depends('type', 'vless');
    o.depends('type', 'vmess');
    o.modalonly = true;

    o = s.option(form.DynamicList, 'wireguard_local_address', _('Local address'),
        _('List of IP (v4 or v6) addresses prefixes to be assigned to the interface.'));
    o.datatype = 'cidr';
    o.depends('type', 'wireguard');
    o.rmempty = false;
    o.modalonly = true;

    o = s.option(form.Value, 'wireguard_private_key', _('Private key'),
        _('WireGuard requires base64-encoded private keys.'));
    o.password = true;
    o.depends('type', 'wireguard');
    o.validate = function (section_id, value) { return validateBase64Key(44, section_id, value); };
    o.rmempty = false;
    o.modalonly = true;

    o = s.option(form.Value, 'wireguard_peer_public_key', _('Peer public key'),
        _('WireGuard peer public key.'));
    o.depends('type', 'wireguard');
    o.validate = function (section_id, value) { return validateBase64Key(44, section_id, value); };
    o.rmempty = false;
    o.modalonly = true;

    o = s.option(form.Value, 'wireguard_pre_shared_key', _('Pre-shared key'),
        _('WireGuard pre-shared key.'));
    o.password = true;
    o.depends('type', 'wireguard');
    o.validate = function (section_id, value) { return validateBase64Key(44, section_id, value); };
    o.modalonly = true;

    o = s.option(form.DynamicList, 'wireguard_reserved', _('Reserved field bytes'));
    o.datatype = 'integer';
    o.depends('type', 'wireguard');
    o.modalonly = true;

    o = s.option(form.Value, 'wireguard_mtu', _('MTU'));
    o.datatype = 'range(0,9000)';
    o.placeholder = '1408';
    o.depends('type', 'wireguard');
    o.modalonly = true;

    o = s.option(form.Value, 'wireguard_persistent_keepalive_interval', _('Persistent keepalive interval'),
        _('In seconds. Disabled by default.'));
    o.datatype = 'uinteger';
    o.depends('type', 'wireguard');
    o.modalonly = true;

    o = s.option(form.Flag, 'multiplex', _('Multiplex'));
    o.depends('type', 'shadowsocks');
    o.depends('type', 'trojan');
    o.depends('type', 'vless');
    o.depends('type', 'vmess');
    o.modalonly = true;

    o = s.option(form.ListValue, 'multiplex_protocol', _('Protocol'),
        _('Multiplex protocol.'));
    o.value('h2mux');
    o.value('smux');
    o.value('yamux');
    o.default = 'h2mux';
    o.depends('multiplex', '1');
    o.rmempty = false;
    o.modalonly = true;

    o = s.option(form.Value, 'multiplex_max_connections', _('Maximum connections'));
    o.datatype = 'uinteger';
    o.depends('multiplex', '1');
    o.modalonly = true;

    o = s.option(form.Value, 'multiplex_min_streams', _('Minimum streams'),
        _('Minimum multiplexed streams in a connection before opening a new connection.'));
    o.datatype = 'uinteger';
    o.depends('multiplex', '1');
    o.modalonly = true;

    o = s.option(form.Value, 'multiplex_max_streams', _('Maximum streams'),
        _('Maximum multiplexed streams in a connection before opening a new connection.<br/>' +
            'Conflict with <code>%s</code> and <code>%s</code>.').format(
                _('Maximum connections'), _('Minimum streams')));
    o.datatype = 'uinteger';
    o.depends({ 'multiplex': '1', 'multiplex_max_connections': '', 'multiplex_min_streams': '' });
    o.modalonly = true;

    o = s.option(form.Flag, 'multiplex_padding', _('Enable padding'));
    o.depends('multiplex', '1');
    o.modalonly = true;

    o = s.option(form.Flag, 'multiplex_brutal', _('Enable TCP Brutal'),
        _('Enable TCP Brutal congestion control algorithm'));
    o.depends('multiplex', '1');
    o.modalonly = true;

    o = s.option(form.Value, 'multiplex_brutal_down', _('Download bandwidth'),
        _('Download bandwidth in Mbps.'));
    o.datatype = 'uinteger';
    o.depends('multiplex_brutal', '1');
    o.modalonly = true;

    o = s.option(form.Value, 'multiplex_brutal_up', _('Upload bandwidth'),
        _('Upload bandwidth in Mbps.'));
    o.datatype = 'uinteger';
    o.depends('multiplex_brutal', '1');
    o.modalonly = true;

    o = s.option(form.Flag, 'tls', _('TLS'));
    o.depends('type', 'anytls');
    o.depends('type', 'http');
    o.depends('type', 'hysteria');
    o.depends('type', 'hysteria2');
    o.depends('type', 'shadowtls');
    o.depends('type', 'trojan');
    o.depends('type', 'tuic');
    o.depends('type', 'vless');
    o.depends('type', 'vmess');
    o.validate = function (section_id, _value) {
        if (section_id) {
            let type = this.map.lookupOption('type', section_id)[0].formvalue(section_id);
            let tls = this.map.findElement('id', 'cbid.nikki.%s.tls'.format(section_id)).firstElementChild;
            if (['anytls', 'hysteria', 'hysteria2', 'shadowtls', 'tuic'].includes(type)) {
                tls.checked = true;
                tls.disabled = true;
            } else {
                tls.disabled = null;
            }
        }
        return true;
    };
    o.modalonly = true;

    o = s.option(form.Value, 'tls_sni', _('TLS SNI'),
        _('Used to verify the hostname on the returned certificates unless insecure is given.'));
    o.depends('tls', '1');
    o.modalonly = true;

    o = s.option(form.DynamicList, 'tls_alpn', _('TLS ALPN'),
        _('List of supported application level protocols, in order of preference.'));
    o.depends('tls', '1');
    o.modalonly = true;

    o = s.option(form.Flag, 'tls_insecure', _('Allow insecure'),
        _('Allow insecure connection at TLS client.') +
        '<br/>' +
        _('This is <strong>DANGEROUS</strong>, your traffic is almost like <strong>PLAIN TEXT</strong>! Use at your own risk!'));
    o.depends('tls', '1');
    o.onchange = allowInsecureConfirm;
    o.modalonly = true;

    o = s.option(form.ListValue, 'tls_min_version', _('Minimum TLS version'),
        _('The minimum TLS version that is acceptable.'));
    o.value('', _('default'));
    for (let i of tls_versions) o.value(i);
    o.depends('tls', '1');
    o.modalonly = true;

    o = s.option(form.ListValue, 'tls_max_version', _('Maximum TLS version'),
        _('The maximum TLS version that is acceptable.'));
    o.value('', _('default'));
    for (let i of tls_versions) o.value(i);
    o.depends('tls', '1');
    o.modalonly = true;

    o = s.option(CBIStaticList, 'tls_cipher_suites', _('Cipher suites'),
        _('The elliptic curves that will be used in an ECDHE handshake, in preference order. If empty, the default will be used.'));
    for (let i of tls_cipher_suites) o.value(i);
    o.depends('tls', '1');
    o.optional = true;
    o.modalonly = true;

    o = s.option(form.Flag, 'tls_self_sign', _('Append self-signed certificate'),
        _('If you have the root certificate, use this option instead of allowing insecure.'));
    o.depends('tls_insecure', '0');
    o.modalonly = true;

    o = s.option(form.Value, 'tls_cert_path', _('Certificate path'),
        _('The path to the server certificate, in PEM format.'));
    o.value('/etc/nikki/certs/client_ca.pem');
    o.depends('tls_self_sign', '1');
    o.validate = function (section_id, value) { return validateCertificatePath(section_id, value); };
    o.rmempty = false;
    o.modalonly = true;

    o = s.option(form.Button, '_upload_cert', _('Upload certificate'),
        _('<strong>Save your configuration before uploading files!</strong>'));
    o.inputstyle = 'action';
    o.inputtitle = _('Upload...');
    o.depends({ 'tls_self_sign': '1', 'tls_cert_path': '/etc/nikki/certs/client_ca.pem' });
    o.onclick = function (ev) { return uploadCertificate(_('certificate'), 'client_ca', ev); };
    o.modalonly = true;

    o = s.option(form.Flag, 'tls_ech', _('Enable ECH'),
        _('ECH (Encrypted Client Hello) is a TLS extension that allows a client to encrypt the first part of its ClientHello message.'));
    o.depends('tls', '1');
    o.modalonly = true;

    o = s.option(form.Value, 'tls_ech_config_path', _('ECH config path'),
        _('The path to the ECH config, in PEM format. If empty, load from DNS will be attempted.'));
    o.value('/etc/nikki/certs/client_ech_conf.pem');
    o.depends('tls_ech', '1');
    o.modalonly = true;

    o = s.option(form.Button, '_upload_ech_config', _('Upload ECH config'),
        _('<strong>Save your configuration before uploading files!</strong>'));
    o.inputstyle = 'action';
    o.inputtitle = _('Upload...');
    o.depends({ 'tls_ech': '1', 'tls_ech_config_path': '/etc/nikki/certs/client_ech_conf.pem' });
    o.onclick = function (ev) { return uploadCertificate(_('ECH config'), 'client_ech_conf', ev); };
    o.modalonly = true;

    o = s.option(form.ListValue, 'tls_utls', _('uTLS fingerprint'),
        _('uTLS is a fork of "crypto/tls", which provides ClientHello fingerprinting resistance.'));
    o.value('', _('Disable'));
    o.value('chrome');
    o.value('firefox');
    o.value('safari');
    o.value('iOS');
    o.value('android');
    o.value('edge');
    o.value('360');
    o.value('qq');
    o.value('random');
    o.depends({ 'tls': '1', 'type': 'vmess' });
    o.depends({ 'tls': '1', 'type': 'vless' });
    o.depends({ 'tls': '1', 'type': 'trojan' });
    o.depends({ 'tls': '1', 'type': 'anytls' });
    o.depends('type', 'shadowtls');
    o.validate = function (section_id, value) {
        if (section_id) {
            let tls_reality = this.map.findElement('id', 'cbid.nikki.%s.tls_reality'.format(section_id)).firstElementChild;
            if (tls_reality.checked && !value)
                return _('Expecting: %s').format(_('non-empty value'));
            let vless_flow = this.map.lookupOption('vless_flow', section_id)[0].formvalue(section_id);
            if ((tls_reality.checked || vless_flow) && ['360', 'android'].includes(value))
                return _('Unsupported fingerprint!');
        }
        return true;
    };
    o.modalonly = true;

    o = s.option(form.Flag, 'tls_reality', _('REALITY'));
    o.depends({ 'tls': '1', 'type': 'anytls' });
    o.depends({ 'tls': '1', 'type': 'vless' });
    o.modalonly = true;

    o = s.option(form.Value, 'tls_reality_public_key', _('REALITY public key'));
    o.password = true;
    o.depends('tls_reality', '1');
    o.rmempty = false;
    o.modalonly = true;

    o = s.option(form.Value, 'tls_reality_short_id', _('REALITY short ID'));
    o.password = true;
    o.depends('tls_reality', '1');
    o.modalonly = true;

    o = s.option(form.Flag, 'tcp_fast_open', _('TCP fast open'));
    o.modalonly = true;

    o = s.option(form.Flag, 'tcp_multi_path', _('MultiPath TCP'));
    o.modalonly = true;

    return s;
}

function map_utls_fp_alias(fp) {
    if (!fp) return fp;
    if (fp.toLowerCase() === 'ios') return 'iOS';
    return fp;
}

function parseShareLink(uri) {
    let config, url, params;

    uri = uri.split('://');
    if (uri[0] && uri[1]) {
        switch (uri[0]) {
            case 'anytls': {
                url = new URL('http://' + uri[1]);
                params = url.searchParams;
                if (!url.username) return null;
                config = {
                    label: url.hash ? decodeURIComponent(url.hash.slice(1)) : null,
                    type: 'anytls',
                    address: url.hostname,
                    port: url.port || '80',
                    password: decodeURIComponent(url.username),
                    tls: '1',
                    tls_sni: params.get('sni'),
                    tls_insecure: (params.get('insecure') === '1') ? '1' : '0'
                };
                break;
            }
            case 'http':
            case 'https': {
                url = new URL('http://' + uri[1]);
                config = {
                    label: url.hash ? decodeURIComponent(url.hash.slice(1)) : null,
                    type: 'http',
                    address: url.hostname,
                    port: url.port || '80',
                    username: url.username ? decodeURIComponent(url.username) : null,
                    password: url.password ? decodeURIComponent(url.password) : null,
                    tls: (uri[0] === 'https') ? '1' : '0'
                };
                break;
            }
            case 'hysteria': {
                url = new URL('http://' + uri[1]);
                params = url.searchParams;
                if (params.get('protocol') && params.get('protocol') !== 'udp')
                    return null;
                config = {
                    label: url.hash ? decodeURIComponent(url.hash.slice(1)) : null,
                    type: 'hysteria',
                    address: url.hostname,
                    port: url.port || '80',
                    hysteria_protocol: params.get('protocol') || 'udp',
                    hysteria_auth_type: params.get('auth') ? 'string' : null,
                    hysteria_auth_payload: params.get('auth'),
                    hysteria_obfs_password: params.get('obfsParam'),
                    hysteria_down_mbps: params.get('downmbps'),
                    hysteria_up_mbps: params.get('upmbps'),
                    tls: '1',
                    tls_sni: params.get('peer'),
                    tls_alpn: params.get('alpn'),
                    tls_insecure: (params.get('insecure') === '1') ? '1' : '0'
                };
                break;
            }
            case 'hysteria2':
            case 'hy2': {
                url = new URL('http://' + uri[1]);
                params = url.searchParams;
                config = {
                    label: url.hash ? decodeURIComponent(url.hash.slice(1)) : null,
                    type: 'hysteria2',
                    address: url.hostname,
                    port: url.port || '80',
                    password: url.username ? decodeURIComponent(url.username + (url.password ? ':' + url.password : '')) : null,
                    hysteria_obfs_type: params.get('obfs'),
                    hysteria_obfs_password: params.get('obfs-password'),
                    tls: '1',
                    tls_sni: params.get('sni'),
                    tls_insecure: params.get('insecure') ? '1' : '0'
                };
                break;
            }
            case 'socks':
            case 'socks4':
            case 'socks4a':
            case 'socks5':
            case 'socks5h': {
                url = new URL('http://' + uri[1]);
                config = {
                    label: url.hash ? decodeURIComponent(url.hash.slice(1)) : null,
                    type: 'socks',
                    address: url.hostname,
                    port: url.port || '80',
                    username: url.username ? decodeURIComponent(url.username) : null,
                    password: url.password ? decodeURIComponent(url.password) : null,
                    socks_version: uri[0].includes('4') ? '4' : '5'
                };
                break;
            }
            case 'ss': {
                try {
                    try {
                        let suri = uri[1].split('#'), slabel = '';
                        if (suri.length <= 2) {
                            if (suri.length === 2) slabel = '#' + suri[1];
                            uri[1] = decodeBase64Str(suri[0]) + slabel;
                        }
                    } catch (e) {}

                    url = new URL('http://' + uri[1]);
                    let userinfo;
                    if (url.username && url.password) {
                        userinfo = [url.username, decodeURIComponent(url.password)];
                    } else if (url.username) {
                        userinfo = decodeBase64Str(decodeURIComponent(url.username)).split(':');
                        if (userinfo.length > 1)
                            userinfo = [userinfo[0], userinfo.slice(1).join(':')];
                    }
                    if (!shadowsocks_encrypt_methods.includes(userinfo[0])) return null;

                    let plugin, plugin_opts;
                    if (url.search && url.searchParams.get('plugin')) {
                        let plugin_info = url.searchParams.get('plugin').split(';');
                        plugin = plugin_info[0];
                        plugin_opts = plugin_info.length > 1 ? plugin_info.slice(1).join(';') : null;
                    }
                    config = {
                        label: url.hash ? decodeURIComponent(url.hash.slice(1)) : null,
                        type: 'shadowsocks',
                        address: url.hostname,
                        port: url.port || '80',
                        shadowsocks_encrypt_method: userinfo[0],
                        password: userinfo[1],
                        shadowsocks_plugin: plugin,
                        shadowsocks_plugin_opts: plugin_opts
                    };
                } catch (e) {
                    uri = uri[1].split('@');
                    if (uri.length < 2) return null;
                    else if (uri.length > 2) uri = [uri.slice(0, -1).join('@'), uri.slice(-1).toString()];
                    config = {
                        type: 'shadowsocks',
                        address: uri[1].split(':')[0],
                        port: uri[1].split(':')[1],
                        shadowsocks_encrypt_method: uri[0].split(':')[0],
                        password: uri[0].split(':').slice(1).join(':')
                    };
                }
                break;
            }
            case 'trojan': {
                url = new URL('http://' + uri[1]);
                params = url.searchParams;
                if (!url.username) return null;
                config = {
                    label: url.hash ? decodeURIComponent(url.hash.slice(1)) : null,
                    type: 'trojan',
                    address: url.hostname,
                    port: url.port || '80',
                    password: decodeURIComponent(url.username),
                    transport: params.get('type') !== 'tcp' ? params.get('type') : null,
                    tls: '1',
                    tls_sni: params.get('sni')
                };
                switch (params.get('type')) {
                    case 'grpc':
                        config.grpc_servicename = params.get('serviceName');
                        break;
                    case 'ws':
                        config.ws_host = params.get('host') ? decodeURIComponent(params.get('host')) : null;
                        config.ws_path = params.get('path') ? decodeURIComponent(params.get('path')) : null;
                        if (config.ws_path && config.ws_path.includes('?ed=')) {
                            config.websocket_early_data_header = 'Sec-WebSocket-Protocol';
                            config.websocket_early_data = config.ws_path.split('?ed=')[1];
                            config.ws_path = config.ws_path.split('?ed=')[0];
                        }
                        break;
                }
                break;
            }
            case 'tuic': {
                url = new URL('http://' + uri[1]);
                params = url.searchParams;
                if (!url.username) return null;
                config = {
                    label: url.hash ? decodeURIComponent(url.hash.slice(1)) : null,
                    type: 'tuic',
                    address: url.hostname,
                    port: url.port || '80',
                    uuid: url.username,
                    password: url.password ? decodeURIComponent(url.password) : null,
                    tuic_congestion_control: params.get('congestion_control'),
                    tuic_udp_relay_mode: params.get('udp_relay_mode'),
                    tls: '1',
                    tls_sni: params.get('sni'),
                    tls_alpn: params.get('alpn') ? decodeURIComponent(params.get('alpn')).split(',') : null
                };
                break;
            }
            case 'vless': {
                url = new URL('http://' + uri[1]);
                params = url.searchParams;
                if (['kcp', 'quic'].includes(params.get('type'))) return null;
                if (!url.username || !params.get('type')) return null;

                config = {
                    label: url.hash ? decodeURIComponent(url.hash.slice(1)) : null,
                    type: 'vless',
                    address: url.hostname,
                    port: url.port || '80',
                    uuid: url.username,
                    transport: params.get('type') !== 'tcp' ? params.get('type') : null,
                    tls: ['tls', 'xtls', 'reality'].includes(params.get('security')) ? '1' : '0',
                    tls_sni: params.get('sni'),
                    tls_alpn: params.get('alpn') ? decodeURIComponent(params.get('alpn')).split(',') : null,
                    tls_reality: (params.get('security') === 'reality') ? '1' : '0',
                    tls_reality_public_key: params.get('pbk') ? decodeURIComponent(params.get('pbk')) : null,
                    tls_reality_short_id: params.get('sid'),
                    tls_utls: map_utls_fp_alias(params.get('fp')),
                    vless_flow: ['tls', 'reality'].includes(params.get('security')) ? params.get('flow') : null
                };
                switch (params.get('type')) {
                    case 'grpc':
                        config.grpc_servicename = params.get('serviceName');
                        break;
                    case 'http':
                    case 'tcp':
                        if (config.transport === 'http' || params.get('headerType') === 'http') {
                            config.http_host = params.get('host') ? decodeURIComponent(params.get('host')).split(',') : null;
                            config.http_path = params.get('path') ? decodeURIComponent(params.get('path')) : null;
                        }
                        break;
                    case 'httpupgrade':
                        config.httpupgrade_host = params.get('host') ? decodeURIComponent(params.get('host')) : null;
                        config.http_path = params.get('path') ? decodeURIComponent(params.get('path')) : null;
                        break;
                    case 'ws':
                        config.ws_host = params.get('host') ? decodeURIComponent(params.get('host')) : null;
                        config.ws_path = params.get('path') ? decodeURIComponent(params.get('path')) : null;
                        if (config.ws_path && config.ws_path.includes('?ed=')) {
                            config.websocket_early_data_header = 'Sec-WebSocket-Protocol';
                            config.websocket_early_data = config.ws_path.split('?ed=')[1];
                            config.ws_path = config.ws_path.split('?ed=')[0];
                        }
                        break;
                }
                break;
            }
            case 'vmess': {
                if (uri[1].includes('&')) return null;
                let vmess;
                try {
                    vmess = JSON.parse(decodeBase64Str(uri[1]));
                } catch (e) { return null; }

                if (vmess.v != '2') return null;
                if (['kcp', 'quic'].includes(vmess.net)) return null;

                config = {
                    label: vmess.ps,
                    type: 'vmess',
                    address: vmess.add,
                    port: vmess.port,
                    uuid: vmess.id,
                    vmess_alterid: vmess.aid,
                    vmess_encrypt: vmess.scy || 'auto',
                    transport: vmess.net !== 'tcp' ? vmess.net : null,
                    tls: vmess.tls === 'tls' ? '1' : '0',
                    tls_sni: vmess.sni || vmess.host,
                    tls_alpn: vmess.alpn ? vmess.alpn.split(',') : null,
                    tls_utls: map_utls_fp_alias(vmess.fp)
                };
                switch (vmess.net) {
                    case 'grpc':
                        config.grpc_servicename = vmess.path;
                        break;
                    case 'h2':
                    case 'tcp':
                        if (vmess.net === 'h2' || vmess.type === 'http') {
                            config.transport = 'http';
                            config.http_host = vmess.host ? vmess.host.split(',') : null;
                            config.http_path = vmess.path;
                        }
                        break;
                    case 'httpupgrade':
                        config.httpupgrade_host = vmess.host;
                        config.http_path = vmess.path;
                        break;
                    case 'ws':
                        config.ws_host = vmess.host;
                        config.ws_path = vmess.path;
                        if (config.ws_path && config.ws_path.includes('?ed=')) {
                            config.websocket_early_data_header = 'Sec-WebSocket-Protocol';
                            config.websocket_early_data = config.ws_path.split('?ed=')[1];
                            config.ws_path = config.ws_path.split('?ed=')[0];
                        }
                        break;
                }
                break;
            }
        }
    }

    if (config) {
        if (!config.address || !config.port) return null;
        if (!config.label) config.label = config.address + ':' + config.port;
        config.address = config.address.replace(/\[|\]/g, '');
    }

    return config;
}

return view.extend({
    pendingDeletes: [],
    pendingRenames: [],
    load: function () {
        return uci.load('nikki');
    },

    render: function () {
        let m, s, o, so;
        const self = this;

        m = new form.Map('nikki');

        s = m.section(form.NamedSection, 'config', 'config', _('File'));

        o = s.option(form.FileUpload, '_upload_profile', _('Upload Profile'));
        o.browser = true;
        o.enable_download = true;
        o.root_directory = nikki.profilesDir;
        o.write = function (section_id, formvalue) {
            return true;
        };

        o = s.option(form.DummyValue, '_upload_mixin', _('Upload Mixin'),
            _('Select a local file to upload, it will directly overwrite %s').format(nikki.mixinFilePath));
        o.renderWidget = function (section_id, option_index, cfgvalue) {
            const status = E('span', { style: 'margin-left: 8px; color: #888;' });
            const input = E('input', {
                type: 'file', style: 'display:none',
                change: ui.createHandlerFn(this, function (ev) {
                    const file = ev.target.files[0];
                    if (!file) return;

                    const data = new FormData();
                    data.append('sessionid', L.env.sessionid);
                    data.append('filename', nikki.mixinFilePath);
                    data.append('filedata', file); 4

                    status.textContent = _('Uploading...');

                    return L.Request.post(`${L.env.cgi_base}/cgi-upload`, data, {
                        timeout: 0,
                        progress: L.bind(function (pev) {
                            status.textContent = '%.2f%%'.format((pev.loaded / pev.total) * 100);
                        }, this)
                    }).then(function (res) {
                        const reply = res.json();
                        if (L.isObject(reply) && reply.failure)
                            throw new Error(reply.message || _('Upload failed'));
                        status.textContent = '';
                        ui.addNotification(null, E('p', _('Upload succeeded, %s has been overwritten').format(nikki.mixinFilePath)), 'success');
                    }).catch(function (err) {
                        status.textContent = '';
                        ui.addNotification(null, E('p', _('Upload failed: %s').format(err.message || err)), 'error');
                    }).finally(function () {
                        input.value = '';
                    });
                })
            });

            return E('div', {}, [
                E('button', {
                    class: 'btn cbi-button-action',
                    click: ui.createHandlerFn(this, function () { input.click(); })
                }, _('Select File')),
                input, status]);
        };

        s = m.section(form.GridSection, 'subscription', _('Subscription'));
        s.addremove = true;
        s.anonymous = true;
        s.sortable = true;
        s.modaltitle = _('Edit Subscription');
        s.handleRemove = function (section_id, ev) {
            const name = uci.get('nikki', section_id, 'name');
            if (name) self.pendingDeletes.push(name);
            return this.super('handleRemove', [section_id, ev]);
        };

        o = s.option(form.Value, 'name', _('Subscription Name'));
        o.rmempty = false;
        o.datatype = 'uciname';
        o.write = function (section_id, value) {
            var oldName = this.cfgvalue(section_id);
            if (oldName && oldName !== value)
                self.pendingRenames.push({ from: oldName, to: value });
            return this.super('write', [section_id, value]);
        };

        o = s.option(form.Value, 'used', _('Used'));
        o.modalonly = false;
        o.optional = true;
        o.readonly = true;

        o = s.option(form.Value, 'total', _('Total'));
        o.modalonly = false;
        o.optional = true;
        o.readonly = true;

        o = s.option(form.Value, 'expire', _('Expire At'));
        o.modalonly = false;
        o.optional = true;
        o.readonly = true;

        o = s.option(form.Value, 'update', _('Update At'));
        o.modalonly = false;
        o.optional = true;
        o.readonly = true;

        o = s.option(form.Button, 'update_subscription');
        o.editable = true;
        o.inputstyle = 'positive';
        o.inputtitle = _('Update');
        o.modalonly = false;
        o.onclick = function (ev, section_id) {
            return nikki.updateSubscription(section_id);
        };

        o = s.option(form.Value, 'info_url', _('Subscription Info Url'));
        o.modalonly = true;

        o = s.option(form.Value, 'url', _('Subscription Url'));
        o.modalonly = true;
        o.rmempty = false;

        o = s.option(form.Value, 'user_agent', _('User Agent'));
        o.default = 'clash';
        o.modalonly = true;
        o.rmempty = false;
        o.value('clash');
        o.value('clash.meta');
        o.value('mihomo');

        o = s.option(form.ListValue, 'prefer', _('Prefer'));
        o.default = 'local';
        o.modalonly = true;
        o.rmempty = false;
        o.value('remote', _('Remote'));
        o.value('local', _('Local'));

        s = m.section(form.GridSection, 'node', _('Nodes'));
        s.addremove = true;
        s.anonymous = false;
        so = renderNodeSettings(s);
        so.handleLinkImport = function () {
            let textarea = new ui.Textarea(null, { rows: 10, wrap: true });
            ui.showModal(_('Import share links'), [
                E('p', _('Support Hysteria, Shadowsocks, Trojan, v2rayN (VMess), and XTLS (VLESS) share link format.')),
                textarea.render(),
                E('div', { class: 'button-row' }, [
                    E('button', { class: 'btn', click: ui.hideModal }, _('Cancel')),
                    E('button', {
                        class: 'btn cbi-button-action',
                        click: ui.createHandlerFn(this, function () {
                            let input_links = textarea.getValue().trim().split('\n');
                            if (!input_links || !input_links[0])
                                return ui.hideModal();

                            input_links = input_links.reduce(
                                (pre, cur) => (!pre.includes(cur) && pre.push(cur), pre), []
                            );

                            let imported_node = 0;
                            input_links.forEach(l => {
                                let config = parseShareLink(l);
                                if (config) {
                                    let sid = uci.add('nikki', 'node', getRandom());
                                    Object.keys(config).forEach(k => {
                                        uci.set('nikki', sid, k, config[k]);
                                    });
                                    imported_node++;
                                }
                            });

                            if (imported_node === 0)
                                ui.addNotification(null, E('p', _('No valid share link found.')));
                            else
                                ui.addNotification(null, E('p',
                                    _('Successfully imported %s nodes of total %s.')
                                        .format(imported_node, input_links.length)));

                            return uci.save()
                                // .then(() => uci.apply())
                                .then(L.bind(this.map.load, this.map))
                                .then(L.bind(this.map.reset, this.map))
                                .then(L.ui.hideModal)
                                .catch(() => {});
                        })
                    }, _('Import'))
                ])
            ]);
        };
        so.renderSectionAdd = function () {
            let el = form.GridSection.prototype.renderSectionAdd.apply(this, arguments);
            let nameEl = el.querySelector('.cbi-section-create-name');

            if (nameEl) {
                ui.addValidator(nameEl, 'uciname', true, v => {
                    let button = el.querySelector('.cbi-section-create > .cbi-button-add');
                    let uciconfig = this.uciconfig || this.map.config;
                    if (!v) {
                        button.disabled = true;
                        return true;
                    } else if (uci.get(uciconfig, v)) {
                        button.disabled = true;
                        return _('Expecting: %s').format(_('unique UCI identifier'));
                    } else {
                        button.disabled = null;
                        return true;
                    }
                }, 'blur', 'keyup');
            }

            el.appendChild(E('button', {
                class: 'cbi-button cbi-button-add',
                title: _('Import share links'),
                click: ui.createHandlerFn(this, 'handleLinkImport')
            }, _('Import share links')));

            return el;
        };

        return m.render();
    },

    handleSaveApply: function (ev, mode) {
        var self = this;
        var tasks = self.pendingRenames.map(function (r) {
            return nikki.renameSubscription(r.from, r.to);
        }).concat(self.pendingDeletes.map(function (name) {
            return fs.remove(nikki.subscriptionsDir + '/' + name + '.yaml');
        }));

        return Promise.all(tasks).then(function () {
            self.pendingRenames = [];
            self.pendingDeletes = [];
            return self.super('handleSaveApply', [ev, mode]);
        });
    }

});
