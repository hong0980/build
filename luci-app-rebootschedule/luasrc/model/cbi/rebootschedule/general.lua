m=Map("rebootschedule",translate("定时任务 Plus+"),
translate("<font color=\"green\"><b>让定时任务更加易用的插件。是用 wulishui@gmail.com 的原版修改，支持 wulishui 点击下面的 </font><font color=\"red\"> 查看示例 </font><font color=\"green\"> 后扫描二维码打赏</font></b></br>") ..
translate("CRON表达式的字符串是五个有空格分隔加执行命令字段组成。 </br>* * * * * [command]</br>五个星号按照位置分别表示 (分) (时) (日) (月) (周) commond 表示所需执行的命令</br>允许的数值范围是，分(1-59), 时(0-23), 日(1-31)，月(1-12), 周(0-6)。</br>每一个字段都可以使用范围之内的数值或者以下半角的特殊字符组合组成：</br>") ..
translate("1) 星号 (*) 表示任意值。如在“分钟”字段使用*, 表示每分钟都会触发一次。</br>2) 连字符 (-) 表示范围。如在“分钟”字段使用5-20，表示在从5分到20分时段每分钟触发一次。</br>3) 逗号 (,) 表示分割数值。如在“分钟”字段使用5,20，表示在每5分和20分时触发一次。</br>4) 正斜杠 (/) 表示每隔时段。如在“分钟”字段使用5-45/20，表示在5分和25分和45分每隔20分钟触发一次。</br>") ..
translate("<font color=\"green\"><b>具体的设置方法可点击下面查看示例或在crontab文件中的前5位去验证是否正确</b></font></br>") ..
translate("<input class=\"cbi-button cbi-button-apply\" type=\"button\" value=\"" ..
translate("查看示例") ..
" \" onclick=\"window.open('http://'+window.location.hostname+'/reboothelp.jpg')\"/>") ..
translate("&nbsp;&nbsp;&nbsp;<input class=\"cbi-button cbi-button-apply\" type=\"button\" value=\"" ..
translate("查看/验证") ..
" \" onclick=\"window.open('https://tool.lu/crontab/')\"/>")
)

s=m:section(TypedSection,"crontab","")
s.template = "cbi/tblsection"
s.anonymous = true
s.addremove = true

p=s:option(Flag,"enable",translate("启用"))
p.rmempty = false
p.default=0

month=s:option(Value,"month",translate("月"))
month.default = '*'
month.size = 8

day=s:option(Value,"day",translate("日"))
day.default = '*'
day.size = 8

hour=s:option(Value,"hour",translate("时"))
hour.default = '5'
hour.size = 8

minute=s:option(Value,"minute",translate("分"))
minute.default = '0'
minute.size = 8

week=s:option(Value,"week",translate("周"))
week.rmempty = true
week:value('*',translate("每天"))
week:value(1,translate("Monday"))
week:value(2,translate("Tuesday"))
week:value(3,translate("Wednesday"))
week:value(4,translate("Thursday"))
week:value(5,translate("Friday"))
week:value(6,translate("Saturday"))
week:value(7,translate("Sunday"))
week.default='*'
week.size = 8

command=s:option(Value,"command",translate("执行的任务"))
command:value('sleep 5 && touch /etc/banner && reboot',translate("重启系统"))
command:value('/etc/init.d/network restart',translate("重启网络"))
command:value('ifdown wan && ifup wan',translate("重启wan"))
command:value('killall -q pppd && sleep 5 && pppd file /tmp/ppp/options.wan', translate("重新拨号"))
command:value('ifdown wan',translate("关闭联网"))
command:value('ifup wan',translate("打开联网"))
command:value('wifi down',translate("关闭WIFI"))
command:value('wifi up',translate("打开WIFI"))
command:value('sync && echo 1 > /proc/sys/vm/drop_caches', translate("释放内存"))
command:value('poweroff',translate("关闭电源"))
command.default='sleep 5 && touch /etc/banner && reboot'

-- p = s:option(Button, "_baa", translate("立即执行"))
-- p.inputtitle = translate("应用")
-- p.inputstyle = "apply"
-- p.forcewrite = true
-- p.write = function(self, section)
	 -- uci:get("rebootschedule", '@crontab[0]', 'command', section)
-- end

local open=luci.http.formvalue("cbi.apply")
if open then
  io.popen("/etc/init.d/rebootschedule restart")
end

return m
