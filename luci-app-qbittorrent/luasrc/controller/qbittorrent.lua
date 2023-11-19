module("luci.controller.qbittorrent", package.seeall)
local sys  = require "luci.sys"
local http = require "luci.http"
local uci  = require "luci.model.uci".cursor()
local con  = uci:get_all("qbittorrent", "main")

function index()
    if not nixio.fs.access("/etc/config/qbittorrent") then return end
    entry({"admin", "nas", "qbittorrent"}, firstchild(), _("qBittorrent")).dependent = false
    entry({"admin", "nas", "qbittorrent", "config"}, cbi("qbittorrent/config"), _("Global settings"), 1).leaf=true
    entry({"admin", "nas", "qbittorrent", "file"}, form("qbittorrent/files"), _("Configuration"), 2).leaf=true
    entry({"admin", "nas", "qbittorrent", "log"}, form("qbittorrent/log"), _("Log"), 3).leaf=true
    entry({"admin", "nas", "qbittorrent", "status"}, call("act_status")).leaf=true
    entry({"admin", "nas", "qbittorrent", "action_log"}, call("action_log_read")).leaf=true
    entry({"admin", "nas", "qbittorrent", "encryptPassword"}, call("encryptPassword")).leaf=true
end

function encryptPassword()
    local flag = http.formvalue('flag')
    local password = http.formvalue('password')

    if password then
        local password_key = flag and "Password_PBKDF2" or "Password_ha1"
        uci:set("qbittorrent", "main", password_key, password)
        uci:commit("qbittorrent")
    end
end

function act_status()
    local BinaryLocation = con.BinaryLocation or "/usr/bin/qbittorrent-nox"
    http.prepare_content("application/json")
    http.write_json({
        port  = con.Port  or '8080',
        https = con.https or 'false',
        pid   = sys.exec("pidof " .. BinaryLocation) or "",
        pat   = BinaryLocation ~= "/usr/bin/qbittorrent-nox" and BinaryLocation or nil
    })
end

function action_log_read()
    local file = {
        log    = "",
        syslog = sys.exec("/sbin/logread -e qbittorrent | tail -n 60")
    }
    local log_file = (con.Path or con.RootProfilePath .. "/qBittorrent/data/logs") .. "/qbittorrent.log"
    if nixio.fs.access(log_file) then
        file.log = sys.exec("tail -n 60 %s" %log_file)
    end
    http.prepare_content("application/json")
    http.write_json(file)
end
