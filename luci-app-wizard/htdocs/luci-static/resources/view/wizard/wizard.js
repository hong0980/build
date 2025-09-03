'use strict';
'require fs';
'require view';
'require form';
'require tools.widgets as widgets';

return view.extend({
	load: function () {
		fs.exec('/etc/init.d/wizard', ['reconfig'])
	},

	render: function () {
		var m, s, o;
		var dnsOptions = [
			{ value: '223.5.5.5', label: _('AliDNS: 223.5.5.5') },
			{ value: '223.6.6.6', label: _('AliDNS: 223.6.6.6') },
			{ value: '101.226.4.6', label: _('DNSPod: 101.226.4.6') },
			{ value: '218.30.118.6', label: _('DNSPod: 218.30.118.6') },
			{ value: '180.76.76.76', label: _('BaiduDNS: 180.76.76.76') },
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
		o.value('dhcp', _('DHCP client'));
		o.value('pppoe', _('PPPoE'));
		o.value('ap', _('Access Point (AP)'));
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
		o.ucioption = 'ipv6';
		o.depends('wan_proto', 'pppoe');
		o.value('auto', _('Automatic'));
		o.value('0', _('Disabled'));
		o.value('1', _('Manual'));
		o.default = 'auto';

		o = s.taboption('wansetup', form.Value, 'ap_bridge_ip', _('Bridge IP address'),
			_('Static IP address assigned to the router in access point mode for connecting to the main network.'));
		o.depends('wan_proto', 'ap');
		o.datatype = 'ip4addr';
		o.placeholder = '192.168.1.2';
		o.rmempty = false;

		o = s.taboption('wansetup', form.Value, 'ap_netmask', _('Bridge netmask'),
			_('Subnet mask for the router in access point mode, which should match the main network.'));
		o.depends('wan_proto', 'ap');
		o.datatype = 'ip4addr';
		o.value('255.255.255.0');
		o.value('255.255.0.0');
		o.value('255.0.0.0');
		o.rmempty = false;

		o = s.taboption('wansetup', form.Value, 'ap_gateway', _('Bridge gateway'),
			_('Gateway address of the main network, typically the IP address of the main router.'));
		o.depends('wan_proto', 'ap');
		o.datatype = 'ip4addr';
		o.placeholder = '192.168.1.1';
		o.rmempty = false;

		o = s.taboption('wansetup', form.ListValue, 'ap_dhcp', _('DHCP for AP mode'),
			_("Disable DHCP to rely on the main router's DHCP server, or enable local DHCP service."));
		o.depends('wan_proto', 'ap');
		o.value('0', _('Disabled'));
		o.value('1', _('Enabled'));
		o.default = '0';

		o = s.taboption('wansetup', widgets.DeviceSelect, 'ap_bridge_interfaces', _('Bridge interfaces'),
			_('Select the network interfaces (e.g., LAN or wireless interfaces) to participate in bridging to connect to the main network.'));
		o.depends('wan_proto', 'ap');
		o.multiple = true;
		o.noaliases = true;
		o.filter = function (section_id, value) {
			return !/^(@|docker0|veth|teq|br-[0-9a-f]+)/.test(value);
		};

		o = s.taboption('wansetup', form.Value, 'siderouter_local_ip', _('Local IP address'),
			_("IP address assigned to the side router in the main network, which should avoid conflicts with the main router's LAN subnet."));
		o.depends('wan_proto', 'siderouter');
		o.datatype = 'ip4addr';
		o.placeholder = '192.168.2.1';
		o.rmempty = false;

		o = s.taboption('wansetup', form.Value, 'siderouter_wan_ip', _('WAN IP address'),
			_("IP address for the side router's WAN interface to connect to the main network."));
		o.depends('wan_proto', 'siderouter');
		o.datatype = 'ip4addr';
		o.placeholder = '192.168.1.2';
		o.rmempty = false;

		o = s.taboption('wansetup', form.Value, 'siderouter_netmask', _('Netmask for side router'),
			_('Subnet mask for the side router, which should match the main network.'));
		o.depends('wan_proto', 'siderouter');
		o.datatype = 'ip4addr';
		o.value('255.255.255.0');
		o.value('255.255.0.0');
		o.value('255.0.0.0');
		o.rmempty = false;

		o = s.taboption('wansetup', form.Value, 'siderouter_main_router_ip', _('Main router IP address'),
			_('IP address of the main router to which the side router connects.'));
		o.depends('wan_proto', 'siderouter');
		o.datatype = 'ip4addr';
		o.placeholder = '192.168.1.1';

		o = s.taboption('wansetup', form.Value, 'siderouter_gateway', _('Gateway for side router'),
			_('Default gateway address for the side router, typically the IP address of the main router.'));
		o.depends('wan_proto', 'siderouter');
		o.datatype = 'ip4addr';
		o.placeholder = '192.168.1.1';
		o.rmempty = false;

		o = s.taboption('wansetup', form.ListValue, 'siderouter_dhcp', _('DHCP for side router'),
			_("Disable DHCP to rely on the main router's DHCP server, or enable local DHCP service."));
		o.depends('wan_proto', 'siderouter');
		o.value('0', _('Disabled'));
		o.value('1', _('Enabled'));
		o.default = '0';

		o = s.taboption('wansetup', widgets.DeviceSelect, 'siderouter_interfaces', _('Connection interfaces'),
			_('Select the interfaces (e.g., WAN or LAN ports) for the side router to connect to the main network.'));
		o.depends('wan_proto', 'siderouter');
		o.multiple = true;
		o.noaliases = true;
		o.filter = function (section_id, value) {
			return !/^(@|docker0|veth|teq|br-[0-9a-f]+)/.test(value);
		};

		o = s.taboption('wansetup', form.DynamicList, 'wan_dns', _('WAN DNS servers'),
			_('List of custom DNS servers for the WAN interface.'));
		o.datatype = 'ip4addr';
		o.ucioption = 'wan_dns';
		o.default = '';
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
			_('List of custom DNS servers used by LAN clients (DHCP).'));
		o.datatype = 'ip4addr';
		o.default = '';
		dnsOptions.forEach(opt => o.value(opt.value, opt.label));

		if (L.hasSystemFeature('wifi')) {
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
		};

		return m.render();
	}
});
