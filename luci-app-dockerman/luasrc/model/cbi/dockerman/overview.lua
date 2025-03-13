--[[
LuCI - Lua Configuration Interface
Copyright 2019 lisaac <https://github.com/lisaac/luci-app-dockerman>
]]--

local docker = require "luci.model.docker"
local m, s, o, lost_state
local dk = docker.new()

if dk:_ping().code ~= 200 then lost_state = true end

m = SimpleForm("dockerd", translate("Docker - Overview"),
	translate("An overview with the relevant data is displayed here with which the LuCI docker client is connected.") ..
	[[<a href="https://github.com/lisaac/luci-app-dockerman" target="_blank"> Github</a>]])
m.submit=false
m.reset=false

local docker_info_table = {
	-- ['0OperatingSystem'] = {_key = translate("Operating System"), _value = '-'},
	-- ['1Architecture'] = {_key = translate("Architecture"), _value = '-'},
	-- ['2KernelVersion'] = {_key = translate("Kernel Version"), _value = '-'},
	['3ServerVersion'] = {_key = translate("Docker Version"), _value = '-'},
	['4ApiVersion'] = {_key = translate("Api Version"), _value = '-'},
	['5NCPU'] = {_key = translate("CPUs"), _value = '-'},
	['6MemTotal'] = {_key = translate("Total Memory"), _value = '-'},
	['7DockerRootDir'] = {_key = translate("Docker Root Dir"), _value = '-'},
	['8IndexServerAddress'] = {_key = translate("Index Server Address"), _value = '-'},
	['9RegistryMirrors'] = {_key = translate("Registry Mirrors"), _value = '-'}
}
local start = nixio.fs.access("/usr/bin/dockerd") and
			  luci.model.uci.cursor():get("dockerd", "dockerman", "remote_endpoint") == "0"

if start then
	s = m:section(SimpleSection)
	s.template = "dockerman/apply_widget"
	s.err = docker:read_status()
	s.err = s.err and s.err:gsub("\n","<br>"):gsub(" ","&nbsp;")
	if s.err then
		docker:clear_status()
	end
	s = m:section(Table,{{}})
	s.notitle = true
	s.rowcolors = false
	s.template = "cbi/nullsection"

	o = s:option(Button, "_start")
	o.template = "dockerman/cbi/inlinebutton"
	o.inputtitle = translate(lost_state and "Start" or "Stop")
	o.inputstyle = lost_state and "add" or "remove"
	o.forcewrite = true
	o.write = function(self, section)
		docker:clear_status()
		if lost_state then
			docker:append_status(translate("Docker daemon: starting"))
			luci.util.exec("/etc/init.d/dockerd start && sleep 5")
			luci.util.exec("/etc/init.d/dockerman start")
		else
			docker:append_status(translate("Docker daemon: stopping"))
			luci.util.exec("/etc/init.d/dockerd stop")
		end
		docker:clear_status()
		luci.http.redirect(luci.dispatcher.build_url("admin/services/docker/overview"))
	end

	o = s:option(Button, "_restart")
	o.template = "dockerman/cbi/inlinebutton"
	o.inputtitle = translate("Restart")
	o.inputstyle = "reload"
	o.forcewrite = true
	o.write = function(self, section)
		docker:clear_status()
		docker:append_status(translate("Docker daemon: restarting"))
		luci.util.exec("/etc/init.d/dockerd restart && sleep 5")
		luci.util.exec("/etc/init.d/dockerman start")
		docker:clear_status()
		luci.http.redirect(luci.dispatcher.build_url("admin/services/docker/overview"))
	end
end

s = m:section(Table, docker_info_table)
s:option(DummyValue, "_key", translate("Info"))
s:option(DummyValue, "_value")

s = m:section(SimpleSection)
s.template = "dockerman/overview"
s.containers_running = '-'
s.images_used = '-'
s.containers_total = '-'
s.images_total = '-'
s.networks_total = '-'
s.volumes_total = '-'

if not lost_state then
	local vol             = dk.volumes:list()
	local docker_info     = dk:info()
	local images_list     = dk.images:list().body
	local networks_list   = dk.networks:list().body or {}
	local volumes_list    = vol and vol.body and vol.body.Volumes or {}
	local containers_list = dk.containers:list({query = {all = true}}).body

	-- docker_info_table['0OperatingSystem']._value = docker_info.body.OperatingSystem
	-- docker_info_table['1Architecture']._value = docker_info.body.Architecture
	-- docker_info_table['2KernelVersion']._value = docker_info.body.KernelVersion
	docker_info_table['3ServerVersion']._value = docker_info.body.ServerVersion
	docker_info_table['4ApiVersion']._value = docker_info.headers["Api-Version"]
	docker_info_table['5NCPU']._value = tostring(docker_info.body.NCPU)
	docker_info_table['6MemTotal']._value = docker.byte_format(docker_info.body.MemTotal)
	if docker_info.body.DockerRootDir then
		local statvfs = nixio.fs.statvfs(docker_info.body.DockerRootDir)
		local size = statvfs and (statvfs.bavail * statvfs.bsize) or 0
		docker_info_table['7DockerRootDir']._value = "%s (%s %s)" %{docker_info.body.DockerRootDir, tostring(docker.byte_format(size)), translate("Available")}
	end

	docker_info_table['8IndexServerAddress']._value = docker_info.body.IndexServerAddress
	if docker_info.body.RegistryConfig and docker_info.body.RegistryConfig.Mirrors then
		for i, v in ipairs(docker_info.body.RegistryConfig.Mirrors or {}) do
			docker_info_table['9RegistryMirrors']._value = docker_info_table['9RegistryMirrors']._value == "-" and v or (docker_info_table['9RegistryMirrors']._value .. ", " .. v)
		end
	end

	s.images_used = 0
	for i, v in ipairs(images_list) do
		for ci,cv in ipairs(containers_list) do
			if v.Id == cv.ImageID then
				s.images_used = s.images_used + 1
				break
			end
		end
	end

	s.containers_running = tostring(docker_info.body.ContainersRunning)
	s.images_used = tostring(s.images_used)
	s.containers_total = tostring(docker_info.body.Containers)
	s.images_total = tostring(#images_list)
	s.networks_total = tostring(#networks_list)
	s.volumes_total = tostring(#volumes_list)
else
	docker_info_table['3ServerVersion']._value = translate("Can NOT connect to docker daemon, please check!!")
end

return m
