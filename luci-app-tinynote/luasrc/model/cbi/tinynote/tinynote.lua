local fs   = require "nixio.fs"
local util = require 'luci.util'
local uci  = require 'luci.model.uci'.cursor()
local nixio = require "nixio"

if not uci:get('luci', 'tinynote') then
    uci:set('luci', 'tinynote', 'tinynote')
    uci:commit('luci')
end

local function new_write_file(path, note_suffix, value)
    local note_suffix_array = {
        sh  = "#!/bin/sh /etc/rc.common\n",
        py  = "#!/usr/bin/env python\n" ..
              "import os, re, sys, time\n",
        lua = "#!/usr/bin/env lua\n" ..
              "local fs   = require 'nixio.fs'\n" ..
              "local sys  = require 'luci.sys'\n" ..
              "local util = require 'luci.util'\n" ..
              "local uci  = require 'luci.model.uci'.cursor()\n",
    }
    local data = value or (note_suffix_array[note_suffix] or '')
    fs.writefile(path, data)
end

local note_theme_array = {
    { "monokai",                 "Monokai (Dark)"                 },
    { "dracula",                 "Dracula (Dark)"                 },
    { "material",                "Material (Dark)"                },
    { "darcula",                 "Darcula (Dark)"                 },
    { "solarized",               "Solarized (Medium contrast)"    },
    { "nord",                    "Nord (Dark/Light usable)"       },
    { "oceanic-next",            "Oceanic Next (Dark)"            },
    { "ambiance",                "Ambiance (Dark)"                },
    { "twilight",                "Twilight (Dark)"                },
    { "zenburn",                 "Zenburn (Dark)"                 },
    { "cobalt",                  "Cobalt (Dark)"                  },
    { "midnight",                "Midnight (Dark)"                },
    { "night",                   "Night (Dark)"                   },
    { "tomorrow-night-bright",   "Tomorrow Night Bright (Dark)"   },
    { "tomorrow-night-eighties", "Tomorrow Night Eighties (Dark)" },
    { "vibrant-ink",             "Vibrant Ink (Dark)"             },
    { "pastel-on-dark",          "Pastel on dark (Dark)"          },
    { "railscasts",              "Railscasts (Dark)"              },
    { "gruvbox-dark",            "Gruvbox (Dark)"                 },
    { "paraiso-dark",            "Paraiso (Dark)"                 },
    { "bespin",                  "Bespin (Dark)"                  },
    { "blackboard",              "Blackboard (Dark)"              },
    { "erlang-dark",             "Erlang (Dark)"                  },
    { "base16-dark",             "Base16 (Dark)"                  },
    { "duotone-dark",            "Duotone (Dark)"                 },
    { "lucario",                 "Lucario (Dark)"                 },
    { "seti",                    "Seti (Dark)"                    },
    { "shadowfox",               "Shadowfox (Dark)"               },
    { "the-matrix",              "Matrix (Dark)"                  },
    { "panda-syntax",            "Panda (Dark)"                   },
    { "eclipse",                 "Eclipse (Light)"                },
    { "idea",                    "Idea (Light)"                   },
    { "mdn-like",                "MDN-like (Light)"               },
    { "xq-light",                "XQ (Light)"                     },
    { "paraiso-light",           "Paraiso (Light)"                },
    { "duotone-light",           "Duotone (Light)"                },
    { "yeti",                    "Yeti (Light)"                   },
    { "neat",                    "Neat (Light)"                   },
    { "elegant",                 "Elegant (Light)"                },
    { "abcdef",                  "Abcdef (Light)"                 },
    { "3024-day",                "3024 Day (Light)"               },
    { "3024-night",              "3024 Night (Dark)"              },
    { "ambiance-mobile",         "Ambiance Mobile (Dark)"         },
    { "colorforth",              "Colorforth (Dark)"              },
    { "hopscotch",               "Hopscotch (Dark)"               },
    { "icecoder",                "Icecoder (Dark)"                },
    { "isotope",                 "Isotope (Dark)"                 },
    { "lesser-dark",             "Lesser Dark (Dark)"             },
    { "liquibyte",               "Liquibyte (Dark)"               },
    { "mbo",                     "MBO (Dark)"                     },
    { "neo",                     "Neo (Dark)"                     },
    { "rubyblue",                "Rubyblue (Dark)"                },
    { "ssms",                    "SSMS (Light-like)"              },
    { "ttcn",                    "TTCN (Neutral)"                 },
    { "xq-dark",                 "XQ (Dark)"                      },
    { "yonce",                   "Yonce (Dark)"                   }
};

