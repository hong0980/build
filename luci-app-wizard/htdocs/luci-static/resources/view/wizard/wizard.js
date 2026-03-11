'use strict';
'require fs';
'require uci';
'require view';
'require form';
'require tools.widgets as widgets';

return view.extend({
	load: function () {
		return Promise.all([
			fs.stat('/etc/config/wireless').catch(function () { return null; }),
			uci.load('wizard').then(function (data) {
				if (!uci.get(data, 'default', 'wan_proto')) {
					return fs.exec_direct('/etc/init.d/wizard', ['reconfig'])
						.then(function () {
							uci.unload('wizard');
							return uci.load('wizard');
						});
				}
				return data;
			})
		]);
	},

	render: function (data) {
		var stat = data[0];
		var m, s, o;
		var dnsOptions = [
			{ value: '223.5.5.5',       label: _('AliDNS: 223.5.5.5') },
			{ value: '223.6.6.6',       label: _('AliDNS: 223.6.6.6') },
			{ value: '101.226.4.6',     label: _('DNSPod: 101.226.4.6') },
			{ value: '218.30.118.6',    label: _('DNSPod: 218.30.118.6') },
			{ value: '180.76.76.76',    label: _('BaiduDNS: 180.76.76.76') },
			{ value: '114.114.114.114', label: _('114DNS: 114.114.114.114') },
			{ value: '114.114.115.115', label: _('114DNS: 114.114.115.115') }
		];

		m = new form.Map('wizard', _('Inital Router Setup'),
			_('If you are using this router for the first time, please configure it here.'));

		s = m.section(form.NamedSection, 'default', 'wizard');
		s.addremove = false;

		s.tab('wansetup', _('Wan Settings'),
			_('There are several different ways to access the Internet, please choose according to your own situation.'));
		s.tab('lansetup', _('Lan Settings'));

		o = s.taboption('wansetup', form.ListValue, 'wan_proto', _('Protocol'),
			_('Select the network access protocol to determine how the router connects to the Internet.'));
		o.rmempty = false;
		o.default = 'dhcp';
		o.value('dhcp',       _('DHCP client'));
		o.value('pppoe',      _('PPPoE'));
		o.value('ap',         _('Access Point (AP)'));
		o.value('siderouter', _('Side Router'));

		o = s.taboption('wansetup', form.Value, 'wan_pppoe_user', _('PAP/CHAP username'),
			_('Username for PPPoE dial-up.'));
		o.depends('wan_proto', 'pppoe');
		o.datatype = 'minlength(1)';
		o.rmempty = false;

		o = s.taboption('wansetup', form.Value, 'wan_pppoe_pass', _('PAP/CHAP password'),
			_('Password for PPPoE dial-up.'));
		o.depends('wan_proto', 'pppoe');
		o.datatype = 'minlength(1)';
		o.rmempty = false;
		o.password = true;

		o = s.taboption('wansetup', form.ListValue, 'ppp_ipv6', _('Obtain IPv6 address'),
			_('Enable IPv6 negotiation on the PPP link'));
		o.depends('wan_proto', 'pppoe');
		o.value('auto', _('Automatic'));
		o.value('0',    _('Disabled'));
		o.value('1',    _('Manual'));
		o.default = 'auto';

		o = s.taboption('wansetup', form.ListValue, 'ap_ip_mode',
			_('AP management IP'),
			_('In AP mode all ports are bridged to the main router. ' +
			  'Choose "Auto (DHCP)" to let the main router assign a management IP automatically (recommended). ' +
			  'Choose "Static" only if you need a fixed IP to access this device.'));
		o.depends('wan_proto', 'ap');
		o.value('dhcp',   _('Auto (DHCP) — recommended'));
		o.value('static', _('Static IP'));
		o.default = 'dhcp';
		o.rmempty = false;

		o = s.taboption('wansetup', form.Value, 'ap_bridge_ip', _('Bridge IP address'),
			_('Static management IP for this router in AP mode. Must be in the same subnet as the main router.'));
		o.depends({ wan_proto: 'ap', ap_ip_mode: 'static' });
		o.datatype = 'ip4addr';
		o.placeholder = '192.168.1.2';
		o.rmempty = true;

		o = s.taboption('wansetup', form.Value, 'ap_netmask', _('Bridge netmask'),
			_('Subnet mask matching the main network (e.g. 255.255.255.0).'));
		o.depends({ wan_proto: 'ap', ap_ip_mode: 'static' });
		o.datatype = 'ip4addr';
		o.value('255.255.255.0');
		o.value('255.255.0.0');
		o.value('255.0.0.0');
		o.rmempty = true;

		o = s.taboption('wansetup', form.Value, 'ap_gateway', _('Bridge gateway'),
			_('Main router IP address (e.g. 192.168.1.1). Used as default gateway for management traffic.'));
		o.depends({ wan_proto: 'ap', ap_ip_mode: 'static' });
		o.datatype = 'ip4addr';
		o.placeholder = '192.168.1.1';
		o.rmempty = true;

		o = s.taboption('wansetup', form.ListValue, 'ap_dhcp', _('DHCP server'),
			_('Should be disabled in AP mode — the main router handles DHCP for all clients.'));
		o.depends('wan_proto', 'ap');
		o.value('1', _('Disabled (recommended)'));
		o.value('0', _('Enabled'));
		o.default = '1';

		o = s.taboption('wansetup', widgets.DeviceSelect, 'ap_bridge_interfaces', _('Bridge interfaces'),
			_('Interfaces to include in the bridge (typically LAN ports and wireless interfaces). The WAN port connects to the main router.'));
		o.depends('wan_proto', 'ap');
		o.multiple = true;
		o.noaliases = true;
		o.rmempty = false;
		o.filter = function (section_id, value) {
			return !/^(@|docker0|veth|teq|br-[0-9a-f]+|wlan-ap)/.test(value);
		};
		o.validate = function (section_id, value) {
			if (!value || value.length === 0)
				return _('At least one interface must be selected');
			return true;
		};

		o = s.taboption('wansetup', form.Value, 'siderouter_wan_ip', _('WAN IP address'),
			_("Static IP for this router's WAN port on the main network (e.g. 192.168.1.2). " +
			  "Clients that want to use this router as gateway will point to this IP."));
		o.depends('wan_proto', 'siderouter');
		o.datatype = 'ip4addr';
		o.placeholder = '192.168.1.2';
		o.rmempty = false;

		o = s.taboption('wansetup', form.Value, 'siderouter_netmask', _('WAN netmask'),
			_('Subnet mask of the main network.'));
		o.depends('wan_proto', 'siderouter');
		o.datatype = 'ip4addr';
		o.value('255.255.255.0');
		o.value('255.255.0.0');
		o.value('255.0.0.0');
		o.rmempty = false;

		o = s.taboption('wansetup', form.Value, 'siderouter_gateway', _('Main router IP'),
			_("IP address of the main router (e.g. 192.168.1.1). Used as the default gateway for upstream traffic."));
		o.depends('wan_proto', 'siderouter');
		o.datatype = 'ip4addr';
		o.placeholder = '192.168.1.1';
		o.rmempty = false;

		o = s.taboption('wansetup', form.Value, 'siderouter_local_ip', _('LAN IP address'),
			_("This router's LAN IP. Clients set their gateway to this address to route through this device. " +
			  "Must be in a different subnet from the main router (e.g. 192.168.2.1)."));
		o.depends('wan_proto', 'siderouter');
		o.datatype = 'ip4addr';
		o.placeholder = '192.168.2.1';
		o.rmempty = false;
		o.validate = function (section_id, value) {
			if (!value) return true;
			var gw_el = this.section.getUIElement(section_id, 'siderouter_gateway');
			var gw = gw_el ? gw_el.getValue() : '';
			if (gw && value) {
				var a = value.split('.');
				var b = gw.split('.');
				if (a.length === 4 && b.length === 4 &&
				    a[0] === b[0] && a[1] === b[1] && a[2] === b[2]) {
					return _('The LAN IP must be in a different subnet from the main router IP (%s). Try e.g. 192.168.2.1.').format(gw);
				}
			}
			return true;
		};

		o = s.taboption('wansetup', form.Value, 'siderouter_lan_netmask', _('LAN netmask'),
			_("Subnet mask for this router's LAN segment."));
		o.depends('wan_proto', 'siderouter');
		o.datatype = 'ip4addr';
		o.value('255.255.255.0');
		o.value('255.255.0.0');
		o.value('255.0.0.0');
		o.default = '255.255.255.0';
		o.rmempty = false;

		o = s.taboption('wansetup', form.ListValue, 'siderouter_dhcp', _('LAN DHCP server'),
			_("Enable to let this router assign IPs to its own LAN clients (recommended when clients connect directly to this router). " +
			  "Disable if clients are managed by the main router."));
		o.depends('wan_proto', 'siderouter');
		o.value('0', _('Enabled (recommended)'));
		o.value('1', _('Disabled'));
		o.default = '0';

		o = s.taboption('wansetup', widgets.DeviceSelect, 'siderouter_interfaces', _('WAN interface'),
			_('The interface connected to the main router (typically the WAN port).'));
		o.depends('wan_proto', 'siderouter');
		o.multiple = false;
		o.noaliases = true;
		o.rmempty = false;
		o.filter = function (section_id, value) {
			return !/^(@|docker0|veth|teq|br-[0-9a-f]+|wlan-ap)/.test(value);
		};
		o.validate = function (section_id, value) {
			if (!value || value.length === 0)
				return _('At least one interface must be selected');
			return true;
		};

		o = s.taboption('wansetup', form.DynamicList, 'wan_dns', _('WAN DNS servers'),
			_('Custom DNS servers for the WAN interface. Leave empty to use the ISP-assigned DNS.'));
		o.datatype = 'ip4addr';
		o.ucioption = 'wan_dns';
		o.default = '';
		o.depends('wan_proto', 'dhcp');
		o.depends('wan_proto', 'pppoe');
		dnsOptions.forEach(opt => o.value(opt.value, opt.label));

		o = s.taboption('lansetup', form.Value, 'lan_ipaddr', _('IPv4 address'),
			_('IPv4 address for the LAN interface.'));
		o.datatype = 'ip4addr';

		o = s.taboption('lansetup', form.Value, 'lan_netmask', _('IPv4 netmask'),
			_('Subnet mask for the LAN interface.'));
		o.datatype = 'ip4addr';
		o.value('255.255.255.0');
		o.value('255.255.0.0');
		o.value('255.0.0.0');

		o = s.taboption('lansetup', form.DynamicList, 'lan_dns', _('LAN DNS servers'),
			_('DNS servers pushed to LAN clients via DHCP.'));
		o.datatype = 'ip4addr';
		o.default = '';
		dnsOptions.forEach(opt => o.value(opt.value, opt.label));

		if (stat?.size > 0) {
			s.tab('wifisetup', _('Wireless Settings'),
				_("Set the router's wireless name and password. For more advanced settings, please go to the Network-Wireless page."));

			o = s.taboption('wifisetup', form.Value, 'wifi_ssid',
				_("<abbr title='Extended Service Set Identifier'>ESSID</abbr>"),
				_('SSID of the wireless network, with a maximum length of 32 characters.'));
			o.datatype = 'maxlength(32)';

			o = s.taboption('wifisetup', form.Value, 'wifi_key', _('Key'),
				_('Password for the wireless network, compliant with WPA key requirements.'));
			o.datatype = 'wpakey';
			o.password = true;
		}

		return m.render();
	}
});
