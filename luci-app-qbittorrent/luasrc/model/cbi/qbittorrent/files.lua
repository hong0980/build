local m = SimpleForm("qbittorrent", translatef("%s - %s", translate("qBittorrent"), translate("configuration file")),
    translate("This page is the configuration file content of qBittorrent."))
m.reset  = false
m.submit = false

local files = {
    {name = "qbittorrent", path = (luci.model.uci.cursor():get("qbittorrent", "main", "RootProfilePath") or "/tmp") .. "/qBittorrent/config/qBittorrent.conf"},
    {name = "conf", path = "/etc/config/qbittorrent"}
}

for _, file in ipairs(files) do
    local content = nixio.fs.readfile(file.path)
    if content then
        local s = m:section(SimpleSection, nil,
            translatef("This is the content of the configuration file under <code>%s</code>:", file.path))
        local o = s:option(TextValue, file.name)
        o.rows = 20
        o.readonly = true
        o.cfgvalue = function()
            local v = content or translate("File does not exist.")
            return luci.util.trim(v) ~= "" and v or translate("Empty file.")
        end
    end
end

return m
