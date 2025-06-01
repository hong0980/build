module("luci.controller.ddnsto", package.seeall)

local sys   = require "luci.sys"
local i18n  = require "luci.i18n"
local fs    = require "nixio.fs"
local http  = require "luci.http"
local uci   = require "luci.model.uci".cursor()
local cfg   = uci:get_all("ddnsto", "default")
local sta   = sys.call("pidof ddnstod >/dev/null") == 0

function index()
    if not fs.access("/etc/config/ddnsto") then return end
    entry({"admin", "services", "ddnsto"}, call("redirect_index"), _("DDNSTO Remote Control"), 20).dependent = true
    entry({"admin", "services", "ddnsto", "pages"}, call("ddnsto_index")).leaf = true
    if fs.access("/usr/lib/lua/luci/view/ddnsto/main_dev.htm") then
        entry({"admin", "services", "ddnsto", "dev"}, call("ddnsto_dev")).leaf = true
    end
    -- entry({"admin", "services", "ddnsto"}, cbi("ddnsto"), _("DDNS.to"), 20)
    -- entry({"admin", "services", "ddnsto_status"}, call("ddnsto_status"))
    entry({"admin", "services", "ddnsto", "form"}, call("ddnsto_form")).leaf = true
    entry({"admin", "services", "ddnsto", "submit"}, call("ddnsto_submit")).leaf = true
    entry({"admin", "services", "ddnsto", "log"}, call("ddnsto_log")).leaf = true
end

local is_empty = function(s)
    return not s or s == ""
end

local trim = function(s)
    return s and s:gsub("^%s*(.-)%s*$", "%1") or ""
end

local config = {
    token = cfg.token or "",
    enabled = cfg.enabled == "1",
    threads = cfg.threads or '0',
    log_level = cfg.log_level or "2",
    index = tonumber(cfg.index) or 0,
    feat_enabled = cfg.feat_enabled == "1",
    feat_password = cfg.feat_password or "",
    feat_username = cfg.feat_username or "",
    feat_port = tonumber(cfg.feat_port) or 3030,
    feat_disk_path_selected = cfg.feat_disk_path_selected or ""
}
local color_html = i18n.translatef("<b style='color:%s;font-weight:bolder'>%s</b>", "%s", "%s")
function status_container()
    local is_enabled = sys.call("pidof ddwebdav >/dev/null") == 0

    return {
        title = i18n.translate("Service Status"),
        labels = (function()
            local id = sys.exec("/usr/sbin/ddnstod -x %s -w | cut -d' ' -f2" %config.index)
            local enabled_html = color_html % {is_enabled and "green" or "red", is_enabled and i18n.translate("Enabled") or i18n.translate("Disabled")}
            local labels = {
                {key = i18n.translate("Service Status:"), value = color_html %{sta and "green" or "red", sta and i18n.translate("Running") or i18n.translate("Not Running")}},
                {key = i18n.translate("Plugin Version:"), value = sys.exec("/usr/sbin/ddnstod -v")},
                {key = i18n.translate("Device ID:"), value = i18n.translatef("<b style='color:green;font-weight:bolder'>%s</b> (Device Number: %s)", id, config.index)},
                {key = i18n.translate("Console:"), value = i18n.translate("<a href='https://www.ddnsto.com/app/#/devices' target='_blank'>Click to go to DDNSTO Console</a>")},
                {key = i18n.translate("Extended Features:"), value = enabled_html}
            }

            if is_enabled then
                local ip = http.getenv("SERVER_NAME") or "localhost"
                local webdav_url = "http://%s:%s/webdav" %{ip, config.feat_port}
                table.insert(labels, {key = i18n.translate("Extended Username:"), value = config.feat_username})
                table.insert(labels, {key = i18n.translate("WebDAV Service:"), value = enabled_html})
                table.insert(labels, {
                    key = i18n.translate("WebDAV Address:"),
                    value = i18n.translatef("<a href='%s' target='_blank'>%s</a>", webdav_url, webdav_url)
                })
                table.insert(labels, {key = i18n.translate("Remote Boot Service:"), value = enabled_html})
            end

            return labels
        end)()
    }
end

function main_container()
    return {
        title = i18n.translate("Basic Settings"),
        properties = {
            {
                name = "enabled",
                type = "boolean",
                title = i18n.translate("Enable"),
                ["ui:options"] = {description = i18n.translate("Enable DDNSTO Remote Control")}
            },
            {
                name = "token",
                required = true,
                mode = "password",
                type = "string",
                title = i18n.translate("User Token"),
                ["ui:options"] = {
                    description = i18n.translate("<a href='https://doc.linkease.com/zh/guide/ddnsto/' target='_blank'>How to obtain a token?</a>")
                }
            },
            {
                name = "index",
                type = "interger",
                enum = {0, 1, 2, 3, 4, 5, 6, 7, 8, 9},
                title = i18n.translate("Device Number"),
                ["ui:options"] = {description = i18n.translate("If multiple devices have duplicate IDs, please modify this number")}
            },
            {
                name = "threads",
                type = "interger",
                enum = {0, 1, 2, 4, 8, 16},
                title = i18n.translate("CPU Core Count"),
                enumNames = { i18n.translate("Auto Detect"),
                              i18n.translate("1 Thread"),
                              i18n.translate("2 Threads"),
                              i18n.translate("4 Threads"),
                              i18n.translate("8 Threads"),
                              i18n.translate("16 Threads")},
                ["ui:options"] = {description = i18n.translate("CPU Core Count")}
            },
            {
                name = "log_level",
                type = "interger",
                enum = {0, 1, 2, 3},
                title = i18n.translate("Log"),
                enumNames = { i18n.translate("Debug"),
                              i18n.translate("Info"),
                              i18n.translate("Warning"),
                              i18n.translate("Error")},
                ["ui:options"] = {description = i18n.translate("Log level, default is Warning")}
            }
        }
    }
