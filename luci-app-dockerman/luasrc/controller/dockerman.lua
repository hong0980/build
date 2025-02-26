--[[
LuCI - Lua Configuration Interface
Copyright 2019 lisaac <https://github.com/lisaac/luci-app-dockerman>
]]--
module("luci.controller.dockerman",package.seeall)
local util  = require "luci.util"
local docker = require "luci.model.docker"
local dk = docker.new()

function index()
	entry({"admin", "services", "docker"}, firstchild(), _("Docker"), 40).dependent = true
	entry({"admin", "services", "docker", "overview"}, form("dockerman/overview"), _("Overview"), 1).leaf = true
	entry({"admin", "services", "docker", "configuration"}, cbi("dockerman/configuration"), _("Configuration"), 2).leaf = true
	entry({"admin", "services", "docker", "containers"}, form("dockerman/containers"), _("Containers"), 3).leaf = true
	entry({"admin", "services", "docker", "images"}, form("dockerman/images"), _("Images"), 4).leaf = true
	entry({"admin", "services", "docker", "networks"}, form("dockerman/networks"), _("Networks"), 5).leaf = true
	entry({"admin", "services", "docker", "volumes"}, form("dockerman/volumes"), _("Volumes"), 6).leaf = true
	entry({"admin", "services", "docker", "action_events"}, call("action_events"), _("Events"), 7).leaf = true

	entry({"admin", "services", "docker", "container"}, form("dockerman/container")).leaf = true
	entry({"admin", "services", "docker", "newnetwork"}, form("dockerman/newnetwork")).leaf = true
	entry({"admin", "services", "docker", "newcontainer"}, form("dockerman/newcontainer")).leaf = true

	entry({"admin", "services", "docker", "images_tag"}, call("tag_image")).leaf = true
	entry({"admin", "services", "docker", "confirm"}, call("action_confirm")).leaf = true
	entry({"admin", "services", "docker", "images_save"}, call("save_images")).leaf = true
	entry({"admin", "services", "docker", "images_load"}, call("load_images")).leaf = true
	entry({"admin", "services", "docker", "images_untag"}, call("untag_image")).leaf = true
	entry({"admin", "services", "docker", "images_import"}, call("import_images")).leaf = true
	entry({"admin", "services", "docker", "container_list_file"}, call("list_file")).leaf = true
	entry({"admin", "services", "docker", "images_get_tags"}, call("get_image_tags")).leaf = true
	entry({"admin", "services", "docker", "container_remove_file"}, call("remove_file")).leaf = true
	entry({"admin", "services", "docker", "container_rename_file"}, call("rename_file")).leaf = true
	entry({"admin", "services", "docker", "container_export"}, call("export_container")).leaf = true
	entry({"admin", "services", "docker", "get_system_df"}, call("action_get_system_df")).leaf = true
	entry({"admin", "services", "docker", "container_put_archive"}, call("upload_archive")).leaf = true
	entry({"admin", "services", "docker", "container_get_archive"}, call("download_archive")).leaf = true
	entry({"admin", "services", "docker", "container_stats"}, call("action_get_container_stats")).leaf = true
	entry({"admin", "services", "docker", "containers_stats"}, call("action_get_containers_stats")).leaf = true
end

local function getDockerInfo()
	local cmd_docker = util.exec("command -v docker"):match("^.+docker") or nil
	if not cmd_docker or cmd_docker:match("^%s*$") then
		return nil, nil
	end

	local con = luci.model.uci.cursor():get_all("dockerd", "dockerman")
	local hosts = con.remote_endpoint == '1'
		and (con.remote_host and con.remote_port and ("tcp://%s:%s" %{con.remote_host, con.remote_port}))
		or (con.socket_path and ("unix://%s" %con.socket_path))

	if not hosts then
		return nil, nil
	end

	return cmd_docker, hosts
end

local function scandir(id, directory)
	local cmd_docker, hosts = getDockerInfo()
	if not cmd_docker or not hosts then
		return
	end
	local i, t = 0, {}
	local pfile = util.execi('%s -H "%s" exec "%s" ls -Ah --full-time --group-directories-first "%s" | egrep -v "^total"' %{cmd_docker, hosts, id, directory})
	for fileinfo in pfile do
		i = i + 1
		-- local dirname = fileinfo:match("%s([^%s]+)$")
		-- if fileinfo:sub(1, 2) == 'dr' and dirname ~= 'proc' then
		-- 	local dirname = fileinfo:match("%s([^%s]+)$")
		-- 	local filepath = ('/%s/%s' %{directory, dirname}):gsub("/+", "/")
		-- 	local du_dir = util.execi('%s -H "%s" exec "%s" du -sh %s' %{cmd_docker, hosts, id, filepath})
		-- 	for sizeinfo in du_dir do
		-- 		sizeinfo = sizeinfo:match("(%S+)")
		-- 		fileinfo = fileinfo:gsub("(%s+%S+%s+%S+%s+%S+%s+)(%S+)(%s+.+)$", "%1" .. sizeinfo .. "%3")
		-- 		t[i] = fileinfo
		-- 	end
		-- else
			t[i] = fileinfo
		-- end
	end
	return t
