local SYS = require "luci.sys"
font_green = [[<b><font color="green">]]
font_red = [[<b><font color="red">]]
font_off = [[</font></b>]]
font_op = " \" onclick=\"window.open('http://'+window.location.hostname+':"
font_apply = "<input class=\"cbi-button cbi-button-apply\" type=\"button\" value=\" "
m = Map("softwarecenter",translate("Entware软件安装"), translate("Entware提供超过2000多个不同平台的软件包<br>所有配置文件都软链接在 /opt/etc/config下，方便查看和修改"))
s = m:section(TypedSection, "softwarecenter")
s.anonymous = true

-- aMule
o = s:option(Flag, "amule_enable", translate("启用aMule"))
o.rmempty = false
o.description = translate("aMule是一个开源免费的P2P文件共享软件，类似于eMule<br>基于xMule和lMule。可应用eDonkey网络协议，也支持KAD网络。")
o = s:option(Flag, "amule_boot", translate("开机运行"), translate("开机启动aMule"))
o:depends("amule_enable",1)
local _state=(SYS.call("[ -s /opt/etc/init.d/S57amuled 2>/dev/null ]") == 0)
local am_state=(SYS.call("[ `(ps | grep 'amule') 2>/dev/null | grep -c 'opt' 2>/dev/null` -gt 0 ] >/dev/null") == 0)
if not _state then
	if am_state then
		p = s:option(Button, "_aac", translate(" "))
		p.inputtitle = translate("运行 aMule")
		p.inputstyle = "apply"
		p.forcewrite = true
		function p.write(self, section)
			SYS.call("/opt/etc/init.d/S57amuled start >/dev/null 2>&1 &")
			luci.http.redirect(luci.dispatcher.build_url("admin/services/softwarecenter/app"))
		end
		p.description = translate("<b>当前状态</b>：") .. font_red .. "未运行" .. font_off
		p:depends("amule_enable",1)
	else
		p = s:option(Button, "_aad", translate("安装aMule"))
		p.inputtitle = translate("开始安装")
		p.inputstyle = "apply"
		p.forcewrite = true
		function p.write(self, section)
			SYS.call("/usr/bin/softwarecenter/lib_functions.sh amule &")
			luci.http.redirect(luci.dispatcher.build_url("admin/services/softwarecenter/log"))
		end
		p.description = translate("<b>当前状态</b>：" .. font_red .. "未安装" .. font_off )
		p:depends("amule_enable",1)
	end
else
	p = s:option(Button, "_aaa", translate(" "))
	p.inputtitle = translate("重启 aMule")
	p.inputstyle = "reload"
	p.forcewrite = true
	function p.write(self, section)
		SYS.call("/opt/etc/init.d/S57amuled restart >/dev/null 2>&1 &")
		luci.http.redirect(luci.dispatcher.build_url("admin/services/softwarecenter/app"))
	end
	p:depends("amule_enable",1)
	p = s:option(Button, "_aab", translate(" "))
	p.inputtitle = translate("关闭 aMule")
	p.inputstyle = "reset"
	p.forcewrite = true
	function p.write(self, section)
		SYS.call("/opt/etc/init.d/S57amuled stop >/dev/null 2>&1 &")
		luci.http.redirect(luci.dispatcher.build_url("admin/services/softwarecenter/app"))
	end
	p.description = translate("aMule默认WebUI端口: 4711，密码: admin<br><b>当前状态</b>：" .. font_green .. "运行中&nbsp;&nbsp;&nbsp;" .. font_off .. font_apply .. "打开WebUI管理" .. font_op .. "4711')\"/>" )
	p:depends("amule_enable",1)
end

-- aria2
o = s:option(Flag, "aria2_enable", translate("启用Aria2"))
o.rmempty = false
o.description = translate("Aria2 是一款开源、轻量级的多协议命令行下载工具<br>支持 HTTP/HTTPS、FTP、SFTP、BitTorrent 和 Metalink 协议")
o = s:option(Flag, "aria2_boot", translate("开机运行"), translate("开机启动Aria2"))
o:depends("aria2_enable",1)
local ar_state=(SYS.call("[ `(ps | grep aria2c) 2>/dev/null | grep -c opt 2>/dev/null` -gt 0 ] >/dev/null") == 0)
local _state=(SYS.call("[ -s /opt/etc/init.d/S81aria2 2>/dev/null ]") == 0)

