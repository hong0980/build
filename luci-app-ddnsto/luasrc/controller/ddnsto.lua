module("luci.controller.ddnsto", package.seeall)

local sys   = require "luci.sys"
local fs    = require "nixio.fs"
local http  = require "luci.http"
local uci   = require "luci.model.uci".cursor()
local cfg   = uci:get_all("ddnsto", "default")
local sta   = sys.call("pidof ddnstod >/dev/null") == 0

function index()
    if not fs.access("/etc/config/ddnsto") then return end
    entry({"admin", "services", "ddnsto"}, call("redirect_index"), _("DDNSTO 远程控制"), 20).dependent = true
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
    index = tonumber(cfg.index) or '0',
    feat_enabled = cfg.feat_enabled == "1",
    feat_password = cfg.feat_password or "",
    feat_username = cfg.feat_username or "",
    feat_port = tonumber(cfg.feat_port) or '3030',
    feat_disk_path_selected = cfg.feat_disk_path_selected or ""
}

local function status_container()
    local is_enabled = sys.call("pidof ddwebdav >/dev/null") == 0
    local status_html = "<b style='color:%s;font-weight:bolder'>%s</b>"

    return {
        title = "服务状态",
        labels = (function()
            local id = sys.exec("/usr/sbin/ddnstod -x %s -w | cut -d' ' -f2" %config.index)
            local enabled_html = status_html % {is_enabled and "green" or "red", is_enabled and "已启用" or "未启用"}
            local labels = {
                { key = "服务状态：", value = status_html %{sta and "green" or "red", sta and "已启动" or "未运行"}},
                { key = "插件版本：", value = sys.exec("/usr/sbin/ddnstod -v")},
                { key = "设备ID：", value = "<b style='color:green;font-weight:bolder'>%s</b>（设备编号: %s）" %{id, config.index}},
                { key = "控制台：", value = "<a href='https://www.ddnsto.com/app/#/devices' target='_blank'>点击前往DDNSTO控制台</a>"},
                { key = "拓展功能：", value = enabled_html}
            }

            if is_enabled then
                local ip = http.getenv("SERVER_NAME") or "localhost"
                local webdav_url = "http://%s:%s/webdav" %{ip, config.feat_port}
                table.insert(labels, { key = "拓展用户名：", value = config.feat_username})
                table.insert(labels, { key = "webdav服务：", value = enabled_html})
                table.insert(labels, {
                    key = "webdav地址：",
                    value = "<a href='%s' target='_blank'>%s</a>" %{webdav_url, webdav_url}
               })
                table.insert(labels, { key = "远程开机服务：", value = enabled_html})
            end

            return labels
        end)()
    }
end

local function main_container()
    return {
        title = "基础设置",
        properties = {
            {
                name = "enabled",
                title = "启用",
                type = "boolean",
                ["ui:options"] = {description = "启用DDNSTO 远程控制"}
            },
            {
                name = "token",
                required = true,
                mode = "password",
                title = "用户Token",
                type = "string",
                ["ui:options"] = {
                    description = "<a href='https://doc.linkease.com/zh/guide/ddnsto/' target='_blank'>如何获取令牌?</a>"
                }
            },
            {
                name = "index",
                enum = {0, 1, 2, 3, 4, 5, 6, 7, 8, 9},
                enumNames = {0, 1, 2, 3, 4, 5, 6, 7, 8, 9},
                title = "设备编号",
                type = "interger",
                ["ui:options"] = {description = "如有多台设备id重复，请修改此编号"}
            },
            {
                name = "threads",
                title = "CPU核心数",
                type = "interger",
                enum = {0, 1, 2, 4, 8, 16, 32},
                enumNames = {'自动获取', 1, 2, 4, 8, 16, 32},
                ["ui:options"] = {description = "CPU核心数"}
            },
            {
                name = "log_level",
                title = "日志",
                type = "interger",
                enum = {0, 1, 2, 3},
                enumNames = {'调试', '信息', '警告', '错误'},
                ["ui:options"] = {description = "日志级别，默认值是警告"}
            }
        }
    }
end

