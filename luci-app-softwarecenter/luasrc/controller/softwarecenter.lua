module("luci.controller.softwarecenter",package.seeall)

function index()
	local fs = require "nixio.fs"
	if not nixio.fs.access("/etc/config/softwarecenter") then
		return
	end
	entry({"admin", "services", "softwarecenter"}, alias("admin", "services", "softwarecenter", "softwarecenter"), _("Entware部署"), 30).dependent = true
	entry({"admin", "services", "softwarecenter", "softwarecenter"}, cbi("softwarecenter/softwarecenter"), _("常用配置"), 40).leaf = true
	if fs.access("/opt/etc/init.d/S80nginx") and fs.access("/opt/etc/init.d/S70mysqld") and fs.access("/opt/etc/init.d/S79php7-fpm") then
		entry({"admin", "services", "softwarecenter", "website"}, cbi("softwarecenter/website"), _("网站管理"), 60).leaf = true
		entry({"admin", "services", "softwarecenter", "errorlog"}, form("softwarecenter/errorlog"), _("nginx日志"), 70).leaf = true
	end
	if fs.access("/etc/init.d/entware") then
		entry({"admin", "services", "softwarecenter", "app"}, cbi("softwarecenter/app"), _("应用安装"), 50).leaf = true
	end
	entry({"admin", "services", "softwarecenter", "log"}, form("softwarecenter/log"), _("运行日志"), 80).leaf = true
	entry({"admin", "services", "softwarecenter", "get_log"}, call("get_log")).leaf = true
	entry({"admin", "services", "softwarecenter", "clear_log"}, call("clear_log")).leaf = true
	entry({"admin", "services", "softwarecenter", "error_log"}, call("error_log")).leaf = true
	entry({"admin", "services", "softwarecenter", "clear_error_log"}, call("clear_error_log")).leaf = true
	entry({"admin", "services", "softwarecenter", "access_log"}, call("access_log")).leaf = true
	entry({"admin", "services", "softwarecenter", "clear_access_log"}, call("clear_access_log")).leaf = true
	entry({"admin", "services", "softwarecenter", "status"}, call("connection_status")).leaf = true
end

function get_log()
	luci.http.write(luci.sys.exec("[ -f '/tmp/log/softwarecenter.log' ] && cat /tmp/log/softwarecenter.log"))
end

function clear_log()
	luci.sys.call("cat > /tmp/log/softwarecenter.log")
end

function error_log()
	luci.http.write(luci.sys.exec("[ -f '/opt/var/log/nginx/error.log' ] && cat /opt/var/log/nginx/error.log | tail -n 50"))
end

function clear_error_log()
	luci.sys.call("cat > /opt/var/log/nginx/error.log")
end

function access_log()
	luci.http.write(luci.sys.exec("[ -f '/opt/var/log/nginx/access.log' ] && cat /opt/var/log/nginx/access.log | tail -n 50"))
end

function clear_access_log()
	luci.sys.call("cat > /opt/var/log/nginx/access.log")
end

local function nginx_status_report()
	return luci.sys.call("pidof nginx > /dev/null") == 0
end

local function mysql_status_report()
	return luci.sys.call("pidof mysqld > /dev/null") == 0
end

local function php_status_report()
	return luci.sys.call("pidof php-fpm > /dev/null") == 0
end

local function nginx_installed_report()
	return luci.sys.call("ls /opt/etc/init.d/S80nginx > /dev/null") == 0
end

local function mysql_installed_report()
	return luci.sys.call("ls /opt/etc/init.d/S70mysqld > /dev/null") == 0
end

local function php_install_report()
	return luci.sys.call("ls /opt/etc/init.d/S79php7-fpm > /dev/null") == 0
end 

local function get_website_list()
	return luci.sys.exec("sh /usr/bin/softwarecenter/website_list_for_luci.sh 1")
end

local function get_website_list_size()
	return luci.sys.exec("sh /usr/bin/softwarecenter/website_list_for_luci.sh")
end

function connection_status()
  luci.http.prepare_content("application/json")
  luci.http.write_json({nginx_state=nginx_status_report(),
  mysql_state=mysql_status_report(),
  php_state=php_status_report(),
  nginx_installed=nginx_installed_report(),
  mysql_installed=mysql_installed_report(),
  php_installed=php_install_report(),
  website_list_size=get_website_list_size(),
  website_list=get_website_list()
  })
end