if ar_state then
	p = s:option(Button, "_aba", translate("Aria2"))
	p.inputtitle = translate("重启 Aria2")
	p.inputstyle = "reload"
	p.forcewrite = true
	function p.write(self, section)
		SYS.call("/opt/etc/init.d/S81aria2 restart >/dev/null 2>&1 &")
		luci.http.redirect(luci.dispatcher.build_url("admin/services/softwarecenter/app/"))
	end
	p:depends("aria2_enable",1)
	p = s:option(Button, "_abb", translate(" "))
	p.inputtitle = translate("关闭 Aria2")
	p.inputstyle = "reset"
	p.forcewrite = true
	function p.write(self, section)
		SYS.call("/opt/etc/init.d/S81aria2 stop >/dev/null 2>&1 &")
		luci.http.redirect(luci.dispatcher.build_url("admin/services/softwarecenter/app"))
	end
	p.description = translate(("Aria2 RPC 监听端口为默认: 6800，密钥为默认: Passw0rd<br>添加了") .. [[<a href="https://github.com/P3TERX/aria2.conf"target="_blank">]] .. " P3TERX </a>的增强和扩展功能<br><b>当前状态</b>：" .. font_green .. "运行中" .. font_off .. "<br>" .. font_apply .. "打开AriNG管理 \" onclick=\"window.open('http://ariang.mayswind.net/latest')\"/>&nbsp;&nbsp;&nbsp;" .. font_apply .. "打开webui-aria2管理 \" onclick=\"window.open('http://webui-aria2.1ge.fun/')\"/>" )
	p:depends("aria2_enable",1)
else
	if _state then
		p = s:option(Button, "_abc", translate(" "))
		p.inputtitle = translate("运行 Aria2")
		p.inputstyle = "apply"
		p.forcewrite = true
		function p.write(self, section)
			SYS.call("/opt/etc/init.d/S81aria2 start >/dev/null 2>&1 &")
			luci.http.redirect(luci.dispatcher.build_url("admin/services/softwarecenter/app"))
		end
		p.description = translate("<b>当前状态</b>：") .. font_red .. "未运行" .. font_off
		p:depends("aria2_enable",1)
	else
		p = s:option(Button, "_abd", translate("安装Aria2"))
		p.inputtitle = translate("开始安装")
		p.inputstyle = "apply"
		p.forcewrite = true
		p.write = function()
			SYS.call("/usr/bin/softwarecenter/lib_functions.sh aria2 &")
			luci.http.redirect(luci.dispatcher.build_url("admin/services/softwarecenter/log"))
		end
		p.description = translate("<b>当前状态</b>：") .. font_red .. "未安装" .. font_off
		p:depends("aria2_enable",1)
	end
end

-- Deluge
o = s:option(Flag, "deluge_enable", translate("启用Deluge"))
o.rmempty = false
o.description = translate("Deluge是一个免费好用的BT下载软件，使用libtorrent作为其后端<br>多种用户界面，占用系统资源少，有丰富的插件来实现核心以外的众多功能")
o = s:option(Flag, "deluge_boot", translate("开机运行"), translate("开机启动Deluge"))
o:depends("deluge_enable",1)
local _pstate=(SYS.call("[ ! -s /opt/etc/init.d/S80deluged 2>/dev/null ]") == 0)
local de_state=(SYS.call("[ `(ps | grep deluge) 2>/dev/null | grep -c opt 2>/dev/null` -gt 0 ] >/dev/null") == 0)