local function get_block_devices()
    local b = io.popen("/sbin/block info", "r")
    if not b then
        return {}
    end
    local rv = {}
    for ln in b:lines() do
        if ln:match("^/dev/.-:") then
            for k, v in ln:gmatch([[(%w+)="(.-)"]]) do
                if k:lower() == "mount" then rv[#rv+1] = v end
            end
        end
    end
    b:close()
    return rv
end

local function feat_container()
    local disks = get_block_devices()
    return {
        title = "拓展功能",
        description = "启用后可支持控制台的“文件管理”及“远程开机”功能 <a href='https://doc.linkease.com/zh/guide/ddnsto/ddnstofile.html' target='_blank'>查看教程</a>",
        properties = {
            {
                name = "feat_enabled",
                title = "启用",
                type = "boolean"
            },
            {
                name = "feat_port",
                required = true,
                title = "端口",
                type = "interger",
                ["ui:hidden"] = "{{rootValue.feat_enabled !== true }}"
            },
            {
                name = "feat_username",
                required = true,
                title = "授权用户名",
                type = "string",
                ["ui:hidden"] = "{{rootValue.feat_enabled !== true }}"
            },
            {
                name = "feat_password",
                mode = "password",
                required = true,
                title = "授权用户密码",
                type = "string",
                ["ui:hidden"] = "{{rootValue.feat_enabled !== true }}"
            },
            {
                name = "feat_disk_path_selected",
                enum = disks,
                enumNames = disks,
                required = true,
                title = "共享磁盘",
                type = "string",
                ["ui:hidden"] = "{{rootValue.feat_enabled !== true }}"
            }
        }
    }
end

local function get_schema()
    return {
        title = "DDNSTO 远程控制",
        description = "DDNSTO远程控制是Koolcenter小宝开发的，支持http2的远程穿透控制插件。<br />支持通过浏览器访问自定义域名访问内网设备后台、远程RDP/VNC桌面、远程文件管理等多种功能。<br />详情请查看 <a href='https://www.ddnsto.com/' target='_blank'>https://www.ddnsto.com</a>",
        actions = {{
            text = "保存并应用",
            type = "apply"
        }},
        containers = {
            status_container(),
            main_container(),
            feat_container()
        }
    }
end

function ddnsto_form()
    http.prepare_content("application/json")
    http.write_json({
        error = "",
        scope = "",
        success = 0,
        result = {
            data = config,
            schema = get_schema()
        }
    })
end

function ddnsto_submit()
    local req = luci.jsonc.parse(http.content()) or {}
    local error = ''
    local success = true
    local log = "正在验证参数...\n"

    if not next(req) then
        error = "无效的请求"
    elseif req.enabled and is_empty(req.token) then
        error = "请填写正确用户Token（令牌）"
        success = nil
    elseif req.token and #req.token ~= 36 then
        error = "令牌长度必须是36个字符"
        success = nil
    elseif req.token and req.token:find(" ") then
        error = "令牌勿包含空格"
        success = nil
    elseif not tonumber(req.index) or req.index < 0 or req.index > 99 then
        error = "请填写正确的设备编号"
        success = nil
    elseif req.feat_enabled and (
        not tonumber(req.feat_port) or req.feat_port == 0 or
        is_empty(req.feat_username) or req.feat_username:find(" ") or
        is_empty(req.feat_password) or req.feat_password:find(" ") or
        is_empty(req.feat_disk_path_selected)
    ) then
        error = ({
            [true] = "请填写正确的端口",
            [is_empty(req.feat_username)] = "请填写授权用户名",
            [req.feat_username:find(" ")] = "用户名请勿包含空格",
            [is_empty(req.feat_password)] = "请填写授权用户密码",
            [req.feat_password:find(" ")] = "用户密码请勿包含空格",
            [is_empty(req.feat_disk_path_selected)] = "请填写共享磁盘路径"
        })[true]
        success = nil
    end

    if success then
        local con = {
            token = trim(req.token),
            index = req.index or '0',
            threads = req.threads or '0',
            log_level = req.log_level or '2',
            feat_port = req.feat_port or '3033',
            enabled = req.enabled and "1" or "0",
            feat_username = trim(req.feat_username),
            feat_password = trim(req.feat_password),
            feat_enabled = req.feat_enabled and "1" or "0",
            feat_disk_path_selected = trim(req.feat_disk_path_selected)
        }
        for k, v in pairs(con) do
            uci:set("ddnsto", "default", k, v)
        end
        uci:commit("ddnsto")
        sys.exec("/etc/init.d/ddnsto stop; /etc/init.d/ddnsto start; sleep 1")
        log = "%s正在保存参数...\n保存成功!\n请关闭对话框\n" %log
    else
        log = "%s参数错误： %s\n保存失败！\n请关闭对话框\n" %{log, "<b style='color:red;font-weight:bolder'>%s</b>" %error}
        sys.exec("sleep 1")
    end

    http.prepare_content("application/json")
    http.write_json({
        success = 0,
        result = {
            log = log,
            async = false,
            data = config,
            schema = get_schema()
        }
    })
end

function ddnsto_log()
    http.prepare_content("text/plain;charset=utf-8")
    http.write(fs.readfile("/tmp/ddnsto/ddnsto-luci.log") or "")
end

function ddnsto_status()
    http.prepare_content("application/json")
    http.write_json({
        running = sta
    })
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
