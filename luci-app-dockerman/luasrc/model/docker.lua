--[[
LuCI - Lua Configuration Interface
Copyright 2019 lisaac <https://github.com/lisaac/luci-app-dockerman>
]]--

local fs = require "nixio.fs"
local docker = require "luci.docker"
local uci = require "luci.model.uci".cursor()
local con = uci:get_all("dockerd", "dockerman")
local remote = con.remote_endpoint == '1'
local _docker = {}

local update_image = function(self, image_name)
	_docker:append_status("Images: pulling %s...\n" %image_name)
	local res = self.images:create({query = {fromImage=image_name}}, _docker.pull_image_show_status_cb)

	if res and res.code and res.code == 200
		   and (#res.body > 0 and not res.body[#res.body].error and res.body[#res.body].status and (res.body[#res.body].status == "Status: Downloaded newer image for %s" %image_name)) then
		_docker:append_status("done\n")
	else
		res.body.message = res.body[#res.body] and res.body[#res.body].error or (res.body.message or res.message)
	end

	new_image_id = self.images:inspect({name = image_name}).body.Id
	return new_image_id, res
end

local table_equal = function(t1, t2)
	if not t1 then return true end
	if not t2 then return false end
	if #t1 ~= #t2 then return false end

	for i, v in ipairs(t1) do
		if t1[i] ~= t2[i] then
			return false
		end
	end

	return true
end

local table_subtract = function(t1, t2)
	if not t1 or next(t1) == nil then return nil end
	if not t2 or next(t2) == nil then return t1 end

	local res = {}
	for _, v1 in ipairs(t1) do
		local found = false
		for _, v2 in ipairs(t2) do
			if v1 == v2 then
				found = true
				break
			end
		end
		if not found then
			table.insert(res, v1)
		end
	end

	return next(res) == nil and nil or res
end

local map_subtract = function(t1, t2)
	if not t1 or next(t1) == nil then return nil end
	if not t2 or next(t2) == nil then return t1 end

	local res = {}
	for k1, v1 in pairs(t1) do
		local found = false
		for k2, v2 in ipairs(t2) do
			if k1 == k2 and luci.util.serialize_data(v1) == luci.util.serialize_data(v2) then
				found = true
				break
			end
		end

		if not found then res[k1] = v1 end
	end

	return next(res) ~= nil and res or nil
end

local get_config = function(container_config, image_config)
	local config = container_config.Config
	local old_host_config = container_config.HostConfig
	local old_network_setting = container_config.NetworkSettings.Networks or {}

	if config.WorkingDir == image_config.WorkingDir then
		config.WorkingDir = ""
	end

	if config.User == image_config.User then
		config.User = ""
	end

	if table_equal(config.Cmd, image_config.Cmd) then
		config.Cmd = nil
	end

	if table_equal(config.Entrypoint, image_config.Entrypoint) then
		config.Entrypoint = nil
	end

	if table_equal(config.ExposedPorts, image_config.ExposedPorts) then
		config.ExposedPorts = nil
	end

	config.Env = table_subtract(config.Env, image_config.Env)
	config.Labels = table_subtract(config.Labels, image_config.Labels)
	config.Volumes = map_subtract(config.Volumes, image_config.Volumes)

	if old_host_config.PortBindings and next(old_host_config.PortBindings) ~= nil then
		config.ExposedPorts = {}
		for p, v in pairs(old_host_config.PortBindings) do
			config.ExposedPorts[p] = {HostPort = v[1] and v[1].HostPort}
		end
	end

	local network_setting, extra_network, multi_network = {}, {}, false

	for k, v in pairs(old_network_setting) do
		if multi_network then
			extra_network[k] = v
		else
			network_setting[k] = v
		end
		multi_network = true
	end

	local host_config = old_host_config
	host_config.Mounts = {}
	for i, v in ipairs(container_config.Mounts) do
		if v.Type == "volume" then
			table.insert(host_config.Mounts, {
				Type = v.Type,
				Target = v.Destination,
				Source = v.Source:match("([^/]+)\/_data"),
				BindOptions = (v.Type == "bind") and {Propagation = v.Propagation} or nil,
				ReadOnly = not v.RW
			})
		end
	end

	local create_body = config
	create_body["HostConfig"] = host_config
	create_body["NetworkingConfig"] = {EndpointsConfig = network_setting}
	create_body = _docker.clear_empty_tables(create_body) or {}
	extra_network = _docker.clear_empty_tables(extra_network) or {}

	return create_body, extra_network
end

local upgrade = function(self, request)
	_docker:clear_status()

	local container_info = self.containers:inspect({id = request.id})

	if container_info.code > 300 and type(container_info.body) == "table" then
		return container_info
	end

	local image_name = container_info.body.Config.Image
	if not image_name:match(".-:.+") then
		image_name = image_name .. ":latest"
	end

	local old_image_id = container_info.body.Image
	local container_name = container_info.body.Name:sub(2)

	local image_id, res = update_image(self, image_name)
	if res and res.code and res.code ~= 200 then
		return res
	end

	if image_id == old_image_id then
		return {code = 305, body = {message = "Already up to date"}}
	end

	local t = os.date("%Y%m%d%H%M%S")
	_docker:append_status("Container: rename %s to %s_old_%s..." %{container_name, container_name, t})
	res = self.containers:rename({name = container_name, query = {name = "%s_old_%s" %{container_name, t}}})
	if res and res.code and res.code < 300 then
		_docker:append_status("done\n")
	else
		return res
	end

	local image_config = self.images:inspect({id = old_image_id}).body.Config
	local create_body, extra_network = get_config(container_info.body, image_config)

	_docker:append_status("Container: Create %s..." %container_name)
	create_body = _docker.clear_empty_tables(create_body)
	res = self.containers:create({name = container_name, body = create_body})
	if res and res.code and res.code > 300 then
		return res
	end
	_docker:append_status("done\n")

	for k, v in pairs(extra_network) do
		_docker:append_status("Networks: Connect %s..." %{container_name})
		res = self.networks:connect({id = k, body = {Container = container_name, EndpointConfig = v}})
		if res and res.code and res.code > 300 then
			return res
		end
		_docker:append_status("done\n")
	end

	_docker:append_status("Container: Stop %s_old_%s..." %{container_name, t})
	res = self.containers:stop({name = "%s_old_%s" %{container_name, t}})
	if res and res.code and res.code < 305 then
		_docker:append_status("done\n")
	else
		return res
	end

	_docker:append_status("Container: Start %s..." %container_name)
	res = self.containers:start({name = container_name})
	if res and res.code and res.code < 305 then
		_docker:append_status("done\n")
	else
		return res
	end

	_docker:clear_status()
	return res
end

local duplicate_config = function (self, request)
	local container_info = self.containers:inspect({id = request.id})
	if container_info.code > 300 and type(container_info.body) == "table" then
		return nil
	end

	local old_image_id = container_info.body.Image
	local image_config = self.images:inspect({id = old_image_id}).body.Config

	return get_config(container_info.body, image_config)
end

local status_cb = function(res, source, handler)
	res.body = res.body or {}
	while true do
		local chunk = source()
		if not chunk then return end
		res.body[#res.body + 1] = chunk
		handler(chunk)
	end
end

_docker.new = function()
	_docker.options = {
		debug = con.debug == '1',
		host = remote and con.remote_host or nil,
		port = remote and con.remote_port or nil,
		status_path = con.status_path or "/tmp/.docker_action_status",
		socket_path = not remote and con.socket_path or "/var/run/docker.sock",
		debug_path = con.debug == '1' and con.debug_path or "/tmp/.docker_debug"
	}

	local _new = docker.new(_docker.options)
	_new.containers_upgrade = upgrade
	_new.containers_duplicate_config = duplicate_config

	return _new
end

_docker.options = {
	status_path = con.status_path or "/tmp/.docker_action_status"
}

_docker.append_status = function(self, val)
	if not val then return end
	local file_docker_action_status = io.open(self.options.status_path, "a+")
	file_docker_action_status:write(val)
	file_docker_action_status:close()
end

_docker.write_status = function(self, val)
	if not val then return end
	local file_docker_action_status = io.open(self.options.status_path, "w+")
	file_docker_action_status:write(val)
	file_docker_action_status:close()
end

_docker.read_status = function(self)
	return fs.readfile(self.options.status_path)
end

_docker.clear_status = function(self)
	return fs.remove(self.options.status_path)
end

_docker.clear_empty_tables = function(t)
	if type(t) ~= 'table' then return t end

	for k, v in pairs(t) do
		if type(v) == 'table' then
			t[k] = _docker.clear_empty_tables(v)
			if t[k] and next(t[k]) == nil then
				t[k] = nil
			end
		end
	end

	return t
end

_docker.pull_image_show_status_cb = function(res, source)
	return status_cb(res, source, function(chunk)
		local step = luci.jsonc.parse(chunk)
		if type(step) == "table" then
			local buf = _docker:read_status()
			local num = 0
			local str = '\t' .. (step.id and (step.id .. ": ") or "") .. (step.status and step.status or "") .. (step.progress and (" " .. step.progress) or "") .. "\n"
			if step.id then
				buf, num = buf:gsub("\t" .. step.id .. ": .-\n", str)
			end
			if num == 0 then
				buf = buf .. str
			end
			_docker:write_status(buf)
		end
	end)
end

_docker.import_image_show_status_cb = function(res, source)
	return status_cb(res, source, function(chunk)
		local step = luci.jsonc.parse(chunk)
		if type(step) == "table" then
			local buf = _docker:read_status()
			local num = 0
			local str = '\t' .. (step.status and step.status or "") .. (step.progress and (" " .. step.progress) or "") .. "\n"
			if step.status then
				buf, num = buf:gsub("\t" .. step.status .. " .-\n", str)
			end
			if num == 0 then
				buf = buf .. str
			end
			_docker:write_status(buf)
		end
	end)
end

_docker.create_macvlan_interface = function(name, device, gateway, subnet)
	if not fs.access("/etc/config/network") or not fs.access("/etc/config/firewall") or remote then
		return
	end

	local ip = require "luci.ip"
	local if_name = "docker_" .. name
	local dev_name = "macvlan_" .. name
	local net_mask = tostring(ip.new(subnet):mask())
	local lan_interfaces

	uci:delete("network", dev_name)
	uci:set("network", dev_name, "device")
	uci:set("network", dev_name, "name", dev_name)
	uci:set("network", dev_name, "ifname", device)
	uci:set("network", dev_name, "type", "macvlan")
	uci:set("network", dev_name, "mode", "bridge")

	uci:delete("network", if_name)
	uci:set("network", if_name, "interface")
	uci:set("network", if_name, "proto", "static")
	uci:set("network", if_name, "ifname", dev_name)
	uci:set("network", if_name, "ipaddr", gateway)
	uci:set("network", if_name, "netmask", net_mask)
	uci:foreach("firewall", "zone", function(s)
		if s.name == "lan" then
			local interfaces
			if type(s.network) == "table" then
				interfaces = table.concat(s.network, " ")
				uci:delete("firewall", s[".name"], "network")
			else
				interfaces = s.network and s.network or ""
			end
			interfaces = interfaces .. " " .. if_name
			interfaces = interfaces:gsub("%s+", " ")
			uci:set("firewall", s[".name"], "network", interfaces)
		end
	end)

	uci:commit("firewall")
	uci:commit("network")
	luci.util.exec("ifup %s" %if_name)
end

_docker.remove_macvlan_interface = function(name)
	if not fs.access("/etc/config/network") or not fs.access("/etc/config/firewall") or remote then
		return
	end

	local if_name = "docker_" .. name
	local dev_name = "macvlan_" .. name
	uci:foreach("firewall", "zone", function(s)
		if s.name == "lan" then
			local interfaces
			if type(s.network) == "table" then
				interfaces = table.concat(s.network, " ")
			else
				interfaces = s.network and s.network or ""
			end
			interfaces = interfaces and interfaces:gsub(if_name, "")
			interfaces = interfaces and interfaces:gsub("%s+", " ")
			uci:set("firewall", s[".name"], "network", interfaces)
		end
	end)

	uci:delete("network", dev_name)
	uci:delete("network", if_name)
	uci:commit("network")
	uci:commit("firewall")
	luci.util.exec("ip link del %s" %if_name)
end

_docker.byte_format = function (byte)
	if not byte then return 'NaN' end
	local suff = {"B", "KB", "MB", "GB", "TB"}
	for i=1, 5 do
		if byte > 1024 and i < 5 then
			byte = byte / 1024
		else
			return ("%.2f %s" %{byte, suff[i]})
		end
	end
end

return _docker
