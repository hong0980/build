--[[
LuCI - Lua Configuration Interface
Copyright 2021 Florian Eckert <fe@dev.tdt.de>
Copyright 2021 lisaac <lisaac.cn@gmail.com>
]]--
local util = require "luci.util"
local uci = require "luci.model.uci".cursor()
local isfw4 = util.exec("command -v fw4") ~= ''
local remote_endpoint_boot = uci:get("dockerd", "dockerman", "remote_endpoint") == "0"

m = Map("dockerd",
	translate("Docker - Configuration"),
	translate("DockerMan is a simple docker manager client for LuCI"))

if remote_endpoint_boot then
	s = m:section(NamedSection, "globals", "section", translate("Docker Daemon settings"))
	s:tab("globals", translate("Access Control"))
	s:tab("firewall", translate("防火墙设置"))
	s:tab("proxies", translate("代理设置"))

	o = s:taboption("globals", Flag, "auto_start", translate("Auto start"))
	o.rmempty = false
	function o.write(self, section, value)
		if not value or value == "" then
			return
		end
		local val = value == "1" and 'enable' or 'disable'
		util.exec("/etc/init.d/dockerd %s" %val)
		uci:set("dockerd", "globals", "auto_start", value)
	end

	o = s:taboption("globals", Value, "data_root",
		translate("Docker Root Dir"))
	o.placeholder = "/opt/docker/"
	o:depends("remote_endpoint", 0)

	o = s:taboption("globals", Flag, "iptables",
		translate("Enable"),
		translate("Use iptables to configure network isolation and routing"))
	o.default = 1
	o:depends("remote_endpoint", 0)

	o = s:taboption("globals", Flag, "ip6tables",
		translate("Enable"),
		translate("Use ip6tables to configure network isolation and routing"))
	o:depends("remote_endpoint", 0)

	o = s:taboption("globals", Value, "bip",
		translate("Default bridge"),
		translate("Configure the default bridge network"))
	o.placeholder = "172.17.0.1/16"
	o.datatype = "ipaddr"
	o:depends("remote_endpoint", 0)

	o = s:taboption("globals", Value, "fixed_cidr",
		translate("限制容器可用的 IP 范围"),
		translate("为 Docker 桥接网络分配固定的 CIDR 子网（IPv4）"))
	o.placeholder = '172.17.0.0/16'
	o:depends("remote_endpoint", 0)
	o.datatype = "ipaddr"

	o = s:taboption("globals", Value, "alt_config_file",
		translate("指定 Docker 配置文件"),
		translate("使用自定义的 JSON 配置，默认使用 /tmp/dockerd/daemon.json"))
	o.placeholder = "/etc/dockerd/daemon.json"
	o:depends("remote_endpoint", 0)

	o = s:taboption("globals", DynamicList, "hosts",
		translate("Client connection"),
		translate('Specifies where the Docker daemon will listen for client connections (default: unix:///var/run/docker.sock)'))
	o:value("unix:///var/run/docker.sock", "unix:///var/run/docker.sock")
	o:value("tcp://0.0.0.0:2375", "tcp://0.0.0.0:2375")
	o.rmempty = true
	o:depends("remote_endpoint", 0)

	o = s:taboption("globals", Value, "ip",
		translate("Specify IP"),
		translate("Docker will use the given IP address instead of automatically assigning one"))
	o:depends("remote_endpoint", 0)
	o.datatype = "ipaddr"

	o = s:taboption("globals", DynamicList, "dns",
		translate("DNS 服务器"),
		translate("设置 Docker 自定义 DNS"))
	o:depends("remote_endpoint", 0)
	o.datatype = "ipaddr"

	o = s:taboption("globals", DynamicList, "registry_mirrors",
		translate("Registry Mirrors"),
		translate("It replaces the daemon registry mirrors with a new set of registry mirrors"))
	o:value("https://docker.m.daocloud.io", "https://docker.m.daocloud.io")
	o:value("https://hub-mirror.c.163.com", "https://hub-mirror.c.163.com")
	o:value("https://registry.docker-cn.com", "https://registry.docker-cn.com")
	o:value("https://docker.mirrors.ustc.edu.cn", "https://docker.mirrors.ustc.edu.cn")
	o.default = "https://docker.m.daocloud.io"
	o:depends("remote_endpoint", 0)

	o = s:taboption("globals", ListValue, "log_level",
		translate("Log Level"),
		translate('Set the logging level'))
	o:value("debug", translate("Debug"))
	o:value("", translate("Info"))
	o:value("warn", translate("Warning"))
	o:value("error", translate("Error"))
	o:value("fatal", translate("Fatal"))
	o.rmempty = true
	o:depends("remote_endpoint", 0)

	if isfw4 then
		o = s:taboption("firewall", Flag, "fw4",
			translate("Enable"),
			translate("允许 Docker 网络加入 WAN 区域，解决 Docker 与 firewall4 的兼容性"))
		o.rmempty = false
		function o.write(self, section, value)
			if not value or value == "" then
				return
			end

			local modified = false
			local if_name = "docker"
			local function filter_networks(networks)
				local filtered = {}
				for _, net in ipairs(networks) do
					if net ~= if_name then
						filtered[#filtered + 1] = net
					end
				end
				return filtered
			end

			uci:foreach("firewall", "zone", function(s)
				local changed = false
				local networks = uci:get_list("firewall", s[".name"], "network")

				if value == "1" then
					if not util.contains(networks, if_name) then
						networks[#networks + 1] = if_name
						changed = true
					end
				elseif value == "0" then
					local new_networks = filter_networks(networks)
					if #new_networks ~= #networks then
						networks = new_networks
						changed = true
					end
				end

				if changed then
					uci:set_list("firewall", s[".name"], "network", networks)
					modified = true
				end
			end)

			if modified then
				uci:commit("firewall")
				util.exec("/etc/init.d/firewall reload &")
			end

			uci:set("dockerd", "globals", "fw4", value)
		end
	end

	o = s:taboption("firewall", Value, "device",
		translate("Docker 网络接口"),
		translate('默认防火墙将 docker0 接口与 Docker 区域关联'))
	o.placeholder = 'docker0'

	o = s:taboption("firewall", DynamicList, "blocked_interfaces",
		translate("阻止 Docker 访问的网络"),
		translate('设置 wan 表示 Docker 容器无法直接发起到 WAN 接口（例如，pppoe-wan 或 eth1）的连接。'))
	local wa = require "luci.tools.webadmin"
	wa.cbi_add_networks(o)

	o = s:taboption("firewall", Value, "extra_iptables_args",
		translate("防火墙规则"),
		translate('为 Docker 生成的 iptables 规则添加额外的参数，修改后需重启 Docker'))
	o.placeholder = '--match conntrack ! --ctstate RELATED,ESTABLISHED'
	o:depends("iptables", 1)

	o = s:taboption("proxies", Value, "http_proxy",
		translate("为 HTTP 流量设置代理服务器"),
		translate('当 Docker 守护进程或容器需要通过代理访问 HTTP 资源（例如，拉取镜像）时使用。'))
	o.placeholder = "http://proxy.example.com:3128"

	o = s:taboption("proxies", Value, "https_proxy",
		translate("为 HTTPS 流量设置代理服务器"),
		translate('当 Docker 守护进程或容器需要通过代理访问 HTTP 资源（例如，拉取镜像）时使用。'))
	o.placeholder = "https://proxy.example.com:3129"

	o = s:taboption("proxies", Value, "no_proxy",
		translate("指定不走代理的地址和网络"),
		translate('排除内网地址、特定域名或本地地址，避免通过代理访问。'))
	o.placeholder = '*.test.example.com,.example.org,127.0.0.0/8'
end

s = m:section(NamedSection, "dockerman", "section", translate("DockerMan settings"))
s:tab("ac", translate("Access Control"))
s:tab("dockerman", translate("DockerMan"))

o = s:taboption("dockerman", Flag, "remote_endpoint",
	translate("Remote Endpoint"),
	translate("Connect to remote docker endpoint"))
o.rmempty = false
o.validate = function(self, value, sid)
	local res = luci.http.formvaluetable("cbid.dockerd")
	if res["dockerman.remote_endpoint"] == "1" then
	 if res["dockerman.remote_port"]
		and res["dockerman.remote_port"] ~= ""
		and res["dockerman.remote_host"]
		and res["dockerman.remote_host"] ~= "" then
			return 1
		else
			return nil, translate("Please input the PORT or HOST IP of remote docker instance!")
		end
	else
		if not res["dockerman.socket_path"] then
			return nil, translate("Please input the SOCKET PATH of docker daemon!")
		end
	end
	return 0
end

o = s:taboption("dockerman", Value, "socket_path",
	translate("Docker Socket Path"))
o.default = "/var/run/docker.sock"
o.placeholder = "/var/run/docker.sock"
o:depends("remote_endpoint", 0)

o = s:taboption("dockerman", Value, "remote_host",
	translate("Remote Host"),
	translate("Host or IP Address for the connection to a remote docker instance"))
o.datatype = "host"
o.placeholder = "10.1.1.2"
o:depends("remote_endpoint", 1)

o = s:taboption("dockerman", Value, "remote_port",
	translate("Remote Port"))
o.placeholder = "2375"
o.datatype = "port"
o:depends("remote_endpoint", 1)

o = s:taboption("dockerman", Value, "status_path",
	translate("Action Status Tempfile Path"),
	translate("Where you want to save the docker status file"))

o = s:taboption("dockerman", Flag, "debug",
	translate("Enable Debug"),
	translate("For debug, It shows all docker API actions of luci-app-dockerman in Debug Tempfile Path"))
o.enabled = "true"
o.disabled = "false"

o = s:taboption("dockerman", Value, "debug_path",
	translate("Debug Tempfile Path"),
	translate("Where you want to save the debug tempfile"))

if remote_endpoint_boot then
	o = s:taboption("ac", DynamicList, "ac_allowed_interface",
		translate("Allowed access interfaces"),
		translate("Which interface(s) can access containers under the bridge network, fill-in Interface Name"))
	local interfaces = luci.sys.net.devices() or {}
	for i, v in ipairs(interfaces) do
		o:value(v, v)
	end
	o = s:taboption("ac", DynamicList, "ac_allowed_ports",
		translate("Ports allowed to be accessed"),
		translate("Which Port(s) can be accessed, it's not restricted by the Allowed Access interfaces configuration. Use this configuration with caution!"))
	o.placeholder = "8080/tcp"
	local docker = require "luci.model.docker"
	local containers, res, lost_state
	local dk = docker.new()
	if dk:_ping().code ~= 200 then
		lost_state = true
	else
		lost_state = false
		res = dk.containers:list()
		if res and res.code and res.code < 300 then
			containers = res.body
		end
	end

	if containers then
		for i, v in ipairs(containers) do
			if v.State == "running" and v.Ports then
				for _, port in ipairs(v.Ports) do
					if port.PublicPort and port.IP and not string.find(port.IP, ":") then
						o:value(port.PublicPort .. "/" .. port.Type, v.Names[1]:sub(2) .. " | " .. port.PublicPort .. " | " .. port.Type)
					end
				end
			end
		end
	end
end

return m