end

local function list_response(id, path, success)
	luci.http.prepare_content("application/json")
	luci.http.write_json(success and {ec = 0, data = scandir(id, path)} or {ec = 1})
end

local MIME_TYPES = {
	avi    = "video/x-msvideo",
	bmp    = "image/bmp",
	c      = "text/x-csrc; charset=UTF-8",
	conf   = "text/plain; charset=UTF-8",
	css    = "text/css; charset=UTF-8",
	deb    = "application/x-deb",
	doc    = "application/msword",
	gif    = "image/gif",
	h      = "text/x-chdr; charset=UTF-8",
	htm    = "text/html; charset=UTF-8",
	html   = "text/html; charset=UTF-8",
	iso    = "application/x-cd-image",
	js     = "text/javascript; charset=UTF-8",
	json   = "application/json; charset=UTF-8",
	jpg    = "image/jpeg",
	jpeg   = "image/jpeg",
	ko     = "text/x-object; charset=UTF-8",
	lua    = "text/plain; charset=UTF-8",
	log    = "text/plain; charset=UTF-8",
	mpg    = "video/mpeg",
	mpeg   = "video/mpeg",
	mp3    = "audio/mpeg",
	o      = "text/x-object; charset=UTF-8",
	odp    = "application/vnd.oasis.opendocument.presentation",
	odt    = "application/vnd.oasis.opendocument.text",
	ogg    = "audio/x-vorbis+ogg",
	ovpn   = "text/plain; charset=UTF-8",
	pdf    = "application/pdf",
	patch  = "text/x-patch; charset=UTF-8",
	php    = "application/x-php; charset=UTF-8",
	pl     = "application/x-perl",
	png    = "image/png",
	ppt    = "application/vnd.ms-powerpoint",
	sh     = "text/plain; charset=UTF-8",
	svg    = "image/svg+xml",
	tar    = "application/x-compressed-tar",
	txt    = "text/plain; charset=UTF-8",
	wav    = "audio/x-wav",
	xsl    = "application/xml",
	xls    = "application/vnd.ms-excel",
	xml    = "application/xml",
	yaml   = "text/plain; charset=UTF-8",
	zip    = "application/zip",
}

function action_get_system_df()
	local res = docker.new():df()
	luci.http.status(res.code, res.message)
	luci.http.prepare_content("application/json")
	luci.http.write_json(res.body)
end

function list_file(id)
	list_response(id, luci.http.formvalue("path"), true)
end

function rename_file(id)
	local cmd_docker, hosts = getDockerInfo()
	if not cmd_docker or not hosts then
		return
	end
	local newpath = luci.http.formvalue("newpath")
	local filepath = luci.http.formvalue("filepath")
	local success = util.exec('%s -H "%s" exec "%s" mv "%s" "%s"' %{cmd_docker, hosts, id, filepath, newpath})
	list_response(nixio.fs.dirname(filepath), success)
end

function remove_file(id)
	local cmd_docker, hosts = getDockerInfo()
	if not cmd_docker or not hosts then
		return
	end
	local path = luci.http.formvalue("path")
	path = path:gsub("<>", "/"):gsub(" ", "\ ")
	local success = luci.http.formvalue("isdir")
					and util.exec('%s -H "%s" exec %s rm -r "%s"' %{cmd_docker, hosts, id, path})
					or os.remove(path)

	list_response(nixio.fs.dirname(path), success)
end

