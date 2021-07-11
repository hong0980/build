font_green = [[<b><font color="green">]]
font_red = [[<b><font color="red">]]
font_off = [[</font></b>]]
font_op = "\"onclick=\"window.open('http://'+window.location.hostname+':"
font_apply = "<input class=\"cbi-button cbi-button-apply\" type=\"button\"value=\""
function titlesplit(e)
	return "<p style=\"font-size:15px; font-weight:600; color:DodgerBlue\">" .. translate(e) .. "</p>"
end
op_webui = font_green .. "运行中&nbsp;&nbsp;&nbsp;" .. font_off .. font_apply .. "打开WebUI管理" .. font_op

m = Map("softwarecenter",translate("应用安装"), translate("所有配置文件都软链接在 /opt/etc/config下，方便查看和修改"))
s = m:section(TypedSection, "softwarecenter")
s.anonymous = true

-- p = s:option(Value, "delaytime", translate("延时启动"), translate("开机后延时启动Entware的应用，单位：秒。"))
-- p.default=60

-- aMule
o = s:option(DummyValue, " ", titlesplit("aMule"))
o = s:option(Flag, "S57amuled_enable", translate("启用"))
o.rmempty = false
o.description = translate("aMule是一个开源免费的P2P文件共享软件，类似于eMule<br>基于xMule和lMule。可应用eDonkey网络协议，也支持KAD网络。")
o = s:option(Flag, "S57amuled_boot", translate("启动"), translate("开机运行aMule"))
o:depends("S57amuled_enable", 1)
local am_state=(luci.sys.call("ps 2>/dev/null | grep amuleweb 2>/dev/null | grep opt >/dev/null") == 0)

if nixio.fs.access("/opt/etc/init.d/S57amuled") then
	if am_state then
		p = s:option(Button, "aaa", translate(" "))
		p.inputtitle = translate("重启 aMule")
		p.inputstyle = "reload"
		p.forcewrite = true
		function p.write(self, section)
			luci.util.exec("/opt/etc/init.d/S57amuled restart")
			luci.http.redirect(luci.dispatcher.build_url("admin/services/softwarecenter/app"))
		end
		p:depends("S57amuled_enable", 1)

		p = s:option(Button, "aab", translate(" "))
		p.inputtitle = translate("关闭 aMule")
		p.inputstyle = "reset"
		p.forcewrite = true
		function p.write(self, section)
			luci.util.exec("/opt/etc/init.d/S57amuled stop")
			luci.http.redirect(luci.dispatcher.build_url("admin/services/softwarecenter/app"))
		end
		p.description = translate("WebUI默认端口为 4711，密码: admin<br><b>当前状态</b>：" .. op_webui .. "4711')\"/>")
		p:depends("S57amuled_enable", 1)
	else
		p = s:option(Button, "aac", translate(" "))
		p.inputtitle = translate("运行 aMule")
		p.inputstyle = "apply"
		p.forcewrite = true
		function p.write(self, section)
			luci.util.exec("/opt/etc/init.d/S57amuled start")
			luci.http.redirect(luci.dispatcher.build_url("admin/services/softwarecenter/app"))
		end
		p.description = translate("<b>当前状态</b>：") .. font_red .. "没有运行" .. font_off
		p:depends("S57amuled_enable", 1)
	end
else
	p = s:option(Button, "aad", translate("安装"))
	p.inputtitle = translate("开始安装")
	p.inputstyle = "apply"
	p.forcewrite = true
	function p.write(self, section)
		luci.util.exec("/usr/bin/softwarecenter/lib_functions.sh S57amuled &")
		luci.http.redirect(luci.dispatcher.build_url("admin/services/softwarecenter/log"))
	end
	p.description = translate("<b>当前状态</b>：" .. font_red .. "没有安装" .. font_off )
	p:depends("S57amuled_enable", 1)
end

-- aria2
o = s:option(DummyValue, " ", titlesplit("Aria2"))
o = s:option(Flag, "S81aria2_enable", translate("启用"))
o.rmempty = false
o.description = translate("Aria2 是一款开源、轻量级的多协议命令行下载工具<br>支持 HTTP/HTTPS、FTP、SFTP、BitTorrent 和 Metalink 协议")
o = s:option(Flag, "S81aria2_boot", translate("启动"), translate("开机运行Aria2"))
o:depends("S81aria2_enable", 1)
local ar_state=(luci.sys.call("ps 2>/dev/null | grep aria2c 2>/dev/null | grep opt >/dev/null") == 0)

