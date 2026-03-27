'use strict';
'require view';
'require form';
'require uci';
'require rpc';
'require fs';
'require ui';

var callWirelessStatus = rpc.declare({
    object: 'network.wireless',
    method: 'status',
    expect: { '': {} }
});

var callIfaceDump = rpc.declare({
    object: 'network.interface',
    method: 'dump',
    expect: { interface: [] }
});

var callNetdevs = rpc.declare({
    object: 'luci-rpc',
    method: 'getNetworkDevices',
    expect: { '': {} }
});

return view.extend({
    load: function () {
        return Promise.all([callWirelessStatus(), callIfaceDump(), callNetdevs()])
            .then(function ([radios, ifaces, devs]) {
                var info = {
                    ssid_24g: '', ssid_5g: '', meshId: '', wifi_pass: '', mesh_pass: '',
                    lanIp: '', lanMac: '', lanProto: '', wanIfname: '', wanMac: '', wanProto: ''
                };
                Object.keys(radios).forEach(function (radioName) {
                    var radio = radios[radioName],
                        band = radio.config.band;
                    radio.interfaces.forEach(function (iface) {
                        var cfg = iface.config;
                        if (cfg.mode === 'ap') {
                            band === '5g' ? info.ssid_5g = cfg.ssid : info.ssid_24g = cfg.ssid;
                            info.wifi_pass = cfg.key || info.wifi_pass;
                        } else if (cfg.mode === 'mesh') {
                            info.meshId = cfg.mesh_id;
                            info.mesh_pass = cfg.key || info.mesh_pass;
                        }
                    });
                });

                ifaces.forEach(function (iface) {
                    var name = iface.interface;
                    if (name !== 'lan' && name !== 'wan') return;
                    info[name + 'Proto'] = iface.proto;
                    var addrs = iface['ipv4-address'];
                    info[name + 'Ip'] = (addrs && addrs[0]) ? addrs[0].address : '';
                });

                if (devs['br-lan']) info.lanMac = devs['br-lan'].mac;
                if (devs.wan) {
                    info.wanMac = devs.wan.mac;
                    info.wanIfname = devs.wan.name;
                }
                return info;
            });
    },

    render: function (info) {
        var m, s, o;
        m = new form.Map('mesh_node', _('AP + Mesh Deployment'));
        s = m.section(form.NamedSection, 'main');
        s.addremove = false;
        s.anonymous = true;

        s.tab('network', _('Network'));
        s.tab('wireless', _('Wireless'));
        s.tab('miscellaneous', _('Miscellaneous'));

        o = s.taboption('network', form.ListValue, 'proto', _('LAN Connection Mode'));
        o.value('dhcp', _('DHCP client'));
        o.value('static', _('Static address'));
        o.default = info.lanProto || '';

        o = s.taboption('network', form.Value, 'lan_ip', _('Node Static IP'),
            _('Each node must have a unique address, e.g. 192.168.2.2 / .3 / .4'));
        o.datatype = 'ip4addr';
        o.placeholder = '192.168.2.2';
        o.depends('proto', 'static');

        o = s.taboption('network', form.Value, 'gateway', _('Gateway / DNS Server'),
            _('Main router IP, also serves as DNS server'));
        o.datatype = 'ip4addr';
        o.placeholder = '192.168.2.1';
        o.depends('proto', 'static');

        o = s.taboption('network', form.ListValue, 'bridge_wan', _('WAN Protocol'));
        o.rmempty = false;
        o.default = info.wanProto || 'bridge';
        o.value('bridge', _('Bridge to LAN'));
        o.value('pppoe', _('PPPoE'));
        o.value('none', _('Unmanaged'));
        o.depends({ proto: /^(dhcp|static)$/ });

        o = s.taboption('network', form.Value, 'wan_pppoe_user', _('PPPoE Username'));
        o.datatype = 'minlength(1)';
        o.rmempty = false;
        o.depends({ bridge_wan: 'pppoe' });

        o = s.taboption('network', form.Value, 'wan_pppoe_pass', _('PPPoE Password'));
        o.datatype = 'minlength(1)';
        o.rmempty = false;
        o.password = true;
        o.depends({ bridge_wan: 'pppoe' });

        o = s.taboption('network', form.Value, '_lan_ip', _('DHCP Assigned IP'),
            _('Auto-assigned by DHCP, unique for each node, for reference only'));
        o.default = info.lanIp || '';
        o.depends('proto', 'dhcp');

        o = s.taboption('wireless', form.Value, 'ssid_24g', _('2.4G SSID'),
            _('Must exactly match the main router for seamless roaming'));
        o.default = info.ssid_24g || 'HomeWiFi';

        o = s.taboption('wireless', form.Value, 'ssid_5g', _('5G SSID'),
            _('Must exactly match the main router'));
        o.default = info.ssid_5g || 'HomeWiFi-5G';

        o = s.taboption('wireless', form.Value, 'wifi_pass', _('WiFi Password'),
            _('Shared by 2.4G/5G, minimum 8 characters'));
        o.datatype = 'wpakey';
        o.password = true;
        o.rmempty = false;
        o.default = info.wifi_pass || '';

        o = s.taboption('wireless', form.Value, 'mesh_id', _('Mesh ID'),
            _('All nodes must have identical Mesh ID'));
        o.default = info.meshId || 'HomeMesh';

        o = s.taboption('wireless', form.Value, 'mesh_pass', _('Mesh Password'),
            _('SAE encryption, minimum 8 characters, identical on all nodes'));
        o.datatype = 'wpakey';
        o.password = true;
        o.rmempty = false;
        o.default = info.mesh_pass || '';

        o = s.taboption('wireless', form.Button, 'node', _('Mesh Status'));
        o.inputtitle = _('View Mesh Status');
        o.inputstyle = 'positive';
        o.addremove = false;
        o.onclick = L.bind(function (ev, sid) {
            var btn = ev.target;
            var container = document.getElementById('mesh-status');
            if (!container) {
                container = E('div', { id: 'mesh-status', style: 'margin-top:10px;' });
                btn.parentNode.insertBefore(container, btn.nextSibling);
            }
            var pre = E('pre', {
                style: 'background:#1a1a1a;color:#c8d3da;border-radius:4px;' +
                    'padding:10px 12px;font-size:12px;max-height:280px;' +
                    'overflow:auto;white-space:pre-wrap;word-break:break-all;'
            }, _('Checking...'));

            container.innerHTML = '';
            container.appendChild(pre);

            return fs.exec_direct('/usr/sbin/iw', ['dev'])
                .then(function (res) {
                    var ifaces = [];
                    var lines = (res || '').split('\n');
                    for (var i = 0; i < lines.length; i++) {
                        var match = lines[i].match(/Interface\s+(\S+)/);
                        if (match && match[1].indexOf('mesh') !== -1) ifaces.push(match[1]);
                    }

                    if (!ifaces.length) {
                        pre.textContent = _('No mesh interface found. Please deploy and reboot the device first.');
                        return;
                    }

                    var cmds = [];
                    ifaces.forEach(function (iface) {
                        cmds.push(
                            fs.exec_direct('/usr/sbin/iw', ['dev', iface, 'station', 'dump']),
                            fs.exec_direct('/usr/sbin/iw', ['dev', iface, 'mpath', 'dump'])
                        );
                    });
                    return Promise.all(cmds).then(function (results) {
                        var text = '';
                        ifaces.forEach(function (iface, i) {
                            text += '=== ' + iface + ' station dump ===\n' +
                                (results[i * 2].stdout || _('(no data)')) + '\n';
                            text += '=== ' + iface + ' mpath dump ===\n' +
                                (results[i * 2 + 1].stdout || _('(no data)')) + '\n\n';
                        });
                        pre.textContent = text;
                    });
                })
                .catch(function (e) {
                    ui.addTimeLimitedNotification(null, E('p', _('Execution failed: %s').format(e.message)), 4000, 'error');
                });
        });

        o = s.taboption('miscellaneous', form.Value, 'hostname', _('Hostname'));
        o.datatype = 'hostname';
        if (info.lanMac) {
            var macSuffix = info.lanMac.replace(/:/g, '').slice(-6).toUpperCase();
            o.default = 'OpenWrt-' + macSuffix;;
        }

        o = s.taboption('miscellaneous', form.MultiValue, 'init', _('Disabled Services'));
        var PROTECTED = [
            'boot', 'bootcount', 'bridger', 'cron', 'done', 'fstab',
            'log', 'mesh_node', 'network', 'openssl', 'packet_steering',
            'radius', 'rpcd', 'sysctl', 'sysfixtime', 'sysntpd', 'system',
            'ucitrack', 'uhttpd', 'umount', 'urandom_seed', 'urngd',
            'ubihealthd', 'wpad'
        ];
        fs.list('/etc/init.d').then(function (entries) {
            entries
                .filter(function (e) {
                    return e.name.charAt(0) !== '.' && PROTECTED.indexOf(e.name) === -1;
                })
                .map(function (e) { return e.name; })
                .sort()
                .forEach(function (name) { o.value(name, name); });
        });
        o.default = 'dnsmasq miniupnpd dawn odhcpd firewall';

        return m.render();
    }
});