function action_events()
	local logs = ''
	local query = {["until"] = os.time()}
	local events = dk:events({query = query})

	if events.code == 200 then
		for _, v in ipairs(events.body) do
			local date = "unknown"
			if v and v.time then
				date = os.date("%Y-%m-%d %H:%M:%S", v.time)
			end

			local id = v.Actor.ID or "unknown"
			local action = v.Action or "unknown"
			local name = v.Actor.Attributes.name or "unknown"

			if v and v.Type == "container" then
				logs = "%s[%s] %s %s Container ID: %s Container Name: %s\n" %{logs, date, v.Type, action, id, name}
			elseif v.Type == "image" then
				logs = "%s[%s] %s %s Image: %s Image name: %s\n" %{logs, date, v.Type, action, id, name}
			elseif v.Type == "network" then
				local container = v.Actor.Attributes.container or "unknown"
				local network = v.Actor.Attributes.type or "unknown"
				logs = "%s[%s] %s %s Container ID: %s Network Name: %s Network type: %s\n" %{logs, date, v.Type, action, container, name, network}
			end
		end
	end

	luci.template.render("dockerman/logs", {self = {syslog = logs, title="Events"}})
end

local calculate_cpu_percent = function(d)
	if type(d) ~= "table" then return end

	local cpu_count = tonumber(d["cpu_stats"]["online_cpus"])
	local cpu_percent = 0.0
	local cpu_delta = tonumber(d["cpu_stats"]["cpu_usage"]["total_usage"]) - tonumber(d["precpu_stats"]["cpu_usage"]["total_usage"])
	local system_delta = tonumber(d["cpu_stats"]["system_cpu_usage"]) -- tonumber(d["precpu_stats"]["system_cpu_usage"])
	if system_delta > 0.0 then
		cpu_percent = string.format("%.2f", cpu_delta / system_delta * 100.0 * cpu_count)
	end

	return cpu_percent
end

local get_memory = function(d)
	if type(d) ~= "table" then return end

	-- local limit = string.format("%.2f", tonumber(d["memory_stats"]["limit"]) / 1024 / 1024)
	-- local usage = string.format("%.2f", (tonumber(d["memory_stats"]["usage"]) - tonumber(d["memory_stats"]["stats"]["total_cache"])) / 1024 / 1024)
	-- return usage .. "MB / " .. limit.. "MB"

	local limit =tonumber(d["memory_stats"]["limit"])
	local usage = tonumber(d["memory_stats"]["usage"])
	-- - tonumber(d["memory_stats"]["stats"]["total_cache"])

	return usage, limit
end

local get_rx_tx = function(d)
	if type(d) ~= "table" then return end

	local data = {}
	if type(d["networks"]) == "table" then
		for e, v in pairs(d["networks"]) do
			data[e] = {
				bw_tx = tonumber(v.tx_bytes),
				bw_rx = tonumber(v.rx_bytes)
			}
		end
	end

	return data
end

local function get_stat(container_id)
	if not container_id then return 404, "No container name or id" end
	local response = dk.containers:inspect({id = container_id})
	if response.code == 200 and response.body.State.Running then
		response = dk.containers:stats({id = container_id, query = {stream = false, ["one-shot"] = true}})
		if response.code == 200 then
			local container_stats = response.body
			local cpu_percent = calculate_cpu_percent(container_stats)
			local mem_useage, mem_limit = get_memory(container_stats)
			local bw_rxtx = get_rx_tx(container_stats)
			return response.code, response.body.message, {
				cpu_percent = cpu_percent,
				memory = {
					mem_useage = mem_useage,
					mem_limit = mem_limit
				},
				bw_rxtx = bw_rxtx
			}
		else
			return response.code, response.body.message
		end
	else
		if response.code == 200 then
			return 500, "container "..container_id.." not running"
		else
			return response.code, response.body.message
		end
	end
end

function action_get_container_stats(container_id)
	local code, msg, res = get_stat(container_id)
	luci.http.status(code, msg)
	luci.http.prepare_content("application/json")
	luci.http.write_json(res)
end

function action_get_containers_stats()
	local res = luci.http.formvalue('containers') or ""
	local stats = {}
	res = luci.jsonc.parse(res.containers)
	if res and type(res) == "table" then
		for i, v in ipairs(res) do
			_, _, stats[v] = get_stat(v)
		end
	end
	luci.http.status(200, "OK")
	luci.http.prepare_content("application/json")
	luci.http.write_json(stats)
end

function action_confirm()
	local data = docker:read_status()
	if data then
		data = data:gsub("\n","<br>"):gsub(" ","&nbsp;")
		code = 202
		msg = data
	else
		code = 200
		msg = "finish"
		data = "finish"
	end

	luci.http.status(code, msg)
	luci.http.prepare_content("application/json")
	luci.http.write_json({info = data})
end