end

function get_block_devices()
    local rv = {}
    for ln in luci.util.execi("/sbin/block info") do
        if ln:match("^/dev/.-:") then
            for k, v in ln:gmatch('(%w+)="(.-)"') do
                if k:lower() == "mount" then rv[#rv + 1] = v end
            end
        end
    end
    return rv
end

function feat_container()
    local disks = get_block_devices()
    return {
        title = i18n.translate("Extended Features"),
        description = i18n.translate("When enabled, supports console 'File Management' and 'Remote Boot' features <a href='https://doc.linkease.com/zh/guide/ddnsto/ddnstofile.html' target='_blank'>View Tutorial</a>"),
        properties = {
            {
                name = "feat_enabled",
                title = i18n.translate("Enable"),
                type = "boolean"
            },
            {
                name = "feat_port",
                required = true,
                title = i18n.translate("Port"),
                type = "interger",
                ["ui:hidden"] = "{{rootValue.feat_enabled !== true }}"
            },
            {
                name = "feat_username",
                required = true,
                title = i18n.translate("Authorized Username"),
                type = "string",
                ["ui:hidden"] = "{{rootValue.feat_enabled !== true }}"
            },
            {
                name = "feat_password",
                mode = "password",
                required = true,
                title = i18n.translate("Authorized User Password"),
                type = "string",
                ["ui:hidden"] = "{{rootValue.feat_enabled !== true }}"
            },
            {
                name = "feat_disk_path_selected",
                enum = disks,
                enumNames = disks,
                required = true,
                title = i18n.translate("Shared Disk"),
                type = "string",
                ["ui:hidden"] = "{{rootValue.feat_enabled !== true }}"
            }
        }
    }
end

function get_schema()
    return {
        title = i18n.translate("DDNSTO Remote Control"),
        description = i18n.translate("DDNSTO Remote Control is a plugin developed by Koolcenter Xiaobao, supporting HTTP2 for remote penetration control.<br />It supports accessing intranet device backends via custom domains in a browser, remote RDP/VNC desktops, remote file management, and more.<br />For details, visit <a href='https://www.ddnsto.com/' target='_blank'>https://www.ddnsto.com</a>"),
        actions = {{text = i18n.translate("Save and Apply"), type = "apply"}},
        containers = {status_container(), main_container(), feat_container()}
    }
end

function ddnsto_form()
    http.prepare_content("application/json")
    http.write_json({
        error = "", scope = "", success = 0,
        result = {data = config, schema = get_schema()}
    })
end

function ddnsto_submit()
    local error
    local req = luci.jsonc.parse(http.content()) or {}
    local log = i18n.translate("Verifying parameters...<br>")

    for _, v in ipairs({
        {not next(req), "Invalid request"},
        {req.token and req.token:find(" "), "Token must not contain spaces"},
        {req.token and #req.token ~= 36, "Token length must be 36 characters"},
        {req.enabled and is_empty(req.token), "Please enter a valid User Token"},
        {not tonumber(req.index) or req.index < 0 or req.index > 99, "Please enter a valid Device Number"},
        {req.feat_enabled and req.feat_username:find(" "), "Username must not contain spaces"},
        {req.feat_enabled and is_empty(req.feat_username), "Please enter an authorized username"},
        {req.feat_enabled and req.feat_password:find(" "), "User password must not contain spaces"},
        {req.feat_enabled and is_empty(req.feat_password), "Please enter an authorized user password"},
        {req.feat_enabled and is_empty(req.feat_disk_path_selected), "Please enter a shared disk path"},
        {req.feat_enabled and not tonumber(req.feat_port) or req.feat_port == 0, "Please enter a valid port"}
    }) do
        if v[1] then error = i18n.translate(v[2]) break end end

    if not error then
        for k, v in pairs({
            token = trim(req.token or ""),
            index = req.index or '0',
            threads = req.threads or '0',
            log_level = req.log_level or '2',
            feat_port = req.feat_port or '3033',
            enabled = req.enabled and "1" or "0",
            feat_username = trim(req.feat_username or ""),
            feat_password = trim(req.feat_password or ""),
            feat_enabled = req.feat_enabled and "1" or "0",
            feat_disk_path_selected = trim(req.feat_disk_path_selected or "")
        }) do
            uci:set("ddnsto", "default", k, v)
        end
        uci:commit("ddnsto")
        sys.exec("/etc/init.d/ddnsto restart")
        log = i18n.translatef("%sSaving parameters...<br>Saved successfully!<br>Please close the dialog<br>", log)
    else
        log = i18n.translatef("%sParameter error: %s<br>Save failed!<br>Please close the dialog<br>", log, color_html %{'red', error})
    end

    http.prepare_content("application/json")
    http.write_json({
        success = 0,
        result = {log = log, async = false, data = config, schema = get_schema()}
    })
end

function ddnsto_log()
    http.prepare_content("text/plain;charset=utf-8")
    http.write(fs.readfile("/tmp/ddnsto/ddnsto-luci.log") or "")
end

function ddnsto_status()
    http.prepare_content("application/json")
    http.write_json({running = sta})
end

function redirect_index()
    http.redirect(luci.dispatcher.build_url("admin", "services", "ddnsto", "pages"))
end

function ddnsto_index()
    luci.template.render("ddnsto/main", {
        prefix = luci.dispatcher.build_url("admin", "services", "ddnsto", "pages")
    })
end

function ddnsto_dev()
    luci.template.render("ddnsto/main_dev", {
        prefix = luci.dispatcher.build_url("admin", "services", "ddnsto", "dev")
    })
end
