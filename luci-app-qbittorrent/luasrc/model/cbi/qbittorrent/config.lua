local util = require "luci.util"
local uci  = require "luci.model.uci".cursor()
local con  = uci:get_all("qbittorrent", "main")
local BL   = con.BinaryLocation or "/usr/bin/qbittorrent-nox"
local ver  = util.exec("export HOME=/var/run/qbittorrent; %s -v 2>/dev/null | awk '{print $2}'" %BL)

m = Map("qbittorrent", translate("qBittorrent Downloader"),
    translate("A cross-platform open source BitTorrent client based on QT<br>") ..
    translatef("Current version: <b style='color:red'>%s</b>", ver))
m:section(SimpleSection).template = "qbittorrent/qb_status"

t = m:section(NamedSection, "main", "qbittorrent")
t:tab("basic", translate("Basic Settings"))
t:tab("advanced", translate("Advance Settings"))

e = t:taboption("basic", Flag, "EnableService", translate("Enabled"))
e.default = '0'
e.rmempty = false

local e = t:taboption("basic", Value, "RootProfilePath",
    translate("Root Path of the Profile"),
    translate("Specify the root path of all profiles which is equivalent to the commandline parameter: <b>--profile [PATH]</b>. The default value is /tmp."))
e.default = '/tmp'

local e = t:taboption("basic", Value, "DefaultSavePath", translate("Save Path"),
    translate("The files are stored in the download directory automatically created under the selected mounted disk"))
local dev_map = {}
for disk in util.execi("df -h | awk '/dev.*mnt/{print $6,$2,$3,$5,$1}'") do
    local diskInfo = util.split(disk, " ")
    local dev = diskInfo[5]
    if not dev_map[dev] then
        dev_map[dev] = true
        e:value(diskInfo[1] .. "/download",
            translatef(("%s/download (size: %s) (used: %s/%s)"), diskInfo[1], diskInfo[2], diskInfo[3], diskInfo[4]))
    end
end

local e = t:taboption("basic", Value, "Locale", translate("Locale Language"),
    translate("The supported language codes can be used to customize the setting."))
e:value("zh_CN", translate("Simplified Chinese"))
e:value("en", translate("English"))
e.default = "zh_CN"

e = t:taboption("basic", Value, "port", translate("Listening Port"),
    translate("The listening port for WebUI."))
e.datatype = "port"
e.default = "8080"
-- e.rmempty = false

-- local qB_conf = (con.RootProfilePath or "/tmp") .. "/qBittorrent/config/qBittorrent.conf"
-- if not nixio.fs.access(qB_conf) then
e = t:taboption("basic", Flag, "PasswordEnabled", translate("Enable"),
    translate("使用首次启动默认用户名：admin 密码：password<br>不使用从系统日志获取临时密码可以登录WebUI"))
-- e.rmempty = true
-- end

e = t:taboption("advanced", Flag, "AuthSubnetWhitelistEnabled", translate("Subnet Whitelist"),
    translate("Bypass authentication for clients in Whitelisted IP Subnets."))
e.enabled = "true"
e.disabled = "false"
e.default = e.disabled
e.rmempty = false

e = t:taboption("advanced", DynamicList, "AuthSubnetWhitelist", translate(" "))
e.placeholder = translate('Example: 172.17.32.0/24, fdff:ffff:c8::/40')
e.datatype = "ipaddr"
e:depends("AuthSubnetWhitelistEnabled", "true")

e = t:taboption("advanced", Flag, "PortForwardingEnabled", translate("Use UPnP for WebUI"),
    translate("Using the UPnP / NAT-PMP port of the router for connecting to WebUI."))
e.enabled = "true"
e.disabled = "false"
e.default = "true"
e.rmempty = false

e = t:taboption("advanced", Flag, "CSRFProtection", translate("CSRF Protection"),
    translate("关闭跨站请求伪造 (CSRF) 保护"))
e.enabled = "false"
e.disabled = "true"
e.default = "false"
e.rmempty = false

e = t:taboption('advanced', Flag, 'Enabled', translate('Enable Log'),
    translate('Enable logger to log file.'))
e.enabled = 'true'
e.disabled = 'false'
e.default = "true"
e.rmempty = false

e = t:taboption('advanced', Value, 'Path', translate('Log Path'),
    translate("修改保存日志文件路径"))
e:depends('Enabled', 'true')
-- e.rmempty = true

e = t:taboption("advanced", Value, "BinaryLocation",
    translate("Enable additional qBittorrent"),
    translate("Specify the binary location of qBittorrent."))
e.placeholder = "/usr/sbin/qbittorrent-nox"
-- e.rmempty = true

return m
