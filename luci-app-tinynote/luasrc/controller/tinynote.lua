module("luci.controller.tinynote", package.seeall)
local util = require "luci.util"

function index()
    entry({"admin", "nas"}, firstchild(), "NAS", 50).dependent = false
    entry({ "admin", "nas", "tinynote" }, firstchild(), _("TinyNote"), 1).dependent = false
    entry({ "admin", "nas", "tinynote", "tinynote" }, cbi("tinynote/tinynote"), _("TinyNote"), 1).leaf = true
    entry({ "admin", "nas", "tinynote", "codetools" }, form("tinynote/codetools"), _("代码工具"), 2).leaf = true
    entry({ "admin", "nas", "tinynote", "action_run" }, call("action_run"), nil).leaf = true
end

function send_json_response(output)
    luci.http.prepare_content("application/json")
    luci.http.write_json(output)
end

function process_result(exit_code, result_output, command, file_path)
    if exit_code == 0 then
        if #result_output > 0 then
            return send_json_response({
                result = "success",
                data   = util.pcdata(result_output)
            })
        else
            return send_json_response({
                result = "success",
                data   = luci.i18n.translatef("Executing '%s %s' did not return data!<br><br>", command, file_path)
            })
        end
    else
        return send_json_response({
            result = luci.i18n.translatef("Failed to execute <div style='color: #f92672;'>%s %s</div><div style='text-align: left;'>Exit code: %d<br>Error message: <div style='color: #e6db74;'>%s</div>", command, file_path, exit_code, result_output)
        })
    end
end

function action_run()
    local command   = luci.http.formvalue('command')
    local file_path = luci.http.formvalue('file_path')

    if command == '' and file_path == '' then
        return send_json_response({
            result = luci.i18n.translate("No input for the command line yet. Don't click 'Execute Command'!")
        })
    elseif command == '' and file_path ~= '' then
        local sum = 'model_note' .. file_path:match('%d+')
        local con = luci.model.uci.cursor():get_all("luci", "tinynote")
        local allowed_commands = { shell = 'sh', python = 'python' }
        command = allowed_commands[con[sum]] or (con.note_suffix ~= '' and con.note_suffix or "lua"):gsub("py", "python")
    end

    local command_name = util.trim(util.exec("/usr/bin/which " .. command:match("^([^%s]+)"))) or ''
    if #command_name < 4 or command_name:match("no") then
        return send_json_response({
            result = luci.i18n.translatef("The current system cannot find the command '%s' you entered!", command:match("^([^%s]+)"))
        })
    end

    local output    = util.exec(string.format("%s %s 2>&1; echo $?", command, file_path))
    local data      = output:sub(1, -3)
    local exit_code = tonumber(output:sub(-2))
    process_result(exit_code, data, command, file_path)
end
