local sys = require "luci.sys"
local uci = require "luci.model.uci".cursor()
local network = uci:get_all("network") or {}
local wizard = uci:get_all("wizard", "default") or {}
local ip_mac = {}
local success = pcall(function()
    sys.net.ipv4_hints(
        function(ip, name)
            ip_mac[#ip_mac + 1] = {ip = ip, mac = name}
        end,
        function(a, b)
            return #a.ip ~= #b.ip and #a.ip < #b.ip or a.ip < b.ip
        end)
end)

ip_mac = success and ip_mac or {}
local descr = {
    translate("设置主路由同网段未冲突的IP地址<font color=red>(即是该路由web访问的IP)</font><br>当前的内网主机列表：<ol>")
}
for _, key in ipairs(ip_mac) do
    table.insert(descr, translatef("<li>%s (%s)</li>", key.ip, key.mac))
end

function isfile(file)
    local data = nixio.fs.readfile(file, 100)
    return data ~= nil and #data > 0
end

m = Map('wizard', translate('网络设置'), translate('如果你首次使用这个路由器，请在这里简单设置。'))
s = m:section(TypedSection, 'wizard')
s.addremove = false
s.anonymous = true

wan_proto = s:option(ListValue, 'wan_proto', translate('Protocol'))
wan_proto:value('pppoe', translate('PPPoE'))
wan_proto:value('dhcp', translate('DHCP client'))
wan_proto:value('ap', translate('Access Point (AP)'))
-- wan_proto:value('siderouter', translate('旁路由'))
-- wan_proto:value('static', translate('Static address'))

pppoe_user = s:option(Value, 'pppoe_user', translate('PAP/CHAP username'))
pppoe_user:depends('wan_proto', 'pppoe')

pppoe_pass = s:option(Value, 'pppoe_pass', translate('PAP/CHAP password'))
pppoe_pass:depends('wan_proto', 'pppoe')

ipv6 = s:option(ListValue, 'ipv6', translate('Enable IPv6 negotiation'))
ipv6:value("0", translate("disable"))
ipv6:value("1", translate("Manual"))
ipv6:value("auto", translate("Automatic"))
ipv6.default = "auto"
pppoe_pass.password = true
ipv6:depends('wan_proto', 'pppoe')

ap_dhcp = s:option(Flag, 'ap_dhcp', translate('Enable DHCP Server'),
    translate('在 AP 模式下关闭 LAN 的 DHCP 服务，由主路由提供 DHCP'))
ap_dhcp.default = true
ap_dhcp:depends('wan_proto', 'ap')

ap_lan_ipaddr = s:option(Value, 'ap_lan_ipaddr', translate('LAN IPv4 address'),
    translate('AP 模式的 LAN IP 地址，建议与主路由同网段但不冲突'))
ap_lan_ipaddr:depends('wan_proto', 'ap')
ap_lan_ipaddr.datatype = 'ip4addr'
-- ap_lan_ipaddr.default = network.lan and network.lan.ipaddr or '192.168.2.1'
ap_lan_ipaddr.rmempty = false
ap_lan_ipaddr.description = table.concat(descr) .. "</ol>"

local iswireless = isfile('/etc/config/wireless')
if iswireless then
    ap_ssid = s:option(Value, 'ap_ssid', translate('Wi-Fi SSID'),
        translate('AP 模式的 Wi-Fi 网络名称'))
    ap_ssid.datatype = 'maxlength(32)'
    ap_ssid.default = 'OpenWrt-AP'
    ap_ssid.rmempty = false
    ap_ssid:depends('wan_proto', 'ap')

    ap_password = s:option(Value, 'ap_password', translate('Wi-Fi Password'),
        translate('AP 模式的 Wi-Fi 密码，至少 8 字符，留空则无密码'))
    ap_password.password = true
    ap_password.datatype = 'length(8)'
    ap_password.rmempty = true
    ap_password:depends('wan_proto', 'ap')
end

siderouter = s:option(Flag, "enable_siderouter", translate("旁路由设置"))
siderouter.default = 1
siderouter:depends('wan_proto', 'siderouter')

local lan_ipaddr = network.lan and network.lan.ipaddr or ""
ipaddr = s:option(Value, "lan_ipaddr", translate("IPv4 address"))
ipaddr:value(lan_ipaddr, translate(lan_ipaddr .. " --当前LAN的IP--"))
ipaddr.default = lan_ipaddr
ipaddr.datatype="ip4addr"
ipaddr.anonymous = false
ipaddr:depends('enable_siderouter', 0)

ipaddr = s:option(Value, "siderouter_lan_ipaddr", translate("IPv4 address"))
ipaddr.description = table.concat(descr) .. "</ol>"

ipaddr:value(lan_ipaddr, translatef("%s --当前LAN的IP--", lan_ipaddr))
ipaddr.default = lan_ipaddr
ipaddr.datatype="ip4addr"
ipaddr.anonymous = false
ipaddr:depends('enable_siderouter', 1)

local sys_hostname = sys.hostname() or ""
hostname = s:option(Value, "hostname", translate("Hostname"))
hostname.default = sys_hostname
hostname:depends('enable_siderouter', 1)

-- if wizard.hostname and wizard.hostname ~= sys_hostname then
--     sys.hostname(wizard.hostname)
-- end

lan_gateway = s:option(Value, 'lan_gateway', translate('IPv4 gateway'),
    translate('这里输入主路由IP地址<b><font color="red"> 必须填写</font></b>'))
lan_gateway.datatype = 'ip4addr'
lan_gateway.rmempty = true
lan_gateway:depends('enable_siderouter', 1)

lan_sum = s:option(Value, "lan_sum", translate("网口数量"),
    translate("该路由物理网口数量，留空则自动获取"))
lan_sum.datatype = 'uinteger'
lan_sum:depends('enable_siderouter', 1)

netmask = s:option(Value, 'lan_netmask', translate('IPv4 netmask'))
netmask:value("255.255.255.0", translate("255.255.255.0"))
netmask:value("255.255.0.0", translate("255.255.0.0"))
netmask:value("255.0.0.0", translate("255.0.0.0"))
netmask.default = "255.255.255.0"
netmask.datatype='ip4addr'
netmask.anonymous = false

dns = s:option(DynamicList, 'lan_dns', translate('LAN DNS 服务器'),
    translate("可以设置主路由的IP，或可到<a href='https://dnsdaquan.com' target='_blank'> DNS大全 </a>获取更多"))
dns:value("223.5.5.5", translate("阿里DNS：223.5.5.5"))
dns:value("223.6.6.6", translate("阿里DNS：223.6.6.6"))
dns:value("101.226.4.6", translate("DNS派：101.226.4.6"))
dns:value("218.30.118.6", translate("DNS派：218.30.118.6"))
dns:value("180.76.76.76", translate("百度DNS：180.76.76.76"))
dns:value("114.114.114.114", translate("114DNS：114.114.114.114"))
dns:value("114.114.115.115", translate("114DNS：114.114.115.115"))
dns.default = "223.5.5.5"
dns.anonymous = false
dns.datatype = "ip4addr"

dhcp = s:option(Flag, 'dhcp', translate('关闭LAN的DHCP服务'),
    translate('如开启此DHCP则需要关闭主路由LAN的DHCP<br><b><font color="red">关闭主路由DHCP则需要手动将所有上网设备的网关和DNS改为此旁路由的IP</font></b>'))
dhcp.default = 1
dhcp:depends('enable_siderouter', 1)

wan = s:option(Flag, "wan_lan", translate("修改WAN口"),
    translate("修改WAN口变成LAN口"))
wan.rmempty = true
wan:depends('enable_siderouter', 1)

wan_dns_1 = s:option(DynamicList, 'wan_dns_1', translate('WAN DNS 服务器'))
wan_dns_1:value("223.5.5.5", translate("阿里DNS：223.5.5.5"))
wan_dns_1:value("223.6.6.6", translate("阿里DNS：223.6.6.6"))
wan_dns_1:value("101.226.4.6", translate("DNS派：101.226.4.6"))
wan_dns_1:value("218.30.118.6", translate("DNS派：218.30.118.6"))
wan_dns_1:value("180.76.76.76", translate("百度DNS：180.76.76.76"))
wan_dns_1:value("114.114.114.114", translate("114DNS：114.114.114.114"))
wan_dns_1:value("114.114.115.115", translate("114DNS：114.114.115.115"))
wan_dns_1.default = "223.5.5.5"
wan_dns_1.anonymous = false
wan_dns_1.datatype = "ip4addr"
wan_dns_1:depends('wan_lan', 1)

wan_ipaddr_1 = s:option(Value, 'wan_ipaddr_1', translate('IPv4 address'))
wan_ipaddr_1.datatype = 'ip4addr'
wan_ipaddr_1.rmempty = true
wan_ipaddr_1.ucioption = 'ipaddr'
wan_ipaddr_1:depends('wan_lan', 1)

wan_gateway_1 = s:option(Value, 'wan_gateway_1', translate('IPv4 gateway'))
wan_gateway_1.datatype = "ip4addr"
wan_gateway_1.ucioption = 'gateway'
wan_gateway_1:depends('wan_lan', 1)

wan_netmask_1 = s:option(Value, 'wan_netmask_1', translate('IPv4 netmask'))
wan_netmask_1:value('255.255.255.0')
wan_netmask_1:value('255.255.0.0')
wan_netmask_1:value('255.0.0.0')
wan_netmask_1.datatype = "ip4addr"
wan_netmask_1.rmempty = true
wan_netmask_1.ucioption = 'netmask'
wan_netmask_1:depends('wan_lan', 1)

firewall = s:option(Flag, "firewall", translate("防火墙设置"))
firewall.rmempty = true
firewall:depends('enable_siderouter', 1)

fullcone = s:option(Flag, "fullcone", translate("FullCone NAT"), translate("建议开启"))
fullcone.default = true
fullcone.rmempty = true
fullcone:depends("firewall", 1)

masq = s:option(Flag, "masq", translate("启用 IP 动态伪装"), translate("LAN防火墙服务<code>建议开启</code>"))
masq.default = false
masq.rmempty = true
masq:depends("firewall", 1)

syn_flood = s:option(Flag, "syn_flood", translate("启用 SYN-flood 防御"), translate("建议开启"))
syn_flood.default = true
syn_flood.rmempty = true
syn_flood:depends("firewall", 1)

omasq = s:option(Flag, "omasq", translate("防火墙规定"), translate("添加自定义防火墙规则。<code>建议开启</code>"))
omasq:depends("firewall", 1)

ip_tables = s:option(DynamicList, "ip_tables", translate(" "))
ip_tables.default = "iptables -t nat -I POSTROUTING -o " .. (network.wan and network.wan.device or 'eth0') .. " -j MASQUERADE"
ip_tables.anonymous = false
ip_tables:depends("omasq", 1)

-- wan_ipaddr = s:option(Value, 'wan_ipaddr', translate('IPv4 address'))
-- wan_ipaddr.datatype = 'ip4addr'
-- wan_ipaddr.rmempty = false
-- wan_ipaddr.ucioption = 'ipaddr'
-- wan_ipaddr:depends('wan_proto', 'static')

-- wan_gateway = s:option(Value, 'wan_gateway', translate('IPv4 gateway'))
-- wan_gateway.datatype = "ip4addr"
-- wan_gateway.ucioption = 'gateway'
-- wan_gateway:depends('wan_proto', 'static')

-- wan_netmask = s:option(Value, 'wan_netmask', translate('IPv4 netmask'))
-- wan_netmask:value('255.255.255.0')
-- wan_netmask:value('255.255.0.0')
-- wan_netmask:value('255.0.0.0')
-- wan_netmask.datatype = "ip4addr"
-- wan_netmask.rmempty = true
-- wan_netmask.ucioption = 'netmask'
-- wan_netmask:depends('wan_proto', 'static')

if iswireless then
    o = s:option(Value, 'wifi_ssid', translate('Wi-Fi SSID'))
    o.datatype = 'maxlength(32)'

    o = s:option(Value, "wifi_key", translate("Wi-Fi Password"))
    o.datatype = 'wpakey'
    o.password = true
end

local isnetwork = (wizard.wan_proto or '') ~= (network.wan and network.wan.proto or '')
if isnetwork then
    sys.exec("/etc/init.d/wizard reconfig &")
    luci.http.redirect(luci.dispatcher.build_url("admin/system/wizard"))
end

return m