local note_mode_array = {
    { "javascript",            "js"         },
    { "shell",                 "sh"         },
    { "lua",                   "lua"        },
    { "htmlmixed",             "html"       },
    { "css",                   "css"        },
    { "json",                  "json"       },
    { "yaml",                  "yaml"       },
    { "toml",                  "toml"       },
    { "python",                "python"     },
    { "markdown",              "markdown"   },
    { "diff",                  "patch"      },
    { "makefile",              "makefile"   },
    { "vue",                   "vue"        },
    { "typescript",            "ts"         },
    { "php",                   "php"        },
    { "rust",                  "rust"       },
    { "ruby",                  "ruby"       },
    { "sql",                   "sql"        },
    { "xml",                   "xml"        },
    { "nginx",                 "nginx"      },
    { "dockerfile",            "dockerfile" }
}

local ace_theme_array = {
    { "monokai",                  "Monokai (Dark)"               },
    { "dracula",                  "Dracula (Dark)"               },
    { "solarized_dark",           "Solarized (Dark)"             },
    { "solarized_light",          "Solarized (Light)"            },
    { "github",                   "GitHub (Light)"               },
    { "github_dark",              "GitHub Dark (Dark)"           },
    { "one_dark",                 "One Dark (Dark)"              },
    { "nord_dark",                "Nord Dark (Dark)"             },
    { "tomorrow_night_bright",    "Tomorrow Night Bright (Dark)" },
    { "ambiance",                 "Ambiance (Dark)"              },
    { "twilight",                 "Twilight (Dark)"              },
    { "cobalt",                   "Cobalt (Dark)"                },
    { "vibrant_ink",              "Vibrant Ink (Dark)"           },
    { "pastel_on_dark",           "Pastel on Dark (Dark)"        },
    { "clouds_midnight",          "Clouds Midnight (Dark)"       },
    { "merbivore",                "Merbivore (Dark)"             },
    { "idle_fingers",             "Idle Fingers (Dark)"          },
    { "gruvbox",                  "Gruvbox (Dark)"               },
    { "eclipse",                  "Eclipse (Light)"              },
    { "chrome",                   "Chrome (Light)"               },
    { "clouds",                   "Clouds (Light)"               },
    { "dawn",                     "Dawn (Light)"                 },
    { "dreamweaver",              "Dreamweaver (Light)"          },
    { "textmate",                 "TextMate (Light)"             },
    { "xcode",                    "Xcode (Light)"                },
    { "chaos",                    "Chaos (Dark)"                 },
    { "sqlserver",                "SQL Server (Light)"           },
    { "terminal",                 "Terminal (Dark)"              }
}

local function addValues(option, ...)
    for _, value in ipairs({...}) do
        option:value(value, translate(value))
    end
end

m = Map("luci", translate(""))

f = m:section(TypedSection, "tinynote")
-- f.template = "cbi/tblsection"
f.anonymous = true -- 删除
-- f.addremove = true -- 添加
-- f.extedit   = true -- 修改
-- f.sortable  = true -- 移动

if uci:get("luci", "tinynote", "note_path") then
    f:tab("note1", translate("Note display"))
    note_path = f:taboption("note1", DummyValue, "", nil)
end

f:tab("note", translate("Note Settings"))

f:tab("ace", translate("Ace Support"),
    translate("Ace supports syntax highlighting, line number display, automatic syntax checking, etc.") ..
    [[<br><b><a href='https://www.bootcdn.cn/ace/' target='_blank'>]] ..
    translate("BootCDN Resources") ..
    [[</a>&nbsp;&nbsp;&nbsp;<a href='https://ace.c9.io/build/kitchen-sink.html' target='_blank'>]] ..
    translate("Ace demo, theme preview.") ..
    [[</a>&nbsp;&nbsp;&nbsp;<a href='https://github.com/ajaxorg/ace-builds/' target='_blank'>]] ..
    translate("github") .. [[</a></b>]]
)

