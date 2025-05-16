'use strict';
'require view';
'require dom';
'require poll';
'require uci';
'require rpc';
'require form';
'require fs';
'require network';
'require tools.widgets as widgets';

return view.extend({
	load: function() {
		return Promise.all([
			fs.exec('/etc/init.d/wizard', ['reconfig']),
			uci.changes(),
			L.resolveDefault(uci.load('wireless')),
			uci.load('wizard'),
			uci.load('network'),
			uci.load('firewall')
		]);
	},

	render: function(data) {
		var m, s, o;

		m = new form.Map('wizard', [_('Inital Router Setup')],
			_('If you are using this router for the first time, please configure it here.'));

		s = m.section(form.NamedSection, 'default', 'wizard');
		s.addremove = false;
		s.tab('wansetup', _('Wan Settings'),
			_('There are several different ways to access the Internet, please choose according to your own situation.'));
		s.tab('lansetup', _('Lan Settings'));

		o = s.taboption('wansetup', form.ListValue, 'wan_proto', _('Protocol'), _('Select the network access protocol to determine how the router connects to the Internet.'));
		o.rmempty = false;
		o.default = 'dhcp';
		o.value('dhcp', _('DHCP client'));
		o.value('pppoe', _('PPPoE'));
		o.value('static', _('Static address'));
		o.value('ap', _('Access Point (AP)'));
		o.value('siderouter', _('Side Router'));

		o = s.taboption('wansetup', form.Value, 'wan_pppoe_user', _('PAP/CHAP username'),
			_('Username for PPPoE dial-up.'));
		o.depends('wan_proto', 'pppoe');
		o.rmempty = false;

		o = s.taboption('wansetup', form.Value, 'wan_pppoe_pass', _('PAP/CHAP password'),
			_('Password for PPPoE dial-up.'));
		o.depends('wan_proto', 'pppoe');
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

		o = s.taboption('wansetup', form.Value, 'wan_netmask', _('IPv4 netmask'),
			_('Subnet mask for static address mode.'));
		o.depends('wan_proto', 'static');
		o.datatype = 'ip4addr';
		o.value('255.255.255.0');
		o.value('255.255.0.0');
		o.value('255.0.0.0');

		o = s.taboption('wansetup', form.Value, 'wan_gateway', _('IPv4 gateway'),
			_('Gateway address for static address mode.'));
		o.depends('wan_proto', 'static');
		o.datatype = 'ip4addr';

		o = s.taboption('wansetup', form.Value, 'ap_bridge_ip', _('Bridge IP address'),
			_('Static IP address assigned to the router in access point mode for connecting to the main network.'));
		o.depends('wan_proto', 'ap');
		o.datatype = 'ip4addr';
		o.placeholder = '192.168.1.2';

		o = s.taboption('wansetup', form.Value, 'ap_netmask', _('Bridge netmask'),
			_('Subnet mask for the router in access point mode, which should match the main network.'));
		o.depends('wan_proto', 'ap');
		o.datatype = 'ip4addr';
		o.value('255.255.255.0');
		o.value('255.255.0.0');
		o.value('255.0.0.0');

		o = s.taboption('wansetup', form.Value, 'ap_gateway', _('Bridge gateway'),
			_('Gateway address of the main network, typically the IP address of the main router.'));
		o.depends('wan_proto', 'ap');
		o.datatype = 'ip4addr';
		o.placeholder = '192.168.1.1';

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
		o.ucioption = 'ap_bridge_interfaces';

		o = s.taboption('wansetup', form.Value, 'siderouter_local_ip', _('Local IP address'),
			_("IP address assigned to the side router in the main network, which should avoid conflicts with the main router's LAN subnet."));
		o.depends('wan_proto', 'siderouter');
		o.datatype = 'ip4addr';
		o.placeholder = '192.168.2.2';

		o = s.taboption('wansetup', form.Value, 'siderouter_netmask', _('Netmask for side router'),
			_('Subnet mask for the side router, which should match the main network.'));
		o.depends('wan_proto', 'siderouter');
		o.datatype = 'ip4addr';
		o.value('255.255.255.0');
		o.value('255.255.0.0');
		o.value('255.0.0.0');

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
		o.ucioption = 'siderouter_interfaces';

		o = s.taboption('wansetup', form.DynamicList, 'wan_dns', _('WAN DNS servers'),
			_('List of custom DNS servers for the WAN interface.'));
		o.datatype = 'ip4addr';
		o.ucioption = 'wan_dns';
		o.cast = 'string';
		o.value("223.5.5.5", _("AliDNS: 223.5.5.5"));
		o.value("223.6.6.6", _("AliDNS: 223.6.6.6"));
		o.value("101.226.4.6", _("DNSPod: 101.226.4.6"));
		o.value("218.30.118.6", _("DNSPod: 218.30.118.6"));
		o.value("180.76.76.76", _("BaiduDNS: 180.76.76.76"));
		o.value("114.114.114.114", _("114DNS: 114.114.114.114"));
		o.value("114.114.115.115", _("114DNS: 114.114.115.115"));

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
		o.cast = 'string';
		o.value("223.5.5.5", _("AliDNS: 223.5.5.5"));
		o.value("223.6.6.6", _("AliDNS: 223.6.6.6"));
		o.value("101.226.4.6", _("DNSPod: 101.226.4.6"));
		o.value("218.30.118.6", _("DNSPod: 218.30.118.6"));
		o.value("180.76.76.76", _("BaiduDNS: 180.76.76.76"));
		o.value("114.114.114.114", _("114DNS: 114.114.114.114"));
		o.value("114.114.115.115", _("114DNS: 114.114.115.115"));

		if (uci.sections('wireless', 'wifi-device').length > 0) {
			s.tab('wifisetup', _('Wireless Settings'),
				_('Set the router\'s wireless name and password. For more advanced settings, please go to the Network-Wireless page.'));
			o = s.taboption('wifisetup', form.Value, 'wifi_ssid',
				_('<abbr title=\"Extended Service Set Identifier\">ESSID</abbr>'),
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
