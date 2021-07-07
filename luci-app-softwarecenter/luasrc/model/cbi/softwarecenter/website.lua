m = Map("softwarecenter",translate("网站管理"),
translate("在正常运行 Nginx/PHP/MySQL 后再选择要部署的网站。可以自动部署PHP探针，phpMyAdmin，可道云，Typecho等。"))
m:section(SimpleSection).template = "softwarecenter/website_status"

s = m:section(TypedSection,"website", translate("网站部署"), 
translate("自动快速的部署网站。自动获取端口是在 2100 以上的空闲端口，Redis选项只有Owncloud和Nextcloud可使用。"))
s.anonymous = true
s.addremove = true
s.sortable = false
s.template = "cbi/tblsection"
s.rmempty = false

p = s:option(Flag, "website_enabled",
translate("启用"))

p = s:option(Flag, "autodeploy_enable", translate("部署/删除"),
translate("<b style=\"color:red\">(安装后未选会<br>删所有的文件)</b>"))

p = s:option(ListValue,"website_select",
translate("网站列表"),translate("选择要部署的选项"))
p:value("0", "tz（雅黑PHP探针）")
p:value("1", "phpMyAdmin（数据库管理工具）")
p:value("2", "WordPress（使用最广泛的CMS）")
p:value("3", "Owncloud（经典的私有云）")
p:value("4", "Nextcloud（美观强大的个人云盘）")
p:value("5", "h5ai（优秀的文件目录）")
p:value("6", "Lychee（一个好看，易于使用的Web相册）")
p:value("7", "Kodexplorer（可道云•资源管理器）")
p:value("8", "Typecho (流畅的轻量级开源博客程序)")
p:value("9", "Z-Blog (体积小，速度快的PHP博客程序)")
p:value("10", "DzzOffice (开源办公平台)")

p = s:option(Value,"port", translate("访问端口设置"),
translate("端口自定义优先，如留空自动获取<br>如自定义端口已占用转为自动获取"))

-- p = s:option(Flag,"redis_enabled", translate("启用Redis"), translate("Nextcloud<br>Owncloud"))

remarks = s:option(Value, "remarks", translate("备注"))
remarks.size = 8

return m
