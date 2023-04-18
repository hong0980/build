local fs   = require "nixio.fs"
local util = require "luci.util"
local uci  = require "luci.model.uci".cursor()

local config_dir = uci:get("qbittorrent", "main", "RootProfilePath") or "/tmp"
local files = {}
files.conf = "/etc/config/qbittorrent"
files.qbittorrent = config_dir .. "/qBittorrent/config/qBittorrent.conf"

m = SimpleForm("qbittorrent", "%s - %s"%{translate("qBittorrent"), translate("configuration file")},
	translate("This page is the configuration file content of qBittorrent."))
m.reset = false
m.submit = false

for key, value in pairs(files) do
	if fs.readfile(value) then
		s = m:section(SimpleSection, nil, translatef("This is the content of the configuration file under <code>%s</code>:", value))
		o = s:option(TextValue, key)
		o.rows = 20
		o.readonly = true
		o.cfgvalue = function()
			local v = fs.readfile(value) or translate("File does not exist.")
			return util.trim(v) ~= "" and v or translate("Empty file.")
		end
	end
end

return m
