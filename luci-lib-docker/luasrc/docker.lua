--[[
LuCI - Lua Configuration Interface
Copyright 2019 lisaac <https://github.com/lisaac/luci-lib-docker>
]]--

require "luci.util"
require "nixio.util"
local nixio = require "nixio"
local jsonc = require "luci.jsonc"
local ltn12 = require "luci.ltn12"
local json_parse = jsonc.parse
local json_stringify = jsonc.stringify
local urlencode = luci.util.urlencode or luci.http and luci.http.protocol and luci.http.protocol.urlencode

local chunksource = function(sock, buffer)
	buffer = buffer or ""

	return function()
		local output
		local _, endp, count = buffer:find("^([0-9a-fA-F]+)\r\n")

		while not count do
			local newblock, code = sock:recv(1024)
			if not newblock then
				return nil, code
			end
			buffer = buffer .. newblock
			_, endp, count = buffer:find("^([0-9a-fA-F]+)\r\n")
		end
		count = tonumber(count, 16)
		if not count then
			return nil, -1, "invalid encoding"
		elseif count == 0 then
			return nil
		elseif count <= #buffer - endp then
			output = buffer:sub(endp + 1, endp + count)
			if count == #buffer - endp then
				buffer = buffer:sub(endp + count + 1)
				count, code = sock:recvall(2)
				if not count then
					return nil, code
				end
			elseif count + 1 == #buffer - endp then
				buffer = buffer:sub(endp + count + 2)
				count, code = sock:recvall(1)
				if not count then
					return nil, code
				end
			else
				buffer = buffer:sub(endp + count + 3)
			end
			return output
		else
			output = buffer:sub(endp + 1, endp + count)
			buffer = buffer:sub(endp + count + 1)
			local remain, code = sock:recvall(count - #output)
			if not remain then
				return nil, code
			end
			output = output .. remain
			count, code = sock:recvall(2)
			if not count then
				return nil, code
			end
			return output
		end
	end
end

local chunksink = function (sock)
	return function(chunk, err)
		return not chunk and sock:writeall("0\r\n\r\n")
						 or  sock:writeall(("%X\r\n%s\r\n"):format(#chunk, tostring(chunk)))
	end
end

local docker_stream_filter = function(buffer)
	if not buffer or #buffer < 8 then return "" end
	local first_byte = buffer:byte(1)
	local stream_type = (first_byte == 1 and "stdout") or
						(first_byte == 2 and "stderr") or
						(first_byte == 0 and "stdin" ) or
						"stream_err"
	local valid_length = (buffer:byte(5) * 256^3) +
						 (buffer:byte(6) * 256^2) +
						 (buffer:byte(7) * 256  ) +
						 (buffer:byte(8)        )

	if valid_length > #buffer - 8 then return "" end
	return "%s: %s" %{stream_type, buffer:sub(9, valid_length + 8)}
end

local open_socket = function(req_options)
	local socket
	if type(req_options) ~= "table" then
		return socket
	end
	if req_options.socket_path then
		socket = nixio.socket("unix", "stream")
		if socket:connect(req_options.socket_path) ~= true then
			return nil
		end
	elseif req_options.host and req_options.port then
		socket = nixio.connect(req_options.host, req_options.port)
	end
	return socket and socket or nil
end

local send_http_socket = function(options, docker_socket, req_header, req_body, callback)
	if docker_socket:send(req_header) == 0 then
		return {
			headers = {code = 498, message = "bad path", protocol = "HTTP/1.1"},
			body = {message = "can\'t send data to socket"}
		}
	end

	if req_body then
		if type(req_body) == "function" then
			local sink = req_header
						 and req_header:match("chunked")
						 and chunksink(docker_socket)
						 or docker_socket
			req_body(sink)
		else
			local data = type(req_body) == "table"
						 and json_stringify(req_body)
						 or req_body
			docker_socket:send(data)
			if options.debug then
				luci.util.exec("echo '%s' >> %s" %{data, options.debug_path})
			end
		end
	end

	local linesrc = docker_socket:linesource()
	local line = linesrc()
	if not line then
		docker_socket:close()
		return {
			headers = {code = 499, message = "bad socket path", protocol = "HTTP/1.1"},
			body = {message = "no data receive from socket"}
		}
	end

	local response = {code = 0, headers = {}, body = {}}
	local p, code, msg = line:match("^([%w./]+) ([0-9]+) (.*)")
	response.protocol = p
	response.code = tonumber(code)
	response.message = msg
	line = linesrc()
	while line and line ~= "" do
		local key, val = line:match("^([%w-]+)%s?:%s?(.*)")
		if key and key ~= "Status" then
			if type(response.headers[key]) == "string" then
				response.headers[key] = {
					response.headers[key],
					val
				}
			elseif type(response.headers[key]) == "table" then
				response.headers[key][#response.headers[key] + 1] = val
			else
				response.headers[key] = val
			end
		end
		line = linesrc()
	end

	local body_buffer = linesrc(true)
	response.body = {}
	if type(callback) ~= "function" then
		if response.headers["Transfer-Encoding"] == "chunked" then
			local source = chunksource(docker_socket, body_buffer)
			code = ltn12.pump.all(source, (ltn12.sink.table(response.body))) and response.code or 555
			response.code = code
		else
			local body_source = ltn12.source.cat(ltn12.source.string(body_buffer), docker_socket:blocksource())
			code = ltn12.pump.all(body_source, (ltn12.sink.table(response.body))) and response.code or 555
			response.code = code
		end
	else
		if response.headers["Transfer-Encoding"] == "chunked" then
			local source = chunksource(docker_socket, body_buffer)
			callback(response, source)
		else
			local body_source = ltn12.source.cat(ltn12.source.string(body_buffer), docker_socket:blocksource())
			callback(response, body_source)
		end
	end
	docker_socket:close()
	return response
end

local function gen_header(options, http_method, api_group, api_action, name_or_id, request)
	local header, query, path, encoded_value

	if request and type(request.query) == "table" then
		for k, v in pairs(request.query) do
			if type(v) == "table" then
				encoded_value = urlencode(json_stringify(v))
			elseif type(v) == "boolean" then
				encoded_value = v and "true" or "false"
			else
				encoded_value = tostring(v)
			end
			query = "%s%s=%s" %{(query and query .. "&" or "?"), k, encoded_value}
		end
	end
	http_method = http_method or "GET"
	name_or_id = (name_or_id ~= "") and name_or_id or nil
	path = (api_group  and ("/" .. api_group)  or "") ..
		   (name_or_id and ("/" .. name_or_id) or "") ..
		   (api_action and ("/" .. api_action) or "") ..
		   (query or "")
	header = ("%s %s %s\r\nHost: %s\r\nUser-Agent: %s\r\nConnection: close\r\n"
			 %{http_method, path, options.protocol, options.host, options.user_agent})

	if request and type(request.header) == "table" then
		for k, v in pairs(request.header) do
			header = "%s%s: %s\r\n" %{header, k, v}
		end
	end

	if request and request.body then
		if type(request.body) == "function" then
			if not header:match("Content-Length:") then
				header = "%sTransfer-Encoding: chunked\r\n" %header
			end
		elseif type(request.body) == "table" and http_method == "POST" then
			local content_json = json_stringify(request.body)
			header = "%sContent-Type: application/json\r\nContent-Length: %s\r\n" %{header, #content_json}
		elseif type(request.body) == "string" then
			header = "%sContent-Length: %s\r\n" %{header, #request.body}
		end
	end

	header = header .. "\r\n"
	if options.debug then luci.util.exec("echo '%s' >> %s" %{header, options.debug_path}) end
	return header
end

local call_docker = function(options, http_method, api_group, api_action, name_or_id, request, callback)
	local req_options = setmetatable({}, {__index = options})
	local req_header = gen_header(req_options, http_method, api_group, api_action, name_or_id, request)
	local req_body = request and request.body or nil
	local docker_socket = open_socket(req_options)

	return docker_socket and send_http_socket(options, docker_socket, req_header, req_body, callback) or {
		headers = {code = 497, message = "bad socket path or host", protocol = "HTTP/1.1"},
		body = {message = "can\'t connect to socket"}
	}
end

local gen_api = function(_table, http_method, api_group, api_action)
	local _api_action

	if api_action == "get_archive" or api_action == "put_archive" then
		_api_action = "archive"
	elseif api_action == "df" then
		_api_action = "system/df"
	elseif api_action ~= "list" and api_action ~= "inspect" and api_action ~= "remove" then
		_api_action = api_action
	elseif (api_group == "containers" or api_group == "images" or api_group == "exec") and (api_action == "list" or api_action == "inspect") then
		_api_action = "json"
	end

	local fp = function(self, request, callback)
		local name_or_id = request and (request.name or request.id or request.name_or_id) or nil

		if api_action == "list" then
			if (name_or_id ~= "" and name_or_id ~= nil) then
				if api_group == "images" then
					name_or_id = nil
				else
					request.query = request and request.query or {}
					request.query.filters = request.query.filters or {}
					request.query.filters.name = request.query.filters.name or {}
					request.query.filters.name[#request.query.filters.name + 1] = name_or_id
					name_or_id = nil
				end
			end
		elseif api_action == "create" then
			if (name_or_id ~= "" and name_or_id ~= nil) then
				request.query = request and request.query or {}
				request.query.name = request.query.name or name_or_id
				name_or_id = nil
			end
		elseif api_action == "logs" then
			local body_buffer = ""
			local response = call_docker(self.options,
				http_method,
				api_group,
				_api_action,
				name_or_id,
				request,
				callback)
			if response.code >= 200 and response.code < 300 then
				for i, v in ipairs(response.body) do
					body_buffer = body_buffer .. docker_stream_filter(response.body[i])
				end
				response.body = body_buffer
			end
			return response
		end
		local response = call_docker(self.options, http_method, api_group, _api_action, name_or_id, request, callback)
		if response.headers and response.headers["Content-Type"] == "application/json" then
			if #response.body == 1 then
				response.body = json_parse(response.body[1])
			else
				local tmp = {}
				for _, v in ipairs(response.body) do
					tmp[#tmp+1] = json_parse(v)
				end
				response.body = tmp
			end
		end
		return response
	end

	if api_group then
		_table[api_group][api_action] = fp
	else
		_table[api_action] = fp
	end
end

local _docker = {
	exec = {},
	images = {},
	volumes = {},
	networks = {},
	containers = {}
}

gen_api(_docker, "POST",   "exec",        "start")
gen_api(_docker, "POST",   "exec",        "resize")
gen_api(_docker, "GET",    "exec",        "inspect")
gen_api(_docker, "GET",    "containers",  "list")
gen_api(_docker, "POST",   "containers",  "create")
gen_api(_docker, "GET",    "containers",  "inspect")
gen_api(_docker, "GET",    "containers",  "top")
gen_api(_docker, "GET",    "containers",  "logs")
gen_api(_docker, "GET",    "containers",  "changes")
gen_api(_docker, "GET",    "containers",  "stats")
gen_api(_docker, "POST",   "containers",  "resize")
gen_api(_docker, "POST",   "containers",  "start")
gen_api(_docker, "POST",   "containers",  "stop")
gen_api(_docker, "POST",   "containers",  "restart")
gen_api(_docker, "POST",   "containers",  "kill")
gen_api(_docker, "POST",   "containers",  "update")
gen_api(_docker, "POST",   "containers",  "rename")
gen_api(_docker, "POST",   "containers",  "pause")
gen_api(_docker, "POST",   "containers",  "unpause")
gen_api(_docker, "POST",   "containers",  "update")
gen_api(_docker, "DELETE", "containers",  "remove")
gen_api(_docker, "POST",   "containers",  "prune")
gen_api(_docker, "POST",   "containers",  "exec")
gen_api(_docker, "GET",    "containers",  "get_archive")
gen_api(_docker, "PUT",    "containers",  "put_archive")
gen_api(_docker, "GET",    "containers",  "export")

gen_api(_docker, "GET",    "images",      "list")
gen_api(_docker, "POST",   "images",      "create")
gen_api(_docker, "GET",    "images",      "inspect")
gen_api(_docker, "GET",    "images",      "history")
gen_api(_docker, "POST",   "images",      "tag")
gen_api(_docker, "DELETE", "images",      "remove")
gen_api(_docker, "GET",    "images",      "search")
gen_api(_docker, "POST",   "images",      "prune")
gen_api(_docker, "GET",    "images",      "get")
gen_api(_docker, "POST",   "images",      "load")

gen_api(_docker, "GET",    "networks",    "list")
gen_api(_docker, "GET",    "networks",    "inspect")
gen_api(_docker, "DELETE", "networks",    "remove")
gen_api(_docker, "POST",   "networks",    "create")
gen_api(_docker, "POST",   "networks",    "connect")
gen_api(_docker, "POST",   "networks",    "disconnect")
gen_api(_docker, "POST",   "networks",    "prune")

gen_api(_docker, "GET",    "volumes",     "list")
gen_api(_docker, "GET",    "volumes",     "inspect")
gen_api(_docker, "DELETE", "volumes",     "remove")
gen_api(_docker, "POST",   "volumes",     "create")

gen_api(_docker, "GET",    nil,           "df")
gen_api(_docker, "GET",    nil,           "info")
gen_api(_docker, "GET",    nil,           "_ping")
gen_api(_docker, "GET",    nil,           "events")
gen_api(_docker, "GET",    nil,           "version")

function _docker.new(value)
	local docker, opts = {}, value or {}
	local submodules = {'containers', 'networks', 'images', 'volumes', 'exec'}

	docker.options = {
		tls         = opts.tls,
		socket_path = opts.socket_path,
		debug       = opts.debug or false,
		version     = opts.version or "v1.40",
		user_agent  = opts.user_agent or "LuCI",
		protocol    = opts.protocol or "HTTP/1.1",
		tls_key     = opts.tls   and opts.tls_key,
		tls_cert    = opts.tls   and opts.tls_cert,
		tls_cacert  = opts.tls   and opts.tls_cacert,
		debug_path  = opts.debug and opts.debug_path,
		port        = opts.socket_path and nil or opts.port,
		host        = opts.socket_path and "localhost" or opts.host
	}

	setmetatable(docker, {
		__index = function(t, key)
			return _docker[key] or _docker.containers[key]
		end
	})

	for _, name in ipairs(submodules) do
		setmetatable(docker[name], {
			__index = function(t, key)
				return key == 'options' and docker.options
			end
		})
	end
	return docker
end

return _docker