if de_state then
	p = s:option(Button, "_aca", translate(" "))
	p.inputtitle = translate("重启 Deluge")
	p.inputstyle = "reload"
	p.forcewrite = true
	function p.write(self, section)
		SYS.call("/opt/etc/init.d/S80deluged restart >/dev/null 2>&1 &")
		luci.http.redirect(luci.dispatcher.build_url("admin/services/softwarecenter/app/"))
	end
	p:depends("deluge_enable",1)
	p = s:option(Button, "_acb", translate(" "))
	p.inputtitle = translate("关闭 Deluge")
	p.inputstyle = "reset"
	p.forcewrite = true
	function p.write(self, section)
		SYS.call("/opt/etc/init.d/S80deluged stop >/dev/null 2>&1 &")
		luci.http.redirect(luci.dispatcher.build_url("admin/services/softwarecenter/app"))
	end
	p.description = translate("Deluge默认WebUI端口: 888，登录密码: deluge<br><b>当前状态</b>：" .. font_green .. "运行中&nbsp;&nbsp;&nbsp;" .. font_off .. font_apply .. "打开WebUI管理" .. font_op .. "888')\"/>" )
	p:depends("deluge_enable",1)
else
	if _pstate then
		p = s:option(Button, "_acc", translate("安装Deluge"))
		p.inputtitle = translate("开始安装")
		p.inputstyle = "apply"
		p.forcewrite = true
		p.write = function(self, section)
			SYS.call("/usr/bin/softwarecenter/lib_functions.sh deluge &")
			luci.http.redirect(luci.dispatcher.build_url("admin/services/softwarecenter/log"))
		end
		p.description = translate("<b>当前状态</b>：" .. font_red .. "未安装" .. font_off )
		p:depends("deluge_enable",1)
	else
			p = s:option(Button, "_acd", translate(" "))
			p.inputtitle = translate("运行 Deluge")
			p.inputstyle = "apply"
			p.forcewrite = true
			function p.write(self, section)
				SYS.call("/opt/etc/init.d/S80deluged start >/dev/null 2>&1 &")
				luci.http.redirect(luci.dispatcher.build_url("admin/services/softwarecenter/app"))
			end
			p.description = translate("<b>当前状态</b>：") .. font_red .. "未运行" .. font_off
			p:depends("deluge_enable",1)
	end
end

-- qbittorrent
local state=(SYS.call("pidof qbittorrent-nox >/dev/null") == 0)
if state then
	p = s:option(Button, "_aadd", translate("qBittorrent"))
	p.inputtitle = translate("重启 qBittorrent")
	p.inputstyle = "reload"
	p.forcewrite = true
	function p.write(self, section)
		SYS.call("/opt/etc/init.d/S89qbittorrent restart >/dev/null 2>&1 &")
		luci.http.redirect(luci.dispatcher.build_url("admin/services/softwarecenter/app/"))
	end
	o=font_apply .. translate("打开WebUI管理") .. font_op .. "9080')\"/>"
	state_msg = font_green .. translate("qBittorrent 运行中") .. font_off
	p.description = translate("qBittorrent默认WebUI端口: 9080，用启名: admin，密码: adminadmin<br>" .. state_msg .. "<br>" .. o )
else
	p = s:option(Button, "_bad", translate("安装qBittorrent"))
	p.inputtitle = translate("开始安装")
	p.inputstyle = "apply"
	p.forcewrite = true
	function p.write(self, section)
	SYS.call("/usr/bin/softwarecenter/lib_functions.sh qbittorrent &")
	luci.http.redirect(luci.dispatcher.build_url("admin/services/softwarecenter/log"))
end
	state_msg = font_red .. translate("qBittorrent 没有运行") .. font_off
	p.description = translate("qBittorrent是一个跨平台的自由BitTorrent客户端<br>" .. state_msg )
end

