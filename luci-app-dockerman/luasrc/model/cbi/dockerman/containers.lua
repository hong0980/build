--[[
LuCI - Lua Configuration Interface
Copyright 2019 lisaac <https://github.com/lisaac/luci-app-dockerman>
]]--

local http = require "luci.http"
local docker = require "luci.model.docker"
local dk = docker.new()
local m, s, o, images, networks, containers, res, lost_state, gateway, src_dport, dest_port
local urlencode = luci.http.protocol and luci.http.protocol.urlencode or luci.util.urlencode

if dk:_ping().code ~= 200 then
	lost_state = true
else
	res = dk.images:list()
	if res and res.code and res.code < 300 then
		images = res.body
	end

	res = dk.networks:list()
	if res and res.code and res.code < 300 then
		networks = res.body
	end

	res = dk.containers:list({query = {all = true}})
	if res and res.code and res.code < 300 then
		containers = res.body
	end
end

function get_containers()
	local data = {}
	if type(containers) ~= "table" then
		return nil
	end

	for i, v in ipairs(containers) do
		local index =  "%s_id_%s" %{(10^12 - v.Created), v.Id}

		data[index] = {}
		data[index]["_selected"] = 0
		data[index]["_id"] = v.Id:sub(1,12)
		data[index]["_status"] = v.Status

		if v.Status:find("^Up") then
			data[index]["_name"] = "<font color='green'>%s</font>" %{v.Names[1]:sub(2)}
			data[index]["_status"] = [[<a href='%s' title="%s"><font color='green'>%s</font></a><br>
									<font color='#9f9f9f' class='container_cpu_status'></font><br>
									<font color='#9f9f9f' class='container_mem_status'></font><br>
									<font color='#9f9f9f' class='container_network_status'></font>
									]] %
			{
				luci.dispatcher.build_url("admin/services/docker/container/%s/stats" %{v.Id}),
				translate("Running time"),
				data[index]["_status"],
			}
		else
			data[index]["_name"] = "<font color='red'>"..v.Names[1]:sub(2).."</font>"
			data[index]["_status"] = '<font class="container_not_running" color="red">'.. data[index]["_status"] .. "</font>"
		end

		if (type(v.NetworkSettings) == "table" and type(v.NetworkSettings.Networks) == "table") then
			for networkname, netconfig in pairs(v.NetworkSettings.Networks) do
				data[index]["_network"] = (data[index]["_network"] ~= nil and (data[index]["_network"] .. " | ") or "") .. networkname .. (netconfig.IPAddress ~= "" and (": " .. netconfig.IPAddress) or "")
			end
		end

		-- networkmode = v.HostConfig.NetworkMode ~= "default" and v.HostConfig.NetworkMode or "bridge"
		-- data[index]["_network"] = v.NetworkSettings.Networks[networkmode].IPAddress or nil
		-- local _, _, image = v.Image:find("^sha256:(.+)")
		-- if image ~= nil then
		--  image=image:sub(1,12)
		-- end

		if v.Ports and next(v.Ports) ~= nil then
			data[index]["_ports"] = nil
			local ip = require "luci.ip"

			for _, v2 in ipairs(v.Ports) do
				local ip_obj = ip.new(v2.IP or "0.0.0.0")
				if ip_obj:is4() then
					local link = ''

					if v2.PublicPort and v2.Type == "tcp" then
						link = '<a href="javascript:void(0);" title=\'%s\' onclick="window.open((window.location.origin.match(/^(.+):\\d+$/) && window.location.origin.match(/^(.+):\\d+$/)[1] || window.location.origin) + \':\' + \'%s\' , \'_blank\');">' %{translate("Open the container"), v2.PublicPort}
					end

					data[index]["_ports"] = (data[index]["_ports"] or "") .. "%s%s%s%s%s" %{
						link,
						v2.PublicPort and (v2.PublicPort .. ":") or "",
						v2.PrivatePort and (v2.PrivatePort .. "/") or "",
						v2.Type or "",
						link and "</a>" or ""
					}
					src_dport, dest_port = v2.PublicPort, v2.PrivatePort
				end
			end
		end

		for ii, iv in ipairs(images) do
			if iv.Id == v.ImageID then
				data[index]["_image"] = iv.RepoTags and iv.RepoTags[1] or (next(iv.RepoDigests) and (iv.RepoDigests[1]:gsub("(.-)@.+", "%1") .. ":&lt;none&gt;")) or ""
			end
		end
		data[index]["_id_name"] = [[<a href="%s" class="dockerman_link" title="%s">%s</a><br>
									<font color="#9f9f9f">ID: %s</font><br>
									Image: %s<br>
									<font color="#9f9f9f" class="container_size_%s"></font>
									]] %
			{
				luci.dispatcher.build_url("admin/services/docker/container/%s" %v.Id),
				translate("Container detail"),
				data[index]["_name"],
				data[index]["_id"],
				data[index]["_image"] or "&lt;none&gt;",
				v.Id
			}

		if type(v.Mounts) == "table" and next(v.Mounts) then
			for _, v2 in pairs(v.Mounts) do
				if v2.Type ~= "volume" then
					local v_sorce_d, v_dest_d
					local v_sorce = ""
					local v_dest = ""
					for v_sorce_d in v2["Source"]:gmatch('[^/]+') do
						if v_sorce_d and #v_sorce_d > 12 then
							v_sorce = v_sorce .. "/" .. v_sorce_d:sub(1,8) .. ".."
						else
							v_sorce = v_sorce .. "/" .. v_sorce_d
						end
					end
					for v_dest_d in v2["Destination"]:gmatch('[^/]+') do
						if v_dest_d and #v_dest_d > 12 then
							v_dest = v_dest .. "/" .. v_dest_d:sub(1,8) .. ".."
						else
							v_dest = v_dest .. "/" .. v_dest_d
						end
					end
					data[index]["_mounts"] = string.format(
						"%s<span title='%s'><a href='%s/file?path=%s'>%s￫%s</a></span>",
						data[index]["_mounts"] and (data[index]["_mounts"] .. "<br>") or "",
						translate("Open the file list"),
						luci.dispatcher.build_url("admin/services/docker/container/%s" %v.Id),
						v2["Destination"],
						v_sorce,
						v_dest
					)
				end
			end
		end

		data[index]["_image_id"] = v.ImageID:sub(8,20)
		data[index]["_command"] = v.Command
	end
	return data