function export_container(id)
	local first

	local cb = function(res, chunk)
		if res.code == 200 then
			if not first then
				first = true
				luci.http.header('Content-Disposition', 'inline; filename="'.. id ..'.tar"')
				luci.http.header('Content-Type', 'application\/x-tar')
			end
			luci.ltn12.pump.all(chunk, luci.http.write)
		else
			if not first then
				first = true
				luci.http.prepare_content("text/plain")
			end
			luci.ltn12.pump.all(chunk, luci.http.write)
		end
	end

	local res = dk.containers:export({id = id}, cb)
end

function open_file(id, path, filename)
	local cmd_docker, hosts = getDockerInfo()
	if not cmd_docker or not hosts then
		return
	end
	path = path:find("->") and path:match("->%s(.*)$") or path
	path = path:gsub("<>", "/"):gsub(" ", "\ "):gsub("/+", "/")
	-- local res = dk.containers:inspect({id = container_id})
	-- local dir_path = res.body.GraphDriver.Data.MergedDir
	local dir_path = (util.exec('%s inspect -f "{{.GraphDriver.Data.MergedDir}}" %s' %{cmd_docker, id})):gsub("\n", "")
	local ext = filename:match("%.(%w+)$")
	local TYPES = MIME_TYPES[ext and ext:lower()] or "text/plain; charset=UTF-8"
	luci.http.prepare_content(TYPES)
	luci.http.header('Content-Disposition', 'inline; filename="%s"' %{filename})
	local stat = luci.ltn12.pump.all(luci.ltn12.source.file(io.open(dir_path .. path, "r")), luci.http.write)
	if not stat then
		luci.http.write("无法打开文件：%s" %{dir_path .. path})
	end
end

function download_archive()
	local id = luci.http.formvalue("id")
	local path = luci.http.formvalue("path")
	local isdir = luci.http.formvalue("isdir")
	local filename = luci.http.formvalue("filename") or "archive"

	if isdir ~= '' then
		return open_file(id, path, filename)
	end

	local cb = function(res, chunk)
		if res and res.code and res.code == 200 then
			if not first then
				first = true
				luci.http.header('Content-Disposition', 'inline; filename="%s.tar"' %filename)
				luci.http.header('Content-Type', 'application\/x-tar')
			end
			luci.ltn12.pump.all(chunk, luci.http.write)
		else
			if not first then
				first = true
				luci.http.status(res and res.code or 500, msg or "unknow")
				luci.http.prepare_content("text/plain; charset=UTF-8")
			end
			luci.ltn12.pump.all(chunk, luci.http.write)
		end
	end

	local first
	local res = dk.containers:get_archive({
		id = id,
		query = {path = luci.http.urlencode(path)}
	}, cb)
end

function upload_archive(container_id)
	local path = luci.http.formvalue("upload-path")

	local rec_send = function(sinkout)
		luci.http.setfilehandler(function (meta, chunk, eof)
			if chunk then
				luci.ltn12.pump.step(luci.ltn12.source.string(chunk), sinkout)
			end
		end)
	end

	local res = dk.containers:put_archive({
		id = container_id,
		query = {path = luci.http.urlencode(path)},
		body = rec_send
	})

	local msg = res and res.message or res.body and res.body.message or nil
	luci.http.status(res and res.code or 500, msg or "unknow")
	luci.http.prepare_content("application/json")
	luci.http.write_json({message = msg or "unknow"})
end


function save_images(container_id)
	local names = luci.http.formvalue("names")
	local first

	local cb = function(res, chunk)
		if res.code == 200 then
			if not first then
				first = true
				luci.http.status(res.code, res.message)
				luci.http.header('Content-Disposition', 'inline; filename="images.tar"')
				luci.http.header('Content-Type', 'application\/x-tar')
			end
			luci.ltn12.pump.all(chunk, luci.http.write)
		else
			if not first then
				first = true
				luci.http.prepare_content("text/plain")
			end
			luci.ltn12.pump.all(chunk, luci.http.write)
		end
	end

	docker:write_status("Images: saving %s..." %container_id)
	local res = dk.images:get({
		id = container_id,
		query = {names = names}
	}, cb)
	docker:clear_status()

	local msg = res and res.body and res.body.message or nil
	luci.http.status(res.code, msg)
	luci.http.prepare_content("application/json")
	luci.http.write_json({message = msg})
end