if nixio.fs.access("/opt/etc/init.d/S81aria2") then
	if ar_state then
		p = s:option(Button, "aba", translate(" "))
		p.inputtitle = translate("重启 Aria2")
		p.inputstyle = "reload"
		p.forcewrite = true
		function p.write(self, section)
			luci.util.exec("/opt/etc/init.d/S81aria2 restart")
			luci.http.redirect(luci.dispatcher.build_url("admin/services/softwarecenter/app"))
		end
		p:depends("S81aria2_enable", 1)

		p = s:option(Button, "abb", translate(" "))
		p.inputtitle = translate("关闭 Aria2")
		p.inputstyle = "reset"
		p.forcewrite = true
		function p.write(self, section)
			luci.util.exec("/opt/etc/init.d/S81aria2 stop")
			luci.http.redirect(luci.dispatcher.build_url("admin/services/softwarecenter/app"))
		end
		p.description = translate(("RPC的端口为 6800，密码: Passw0rd<br>添加了") .. [[<a href="https://github.com/P3TERX/aria2.conf"target="_blank">]] .. " P3TERX </a>的增强和扩展功能<br><b>当前状态</b>：" .. font_green .. "运行中&nbsp;&nbsp;&nbsp;" .. font_off .. font_apply .. "打开AriNG管理 \" onclick=\"window.open('http://ariang.mayswind.net/latest')\"/>&nbsp;&nbsp;&nbsp;" .. font_apply .. "打开WebUI-Aria2管理 \" onclick=\"window.open('http://webui-aria2.1ge.fun/')\"/>")
		p:depends("S81aria2_enable", 1)
	else
		p = s:option(Button, "abc", translate(" "))
		p.inputtitle = translate("运行 Aria2")
		p.inputstyle = "apply"
		p.forcewrite = true
		function p.write(self, section)
			luci.util.exec("/opt/etc/init.d/S81aria2 start")
			luci.http.redirect(luci.dispatcher.build_url("admin/services/softwarecenter/app"))
		end
		p.description = translate("<b>当前状态</b>：") .. font_red .. "没有运行" .. font_off
		p:depends("S81aria2_enable", 1)
	end
else
	p = s:option(Button, "abd", translate("安装"))
	p.inputtitle = translate("开始安装")
	p.inputstyle = "apply"
	p.forcewrite = true
	p.write = function()
		luci.util.exec("/usr/bin/softwarecenter/lib_functions.sh S81aria2 &")
		luci.http.redirect(luci.dispatcher.build_url("admin/services/softwarecenter/log"))
	end
	p.description = translate("<b>当前状态</b>：") .. font_red .. "没有安装" .. font_off
	p:depends("S81aria2_enable", 1)
end

-- Deluge
o = s:option(DummyValue, " ", titlesplit("Deluge"))
o = s:option(Flag, "S80deluged_enable", translate("启用"))
o.rmempty = false
o.description = translate("Deluge是一个免费好用的BT下载软件，使用libtorrent作为其后端<br>多种用户界面，占用系统资源少，有丰富的插件来实现核心以外的众多功能")
o = s:option(Flag, "S80deluged_boot", translate("启动"), translate("开机运行Deluge"))
o:depends("S80deluged_enable", 1)
local de_state=(luci.sys.call("ps 2>/dev/null | grep deluge 2>/dev/null | grep opt >/dev/null") == 0)

if nixio.fs.access("/opt/etc/init.d/S80deluged") then
	if de_state then
		p = s:option(Button, "aca", translate(" "))
		p.inputtitle = translate("重启 Deluge")
		p.inputstyle = "reload"
		p.forcewrite = true
		function p.write(self, section)
			luci.util.exec("/opt/etc/init.d/S80deluged restart")
			luci.http.redirect(luci.dispatcher.build_url("admin/services/softwarecenter/app"))
		end
		p:depends("S80deluged_enable", 1)

		p = s:option(Button, "acb", translate(" "))
		p.inputtitle = translate("关闭 Deluge")
		p.inputstyle = "reset"
		p.forcewrite = true
		function p.write(self, section)
			luci.util.exec("/opt/etc/init.d/S80deluged stop")
			luci.http.redirect(luci.dispatcher.build_url("admin/services/softwarecenter/app"))
		end
		p.description = translate("WebUI默认端口为 888，密码: deluge<br><b>当前状态</b>：" .. op_webui .. "888')\"/>")
		p:depends("S80deluged_enable", 1)
	else
		p = s:option(Button, "acc", translate(" "))
		p.inputtitle = translate("运行 Deluge")
		p.inputstyle = "apply"
		p.forcewrite = true
		function p.write(self, section)
			luci.util.exec("/opt/etc/init.d/S80deluged start")
			luci.http.redirect(luci.dispatcher.build_url("admin/services/softwarecenter/app"))
		end
		p.description = translate("<b>当前状态</b>：") .. font_red .. "没有运行" .. font_off
		p:depends("S80deluged_enable", 1)
	end
