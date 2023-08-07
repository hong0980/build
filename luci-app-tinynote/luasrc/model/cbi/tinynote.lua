local fs   = require "nixio.fs"
local util = require "luci.util"
local uci  = require "luci.model.uci".cursor()

if not uci:get("luci", "tinynote") then
    uci:set("luci", "tinynote", "tinynote")
    uci:commit("luci")
end

local function new_write_file(path, note_suffix, value)
    local note_suffix_array = {
        sh  = "#!/usr/bin/env sh\n" ..
              ". /lib/functions.sh\n" ..
              ". /lib/functions/service.sh\n",
        py  = "#!/usr/bin/env python\n" ..
              "import os\n" ..
              "import re\n" ..
              "import sys\n" ..
              "import time\n",
        lua = "#!/usr/bin/env lua\n" ..
              "local fs   = require \"nixio.fs\"\n" ..
              "local sys  = require \"luci.sys\"\n" ..
              "local util = require \"luci.util\"\n" ..
              "local uci  = require \"luci.model.uci\".cursor()\n",
    }
    local data = value or (note_suffix_array[note_suffix] or '')
    fs.writefile(path, data)
end

local note_theme_array = {
    { "3024-day",                "3024 Day"               },
    { "3024-night",              "3024 Night"             },
    { "abcdef",                  "Abcdef"                 },
    { "ambiance-mobile",         "Ambiance Mobile"        },
    { "ambiance",                "Ambiance"               },
    { "base16-dark",             "Base16 (dark)"          },
    { "bespin",                  "Bespin"                 },
    { "blackboard",              "Blackboard"             },
    { "cobalt",                  "Cobalt"                 },
    { "colorforth",              "Colorforth"             },
    { "darcula",                 "Darcula"                },
    { "dracula",                 "Dracula"                },
    { "duotone-dark",            "Duotone (dark)"         },
    { "duotone-light",           "Duotone (light)"        },
    { "eclipse",                 "Eclipse"                },
    { "elegant",                 "Elegant"                },
    { "erlang-dark",             "Erlang (dark)"          },
    { "gruvbox-dark",            "Gruvbox (dark)"         },
    { "hopscotch",               "Hopscotch"              },
    { "icecoder",                "Icecoder"               },
    { "idea",                    "Idea"                   },
    { "isotope",                 "Isotope"                },
    { "lesser-dark",             "Lesser Dark"            },
    { "liquibyte",               "Liquibyte"              },
    { "lucario",                 "Lucario"                },
    { "material",                "Material"               },
    { "mbo",                     "MBO"                    },
    { "mdn-like",                "MDN-like"               },
    { "midnight",                "Midnight"               },
    { "monokai",                 "Monokai"                },
    { "neat",                    "Neat"                   },
    { "neo",                     "Neo"                    },
    { "night",                   "Night"                  },
    { "nord",                    "Nord"                   },
    { "oceanic-next",            "Oceanic Next"           },
    { "panda-syntax",            "Panda"                  },
    { "paraiso-dark",            "Paraiso (dark)"         },
    { "paraiso-light",           "Paraiso (light)"        },
    { "pastel-on-dark",          "Pastel on dark"         },
    { "railscasts",              "Railscasts"             },
    { "rubyblue",                "Rubyblue"               },
    { "seti",                    "Seti"                   },
    { "shadowfox",               "Shadowfox"              },
    { "solarized",               "Solarized"              },
    { "ssms",                    "SSMS"                   },
    { "the-matrix",              "Matrix"                 },
    { "tomorrow-night-bright",   "Tomorrow Night Bright"  },
    { "tomorrow-night-eighties", "Tomorrow Night Eighties"},
    { "ttcn",                    "TTCN"                   },
    { "twilight",                "Twilight"               },
    { "vibrant-ink",             "Vibrant Ink"            },
    { "xq-dark",                 "XQ (dark)"              },
    { "xq-light",                "XQ (light)"             },
    { "yeti",                    "Yeti"                   },
    { "yonce",                   "Yonce"                  },
    { "zenburn",                 "Zenburn"                }
}