f:tab("codemirror", translate("CodeMirror Support"),
    translate("CodeMirror supports syntax highlighting, line number display, automatic indentation, etc.<br><b>") ..
    [[<a href='https://www.bootcdn.cn/codemirror/' target='_blank'>]] ..
    translate("BootCDN Resources") ..
    [[</a>&nbsp;&nbsp;&nbsp;<a href='https://discuss.codemirror.net/t/user-manual-in-chinese/1436/' target='_blank'>]] ..
    translate("User manual in Chinese") ..
    [[</a>&nbsp;&nbsp;&nbsp;<a href='https://codemirror.net/5/demo/theme.html' target='_blank'>]] ..
    translate("Theme Demo") .. [[</a></b>]]
)

local aceonly = f:taboption("ace", Flag, "aceonly",
    translate("Read-Only Mode"), translate("maximum authority"))
aceonly.enabled = 'true'
aceonly.disabled = 'false'
aceonly.default = aceonly.disabled
aceonly:depends("aceenable", 1)

local acetheme = f:taboption("ace", ListValue, "acetheme",
    translate("Design"))
acetheme.default = "monokai"
for _, k in ipairs(ace_theme_array) do
    acetheme:value(k[1], k[2])
end
acetheme:depends("aceenable", 1)

local acefont_size = f:taboption("ace", Value, "acefont_size",
    translate("Font Size"))
acefont_size.default = "14"
addValues(acefont_size, 10, 12, 14, 16)
acefont_size.datatype = "uinteger"
acefont_size:depends("aceenable", 1)

local aceline_spacing = f:taboption("ace", Value, "aceline_spacing",
    translate("Line Spacing"))
aceline_spacing.default = "1.2"
addValues(aceline_spacing, '1.0', '1.2', '1.3', '1.5')
aceline_spacing:depends("aceenable", 1)

local aceheight = f:taboption("ace", Value, "aceheight",
    translate("Display Height"))
aceheight.default = "350"
addValues(aceheight, 'auto', 300, 400, 500, 600)
aceheight:depends("aceenable", 1)

local note_path = f:taboption("note", Value, "note_path",
    translate("Save Path"))
note_path.default = "/etc/tinynote"

local note_sum = f:taboption("note", Value, "note_sum",
    translate("Number of Texts"))
note_sum.default = 1
note_sum.rmempty = false
note_sum.datatype = "range(1,20)"

local note_suffix = f:taboption("note", ListValue, "note_suffix",
    translate("Text Type"))
note_suffix.default = "lua"
for _, k in ipairs(note_mode_array) do
    note_suffix:value(k[1], k[2])
end

local cmenable = f:taboption("note", Flag, "cmenable",
    translate("Enable CodeMirror Support"))
cmenable:depends("aceenable", 0)

local aceenable = f:taboption("note", Flag, "aceenable",
    translate("Enable Ace Support"))
aceenable:depends("cmenable", 0)

local theme = f:taboption("codemirror", ListValue, "theme",
    translate("Design"))
theme.default = "monokai"
for _, k in ipairs(note_theme_array) do
    theme:value(k[1], k[2])
end
theme:depends("cmenable", 1)

local font_size = f:taboption("codemirror", Value, "font_size",
    translate("Font Size"))
font_size.default = "14"
addValues(font_size, 10, 12, 14, 16)
font_size.datatype = "uinteger"
font_size:depends("cmenable", 1)

local cmline_spacing = f:taboption("codemirror", Value, "cmline_spacing",
    translate("Line Spacing"))
cmline_spacing.default = "1.2"
addValues(cmline_spacing, '1.0', '1.2', '1.3', '1.5')
cmline_spacing:depends("cmenable", 1)

local height = f:taboption("codemirror", Value, "height",
    translate("Display Height"))