function load_images()
	local archive = luci.http.formvalue("upload-archive")

	local rec_send = function(sinkout)
		luci.http.setfilehandler(function (meta, chunk, eof)
			if chunk then
				luci.ltn12.pump.step(luci.ltn12.source.string(chunk), sinkout)
			end
		end)
	end

	docker:write_status("Images: loading...")
	local res = dk.images:load({body = rec_send})
	local msg = res and res.body and ( res.body.message or res.body.stream or res.body.error ) or nil
	if res and res.code == 200 and msg and msg:match("Loaded image ID") then
		docker:clear_status()
	else
		docker:append_status("code:%s %s" %{(res and res.code or "500"), (msg or "unknow")})
	end

	luci.http.status(res and res.code or 500, msg or "unknow")
	luci.http.prepare_content("application/json")
	luci.http.write_json({message = msg or "unknow"})
end

function import_images()
	local src = luci.http.formvalue("src")
	local itag = luci.http.formvalue("tag")

	local rec_send = function(sinkout)
		luci.http.setfilehandler(function (meta, chunk, eof)
			if chunk then
				luci.ltn12.pump.step(luci.ltn12.source.string(chunk), sinkout)
			end
		end)
	end

	docker:write_status("Images: importing %s...\n" %itag)
	local repo = itag and itag:match("^([^:]+)")
	local tag = itag and itag:match("^[^:]-:([^:]+)")
	local res = dk.images:create({
		query = {
			fromSrc = luci.http.urlencode(src or "-"),
			repo = repo or nil,
			tag = tag or nil
		},
		body = not src and rec_send or nil
	}, docker.import_image_show_status_cb)

	local msg = res and res.body and ( res.body.message )or nil
	if not msg and #res.body == 0 then
		msg = res.body.status or res.body.error
	elseif not msg and #res.body >= 1 then
		msg = res.body[#res.body].status or res.body[#res.body].error
	end

	if res.code == 200 and msg and msg:match("sha256:") then
		docker:clear_status()
	else
		docker:append_status("code:%s %s" %{(res and res.code or "500"), (msg or "unknow")})
	end

	luci.http.status(res and res.code or 500, msg or "unknow")
	luci.http.prepare_content("application/json")
	luci.http.write_json({message = msg or "unknow"})
end

function get_image_tags(image_id)
	if not image_id then
		luci.http.status(400, "no image id")
		luci.http.prepare_content("application/json")
		luci.http.write_json({message = "no image id"})
		return
	end

	local res = dk.images:inspect({id = image_id})
	local msg = res and res.body and res.body.message or nil
	luci.http.status(res and res.code or 500, msg or "unknow")
	luci.http.prepare_content("application/json")

	if res.code == 200 then
		local tags = res.body.RepoTags
		luci.http.write_json({tags = tags})
	else
		local msg = res and res.body and res.body.message or nil
		luci.http.write_json({message = msg or "unknow"})
	end
end

function tag_image(image_id)
	local src = luci.http.formvalue("tag")
	local image_id = image_id or luci.http.formvalue("id")

	if type(src) ~= "string" or not image_id then
		luci.http.status(400, "no image id or tag")
		luci.http.prepare_content("application/json")
		luci.http.write_json({message = "no image id or tag"})
		return
	end

	local repo = src:match("^([^:]+)")
	local tag = src:match("^[^:]-:([^:]+)")
	local res = dk.images:tag({
		id = image_id,
		query={repo=repo, tag=tag}
	})
	local msg = res and res.body and res.body.message or nil
	luci.http.status(res and res.code or 500, msg or "unknow")
	luci.http.prepare_content("application/json")

	if res.code == 201 then
		local tags = res.body.RepoTags
		luci.http.write_json({tags = tags})
	else
		local msg = res and res.body and res.body.message or nil
		luci.http.write_json({message = msg or "unknow"})
	end
end

function untag_image(tag)
	local tag = tag or luci.http.formvalue("tag")

	if not tag then
		luci.http.status(400, "no tag name")
		luci.http.prepare_content("application/json")
		luci.http.write_json({message = "no tag name"})
		return
	end

	local res = dk.images:inspect({name = tag})

	if res.code == 200 then
		local tags = res.body.RepoTags
		if #tags > 1 then
			local r = dk.images:remove({name = tag})
			local msg = r and r.body and r.body.message or nil
			luci.http.status(r.code, msg)
			luci.http.prepare_content("application/json")
			luci.http.write_json({message = msg})
		else
			luci.http.status(500, "Cannot remove the last tag")
			luci.http.prepare_content("application/json")
			luci.http.write_json({message = "Cannot remove the last tag"})
		end
	else
		local msg = res and res.body and res.body.message or nil
		luci.http.status(res and res.code or 500, msg or "unknow")
		luci.http.prepare_content("application/json")
		luci.http.write_json({message = msg or "unknow"})
	end
end
