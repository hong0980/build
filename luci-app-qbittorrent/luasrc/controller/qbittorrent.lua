module("luci.controller.qbittorrent", package.seeall)
local sys = require "luci.sys"
local con = require "luci.model.uci".cursor():get_all("qbittorrent", "main")

function index()
    if not nixio.fs.access("/etc/config/qbittorrent") then return end
    entry({"admin", "nas", "qbittorrent"}, firstchild(), _("qBittorrent")).dependent = false
    entry({"admin", "nas", "qbittorrent", "config"}, cbi("qbittorrent/config"), _("Global settings"), 1).leaf=true
    entry({"admin", "nas", "qbittorrent", "file"}, form("qbittorrent/files"), _("Configuration"), 2).leaf=true
    entry({"admin", "nas", "qbittorrent", "log"}, form("qbittorrent/log"), _("Log"), 3).leaf=true
    entry({"admin", "nas", "qbittorrent", "status"}, call("act_status")).leaf=true
    entry({"admin", "nas", "qbittorrent", "action_log"}, call("action_log_read")).leaf=true
end

function act_status()
    local BL = con.BinaryLocation or "/usr/bin/qbittorrent-nox"
    luci.http.prepare_content("application/json")
    luci.http.write_json({
        port  = con.port  or '8080',
        pid   = sys.exec("pidof %s" %BL) or "",
        pat   = con.BinaryLocation and BL or nil
    })
end

function action_log_read()
    local log_file = (con.Path or (con.RootProfilePath .. "/qBittorrent/data/logs")) .. "/qbittorrent.log"
    luci.http.prepare_content("application/json")
    luci.http.write_json({
        syslog = sys.exec("/sbin/logread -e qbittorrent -t 100") or nil,
        log    = nixio.fs.access(log_file) and sys.exec("tail -n 100 %s" %log_file) or nil
    })
end