end

local container_list = not lost_state and get_containers() or {}

m = SimpleForm("docker",
	translate("Docker - Containers"),
	translate("This page displays all containers that have been created on the connected docker host."))
m.submit=false
m.reset=false
m:append(Template("dockerman/containers_running_stats"))

s = m:section(SimpleSection)
s.template = "dockerman/apply_widget"
s.err=docker:read_status()
s.err=s.err and s.err:gsub("\n","<br>"):gsub(" ","&nbsp;")
if s.err then
	docker:clear_status()
end

s = m:section(Table, container_list, translate("Containers"))
s.nodescr=true
s.config="containers"

o = s:option(Flag, "_selected","")
o.disabled = 0
o.enabled = 1
o.default = 0
o.width = "1%"
o.write=function(self, section, value)
	container_list[section]._selected = value
end

-- o = s:option(DummyValue, "_id", translate("ID"))
-- o.width="10%"

-- o = s:option(DummyValue, "_name", translate("Container Name"))
-- o.rawhtml = true

o = s:option(DummyValue, "_id_name", translate("Container Info"))
o.rawhtml = true
o.width="15%"

o = s:option(DummyValue, "_status", translate("Status"))
o.width="15%"
o.rawhtml=true

o = s:option(DummyValue, "_network", translate("Network"))
o.width="10%"

o = s:option(DummyValue, "_ports", translate("Ports"))
o.width="5%"
o.rawhtml = true
o = s:option(DummyValue, "_mounts", translate("Mounts"))
o.width="25%"
o.rawhtml = true

-- o = s:option(DummyValue, "_image", translate("Image"))
-- o.width="8%"