local note_mode_array = {
    { "shell",            "sh"         },
    { "javascript",       "js"         },
    { "lua",              "lua"        },
    { "python",           "py"         },
    { "htmlmixed",        "html"       },
    { "cmake",            "cmake"      },
    { "yaml",             "yaml"       },
    { "diff",             "patch(diff)"},
    { "css",              "css"        },
    { "xml",              "xml"        },
    { "ttcn-cfg",         "cfg"        },
    { "http",             "http"       },
    { "perl",             "pl"         },
    { "php",              "php"        },
    { "sql",              "sql"        },
    { "vb",               "vb"         },
    { "vbscript",         "vbs"        },
    { "velocity",         "vm"         },
    { "apl",              "apl"        },
    { "asciiarmor",       "asc"        },
    { "asn.1",            "asn1"       },
    { "asterisk",         "asterisk"   },
    { "brainfuck",        "bf"         },
    { "clike",            "c"          },
    { "clojure",          "clj"        },
    { "cobol",            "cobol"      },
    { "coffeescript",     "coffee"     },
    { "commonlisp",       "lisp"       },
    { "crystal",          "cr"         },
    { "cypher",           "cypher"     },
    { "d",                "d"          },
    { "dart",             "dart"       },
    { "django",           "django"     },
    { "dockerfile",       "dockerfile" },
    { "dtd",              "dtd"        },
    { "dylan",            "dylan"      },
    { "ebnf",             "ebnf"       },
    { "ecl",              "ecl"        },
    { "eiffel",           "eiffel"     },
    { "elm",              "elm"        },
    { "erlang",           "erl"        },
    { "factor",           "factor"     },
    { "fcl",              "fcl"        },
    { "forth",            "forth"      },
    { "fortran",          "f90"        },
    { "gas",              "gas"        },
    { "gfm",              "gfm"        },
    { "gherkin",          "gherkin"    },
    { "go",               "go"         },
    { "groovy",           "groovy"     },
    { "haml",             "haml"       },
    { "handlebars",       "hbs"        },
    { "haskell",          "hs"         },
    { "haskell-literate", "lhs"        },
    { "haxe",             "hx"         },
    { "idl",              "idl"        },
    { "jinja2",           "jinja2"     },
    { "jsx",              "jsx"        },
    { "julia",            "jl"         },
    { "livescript",       "ls"         },
    { "markdown",         "md"         },
    { "mathematica",      "m"          },
    { "mbox",             "mbox"       },
    { "mirc",             "mirc"       },
    { "mllike",           "sml"        },
    { "modelica",         "mo"         },
    { "mscgen",           "mscgen"     },
    { "mumps",            "mumps"      },
    { "nginx",            "nginx"      },
    { "nsis",             "nsi"        },
    { "ntriples",         "ntriples"   },
    { "octave",           "octave"     },
    { "oz",               "oz"         },
    { "pascal",           "pascal"     },
    { "pegjs",            "pegjs"      },
    { "pig",              "pig"        },
    { "powershell",       "ps1"        },
    { "properties",       "properties" },
    { "protobuf",         "protobuf"   },
    { "pug",              "pug"        },
    { "puppet",           "pp"         },
    { "q",                "q"          },
    { "r",                "r"          },
    { "rpm",              "rpm"        },
    { "rst",              "rst"        },
    { "ruby",             "rb"         },
    { "rust",             "rs"         },
    { "sas",              "sas"        },
    { "sass",             "sass"       },
    { "scheme",           "scheme"     },
    { "sieve",            "sieve"      },
    { "slim",             "slim"       },
    { "smalltalk",        "st"         },
    { "smarty",           "smarty"     },
    { "solr",             "solr"       },
    { "soy",              "soy"        },
    { "sparql",           "sparql"     },
    { "spreadsheet",      "spreadsheet"},
    { "stex",             "latex"      },
    { "stylus",           "styl"       },
    { "swift",            "swift"      },
    { "tcl",              "tcl"        },
    { "textile",          "textile"    },
    { "tiddlywiki",       "tiddlywiki" },
    { "tiki",             "tiki"       },
    { "toml",             "toml"       },
    { "tornado",          "tornado"    },
    { "troff",            "troff"      },
    { "ttcn",             "ttcn"       },
    { "turtle",           "turtle"     },
    { "twig",             "twig"       },
    { "verilog",          "v"          },
    { "vhdl",             "vhdl"       },
    { "vue",              "vue"        },
    { "wast",             "wast"       },
    { "webidl",           "webidl"     },
    { "xquery",           "xq"         },
    { "yacas",            "ys"         },
    { "yaml-frontmatter", "yfm"        },
    { "z80",              "z80"        }
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

f:tab("codemirror", translate("CodeMirror Support"),
    translate("CodeMirror supports syntax highlighting, line number display, automatic indentation, etc.<br><b>") ..
    [[<a href='https://www.bootcdn.cn/codemirror/' target='_blank'>]] ..
    translate("BootCDN Resources") ..
    [[</a><span style="white-space: pre;">     </span><a href='https://discuss.codemirror.net/t/user-manual-in-chinese/1436/' target='_blank'>]] ..
    translate("User manual in Chinese") ..
    [[</a><span style="white-space: pre;">     </span><a href='https://codemirror.net/5/demo/theme.html' target='_blank'>]] ..
    translate("Theme Demo") .. [[</a></b>]]
)

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
note_suffix.default = "txt"
addValues(note_suffix, 'txt', 'sh', 'lua', 'py', 'js')

local enable = f:taboption("note", Flag, "enable",
    translate("Enable CodeMirror Support"))
enable.default = '0'

local theme = f:taboption("codemirror", ListValue, "theme",
    translate("Design"))
theme.default = "monokai"
for _, k in ipairs(note_theme_array) do
    theme:value(k[1], k[2])
end
theme:depends("enable", 1)

local font_size = f:taboption("codemirror", Value, "font_size",
    translate("Font Size"))
font_size.default = "14"
addValues(font_size, 10, 12, 14, 16)
font_size.datatype = "uinteger"
font_size:depends("enable", 1)

local line_spacing = f:taboption("codemirror", Value, "line_spacing",
    translate("Line Spacing"))
line_spacing.default = "140"
addValues(line_spacing, 100, 140, 150)
line_spacing.datatype = "uinteger"
line_spacing:depends("enable", 1)

local height = f:taboption("codemirror", Value, "height",
    translate("Display Height"))
height.default = "500"
addValues(height, 'auto', 500, 600, 800)
height:depends("enable", 1)

local width = f:taboption("codemirror", Value, "width",
    translate("Display Width"))
width.default = "1000"
addValues(width, 'auto', 1000, 1300, 1500)
width:depends("enable", 1)

local only = f:taboption("codemirror", Flag, "only",
    translate("Read-Only Mode"), translate("maximum authority"))
only.enabled = 'true'
only.disabled = 'false'
only.default = only.disabled
only:depends("enable", 1)

local s = m:section(TypedSection, "tinynote")
s.anonymous = true
s.addremove = false

local con         = uci:get_all("luci", "tinynote")
local note_sum    = con.note_sum    or "1"
local code_enable = con.enable      or nil
local note_suffix = con.note_suffix or "txt"
local note_path   = con.note_path   or "/etc/tinynote"

if not fs.access(note_path) then
    fs.mkdirr(note_path)
end

local note_arg = {}
for sum_str = 1, note_sum do
    local sum  = "%02d" % sum_str
    local file = "%s/note%s.%s" % {note_path, sum, note_suffix}
    note_arg[#note_arg + 1] = file

    if not fs.access(file) then
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
        a.template = "cbi/tvalue"
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
        clear_button.template   = "tinynote/clear_button"
        clear_button.inputtitle = translatef("Reset Notes %s", sum)
        clear_button.write = function(self, section)
            new_write_file(file, note_suffix)
        end

        local run_button = s:taboption(note, Button, sum .. "_run_note",
            translatef("Run Note %s", sum))
        run_button.file_path  = file
        run_button.inputstyle = "apply"
        run_button.template   = "tinynote/run_button"
    end
end

for file_name in fs.dir(note_path) do
    local file_path = "%s/%s" % {note_path, file_name}
    if not util.contains(note_arg, file_path) then
        fs.remove(file_path)
    end
end

if code_enable then
    m:append(Template("tinynote/codemirror"))
end

return m
