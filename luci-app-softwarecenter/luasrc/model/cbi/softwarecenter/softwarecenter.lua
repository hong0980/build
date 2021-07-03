-- Copyright (C) 2019 Jianpeng Xiang (1505020109@mail.hnust.edu.cn)

--得到Map对象，并初始化。参一：指定cbi文件，参二：设置标题，参三：设置标题下的注释
m = Map("softwarecenter", translate("Entware"), translate("Entware是一个适用于嵌入式系统的软件包库，提供超过2000多个不同平台的软件包<br>可以自动部署Entware-opt/Nginx/MySQ/PHP(ONMP)和应用安装<br>原项目地址：<a href='https://github.com/jsp1256/openwrt-package' target='_blank'> https://github.com/jsp1256/openwrt-package</a>"))

local software_status = (luci.sys.call("pidof nginx > /dev/null") == 0)
if software_status then
	m:section(SimpleSection).template = "softwarecenter/software_status"
end

s = m:section(TypedSection, "softwarecenter", translate("设置"))
s.addremove = false
s.anonymous = true

s:tab("entware", translate("ONMP部署"))
p = s:taboption("entware", Flag, "entware_enable", translate("启用"), translate("部署ONMP环境"))
local model = luci.sys.exec("uname -m")
local cpu_model = s:taboption("entware", Value, "cpu_model", translate("CPU架构"),
translate("检测到CPU架构是：") .. [[<font color="green"><b>]] .. model .. [[</b></font>]] .. " (如有错误自定义)")
cpu_model:value("", translate("-- 可选是系统检测到CPU架构 --"))
cpu_model:value(model)
cpu_model:depends("entware_enable", 1)

local disk_size = luci.sys.exec("/usr/bin/softwarecenter/check_available_size.sh 2")
p = s:taboption("entware", ListValue,"disk_mount", translate("安装路径"), translatef("已挂载磁盘：(如没检测到加入的磁盘先用<code>磁盘分区</code>)<br><b style=\"color:green\">") .. disk_size .. ("</b><b style=\"color:red\">磁盘如不是EXT4文件系统将重新格式化，里面的数据也同时清空！</b>"))
for list_disk_mount in luci.util.execi("lsblk | grep mnt | awk '{print $7}'") do
	p:value(list_disk_mount)
end
p:depends("entware_enable", 1)

p = s:taboption("entware", Flag, "deploy_entware", translate("部署ONMP"), translate("安装过程可以在运行日志中查看进度<br>如只安装应用软件可不用部署 Nginx / MySQL"))
p:depends("entware_enable", 1)

deploy_nginx = s:taboption("entware", Flag, "deploy_nginx", translate("部署Nginx/PHP"), translate("自动部署Nginx服务器和其所需的PHP7运行环境<br><b style=\"color:red\">安装后如取消选择会删除以有的部署</b>"))
p = s:taboption("entware", Flag, "nginx_enabled", translate("Enabled"), translate("部署完成后启动Nginx/PHP7(依赖Entware软件仓库)"))
p:depends("deploy_nginx", 1)
deploy_nginx:depends("deploy_entware", 1)

deploy_mysql = s:taboption("entware", Flag, "deploy_mysql", translate("部署MySQL"), translate("部署MySQL数据库服务器(依赖Entware软件仓库)<br><b style=\"color:red\">安装后如取消选择会删除以有的部署</b>"))
p = s:taboption("entware", Flag, "mysql_enabled", translate("Enabled"), translate("留空是默认登录用户  root  密码  123456"))
p:depends("deploy_mysql", 1)
p = s:taboption("entware", Value, "user", translate("用户"), translate("MySQL数据库服务器登录用户"))
p.placeholder = "root"
p:depends("mysql_enabled", 1)
p = s:taboption("entware", Value, "pass", translate("密码"), translate("MySQL数据库服务器登录密码"))
p.password = true
p:depends("mysql_enabled", 1)
deploy_mysql:depends("deploy_entware", 1)

s:tab("Partition", translate("磁盘分区"))
p = s:taboption("Partition", ListValue, "Partition_disk", translate("可用磁盘"), translate("当加入的磁盘没有分区，此工具可简单的分区挂载"))
local o = nixio.util.consume((nixio.fs.glob("/dev/sd[a-g]")), o)
local size = {}
for i, l in ipairs(o) do
	local s = tonumber((nixio.fs.readfile("/sys/class/block/%s/size" % l:sub(6))))
	size[l] = s and math.floor(s / 2048 / 1024)
	t="%s"%{nixio.fs.readfile("/sys/class/block/%s/device/model"%nixio.fs.basename(l))}
end
for i, a in ipairs(o) do
	p:value(size[a], a and "%s | %s | 可用:%sGB" % {t, a, size[a]})
end

p = s:taboption("Partition", Button, "_rescan", translate("扫描磁盘"), translate("重新加载加入后没有显示的磁盘"))
p.inputtitle = translate("开始扫描")
p.inputstyle = "reload"
p.forcewrite = true
function p.write(self, section, value)
  luci.util.exec("echo '- - -' | tee /sys/class/scsi_host/host*/scan > /dev/null")
end

p = s:taboption("Partition", Button, "_add",translate("磁盘分区"), translate("默认只分一个区，并格式化EXT4文件系统。如已挂载要先缷载<br><b style=\"color:red\">注意：分区前确认选择的磁盘没有重要数据，分区后数据不可恢复！</b>"))
p.inputtitle = translate("开始分区")
p.inputstyle = "apply"
function p.write(self, section)
	luci.sys.call("/usr/bin/softwarecenter/lib_functions.sh system_check &")
	luci.http.redirect(luci.dispatcher.build_url("admin/services/softwarecenter/log"))
end

s:tab("swap", translate("swap交换分区设置"))
swap_enable = s:taboption("swap", Flag, "swap_enabled", translate("Enabled"), translate("如果物理内存不足或php-fpm和mysqld 启动失败的可以开启<br>闲置数据可自动移到 swap 区暂存，以增加可用的 RAM"))
p = s:taboption("swap", Value, "swap_path", translate("安装路径"), translate("交换分区挂载点"))
p:value("", translate("-- 不选择是安装在opt所在盘 --"))
local f = nixio.util.consume((nixio.fs.glob("/mnt/sd[a-g]*")), f)
local size = {}
for i, q in ipairs(f) do
	local s = tonumber((nixio.fs.readfile("/sys/class/block/%s/size" % q:sub(6))))
	size[q] = s and math.floor(s / 2048 / 1024)
end
for i, d in ipairs(f) do
	p:value(d, size[d] and "%s ( %s GB )" % {d, size[d]})
end
p:depends("swap_enabled", 1)
p = s:taboption("swap", Value, "swap_size", translate("空间大小"), translate("交换空间大小(M)，默认512M"))
p.default = "512"
p:depends("swap_enabled", 1)
swap_enable:depends("deploy_entware", 1)

return m