o = s:option(DummyValue, "_command", translate("Command"))
o.width="15%"

local start_stop_remove = function(m, cmd)
	local container_selected = {}
	for k in pairs(container_list) do
		if container_list[k]._selected == 1 then
			container_selected[#container_selected + 1] = container_list[k]["_id"]
		end
	end
	if #container_selected  > 0 then
		local success = true

		docker:clear_status()
		for _, cont in ipairs(container_selected) do
			docker:append_status("Containers: %s %s..." %{cmd, cont})
			local res = dk.containers[cmd](dk, {id = cont})
			if res and res.code and res.code >= 300 then
				success = false
				docker:append_status("code:%s %s\n" %{res.code, (res.body.message and res.body.message or res.message)})
			else
				docker:append_status("done\n")
			end
		end

		if success then docker:clear_status() end

		luci.http.redirect(luci.dispatcher.build_url("admin/services/docker/containers"))
	end
end

s = m:section(Table,{{}})
s.notitle=true
s.rowcolors=false
s.template="cbi/nullsection"

o = s:option(Button, "_new")
o.inputtitle = translate("Add")
o.template = "dockerman/cbi/inlinebutton"
o.inputstyle = "add"
o.forcewrite = true
o.write = function(self, section)
	luci.http.redirect(luci.dispatcher.build_url("admin/services/docker/newcontainer"))
end
o.disable = lost_state

o = s:option(Button, "_start")
o.template = "dockerman/cbi/inlinebutton"
o.inputtitle = translate("Start")
o.inputstyle = "apply"
o.forcewrite = true
o.write = function(self, section)
	start_stop_remove(m, "start")
end
o.disable = lost_state

o = s:option(Button, "_restart")
o.template = "dockerman/cbi/inlinebutton"
o.inputtitle = translate("Restart")
o.inputstyle = "reload"
o.forcewrite = true
o.write = function(self, section)
	start_stop_remove(m, "restart")
end
o.disable = lost_state

o = s:option(Button, "_stop")
o.template = "dockerman/cbi/inlinebutton"
o.inputtitle = translate("Stop")
o.inputstyle = "reset"
o.forcewrite = true
o.write = function(self, section)
	start_stop_remove(m, "stop")
end
o.disable = lost_state

o = s:option(Button, "_kill")
o.template = "dockerman/cbi/inlinebutton"
o.inputtitle = translate("Kill")
o.inputstyle = "reset"
o.forcewrite = true
o.write = function(self, section)
	start_stop_remove(m, "kill")
end
o.disable = lost_state

o = s:option(Button, "_remove")
o.template = "dockerman/cbi/inlinebutton"
o.inputtitle = translate("Remove")
o.inputstyle = "remove"
o.forcewrite = true
o.write = function(self, section)
	start_stop_remove(m, "remove")
end
o.disable = lost_state

if not lost_state then
	for i, v in pairs(networks) do
		gateway = v.IPAM and v.IPAM.Config and v.IPAM.Config[1] and v.IPAM.Config[1].Gateway or nil
	end
end

local uci = require "luci.model.uci".cursor()
local redirect = uci:get("firewall", "@redirect[-1]")
if not redirect then
	uci:add("firewall", "redirect")
	uci:set("firewall", "@redirect[-1]", "name", "docker")
	uci:set("firewall", "@redirect[-1]", "target", "DNAT")
	uci:set("firewall", "@redirect[-1]", "src", "wan")
	uci:set("firewall", "@redirect[-1]", "dest", "lan")
	uci:set("firewall", "@redirect[-1]", "proto", "tcp")
	uci:set("firewall", "@redirect[-1]", "dest_ip", gateway)
	uci:set("firewall", "@redirect[-1]", "src_dport", src_dport)
	uci:set("firewall", "@redirect[-1]", "dest_port", dest_port)
	uci:delete("firewall", "@redirect[-1]", "enabled")
	uci:commit("firewall")
	luci.util.exec("/etc/init.d/firewall restart")
end

return m
