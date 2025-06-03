-- Taskplan configuration for LuCI
-- Defines scheduled tasks with various preset functions and custom scripts

local m = Map("taskplan", translate("Scheduled Task"), translate(
    "<b>The original [Timing Settings] includes scheduled task execution and startup task execution. " ..
    "Presets include over 10 functions: restart, shutdown, network restart, memory release, system cleaning, " ..
    "network sharing, network shutdown, automatic detection of network disconnects and reconnection, " ..
    "MWAN3 load balancing detection of reconnection, and custom scripts</b><br/>" ..
    "N1-N5 is continuous, N1,N3,N5 is discontinuous, */N represents every N hours or minutes. " ..
    "Week: 0-6, Hour: 0-23, Minute: 0-59. Unavailable time is 48 hours."
))

s = m:section(TypedSection, "global", translate("Global Settings"))
s.anonymous = true

e = s:option(TextValue, "customscript", translate("Edit Custom Script"))
e.description = translate("Execution content for [Scheduled Customscript] task")
e.rows = 5
e.default = " "

e = s:option(TextValue, "customscript2", translate("Edit Custom Script2"))
e.description = translate("Execution content for [Scheduled Customscript2] task")
e.rows = 5
e.default = " "

s = m:section(TypedSection, "stime", translate("Scheduled Tasks"))
s.addremove = true
s.anonymous = true
s.template = "cbi/tblsection"

e = s:option(Value, "remarks", translate("Remarks"))

e = s:option(Flag, "enable", translate("Enable"))
e.rmempty = false
e.default = 0

e = s:option(ListValue, "stype", translate("Scheduled Type"))
e.default = 2
e:value(1, translate("Scheduled Reboot"))
e:value(2, translate("Scheduled Poweroff"))
e:value(3, translate("Scheduled ReNetwork"))
e:value(4, translate("Scheduled RestartSamba"))
e:value(5, translate("Scheduled Restartwan"))
e:value(6, translate("Scheduled Closewan"))
e:value(7, translate("Scheduled Clearmem"))
e:value(8, translate("Scheduled Sysfree"))
e:value(9, translate("Scheduled DisReconn"))
e:value(10, translate("Scheduled DisRereboot"))
e:value(11, translate("Scheduled Restartmwan3"))
e:value(12, translate("Scheduled Customscript"))
e:value(13, translate("Scheduled Wifiup"))
e:value(14, translate("Scheduled Wifidown"))
e:value(15, translate("Scheduled Customscript2"))

e = s:option(Value, "month", translate("Month (0-11)"))
e.rmempty = false
e.default = "*"

e = s:option(Value, "week", translate("Week Day (0-6)"))
e.rmempty = true
e.default = "*"
e:value("*", translate("Everyday"))
e:value("0", translate("Sunday"))
e:value("1", translate("Monday"))
e:value("2", translate("Tuesday"))
e:value("3", translate("Wednesday"))
e:value("4", translate("Thursday"))
e:value("5", translate("Friday"))
e:value("6", translate("Saturday"))

e = s:option(Value, "hour", translate("Hour (0-23)"))
e.rmempty = false
e.default = "0"

e = s:option(Value, "minute", translate("Minute (0-59)"))
e.rmempty = false
e.default = "0"

return m