height.default = "350"
addValues(height, 'auto', 500, 600, 800)
height:depends("cmenable", 1)

local width = f:taboption("codemirror", Value, "width",
    translate("Display Width"))
width.default = "100%"
width:value("100%", translate("Auto"))
width:value("1000", "1000px")
width:value("1300", "1300px")
width:value("1500", "1500px")
width:depends("cmenable", 1)

local only = f:taboption("codemirror", Flag, "only",
    translate("Read-Only Mode"), translate("maximum authority"))
only.enabled = 'true'
only.disabled = 'false'
only.default = only.disabled
only:depends("cmenable", 1)

local s = m:section(TypedSection, "tinynote")
s.anonymous = true
s.addremove = false

local con         = uci:get_all("luci", "tinynote")
local note_sum    = con.note_sum    or "1"
local code_cmenable = con.cmenable      or nil
local code_aceenable = con.aceenable or nil
local note_suffix = con.note_suffix or "txt"
local note_path   = con.note_path   or "/etc/tinynote"

if nixio.fs.lstat(note_path, "type") ~= 'dir' then
    fs.mkdir(note_path)
end

local note_arg = {}
for sum_str = 1, note_sum do
    local sum  = "%02d" % sum_str
    local file = "%s/note%s.%s" % {note_path, sum, note_suffix}
    note_arg[#note_arg + 1] = file

    if nixio.fs.lstat(file, "type") ~= "reg" then
        new_write_file(file, note_suffix)
    end

    if fs.access(file, 'w') then
        local note = "note" .. sum
        s:tab(note, translatef("Note %s", sum))

        local enablenote = s:taboption(note, Flag, "enablenote" .. sum,
            translatef("Note %s Settings", sum))
        enablenote.enabled  = 'true'
        enablenote.disabled = 'false'
        enablenote.default  = 'false'

        local path = s:taboption(note, ListValue, "model_note" .. sum,
            translate("Type"))
        path:depends('enablenote' .. sum, 'true')
        path.remove_empty = true
        path:value('')
        for _, k in ipairs(note_mode_array) do
            path:value(k[1], k[2])
        end

        local note_only = s:taboption(note, Flag, "only_note" .. sum,
            translate("Read-only"))
        note_only:depends("enablenote" .. sum, 'true')
        note_only.enabled  = 'true'
        note_only.disabled = 'false'
        note_only.default  = 'false'

        local a = s:taboption(note, TextValue, "note" .. sum)
        a.template = "tinynote/tvalue"
        if code_cmenable or code_aceenable then
            a.id = "note" .. sum
        end
        a.rows = 20
        a.wrap = "off"

        function a.cfgvalue(self, section)
            local file_handle = io.open(file, "r")
            if not file_handle then return "" end

            local chunks = ""
            repeat
                local chunk = file_handle:read(1024 * 512)
                if chunk then chunks = chunks .. chunk end
                coroutine.yield()
            until not chunk

            file_handle:close()
            return chunks
        end

        function a.write(self, section, value)
            if not value or value == "" then
                return
            end
            value = value:gsub("\r\n?", "\n")
            local old_value = fs.readfile(file) or ""
            if value ~= old_value then
                new_write_file(file, nil, value)
            end
        end

        local clear_button = s:taboption(note, Button,  sum .. "_clear_note")
        clear_button.inputstyle = "reset"
        clear_button.inputtitle = translatef("Reset Notes %s", sum)
        clear_button.write = function(self, section)
            new_write_file(file, note_suffix)
        end

        local run_button = s:taboption(note, Button, sum .. "_run_note",
            translatef("Run Note %s", sum))
        run_button.file_path  = file
        run_button.sum        = sum
        run_button.inputstyle = "apply"
        run_button.template   = "tinynote/run_button"
    end
end

for file_name in fs.dir(note_path) do
    local file_path = "%s/%s" % {note_path, file_name}
    if not util.contains(note_arg, file_path) then
        fs.remover(file_path)
    end
end

if code_cmenable then
    m:append(Template("tinynote/codemirror"))
elseif code_aceenable then
    m:append(Template("tinynote/ace"))
end

return m