else
	p = s:option(Button, "acd", translate("安装"))
	p.inputtitle = translate("开始安装")
	p.inputstyle = "apply"
	p.forcewrite = true
	p.write = function(self, section)
		luci.util.exec("/usr/bin/softwarecenter/lib_functions.sh S80deluged &")
		luci.http.redirect(luci.dispatcher.build_url("admin/services/softwarecenter/log"))
	end
	p.description = translate("<b>当前状态</b>：" .. font_red .. "没有安装" .. font_off)
	p:depends("S80deluged_enable", 1)
end

-- qbittorrent
o = s:option(DummyValue, " ", titlesplit("qBittorrent"))
o = s:option(Flag, "S89qbittorrent_enable", translate("启用"))
o.rmempty = false
o.description = translate("qBittorrent是一个跨平台的自由BitTorrent客户端")
o = s:option(Flag, "S89qbittorrent_boot", translate("启动"), translate("开机运行qBittorrent"))
o:depends("S89qbittorrent_enable", 1)
local qb_state=(luci.sys.call("ps 2>/dev/null | grep qbittorrent-nox 2>/dev/null | grep opt >/dev/null") == 0)

if nixio.fs.access("/opt/etc/init.d/S89qbittorrent") then
	if qb_state then
		p = s:option(Button, "ada", translate(" "))
		p.inputtitle = translate("重启 qBittorrent")
		p.inputstyle = "reload"
		p.forcewrite = true
		function p.write(self, section)
			luci.util.exec("/opt/etc/init.d/S89qbittorrent restart")
			luci.http.redirect(luci.dispatcher.build_url("admin/services/softwarecenter/app"))
		end
		p:depends("S89qbittorrent_enable", 1)

		p = s:option(Button, "adb", translate(" "))
		p.inputtitle = translate("关闭 qBittorrent")
		p.inputstyle = "reset"
		p.forcewrite = true
		function p.write(self, section)
			luci.util.exec("/opt/etc/init.d/S89qbittorrent stop")
			luci.http.redirect(luci.dispatcher.build_url("admin/services/softwarecenter/app"))
		end
		p.description = translate("WebUI默认端口为 9080，用启名: admin，密码: adminadmin<br><b>当前状态</b>：" .. op_webui .. "9080')\"/>")
		p:depends("S89qbittorrent_enable", 1)
	else
		p = s:option(Button, "adc", translate(" "))
		p.inputtitle = translate("运行 qBittorrent")
		p.inputstyle = "apply"
		p.forcewrite = true
		function p.write(self, section)
			luci.util.exec("/opt/etc/init.d/S89qbittorrent start")
			luci.http.redirect(luci.dispatcher.build_url("admin/services/softwarecenter/app"))
		end
		p.description = translate("<b>当前状态</b>：") .. font_red .. "没有运行" .. font_off
		p:depends("S89qbittorrent_enable", 1)
	end
else
	p = s:option(Button, "add", translate("安装"))
	p.inputtitle = translate("开始安装")
	p.inputstyle = "apply"
	p.forcewrite = true
	p.write = function(self, section)
		luci.util.exec("/usr/bin/softwarecenter/lib_functions.sh S89qbittorrent &")
		luci.http.redirect(luci.dispatcher.build_url("admin/services/softwarecenter/log"))
	end
	p.description = translate("<b>当前状态</b>：" .. font_red .. "没有安装" .. font_off )
	p:depends("S89qbittorrent_enable", 1)
end

--- rTorrent
o = s:option(DummyValue, " ", titlesplit("rTorrent"))
o = s:option(Flag, "S85rtorrent_enable", translate("启用"))
o.rmempty = false
o.description = translate("rTorrent是一个Linux下控制台的BT客户端程序")
o = s:option(Flag, "S85rtorrent_boot", translate("启动"), translate("开机运行rTorrent"))
o:depends("S85rtorrent_enable", 1)
local rT_state=(luci.sys.call("ps 2>/dev/null | grep rtorrent 2>/dev/null | grep opt >/dev/null") == 0)
 
