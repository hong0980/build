local util = require "luci.util"

function color(color, text)
    return translatef("<b><font color='%s'>%s</font></b>", color, text)
end

a = Map("deluge", translate("Deluge Downloader"),
    translate("Deluge is a BitTorrent client with a graphical interface built using PyGTK<br>"))
a:section(SimpleSection).template = "deluge/deluge_status"

t = a:section(NamedSection, "main", "deluge")
t:tab("Settings", translate("Basic Settings"))
t:tab("download", translate("Download Settings"),
    translatef("Speed and connection in download settings %s are %s", color("red", "-1"), color("red", translate("Unlimited"))))
t:tab("other_settings", translate("Other Settings"))

e = t:taboption("Settings", Flag, "enabled", translate("Enabled"))
e = t:option(Flag, "enabled", translate("Enabled"))
e.default = "0"
e.rmempty = false

e = t:taboption("Settings", ListValue, "user",
    translate("Run daemon as user"))
for t in util.execi("cut -d ':' -f1 /etc/passwd") do
    e:value(t)
end

e = t:taboption("Settings", Value, "profile_dir",
    translate("Root Path of the Profile"),
    translate("Saved by default in /etc/deluge"))
e.default = '/etc/deluge'
e.rmempty = false

local download_location = t:taboption("Settings", Value, "download_location", translate("Download File Path"),
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

e = t:taboption("Settings", Value, "port", translate("Listening Port"),
    translate("Default port: 8112"))
e.datatype = "port"
e.default = "8112"
e.rmempty = false

e = t:taboption("Settings", Value, "password", translate("WebUI Password"),
    translate("Default password: deluge"))
e.default = "deluge"
e.rmempty = false

e = t:taboption("Settings", ListValue, "https", translate("WebUI uses HTTPS"),
    translate("Not used by default"))
e:value("false", translate("Not Used"))
e:value("true", translate("Use"))
e.default = "false"
e.rmempty = false

e = t:taboption("download", Flag, "event_seed", color("DodgerBlue", translate("Active Seeds")))
e = t:taboption("download", Value, "max_active_limit", translate("Total"))
e.default = "8"
e:depends("event_seed", 1)

e = t:taboption("download", Value, "max_active_downloading",
    translate("Downloading"))
e.default = "3"
e:depends("event_seed", 1)

e = t:taboption("download", Value, "max_active_seeding", translate("Seeding"))
e.default = "5"
e:depends("event_seed", 1)

e = t:taboption("download", Flag, "speed", color("DodgerBlue", translate("Global Bandwidth Usage")))
e = t:taboption("download", Value, "max_connections_global",
    translate("Maximum Connections"))
e.default = "200"
e:depends("speed", 1)

ashop = t:taboption("download", Value, "max_download_speed",
    translate("Maximum Download Speed (KiB/s)"))
e.default = "-1"
e:depends("speed", 1)

e = t:taboption("download", Value, "max_upload_speed",
    translate("Maximum Upload Speed (KiB/s)"))
e.default = "-1"
e:depends("speed", 1)

e = t:taboption("download", Value, "max_upload_slots_global",
    translate("Maximum Upload Slots"))
e.default = "4"
e:depends("speed", 1)

e = t:taboption("download", Flag, "per_torrent", color("DodgerBlue", translate("Per-Torrent Bandwidth Usage")))
e = t:taboption("download", Value, "max_connections_per_torrent",
    translate("Maximum Connections"))
e.default = "-1"
e:depends("per_torrent", 1)

e = t:taboption("download", Value, "max_upload_slots_per_torrent",
    translate("Maximum Upload Slots"))
e.default = "-1"
e:depends("per_torrent", 1)

e = t:taboption("download", Value, "max_download_speed_per_torrent",
    translate("Maximum Download Speed (KiB/s)"))
e.placeholder = "-1"
e:depends("per_torrent", 1)

e = t:taboption("download", Value, "max_upload_speed_per_torrent",
    translate("Maximum Upload Speed (KiB/s)"))
e.placeholder = "-1"
e.default = "-1"
e:depends("per_torrent", 1)

e = t:taboption("download", Flag, "sequential_download", translate("Sequential Download"))
e.enabled = 'true'
e.disabled = 'false'

e = t:taboption("download", Flag, "prioritize_first_last_pieces",
    translate("Prioritize First and Last Pieces"))
e.enabled = 'true'
e.disabled = 'false'

e = t:taboption("download", Flag, "move_completed", translate("Move Completed Tasks to"))
e.enabled = 'true'
e.disabled = 'false'

e = t:taboption("download", Value, "move_completed_path", translate("Path"))
e.placeholder = "/mnt/sda3/download"
e:depends("move_completed", 'true')

e = t:taboption("download", Flag, "copy_torrent_file", translate("Copy Torrent File to"))
e.enabled = 'true'
e.disabled = 'false'

e = t:taboption("download", Value, "torrentfiles_location", translate("Path"))
e.placeholder = "/mnt/sda3/download"
e:depends("copy_torrent_file", 'true')

e = t:taboption("other_settings", Flag, "enable_logging", translate("Enable Log"))
e.default = 1
e.rmempty = false

e = t:taboption("other_settings", Value, "log_dir", translate("Log Path"),
    translate("By default in the configuration directory"))
e:depends("enable_logging", 1)
e.placeholder = "/var/log"

e = t:taboption("other_settings", ListValue, "log_level", translate("Log Level"))
e:depends("enable_logging", 1)
e:value("none", translate("none"))
e:value("error", translate("Error"))
e:value("warning", translate("Warning"))
e:value("info", translate("Info"))
e:value("debug", translate("Debug"))
e.default = "error"

e = t:taboption("other_settings", Value, "geoip_db_location", translate("GeoIP Database Path"))
e.default = "/usr/share/GeoIP"

e = t:taboption("other_settings", Value, "cache_size", translate("Cache Size"), translate("Unit: KiB"))
e.default = "32768"

-- if luci.http.formvalue("cbi.apply") then
--     luci.sys.exec("/etc/init.d/deluge reload &")
-- end

return a
