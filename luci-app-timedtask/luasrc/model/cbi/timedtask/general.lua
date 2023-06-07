uci = require "luci.model.uci".cursor()
m = Map("timedtask", translate("timedtask Plus+"),
translate("<font color='green'><b>The plug-in that makes scheduled tasks easier to use is modified with the original version by wulishhui@gmail.com. </font></b><br>") ..
translate("The string of the CRON expression is composed of five fields separated by spaces and the execution command: <font color=red> * * * * * [command]</font><br>") ..
translate("According to the definition of the position and the range of values: minute (0-59), hour (0-23), day (1-31), month (1-12), week (1-7), (commond) The command to execute. <br>") ..
translate("[ , ] comma means <strong>list enumeration values</strong>. In the minute field, 5,20 means triggering once at the 5th minute and 20th minute respectively. <br>") ..
translate("[ / ] A forward slash indicates an <strong>increment of the specified value</strong>. In the minute field, 3/20 means triggering from the 3rd minute of every 20 minutes. <br>") ..
translate("[ - ] hyphen indicates a <strong>range</strong>. In the minute field, 5-20 means trigger every minute from 5 minutes to 20 minutes. <br>") ..
translate("[ * ] An asterisk indicates <strong>all possible values</strong>. In the month field, * means every month; in the week field, * means every day of the week. <br>") ..
translate("The setting method can also be clicked below to view the example or the first 5 fields of the command whose line ends in the crontab file is #timedtask to verify whether it is correct<br><br>") ..
translate("<input class='cbi-button cbi-button-apply' type='button' value='") ..
translate("View example") ..
translate("' onclick=\"window.open('http://'+window.location.hostname+'/reboothelp.jpg')\">&nbsp;&nbsp;&nbsp;&nbsp;") ..
translate("<input class='cbi-button cbi-button-apply' type='button' value='view/verify' onclick=\"window.open('https://tool.lu/crontab')\"><br><br>"))

f = m:section(TypedSection, "cronloglevel")
f.anonymous = true
f = f:option(ListValue, "cronloglevel", translate("Cron Log Level"))
f:value(5, translate("Debug"))
f:value(8, translate("Normal"))
f:value(9, translate("Warning"))
f.default = "9"

local sy_level = uci:get("system", "@system[0]", "cronloglevel")
local ti_level = uci:get("timedtask", "@cronloglevel[0]", "cronloglevel") or ""
if (ti_level ~= sy_level) then
    uci:set("system", "@system[0]", "cronloglevel", ti_level)
    uci:commit("system")
end

s = m:section(TypedSection, "crontab", "")
s.template = "cbi/tblsection"
s.anonymous = true -- 删除
s.addremove = true -- 添加
-- s.extedit  =  true -- 修改
-- s.sortable  =  true -- 移动

enable = s:option(Flag, "enable", translate("enable"))
enable.rmempty = false
enable.default = 0

enable = s:option(Flag, "enable_lock", translate("task lock"))
enable.rmempty = false
enable.default = 0

minute = s:option(Value, "minute", translate("minute"))
minute.default = '0'
minute.size = 4

hour = s:option(Value, "hour", translate("Hour"))
hour.default = '5'
hour.size = 4

day = s:option(Value, "day", translate("day"))
day.default = '*'
day.size = 4

month = s:option(Value, "month", translate("Month"))
month.default = '*'
month.size = 4

week = s:option(Value, "week", translate("weeks"))
week:value('*', translate("Every day"))
week:value(1, translate("Monday"))
week:value(2, translate("Tuesday"))
week:value(3, translate("Wednesday"))
week:value(4, translate("Thursday"))
week:value(5, translate("Friday"))
week:value(6, translate("Saturday"))
week:value(7, translate("Sunday"))
week.default = '*'
week.size = 4

command = s:option(Value, "command", translate("Task"))
command:value('sleep 5 && touch /etc/banner && reboot', translate("Reboots"))
command:value('service network restart &', translate("Restart network"))
command:value('ifdown wan && ifup wan', translate("Restart wan"))
command:value('ifup wan', translate("Redial"))
command:value('ifdown wan', translate("Turn off networking"))
command:value('ifup wan', translate("Turn on networking"))
command:value('wifi down', translate("Turn off WIFI"))
command:value('wifi up', translate("Turn on WIFI"))
command:value('sync && echo 3 > /proc/sys/vm/drop_caches', translate("Free up memory"))
command:value('poweroff', translate("Turn off the power"))
command:value('logread | egrep -v "miniupnpd|uhttpd" | tail -20 > /etc/syslog.log', translate("save log"))
command.rmempty = false
command.size = 25

btn = s:option(Button, "Button", translate("Executed immediately"))
btn.inputtitle = translate("Execute")
btn.inputstyle = "apply"
btn.disabled = false
btn.template = "timedtask/action_run"

function random_cfg()
    local cfg = ''
    math.randomseed(os.time())
    for i = 1, 6 do
        cfg = cfg .. string.char(math.random(97, 122))
    end
    return cfg
end

function s.create(e, t)
    t = "cfg" .. random_cfg()
    TypedSection.create(e, t)
end

if luci.http.formvalue("cbi.apply") then
  io.popen("sleep 3 && /etc/init.d/timedtask restart &")
end

return m
