m = SimpleForm("logview")
m.submit = false
m.reset = false
f = m:section(TypedSection)
f.cfgsections = function()
    return {""}
end

f:tab("JS", translate("JavaScript"))
f:tab("HTML", translate("HTML"))
f:tab("CSS", translate("CSS"))
f:tab("JSON", translate("JSON"))
f:tab("YAML", translate("YAML"))
f:tab("Lua", translate("Lua"))
f:tab("SH", translate("SH"))

x = f:taboption("JS", Button, "examineJavaScript")
x.inputtitle = "语法检查"
x.onclick    = "examineJavaScript();"
x.template   = "tinynote/inlinebutton"
x = f:taboption("JS", Button, "JsFormat")
x.inputtitle = "美化/格式化"
x.onclick    = "JsCompression('beautify');"
x.template   = "tinynote/inlinebutton"
x = f:taboption("JS", Button, "JsCompressionpack")
x.inputtitle = "常规压缩"
x.onclick    = "JsCompression('minify');"
x.template   = "tinynote/inlinebutton"
x = f:taboption("JS", Button, "JsCompressionminify")
x.inputtitle = "混淆压缩"
x.onclick    = "JsCompression('pack');"
x.template   = "tinynote/inlinebutton"
x = f:taboption("JS", Button, "getExampleJavaScript")
x.inputstyle = 'add'
x.inputtitle = "示例"
x.onclick    = "getExampleJavaScript();"
x.template   = "tinynote/inlinebutton"

x = f:taboption("Lua", Button, "examineLua")
x.inputtitle = "语法检查"
x.onclick    = "formatLua('examine');"
x.template   = "tinynote/inlinebutton"
x = f:taboption("Lua", Button, "Luaformat")
x.inputtitle = "美化/格式化"
x.onclick    = "formatLua();"
x.template   = "tinynote/inlinebutton"
x = f:taboption("Lua", Button, "Luaminify")
x.inputtitle = "压缩"
x.onclick    = "formatLua('minify');"
x.template   = "tinynote/inlinebutton"
x = f:taboption("Lua", Button, "getExampleLua")
x.inputstyle = 'add'
x.inputtitle = "示例"
x.onclick    = "getExampleLua();"
x.template   = "tinynote/inlinebutton"

x = f:taboption("SH", Button, "SHformat")
x.inputtitle = "美化/格式化"
x.onclick    = "FormatSH('format');"
x.template   = "tinynote/inlinebutton"
x = f:taboption("SH", Button, "SHmin")
x.inputtitle = "压缩"
x.onclick    = "FormatSH('min');"
x.template   = "tinynote/inlinebutton"
x = f:taboption("SH", Button, "getExampleSH")
x.inputstyle = 'add'
x.inputtitle = "示例"
x.onclick    = "getExampleSH();"
x.template   = "tinynote/inlinebutton"

x = f:taboption("HTML", Button, "HTMLformat")
x.inputtitle = "美化/格式化"
x.onclick    = "FormatHTML('format');"
x.template   = "tinynote/inlinebutton"
x = f:taboption("HTML", Button, "HTMLmin")
x.inputtitle = "压缩"
x.onclick    = "FormatHTML('min');"
x.template   = "tinynote/inlinebutton"
x = f:taboption("HTML", Button, "getExampleHTML")
x.inputstyle = 'add'
x.inputtitle = "示例"
x.onclick    = "getExampleHTML();"
x.template   = "tinynote/inlinebutton"

x = f:taboption("CSS", Button, "CSSFormat")
x.inputtitle = "美化/格式化"
x.onclick    = "CSSFormat('format');"
x.template   = "tinynote/inlinebutton"
x = f:taboption("CSS", Button, "CSSFormatpack")
x.inputtitle = "常规压缩"
x.onclick    = "CSSFormat('pack');"
x.template   = "tinynote/inlinebutton"
x = f:taboption("CSS", Button, "CSSFormatpackAdv")
x.inputtitle = "极限压缩"
x.onclick    = "CSSFormat('min');"
x.template   = "tinynote/inlinebutton"
x = f:taboption("CSS", Button, "getExampleCSS")
x.inputstyle = 'add'
x.inputtitle = "示例"
x.onclick    = "getExampleCSS();"
x.template   = "tinynote/inlinebutton"

x = f:taboption("JSON", Button, "examineJSON")
x.inputtitle = "语法检查"
x.onclick    = "jsonFormat('safeLoad');"
x.template   = "tinynote/inlinebutton"
x = f:taboption("JSON", Button, "jsonFormat")
x.inputtitle = "美化/格式化"
x.onclick    = "jsonFormat('format');"
x.template   = "tinynote/inlinebutton"
x = f:taboption("JSON", Button, "jsonmin")
x.inputtitle = "压缩"
x.onclick    = "jsonFormat('min');"
x.template   = "tinynote/inlinebutton"
x = f:taboption("JSON", Button, "jsonToYAML")
x.inputtitle = "JSON 转 YAML"
x.onclick    = "FormatYAML('yaml');"
x.template   = "tinynote/inlinebutton"
x = f:taboption("JSON", Button, "jsonToXML")
x.inputtitle = "JSON 转 XML"
x.onclick    = "jsonToXML();"
x.template   = "tinynote/inlinebutton"
x = f:taboption("JSON", Button, "jsonTocsv")
x.inputtitle = "JSON 转 CSV"
x.onclick    = "jsonTocsv();"
x.template   = "tinynote/inlinebutton"
x = f:taboption("JSON", Button, "getExampleJson")
x.inputstyle = 'add'
x.inputtitle = "示例"
x.onclick    = "getExampleJson();"
x.template   = "tinynote/inlinebutton"

x = f:taboption("YAML", Button, "examineYAML")
x.inputtitle = "语法检查"
x.onclick    = "FormatYAML('safeLoad');"
x.template   = "tinynote/inlinebutton"
x = f:taboption("YAML", Button, "examineYAMLdump")
x.inputtitle = "美化/格式化"
x.onclick    = "FormatYAML('format');"
x.template   = "tinynote/inlinebutton"
x = f:taboption("YAML", Button, "examineYAMLJSON")
x.inputtitle = "YAML 转 JSON"
x.onclick    = "FormatYAML('json');"
x.template   = "tinynote/inlinebutton"
x = f:taboption("YAML", Button, "jsonToXML")
x.inputtitle = "YAML 转 XML"
x.onclick    = "yamlToxml();"
x.template   = "tinynote/inlinebutton"
x = f:taboption("YAML", Button, "getExampleYaml")
x.inputstyle = 'add'
x.inputtitle = "示例"
x.onclick    = "getExampleYaml();"
x.template   = "tinynote/inlinebutton"

m:append(Template("tinynote/codetools"))
return m
