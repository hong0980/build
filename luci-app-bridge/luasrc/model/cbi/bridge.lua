m=Map("bridge", translate("Transparent bridge"),
translate("<font color=\"green\">Let the routing become a transparent bridge device that communicates with the superior routing without perception and has the function of firewall.</font><br><br>Applicable to network environments that have superior routing and require some functions of soft routing but do not want multi-level NAT.<br>The switch or client needs to be connected to the network port of the soft route.<br>The WEB console of the soft route after the transparent bridge is enabled is the bridge IP.<br>Some features on the soft route will be invalid after enabling the transparent bridge, such as Full Cone, multi-dial, etc.<br>After closing, restore the network settings when the plugin is installed, and the WEB console reverts to the original set IP."))

m:section(SimpleSection).template  = "bridge/bridge_status"

s=m:section(TypedSection, "bridge")
s.anonymous=true

o=s:option(Flag, "enabled", translate("Passerelle transparente"))
o.rmempty=false

o=s:option(Value, "gateway", translate("GatewayIP"), translate("Superior routing IP"))
o.rmempty=false

o=s:option(Value, "ipaddr", translate("Bridge IP"), translate("Need to be on the same network segment as the upper-level route but do not conflict with other device IPs."))
o.rmempty=false

o=s:option(Value, "netmask", translate("Netmask"))
o.rmempty=false

o=s:option(Value, "network", translate("Number of network ports"), translate("The number of physical network ports on the soft route is automatically detected when left blank."))
o.anonymous=true

return m
