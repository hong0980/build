function titlesplit(e)
	return"<p style = \"font-size:15px;font-weight:bold;color: DodgerBlue\">" .. translate(e) .. "</p>"
end

a = Map("deluge", translate("Deluge 下载器"), translate("Deluge是一个通过PyGTK建立图形界面的BitTorrent客户端<br>"))
a:section(SimpleSection).template = "deluge/deluge_status"

t = a:section(NamedSection, "main", "deluge")
e = t:option(Flag, "enabled", translate("Enabled"))
--e.description = e.description .. translatef("当前Deluge的版本: <b style=\"color:green\"> %s", luci.sys.exec("deluge -v | awk '/deluge/{print $2}'")) .. "</b>"
e.default = "0"

e = t:option(ListValue, "user", translate("以此用户运行"), translate("默认使用root"))
for t in luci.util.execi("cut -d: -f1 /etc/passwd") do e:value(t) end

e = t:option(Value, "profile_dir", translate("配置文件路径"), translate("默认保存在/etc/deluge"))
e.default = '/etc/deluge'

e = t:option(Value, "download_dir", translate("下载文件路径"))
e.placeholder = "/mnt/sda3/download"

e = t:option(Value, "language", translate("WebUI语言"))
e:value("zh_CN", translate("Chinese"))
e:value("en_GB", translate("English"))
e.default = "zh_CN"

e = t:option(Value, "port", translate("WebUI端口"), translate("默认端口：8112"))
e.datatype = "port"
e.default = "8112"

e = t:option(Value, "password", translate("WebUI密码"), translate("默认密码：deluge"))
e.default = "deluge"

e = t:option(Value, "https", translate("WebUI使用https"), translate("默认不使用"))
e:value("http", translate("不使用"))
e:value("https", translate("使用"))
e.default = "http"

e = t:option(Value, "cache_size", translate("缓存大小"), translate("单位：KiB"))
e.default = "32768"

e = t:option(Flag, "enable_logging", translate("启用日志"))
e.rmempty = "false"

e = t:option(Value, "log_dir", translate("日志保存目录"), translate("默认保存在/var/log/"))
e:depends("enable_logging", "1")
e.default = "/var/log"

e = t:option(ListValue, "log_level", translate("日志记录等级"))
e:depends("enable_logging", "1")
e:value("none", translate("none"))
e:value("error", translate("Error"))
e:value("warning", translate("Warning"))
e:value("info", translate("Info"))
e:value("debug", translate("Debug"))
e.default = "error"

return a