--- rTorrent
o = s:option(Flag, "rutorrent_enable", translate("启用rTorrent"))
o.rmempty = false
o.description = translate("rTorrent是一个Linux下控制台的BT客户端程序")
o = s:option(Flag, "rutorrent_boot", translate("开机运行"), translate("开机启动rTorrent"))
o:depends("rutorrent_enable",1)
local _pstate=(SYS.call("[ ! -s /opt/etc/init.d/S85rtorrent 2>/dev/null ]") == 0)
local rT_state=(SYS.call("[ `(ps | grep deluge) 2>/dev/null | grep -c opt 2>/dev/null` -gt 0 ] >/dev/null") == 0)
if rT_state then
	p = s:option(Button, "aua", translate(" "))
	p.inputtitle = translate("重启 rTorrent")
	p.inputstyle = "reload"
	p.forcewrite = true
	function p.write(self, section)
		SYS.call("/opt/etc/init.d/S85rtorrent restart >/dev/null 2>&1 &")
		luci.http.redirect(luci.dispatcher.build_url("admin/services/softwarecenter/app/"))
	end
	p:depends("rutorrent_enable",1)
	p = s:option(Button, "aub", translate(" "))
	p.inputtitle = translate("关闭 rTorrent")
	p.inputstyle = "reset"
	p.forcewrite = true
	function p.write(self, section)
		SYS.call("/opt/etc/init.d/S85rtorrent stop >/dev/null 2>&1 &")
		luci.http.redirect(luci.dispatcher.build_url("admin/services/softwarecenter/app"))
	end

	p.description = translate(("rTorrent默认WebUI端口: 1099。Rutorrent替换为") .. [[<a href="https://github.com/Novik/ruTorrent"target="_blank">]] .. " Novik </a>的稳定插件版<br><b>当前状态</b>：" .. font_green .. "运行中&nbsp;&nbsp;&nbsp;" .. font_off .. font_apply .. "打开WebUI管理" .. font_op .. "1099/rutorrent')\"/>")
	p:depends("rutorrent_enable",1)
else
	if _pstate then
		p = s:option(Button, "auc", translate("安装rTorrent"))
		p.inputtitle = translate("开始安装")
		p.inputstyle = "apply"
		p.forcewrite = true
		p.write = function(self, section)
			SYS.call("/usr/bin/softwarecenter/lib_functions.sh rtorrent &")
			luci.http.redirect(luci.dispatcher.build_url("admin/services/softwarecenter/log"))
		end
		p.description = translate("<b>当前状态</b>：" .. font_red .. "未安装" .. font_off )
		p:depends("rutorrent_enable",1)
	else
			p = s:option(Button, "aud", translate(" "))
			p.inputtitle = translate("运行 rTorrent")
			p.inputstyle = "apply"
			p.forcewrite = true
			function p.write(self, section)
				SYS.call("/opt/etc/init.d/S85rtorrent start >/dev/null 2>&1 &")
				luci.http.redirect(luci.dispatcher.build_url("admin/services/softwarecenter/app"))
			end
			p.description = translate("<b>当前状态</b>：") .. font_red .. "未运行" .. font_off
			p:depends("rutorrent_enable",1)
	end
end

-- transmission
local state=(SYS.call("pidof transmission-daemon >/dev/null") == 0)
if state then
	p = s:option(Button, "_aaf", translate("Transmission"))
	p.inputtitle = translate("重启 Transmission")
	p.inputstyle = "reload"
	p.forcewrite = true
	function p.write(self, section)
		SYS.call("/opt/etc/init.d/S88transmission restart >/dev/null 2>&1 &")
		luci.http.redirect(luci.dispatcher.build_url("admin/services/softwarecenter/app/"))
	end
	o=font_apply .. translate("打开WebUI管理") .. font_op .. "9091')\"/>"
	state_msg = font_green .. translate("Transmission 运行中") .. font_off
	p.description = translate("Transmission默认WebU 用启名: admin，密码: admin<br>" .. state_msg .. "<br>" .. o )
else
	p = s:option(Button, "_baf", translate("安装Transmission"))
	p.inputtitle = translate("开始安装 3.00")
	p.inputstyle = "apply"
	p.forcewrite = true
	function p.write(self, section)
		SYS.call("/usr/bin/softwarecenter/lib_functions.sh transmission &")
		luci.http.redirect(luci.dispatcher.build_url("admin/services/softwarecenter/log"))
	end
	p = s:option(Button, "_bag", translate(" "))
	p.inputtitle = translate("开始安装 2.77plus")
	p.inputstyle = "apply"
	p.forcewrite = true
	function p.write(self, section)
		SYS.call("/usr/bin/softwarecenter/lib_functions.sh transmi_2_77 &")
		luci.http.redirect(luci.dispatcher.build_url("admin/services/softwarecenter/log"))
	end
	state_msg = font_red .. translate("Transmission 没有运行") .. font_off
	p.description = translate("Transmission 是一个快速、精简的 bittorrent 客户端<br>" .. state_msg )
end

return m
