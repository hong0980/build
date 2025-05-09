local util = require "luci.util"

function color(color, text)
    return translatef("<b><font color='%s'>%s</font></b>", color, text)
end

a = Map("deluge", translate("Deluge 下载器"), translate("Deluge是一个通过PyGTK建立图形界面的BitTorrent客户端<br>"))
a:section(SimpleSection).template = "deluge/deluge_status"

t = a:section(NamedSection, "main", "deluge")
t:tab("Settings", translate("Basic Settings"))
t:tab("download", translate("下载设置"),
    translatef([[下载设置中的速度和连接 %s 为 %s]], color("red", "-1"), color("red", "无限制")))
t:tab("other_settings", translate("其他设置"))

e = t:taboption("Settings", Flag, "enabled", translate("Enabled"))
e = t:option(Flag, "enabled", translate("Enabled"))
e.default = "0"
e.rmempty = false

e = t:taboption("Settings", ListValue, "user", translate("Run daemon as user"))
for t in util.execi("cut -d ':' -f1 /etc/passwd") do
    e:value(t)
end

e = t:taboption("Settings", Value, "profile_dir", translate("Root Path of the Profile"),
    translate("默认保存在/etc/deluge"))
e.default = '/etc/deluge'
e.rmempty = false

local download_location = t:taboption("Settings", Value, "download_location", translate("下载文件路径"),
    translate("The files are stored in the download directory automatically created under the selected mounted disk"))
local dev_map = {}
for disk in util.execi("df -h | awk '/dev.*mnt/{print $6,$2,$3,$5,$1}'") do
    local diskInfo = util.split(disk, " ")
    local dev = diskInfo[5]
    if not dev_map[dev] then
        dev_map[dev] = true
        download_location:value(diskInfo[1] .. "/download",
            translatef(("%s/download (size: %s) (used: %s/%s)"), diskInfo[1], diskInfo[2], diskInfo[3], diskInfo[4]))
    end
end
download_location.rmempty = false

e = t:taboption("Settings", Value, "language", translate("Locale Language"))
e:value("zh_CN", translate("Simplified Chinese"))
e:value("en_GB", translate("English"))
e.default = "zh_CN"
e.rmempty = false

e = t:taboption("Settings", Value, "port", translate("Listening Port"), translate("默认端口：8112"))
e.datatype = "port"
e.default = "8112"
e.rmempty = false

e = t:taboption("Settings", Value, "password", translate("WebUI密码"), translate("默认密码：deluge"))
e.default = "deluge"
e.rmempty = false

e = t:taboption("Settings", ListValue, "https", translate("WebUI使用https"), translate("默认不使用"))
e:value("false", translate("不使用"))
e:value("true", translate("使用"))
e.default = "false"
e.rmempty = false

e = t:taboption("download", Flag, "event_seed", color("DodgerBlue", "活动种子"))
e = t:taboption("download", Value, "max_active_limit", translate("总数"))
e.default = "8"
e:depends("event_seed", 1)

e = t:taboption("download", Value, "max_active_downloading", translate("正在下载"))
e.default = "3"
e:depends("event_seed", 1)

e = t:taboption("download", Value, "max_active_seeding", translate("做种"))
e.default = "5"
e:depends("event_seed", 1)

e = t:taboption("download", Flag, "speed", color("DodgerBlue", "全局带宽使用"))
e = t:taboption("download", Value, "max_connections_global", translate("最大连接数"))
e.default = "200"
e:depends("speed", 1)

e = t:taboption("download", Value, "max_download_speed", translate("最大下载速度(KiB/s)"))
e.default = "-1"
e:depends("speed", 1)

e = t:taboption("download", Value, "max_upload_speed", translate("最大上传速度(KiB/s)"))
e.default = "-1"
e:depends("speed", 1)

e = t:taboption("download", Value, "max_upload_slots_global", translate("最大上传通道"))
e.default = "4"
e:depends("speed", 1)

e = t:taboption("download", Flag, "per_torrent", color("DodgerBlue", "每个种子带宽使用"))
e = t:taboption("download", Value, "max_connections_per_torrent", translate("最大连接数"))
e.default = "-1"
e:depends("per_torrent", 1)

e = t:taboption("download", Value, "max_upload_slots_per_torrent", translate("最大上传通道"))
e.default = "-1"
e:depends("per_torrent", 1)

e = t:taboption("download", Value, "max_download_speed_per_torrent", translate("最大下载速度(KiB/s)"))
e.placeholder = "-1"
e:depends("per_torrent", 1)

e = t:taboption("download", Value, "max_upload_speed_per_torrent", translate("最大上传速度(KiB/s)"))
e.placeholder = "-1"
e.default = "-1"
e:depends("per_torrent", 1)

e = t:taboption("download", Flag, "sequential_download", translate("顺序下载"))
e.enabled = 'true'
e.disabled = 'false'

e = t:taboption("download", Flag, "prioritize_first_last_pieces", translate("任务首尾块优先"))
e.enabled = 'true'
e.disabled = 'false'

e = t:taboption("download", Flag, "move_completed", translate("将已完成的任务移动到"))
e.enabled = 'true'
e.disabled = 'false'

e = t:taboption("download", Value, "move_completed_path", translate("路径"))
e.placeholder = "/mnt/sda3/download"
e:depends("move_completed", 'true')

e = t:taboption("download", Flag, "copy_torrent_file", translate("将种子文件复制到"))
e.enabled = 'true'
e.disabled = 'false'

e = t:taboption("download", Value, "torrentfiles_location", translate("路径"))
e.placeholder = "/mnt/sda3/download"
e:depends("copy_torrent_file", 'true')

e = t:taboption("other_settings", Flag, "enable_logging", translate("Enable Log"))
e.default = 1
e.rmempty = false

e = t:taboption("other_settings", Value, "log_dir", translate("Log Path"), translate("默认在配置目录下"))
e:depends("enable_logging", 1)
e.placeholder = "/var/log"

e = t:taboption("other_settings", ListValue, "log_level", translate("日志记录等级"))
e:depends("enable_logging", 1)
e:value("none", translate("none"))
e:value("error", translate("Error"))
e:value("warning", translate("Warning"))
e:value("info", translate("Info"))
e:value("debug", translate("Debug"))
e.default = "error"

e = t:taboption("other_settings", Value, "geoip_db_location", translate("GeoIP 数据库路径"))
e.default = "/usr/share/GeoIP"

e = t:taboption("other_settings", Value, "cache_size", translate("缓存大小"), translate("单位：KiB"))
e.default = "32768"

-- if luci.http.formvalue("cbi.apply") then
--     luci.sys.exec("/etc/init.d/deluge reload &")
-- end

return a