if nixio.fs.access("/opt/etc/init.d/S85rtorrent") then
	if rT_state then
		p = s:option(Button, "aea", translate(" "))
		p.inputtitle = translate("重启 rTorrent")
		p.inputstyle = "reload"
		p.forcewrite = true
		function p.write(self, section)
			luci.util.exec("/opt/etc/init.d/S85rtorrent restart")
			luci.http.redirect(luci.dispatcher.build_url("admin/services/softwarecenter/app"))
		end
		p:depends("S85rtorrent_enable", 1)

		p = s:option(Button, "aeb", translate(" "))
		p.inputtitle = translate("关闭 rTorrent")
		p.inputstyle = "reset"
		p.forcewrite = true
		function p.write(self, section)
			luci.util.exec("/opt/etc/init.d/S85rtorrent stop")
			luci.http.redirect(luci.dispatcher.build_url("admin/services/softwarecenter/app"))
		end
		p.description = translate(("WebUI默认端口为 1099，Rutorrent替换为") .. [[<a href="https://github.com/Novik/ruTorrent"target="_blank">]] .. " Novik </a>的稳定插件版<br><b>当前状态</b>：" .. op_webui .. "1099/rutorrent')\"/>")
		p:depends("S85rtorrent_enable", 1)
	else
		p = s:option(Button, "aec", translate(" "))
		p.inputtitle = translate("运行 rTorrent")
		p.inputstyle = "apply"
		p.forcewrite = true
		function p.write(self, section)
			luci.util.exec("/opt/etc/init.d/S85rtorrent start")
			luci.http.redirect(luci.dispatcher.build_url("admin/services/softwarecenter/app"))
		end
		p.description = translate("<b>当前状态</b>：") .. font_red .. "没有运行" .. font_off
		p:depends("S85rtorrent_enable", 1)
	end
else
	p = s:option(Button, "aed", translate("安装"))
	p.inputtitle = translate("开始安装")
	p.inputstyle = "apply"
	p.forcewrite = true
	p.write = function(self, section)
		luci.util.exec("/usr/bin/softwarecenter/lib_functions.sh S85rtorrent &")
		luci.http.redirect(luci.dispatcher.build_url("admin/services/softwarecenter/log"))
	end
	p.description = translate("<b>当前状态</b>：" .. font_red .. "没有安装" .. font_off )
	p:depends("S85rtorrent_enable", 1)
end

-- transmission
o = s:option(DummyValue, " ", titlesplit("Transmission"))
o = s:option(Flag, "S88transmission_enable", translate("启用"))
o.rmempty = false
o.description = translate("Transmission 是一个快速、精简的 bittorrent 客户端")
o = s:option(Flag, "S88transmission_boot", translate("启动"), translate("开机运行Transmission"))
o:depends("S88transmission_enable", 1)
local tr_state=(luci.sys.call("ps 2>/dev/null | grep transmission 2>/dev/null | grep opt >/dev/null") == 0)

if nixio.fs.access("/opt/etc/init.d/S88transmission") then
	if tr_state then
		p = s:option(Button, "afa", translate(" "))
		p.inputtitle = translate("重启 Transmission")
		p.inputstyle = "reload"
		p.forcewrite = true
		function p.write(self, section)
			luci.util.exec("/opt/etc/init.d/S88transmission restart")
			luci.http.redirect(luci.dispatcher.build_url("admin/services/softwarecenter/app"))
		end
		p:depends("S88transmission_enable", 1)

		p = s:option(Button, "afb", translate(" "))
		p.inputtitle = translate("关闭 Transmission")
		p.inputstyle = "reset"
		p.forcewrite = true
		function p.write(self, section)
			luci.util.exec("/opt/etc/init.d/S88transmission stop")
			luci.http.redirect(luci.dispatcher.build_url("admin/services/softwarecenter/app"))
		end
		p.description = translate("WebUI默认端口为 9091，用启名: admin，密码: admin<br><b>当前状态</b>：" .. op_webui .. "9091')\"/>")
		p:depends("S88transmission_enable", 1)
	else
		p = s:option(Button, "afc", translate(" "))
		p.inputtitle = translate("运行 Transmission")
		p.inputstyle = "apply"
		p.forcewrite = true
		function p.write(self, section)
			luci.util.exec("/opt/etc/init.d/S88transmission start")
			luci.http.redirect(luci.dispatcher.build_url("admin/services/softwarecenter/app"))
		end
		p.description = translate("<b>当前状态</b>：") .. font_red .. "没有运行" .. font_off
		p:depends("S88transmission_enable", 1)
	end
else
	p = s:option(Button, "afd", translate("安装 3.00"))
	p.inputtitle = translate("开始安装")
	p.inputstyle = "apply"
	p.forcewrite = true
	p.write = function(self, section)
		luci.util.exec("/usr/bin/softwarecenter/lib_functions.sh S88transmission 1 &")
		luci.http.redirect(luci.dispatcher.build_url("admin/services/softwarecenter/log"))
	end
	p:depends("S88transmission_enable", 1)

	p = s:option(Button, "afe", translate("安装2.77plus"))
	p.inputtitle = translate("开始安装")
	p.inputstyle = "apply"
	p.forcewrite = true
	function p.write(self, section)
		luci.util.exec("/usr/bin/softwarecenter/lib_functions.sh S88transmission 2 &")
		luci.http.redirect(luci.dispatcher.build_url("admin/services/softwarecenter/log"))
	end
	p.description = translate("<b>当前状态</b>：" .. font_red .. "没有安装" .. font_off )
	p:depends("S88transmission_enable", 1)
end

return m
