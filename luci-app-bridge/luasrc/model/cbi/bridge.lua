m=Map("bridge", translate("旁路由"),
translate("<font color=\"green\">Let the routing become a transparent bridge device that communicates with the superior routing without perception and has the function of firewall.</font><br><br>Applicable to network environments that have superior routing and require some functions of soft routing but do not want multi-level NAT.<br>The switch or client needs to be connected to the network port of the soft route.<br>The WEB console of the soft route after the transparent bridge is enabled is the bridge IP.<br>Some features on the soft route will be invalid after enabling the transparent bridge, such as Full Cone, multi-dial, etc.<br>After closing, restore the network settings when the plugin is installed, and the WEB console reverts to the original set IP."))

m:section(SimpleSection).template  = "bridge/bridge_status"

s = m:section(TypedSection, "bridge")
s.anonymous=true

o = s:option(Flag, "enabled", translate("开启旁路由"))
o.rmempty=false

o = s:option(Value, "ipaddr", translate("网桥IP"), translate("主路由同一个网段没有冲突的IP地址"))
o.default = "192.168.2.150"

o = s:option(Value, "gateway", translate("网关IP"), translate("主路由IP地址"))
o.default = "192.168.2.1"

o = s:option(Value, "netmask", translate("Netmask"))
o.default = "255.255.255.0"
o.rmempty=false

o = s:option(Value, "network", translate("网口数量"), translate("软路由物理网口数量，留空则自动获取"))
o.anonymous=true

o = s:option(Flag, "ignore", translate("关闭DHCP"), translate("关闭LAN的自动获取IP服务"))
o.rmempty=false

o = s:option(Flag, "firewall", translate("防火墙设置"))
o.rmempty=false
o = s:option(Flag, "fullcone", translate("SYN-flood"), translate("关闭防火墙ISYN-flood防御服务"))
o:depends("firewall", 1)
o = s:option(Flag, "syn_flood", translate("FullCone-NAT"), translate("关闭防火墙IFullCone-NAT服务"))
o:depends("firewall", 1)
o = s:option(Flag, "masq", translate("IP动态伪装"), translate("开启防火墙IP动态伪装IP服务"))
o:depends("firewall", 1)

return m
