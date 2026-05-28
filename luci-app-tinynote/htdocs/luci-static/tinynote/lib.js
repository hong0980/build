// customScrollbar: 自定义滚动条
// hScrollBarAlwaysVisible: 水平滚动条是否始终可见
// vScrollBarAlwaysVisible: 垂直滚动条是否始终可见
// highlightGutterLine: 是否高亮显示行号区域
// animatedScroll: 是否启用平滑滚动
// showInvisibles: 是否显示不可见字符
// showPrintMargin: 是否显示打印边距
// printMarginColumn: 设置打印边距的列数
// printMargin: 设置打印边距的显示方式
// fadeFoldWidgets: 是否淡化折叠小部件
// showFoldWidgets: 是否显示折叠小部件
// displayIndentGuides: 是否显示缩进指南
// highlightIndentGuides: 是否高亮显示缩进指南
// showGutter: 是否显示行号区域
// fontSize: 编辑器的字号
// fontFamily: 编辑器的字体
// maxLines: 编辑器的最大行数
// minLines: 编辑器的最小行数
// scrollPastEnd: 是否允许滚动超出内容末尾
// fixedWidthGutter: 是否固定行号区域的宽度
// theme: 编辑器的主题
// hasCssTransforms: 是否启用 CSS 变换
// maxPixelHeight: 编辑器的最大像素高度
// useTextareaForIME: 是否使用 textarea 处理输入法
// useResizeObserver: 是否使用 ResizeObserver 接口
// useSvgGutterIcons: 是否使用 SVG 图标作为行号区域的图标
// showFoldedAnnotations: 是否显示折叠的注解
// scrollSpeed: 滚动速度
// dragDelay: 拖拽延迟
// dragEnabled: 是否启用拖拽
// focusTimeout: 焦点超时
// tooltipFollowsMouse: 鼠标提示是否跟随鼠标移动
// firstLineNumber: 第一行的行号
// overwrite: 是否为覆盖模式
// newLineMode: 新行的模式
// useWorker: 是否启用后台工作线程
// useSoftTabs: 是否使用软制表符
// navigateWithinSoftTabs: 是否在软制表符内导航
// tabSize: 制表符的大小
// wrap: 是否启用自动换行
// indentedSoftWrap: 缩进自动换行
// foldStyle: 折叠样式
// mode: 编辑器的语言模式
var editor1 = ace.edit("editor1"),
    editor2 = ace.edit("editor2");

[editor1, editor2].forEach(function (ed) {
    ed.setOptions({
        fontFamily: "Consolas, monospace",
        printMarginColumn: -1,
        wrap: true,
        showPrintMargin: true
    });
});

var output = '',
    indent_char = ' ',
    indent_size = calculateTabSize();

$(function () {
    var themes = [
        { value: "ambiance",                 name: "Ambiance"                },
        { value: "chaos",                    name: "Chaos"                   },
        { value: "chrome",                   name: "Chrome"                  },
        { value: "cloud9_day",               name: "Cloud9 Day"              },
        { value: "cloud9_night",             name: "Cloud9 Night"            },
        { value: "cloud9_night_low_color",   name: "Cloud9 Night Low Color"  },
        { value: "clouds",                   name: "Clouds"                  },
        { value: "clouds_midnight",          name: "Clouds Midnight"         },
        { value: "cobalt",                   name: "Cobalt"                  },
        { value: "crimson_editor",           name: "Crimson Editor"          },
        { value: "dawn",                     name: "Dawn"                    },
        { value: "dracula",                  name: "Dracula"                 },
        { value: "dreamweaver",              name: "Dreamweaver"             },
        { value: "eclipse",                  name: "Eclipse"                 },
        { value: "github",                   name: "GitHub"                  },
        { value: "github_dark",              name: "GitHub Dark"             },
        { value: "gob",                      name: "Gob"                     },
        { value: "gruvbox",                  name: "Gruvbox"                 },
        { value: "gruvbox_dark_hard",        name: "Gruvbox Dark Hard"       },
        { value: "gruvbox_light_hard",       name: "Gruvbox Light Hard"      },
        { value: "idle_fingers",             name: "Idle Fingers"            },
        { value: "iplastic",                 name: "IPlastic"                },
        { value: "katzenmilch",              name: "Katzenmilch"             },
        { value: "kr_theme",                 name: "KR Theme"                },
        { value: "kuroir",                   name: "Kuroir"                  },
        { value: "merbivore",                name: "Merbivore"               },
        { value: "merbivore_soft",           name: "Merbivore Soft"          },
        { value: "mono_industrial",          name: "Mono Industrial"         },
        { value: "monokai",                  name: "Monokai"                 },
        { value: "nord_dark",                name: "Nord Dark"               },
        { value: "one_dark",                 name: "One Dark"                },
        { value: "pastel_on_dark",           name: "Pastel on Dark"          },
        { value: "solarized_dark",           name: "Solarized Dark"          },
        { value: "solarized_light",          name: "Solarized Light"         },
        { value: "sqlserver",                name: "SQL Server"              },
        { value: "terminal",                 name: "Terminal"                },
        { value: "textmate",                 name: "TextMate"                },
        { value: "tomorrow",                 name: "Tomorrow"                },
        { value: "tomorrow_night",           name: "Tomorrow Night"          },
        { value: "tomorrow_night_blue",      name: "Tomorrow Night Blue"     },
        { value: "tomorrow_night_bright",    name: "Tomorrow Night Bright"   },
        { value: "tomorrow_night_eighties",  name: "Tomorrow Night Eighties" },
        { value: "twilight",                 name: "Twilight"                },
        { value: "vibrant_ink",              name: "Vibrant Ink"             },
        { value: "xcode",                    name: "Xcode"                   }
    ],
        fontSizes = ['12px', '14px', '16px', '18px'],
        $selTheme = $('#aceTheme'),
        $selFontSize = $('#fontSize');

    themes.forEach(function (t) {
        $selTheme.append($('<option>', { value: t.value, text: t.name }));
    });
    fontSizes.forEach(function (s) {
        $selFontSize.append($('<option>', { value: s, text: s }));
    });

    $selTheme.val('monokai');
    $selFontSize.val('14px');

    var applyTheme = function (theme, fontSize) {
        if (theme) { editor1.setTheme('ace/theme/' + theme); editor2.setTheme('ace/theme/' + theme); }
        if (fontSize) { editor1.setFontSize(fontSize); editor2.setFontSize(fontSize); }
    };
    applyTheme($selTheme.val(), $selFontSize.val());

    $selTheme.on('change', function () { applyTheme($selTheme.val(), null); });
    $selFontSize.on('change', function () { applyTheme(null, $selFontSize.val()); });

    $('#indent_size').on('change', function () { indent_size = calculateTabSize(); });

    setTimeout(watchTabChange, 500);
});

editor1.on("input", function () { updateDisplay(editor1, "input"); });
editor2.on("input", function () { updateDisplay(editor2, "output"); });
editor1.selection.on("changeCursor", function () { updateDisplay(editor1, "input"); });
editor2.selection.on("changeCursor", function () { updateDisplay(editor2, "output"); });

function updateDisplay(editor, prefix) {
    var content = editor.getValue().trim();
    var size = content.length;
    var $sz = $("#" + prefix + "TextSize");
    var $lc = $("#" + prefix + "AceLineColumn");

    $sz.html(size === 0 ? "Size: 0 Byte" :
        size < 1024 ? "Size: " + size + " Bytes" :
            "Size: " + (size / 1024).toFixed(2) + " KB");

    var cursor = editor.selection.getCursor();
    var maxCol = 0, lines = editor.session.getLength();
    for (var i = 0; i < lines; i++) maxCol = Math.max(maxCol, editor.session.getLine(i).length);
    $lc.html("Ln: " + (cursor.row + 1) + "; Col: " + (cursor.column + 1) + "; Max Col: " + maxCol);
}

["copyeditor1", "copyeditor2"].forEach(function (btnId) {
    var ed = btnId === "copyeditor1" ? editor1 : editor2;
    new ClipboardJS('#' + btnId, {
        text: function () { return ed.getValue().trim(); }
    }).on('success', function (e) {
        ed.execCommand('selectAll');
        showSuccessMessage("已复制");
        e.clearSelection();
    }).on('error', function (e) {
        e.clearSelection();
        showErrorMessage(ed.getValue().trim() === '' ? '内容为空' : '复制出错' + e.action, true);
    });
});

$(document).on("keydown", function (e) {
    if (e.key !== "F11") return;
    e.preventDefault();
    var active = editor1.isFocused() ? editor1 : editor2.isFocused() ? editor2 : null;
    if (!active) return;
    loadScripts("https://cdn.jsdelivr.net/npm/screenfull@6.0.2/index.min.js").then(function () {
        if (screenfull.isEnabled) screenfull.toggle(active.container);
    });
});

var _savedHeight = {};

function addFullScreen(mode) {
    var divId = mode === 'input' ? 'inputDiv' : 'outputDiv',
        edId = mode === 'input' ? 'editor1' : 'editor2',
        fsBtn = mode === 'input' ? 'inputFullScreen' : 'outputFullScreen',
        clBtn = mode === 'input' ? 'inputCloseScreen' : 'outputCloseScreen',
        ed = mode === 'input' ? editor1 : editor2;

    _savedHeight[mode] = $('#' + edId).height();
    $('#' + divId).addClass('fullScreen');
    $('#' + fsBtn).hide();
    $('#' + clBtn).show();
    ed.focus();
    $('#' + edId).css('height', 'calc(100% - 65px)');
    $('body').css({ overflow: 'hidden', position: 'fixed' });
}

function removeFullScreen(mode) {
    var divId = mode === 'input' ? 'inputDiv' : 'outputDiv',
        edId = mode === 'input' ? 'editor1' : 'editor2',
        fsBtn = mode === 'input' ? 'inputFullScreen' : 'outputFullScreen',
        clBtn = mode === 'input' ? 'inputCloseScreen' : 'outputCloseScreen',
        ed = mode === 'input' ? editor1 : editor2;

    $('#' + divId).removeClass('fullScreen');
    $('#' + fsBtn).show();
    $('#' + clBtn).hide();
    ed.focus();
    $('#' + edId).css('height', _savedHeight[mode] || '60vh');
    $('body').css({ overflow: '', position: '' });
}

function downloadFile(event) {
    event.preventDefault();
    var content = editor2.getValue().trim();
    if (!content) { showErrorMessage('内容为空', true); return; }
    loadScripts("/luci-static/tinynote/FileSaver.min.js").then(function () {
        saveAs(new Blob([content], { type: "text/plain; charset=utf-8" }), "data.txt");
    });
}

function clearAll(event, a) {
    event.preventDefault();
    if (a) { a.setValue(''); }
    else { editor1.setValue(''); editor2.setValue(''); }
}

function changeToFileContent(input) {
    var file = input.files[0];
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function (e) {
        if (editor1) editor1.setValue(e.target.result);
        input.value = "";
    };
    reader.readAsText(file, "UTF-8");
}

function getContent(editor) {
    var time = timeStart();
    var content = (editor || editor1).getValue().trim();
    if (!content) { showErrorMessage('内容为空', true); return false; }
    return { content: content, time: time };
}

var loadedScripts = new Set();

function loadScripts(scripts) {
    scripts = typeof scripts === 'string' ? [scripts] : scripts;
    return Promise.all(scripts.map(function (src) {
        if (loadedScripts.has(src)) return Promise.resolve();
        return new Promise(function (resolve, reject) {
            $.getScript(src).done(function () { loadedScripts.add(src); resolve(); }).fail(reject);
        });
    }));
}

function timeStart() { return window.performance.now(); }
function timeEnd(start) { return (window.performance.now() - start).toFixed(3); }

function calculateTabSize() {
    var v = parseInt($('#indent_size').val(), 10);
    return v === 1 ? '\t' : v;
}

function createShiftArr(indent_size) {
    return typeof indent_size !== 'number' ? '\t' : ' '.repeat(indent_size);
}

function Progress(action) {
    $('.progress.is-success.is-small')[action]();
}

function showSuccessMessage(message, isRed) {
    var bg = isRed ? 'red' : '#3488ce';
    $(".field.success")
        .html('<div class="button is-fullwidth alert-message" style="background:' + bg + ';font-size:14px;">' + message + '</div>')
        .show().delay(3000).fadeOut();
}

function state(time) {
    $(".field.state")
        .html('<div class="button is-fullwidth alert-message" style="color:black;font-size:14px;">用时: ' + timeEnd(time) + 'ms</div>')
        .show().delay(3000).fadeOut();
}

function showErrorMessage(message, a) {
    if (a !== undefined) { showSuccessMessage(message, true); return; }
    clearTimeout(window.hideTimer);
    $(".columns.is-centered").html(
        '<div class="notification alert-message" style="color:black;border:0;background:#f8d7da;">' +
        '<p class="subtitle" style="color:red;">语法错误：</p><p>' + message + '</p>' +
        '<button class="is-medium delete"></button></div>'
    ).fadeIn();
    $(".delete").on("click", function (e) {
        e.preventDefault();
        $(".columns.is-centered").fadeOut();
    });
    var mouseEntered = false;
    $(".columns.is-centered").on({
        mouseenter: function () { mouseEntered = true; clearTimeout(window.hideTimer); },
        mouseleave: function () {
            window.hideTimer = setTimeout(function () {
                if (!mouseEntered) $(".columns.is-centered").fadeOut();
            }, 5000);
        }
    }).trigger('mouseleave');
}

var TAB_MODE_MAP = {
    'JS': 'javascript', 'HTML': 'html', 'CSS': 'css',
    'JSON': 'json', 'YAML': 'yaml', 'Lua': 'lua', 'SH': 'sh'
};

function watchTabChange() {
    var tabContents = { JS: '', HTML: '', CSS: '', JSON: '', YAML: '', Lua: '', SH: '' };
    var $tabMenu = $('.cbi-tabmenu');
    if (!$tabMenu.length) return;

    var getActive = function () { return $tabMenu.find('li.cbi-tab').first().attr('data-tab') || ''; };
    var lastTab = getActive();

    var switchTab = function (from, to) {
        if (from) tabContents[from] = editor1.getValue();
        var mode = TAB_MODE_MAP[to];
        if (mode) {
            editor1.session.setMode('ace/mode/' + mode);
            editor2.session.setMode('ace/mode/' + mode);
        }
        editor1.setValue(tabContents[to] || '', -1);
        editor2.setValue('', -1);
    };

    if (lastTab) switchTab(null, lastTab);
    $tabMenu.on('click', 'li[data-tab]', function () {
        setTimeout(function () {
            var cur = getActive();
            if (cur && cur !== lastTab) { switchTab(lastTab, cur); lastTab = cur; }
        }, 10);
    });
}

function FormatSH(a) {
    const res = getContent();
    if (!res?.content) {
        return showErrorMessage("没有内容", true);
    }
    if (a !== 'format') return;
    output = formatShCode(res.content, indent_size);
    editor2.setValue(output || '没有返回值');
    editor1.session.setMode("ace/mode/sh");
    editor2.session.setMode("ace/mode/sh");
    state(res.time);
}

function JsCompression(a) {
    const res = getContent();
    if (!res?.content) {
        return showErrorMessage("没有内容", true);
    }
    loadScripts(["/luci-static/tinynote/format.js", "/luci-static/tinynote/beautifier.js"])
        .then(function () {
            if (a === "minify") output = new Packer().minify(res.content);
            else if (a === "pack") output = new Packer().pack(res.content, true, true);
            else if (a === "beautify") output = beautifier.js(res.content, {
                indent_size, indent_char,
                jslint_happy: true, wrap_line_length: 0, templating: ["auto"],
                end_with_newline: true, max_preserve_newlines: 1,
                space_in_empty_paren: true, operator_position: "before-newline",
                indent_with_tabs: indent_size === '\t'
            });
            editor1.session.setMode("ace/mode/javascript");
            editor2.session.setMode("ace/mode/javascript");
            editor2.setValue(output || '没有返回值');
            state(res.time);
        });
}

function examineJavaScript() {
    const res = getContent();
    if (!res?.content) {
        return showErrorMessage("没有内容", true);
    }
    editor1.session.setMode("ace/mode/javascript");
    loadScripts("/luci-static/tinynote/jshint.min.js").then(function () {
        if (JSHINT(res.content, { asi: true, esversion: 8 })) {
            showSuccessMessage("语法通过");
        } else {
            var msg = "";
            JSHINT.errors.forEach(function (e) {
                var ev = e.evidence ? '"<b style="color:red;">' + e.evidence + '</b>"，' : '';
                msg += '在第 ' + e.line + ' 行，第 ' + e.character + ' 列，' + ev +
                    '错误代码：' + e.code + ' :' + getErrorMessage(e.code) + '<br>';
            });
            showErrorMessage(msg);
        }
        state(res.time);
    });
}

function CSSFormat(a) {
    const res = getContent();
    if (!res?.content) {
        return showErrorMessage("没有内容", true);
    }
    loadScripts(["/luci-static/tinynote/vkbeautify.js", "/luci-static/tinynote/beautifier.js"])
        .then(function () {
            if (a === "format") output = beautifier.css(res.content, {
                indent_size, indent_char, end_with_newline: true,
                preserve_newlines: false, selector_separator_newline: true,
                indent_with_tabs: indent_size === '\t'
            });
            else if (a === "min") output = vkbeautify.cssmin(res.content);
            else if (a === "pack") output = vkbeautify.csspack(res.content);
            editor1.session.setMode("ace/mode/css");
            editor2.session.setMode("ace/mode/css");
            editor2.setValue(output || '没有返回值');
            state(res.time);
        });
}

function formatLua(a) {
    const res = getContent();
    if (!res?.content) {
        return showErrorMessage("没有内容", true);
    }
    loadScripts(["/luci-static/tinynote/luaparse.js", "/luci-static/tinynote/lua-fmt-lib.js", "/luci-static/tinynote/luamin.min.js"])
        .then(function () {
            try {
                editor1.session.setMode("ace/mode/lua");
                if (a === 'examine') {
                    luaparse.parse(res.content);
                    showSuccessMessage("语法通过");
                } else {
                    output = a === undefined
                        ? beautifyLuaCode(res.content, createShiftArr(indent_size))
                        : luamin.minify(res.content);
                    editor2.session.setMode("ace/mode/lua");
                    editor2.setValue(output || '没有返回值');
                }
                state(res.time);
            } catch (e) { showErrorMessage(e.message); }
        })
        .catch(function () { showErrorMessage("加载错误", true); });
}

function jsonFormat(a) {
    const res = getContent();
    if (!res?.content) {
        return showErrorMessage("没有内容", true);
    }
    loadScripts(["/luci-static/tinynote/vkbeautify.js", "/luci-static/tinynote/jsonlint.min.js"])
        .then(function () {
            editor1.session.setMode("ace/mode/json");
            try {
                if (a === 'min') output = vkbeautify.jsonmin(res.content);
                else if (a === 'format') output = vkbeautify.json(res.content, indent_size);
                else if (a === 'safeLoad') { jsonlint.parse(res.content); showSuccessMessage("语法通过"); }
                if (a !== 'safeLoad') { editor2.session.setMode("ace/mode/json"); editor2.setValue(output || '没有返回值'); }
                state(res.time);
            } catch (e) { showErrorMessage(e.message); }
        })
        .catch(function () { showErrorMessage("加载错误", true); });
}

function FormatHTML(a) {
    const res = getContent();
    if (!res?.content) {
        return showErrorMessage("没有内容", true);
    }

    loadScripts(["/luci-static/tinynote/vkbeautify.js", "/luci-static/tinynote/beautifier.js"])
    .then(function () {
        try {
            editor1.session.setMode("ace/mode/html");
            editor2.session.setMode("ace/mode/html");

            var output = "";
            if (a === "format") {
                output = beautifier.html(res.content, {
                    indent_size, indent_char, indent_with_tabs: false, templating: ["auto"]
                });
            } 
            else if (a === "min") {
                output = vkbeautify.htmlmin
                    ? vkbeautify.htmlmin(res.content)
                    : vkbeautify.xmlmin(res.content);
            }

            editor2.setValue(output || "没有返回值");
            state(res.time);

        } catch (e) {
            showErrorMessage(e.message, true);
        }
    })
    .catch(function () {
        showErrorMessage("加载错误", true);
    });
}

function FormatYAML(a) {
    const res = getContent();
    if (!res?.content) {
        return showErrorMessage("没有内容", true);
    }
    loadScripts(["/luci-static/tinynote/vkbeautify.js", "/luci-static/tinynote/js-yaml.min.js"])
        .then(function () {
            try {
                editor1.session.setMode("ace/mode/yaml");
                editor2.session.setMode("ace/mode/yaml");
                if (a === 'json') { editor2.session.setMode("ace/mode/json"); output = vkbeautify.json(jsyaml.load(res.content), indent_size); }
                else if (a === 'format') output = jsyaml.dump(jsyaml.load(res.content), { indent: indent_size, lineWidth: -1 });
                else if (a === 'yaml') { editor1.session.setMode("ace/mode/json"); output = jsyaml.dump(JSON.parse(res.content), { indent: indent_size }); }
                else if (a === 'safeLoad') { if (jsyaml.load(res.content)) showSuccessMessage("语法通过"); }
                if (a !== 'safeLoad') editor2.setValue(output || '没有返回值');
                state(res.time);
            } catch (e) { showErrorMessage(e.message); }
        })
        .catch(function () { showErrorMessage("加载错误", true); });
}

function yamlToxml() {
    var res = getContent(); if (!res) return;
    loadScripts(["/luci-static/tinynote/ObjTree.min.js", "/luci-static/tinynote/vkbeautify.js", "/luci-static/tinynote/js-yaml.min.js"])
        .then(function () {
			var data = jsyaml.load(res.content);
			var xml = new XML.ObjTree().writeXML({ root: data });
			xml = vkbeautify.xml(xml);
			editor2.session.setMode("ace/mode/xml");
			editor2.setValue(xml || "没有返回值");
			state(res.time);
        })
        .catch(function () { showErrorMessage("加载错误", true); });
}

function jsonTocsv() {
    const res = getContent();
    if (!res?.content) {
        return showErrorMessage("没有内容", true);
    }

    loadScripts("/luci-static/tinynote/tocsv.js")
		.then(() => {
            const data = JSON.parse(res.content);
            if (!Array.isArray(data)) {
                throw new Error("JSON 必须是数组");
            }

            editor1.session.setMode("ace/mode/json");
            editor2.session.setMode("ace/mode/csv");
            editor2.setValue(jsonToCsv(data, ",", true, false, false) || "没有返回值");
            state(res.time);
        })
        .catch(e => showErrorMessage("CSV 转换失败：" + e.message, true));
}

function jsonToXML() {
    var res = getContent();
    if (!res || !res.content) {
        return showErrorMessage("没有内容", true);
    }

    loadScripts(["/luci-static/tinynote/vkbeautify.js", '/luci-static/tinynote/ObjTree.min.js'])
    .then(function () {
        try {
            var data = JSON.parse(res.content);
            var xml = new XML.ObjTree().writeXML({
                root: data
            });

            xml = vkbeautify.xml(xml);
            editor1.session.setMode("ace/mode/json");
            editor2.session.setMode("ace/mode/xml");
            editor2.setValue(xml || "没有返回值");
            state(res.time);

        } catch (e) {
            showErrorMessage("JSON 转 XML 失败：" + e.message, true);
        }
    })
    .catch(function () {
        showErrorMessage("加载错误", true);
    });
}

class Stack {
    constructor() { this.items = []; }
    push(item) { this.items.push(item); }
    pop() { return this.items.length > 0 ? this.items.pop() : null; }
    peek() { return this.items.length > 0 ? this.items[this.items.length - 1] : null; }
    isEmpty() { return this.items.length === 0; }
    size() { return this.items.length; }
    clear() { this.items.length = 0; }
    popUntil(target) { while (this.items.length > 0 && this.pop() !== target); }
}

function formatShCode(content, indentSize) {
    if (typeof content !== 'string') return '';

    function ind(level) {
        if (typeof indentSize !== 'number' || isNaN(indentSize)) return '\t'.repeat(level);
        return ' '.repeat(indentSize * level);
    }

    var lines = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n'),
        out = '',
        level = 0,
        inHeredoc = false,
        heredocEnd = '',
        heredocStrip = false,
        blockStack = [];

    var rHeredocStart = /<<(-?)\s*['"`]?(\w+)['"`]?/,
        rFunction = /^\s*(?:function\s+)?(\w+)\s*\(\s*\)\s*\{?\s*(?:#.*)?$/,
        rCaseStart = /^case\b/,
        rCaseIn = /\bin\s*$/,
        rCasePattern = /^(?:\(?.+\)?)\)\s*(?:#.*)?$/,
        rCaseDblSemi = /^;;/,
        rCaseFallthru = /^;[;&]/,
        rIfStart = /^if\b/,
        rElifElse = /^(?:elif|else)\b/,
        rThen = /\bthen\s*(?:#.*)?$/,
        rFi = /^fi\b/,
        rLoopStart = /^(?:while|until|for|select)\b/,
        rDo = /\bdo\s*(?:#.*)?$/,
        rDone = /^done\b/,
        rEsac = /^esac\b/,
        rOpenBrace = /\{\s*(?:#.*)?$/,
        rCloseBrace = /^\}/,
        rSubshellOpen = /\(\s*(?:#.*)?$/,
        rSubshellClose = /^\)/;

    function stripInlineComment(raw) {
        if (/^#!/.test(raw.trim())) return raw;
        var result = '', q = '', i = 0;
        while (i < raw.length) {
            var ch = raw[i];
            if (q) {
                if (ch === '\\' && q !== "'") { result += ch + (raw[i + 1] || ''); i += 2; continue; }
                if (ch === q) q = '';
                result += ch;
            } else {
                if (ch === '"' || ch === "'" || ch === '`') { q = ch; result += ch; }
                else if (ch === '#') break;
                else result += ch;
            }
            i++;
        }
        return result.trimEnd();
    }

    function peek() { return blockStack[blockStack.length - 1]; }

    for (var li = 0; li < lines.length; li++) {
        var raw = lines[li];

        if (inHeredoc) {
            var check = heredocStrip ? raw.replace(/^\t+/, '') : raw;
            if (check === heredocEnd) {
                inHeredoc = false;
                out += (heredocStrip ? ind(level) : '') + check + '\n';
            } else {
                out += raw + '\n';
            }
            continue;
        }

        var line = stripInlineComment(raw).trim();
        if (!line) { if (out.slice(-2) !== '\n\n') out += '\n'; continue; }

        if (/^#/.test(line) && !/^#!/.test(line)) {
            out += ind(level) + line + '\n';
            continue;
        }

        var hm = rHeredocStart.exec(line);
        if (hm) { heredocStrip = hm[1] === '-'; heredocEnd = hm[2]; inHeredoc = true; }

        if (rFi.test(line)) {
            while (peek() === 'then' || peek() === 'else') blockStack.pop();
            if (peek() === 'if') blockStack.pop();
            level = Math.max(0, level - 1);
        } else if (rEsac.test(line)) {
            while (peek() === 'case_branch') { blockStack.pop(); level = Math.max(0, level - 1); }
            if (peek() === 'case') blockStack.pop();
            level = Math.max(0, level - 1);
        } else if (rDone.test(line)) {
            while (peek() === 'do') blockStack.pop();
            if (peek() === 'loop') blockStack.pop();
            level = Math.max(0, level - 1);
        } else if (rCloseBrace.test(line) && (peek() === 'func' || peek() === 'brace')) {
            blockStack.pop();
            level = Math.max(0, level - 1);
        } else if (rSubshellClose.test(line) && peek() === 'subshell') {
            blockStack.pop();
            level = Math.max(0, level - 1);
        } else if (rElifElse.test(line)) {
            level = Math.max(0, level - 1);
        } else if ((rCaseDblSemi.test(line) || rCaseFallthru.test(line)) && peek() === 'case_branch') {
            blockStack.pop();
            level = Math.max(0, level - 1);
        }

        out += ind(level) + line + '\n';

        if (rIfStart.test(line)) {
            blockStack.push('if');
            if (rThen.test(line)) { blockStack.push('then'); level++; }
        } else if (rElifElse.test(line)) {
            if (rThen.test(line)) { blockStack.push('then'); level++; }
            else if (/^else\b/.test(line)) { blockStack.push('else'); level++; }
        } else if (rThen.test(line) && !rIfStart.test(line) && !rElifElse.test(line)) {
            blockStack.push('then'); level++;
        } else if (rCaseStart.test(line)) {
            blockStack.push('case');
            if (rCaseIn.test(line)) level++;
        } else if (rCaseIn.test(line) && !rCaseStart.test(line) && peek() === 'case') {
            level++;
        } else if (peek() === 'case' && rCasePattern.test(line) && !rCaseDblSemi.test(line)) {
            blockStack.push('case_branch'); level++;
        } else if (rLoopStart.test(line)) {
            blockStack.push('loop');
            if (rDo.test(line)) { blockStack.push('do'); level++; }
        } else if (rDo.test(line) && !rLoopStart.test(line)) {
            blockStack.push('do'); level++;
        } else if (rFunction.test(line)) {
            blockStack.push('func');
            if (rOpenBrace.test(line)) level++;
        } else if (rOpenBrace.test(line) && peek() !== 'func') {
            blockStack.push('brace'); level++;
        } else if (rSubshellOpen.test(line)) {
            blockStack.push('subshell'); level++;
        }
    }

    return out.replace(/\n{3,}/g, '\n\n').replace(/\n+$/, '')+ '\n';
}

function getExampleLua() {
    var output = `function blahblahblah(x)\n  --local table = {asd = 123, x = 0.34,  }\n  if x ~= 3 then\n    print(x)\n  elseif x == "string" then\n    my_custom_function(0x34)\n  else\n    unknown_function("some string")\n  end\n  --single line comment\nend\n\nfunction blablabla3()\n  for k, v in ipairs(table) do\n    --abcde..\n    y = [=[\n  x=[[\n      x is a multi line string\n   ]]\n  but its definition is iside a highest level string!\n  ]=]\n    print("  ")\n\n    s = math.sin(x)\n  end\nend`;
    editor1.session.setMode("ace/mode/lua");
    editor1.setValue(output);
}

function getExampleCsv() {
    return 'id,name,amount,Remark\n1,"Johnson, Smith, and Jones Co.",345.33,Pays on time\n2,"Sam ""Mad Dog"" Smith",993.44,\n3,"Barney & Company",0,"Great to work with\nand always pays with cash."\n4,Johnson\'s Automotive,2344,\n';
}

function getExampleSH() {
    var output = 'cat >>.config <<-EOF\nCONFIG_KERNEL_BUILD_USER="win3gp"\nCONFIG_KERNEL_BUILD_DOMAIN="OpenWrt"\n## CONFIG_PACKAGE_luci-app-ssr-plus is not set\n# CONFIG_PACKAGE_luci-app-zerotier is not set\nEOF\ncase "$1" in\n1)\necho "1"\n;;\n2)\ncase "$2" in\na)\necho "2a"\n;;\nb)\ncase "$3" in\nx)\necho "2bx"\n;;\ny)\necho "2by"\n;;\nesac\n;;\nesac\n;;\n*)\necho "default"\n;;\nesac\ncase "$0" in\n*halt)\nmessage="The system will be halted immediately."\ncase `/bin/uname -m` in\ni?86)\ncommand="halt"\nif test -e /proc/apm -o -e /proc/acpi -o -e /proc/sys/acpi ; then\ncommand="halt -p"\nelse\nread cmdline < /proc/cmdline\ncase "$cmdline" in\n*apm=smp-power-off*|*apm=power-off*)\ncommand="halt -p"\n;;\nesac\nfi\n;;\n*)\ncommand="halt -p"\n;;\nesac\n;;\n*reboot)\nmessage="Please stand by while rebooting the system..."\ncommand="reboot"\n;;\n*)\necho "$0: call me as \'halt\' or \'reboot\' please!"\nexit 1\n;;\nesac\nif [[ $a -eq 1 ]]; then\necho "a is 1"\nelif [[ $a -eq 2 ]]; then\nif [[ $b -eq 3 ]]; then\necho "a is 2 and b is 3"\nelif [[ $b -eq 4 ]]; then\necho "a is 2 and b is 4"\nelse\necho "a is 2 and b is not 3 or 4"\nfi\nelse\necho "a is not 1 or 2"\nfi\nreload_service() {\nstop\nwhile running "${NAME}.main"; do\nsleep 1\ndone\nstart\n}';
    editor1.session.setMode("ace/mode/sh");
    editor1.setValue(output);
}

function getExampleXml() {
    return '<?xml version="1.0"?>\n<ROWSET>\n<ROW>\n<id>1</id>\n<name>Johnson, Smith, and Jones Co.</name>\n<amount>345.33</amount>\n<Remark>Pays on time</Remark>\n</ROW>\n<ROW>\n<id>2</id>\n<name>Sam &quot;Mad Dog&quot; Smith</name>\n<amount>993.44</amount>\n<Remark></Remark>\n</ROW>\n<ROW>\n<id>3</id>\n<name>Barney &amp; Company</name>\n<amount>0</amount>\n<Remark>Great to work with\nand always pays with cash.</Remark>\n</ROW>\n<ROW>\n<id>4</id>\n<name>Johnson&apos;s Automotive</name>\n<amount>2344</amount>\n<Remark></Remark>\n</ROW>\n</ROWSET>'
}

function getExampleYaml() {
    var output = '-\n  id: 1\n  name: John Doe\n  age: 30\n  email: johndoe@example.com\n  hobbies:\n    -\n      name: Reading\n      duration: 5\n    -\n      name: Cooking\n      duration: 3\n-\n  id: 2\n  name: Jane Smith\n  age: 25\n  email: janesmith@example.com\n  hobbies:\n    -\n      name: Painting\n      duration: 7\n    -\n      name: Hiking\n      duration: 4\n-\n  id: 3\n  name: Bob Johnson\n  age: 40\n  email: bobjohnson@example.com\n  hobbies:\n    -\n      name: Photography\n      duration: 6\n    -\n      name: Dancing\n      duration: 2\n';
    editor1.session.setMode("ace/mode/yaml");
    editor1.setValue(output);
}

function getExampleJavaScript() {
    var output = 'var name = "John";\nconsole.log("Hello, " + name + "!");\n\nvar numbers = [1, 2, 3, 4, 5];\nfor (var i = 0; i < numbers.length; i++) {\n    console.log(numbers[i]);\n}\n\nvar person = {\n    name: "John",\n    age: 30,\n    city: "New York"\n};\nconsole.log(person.name);\n';
    editor1.session.setMode("ace/mode/javascript");
    editor1.setValue(output);
}

function getExampleCSS() {
    var output = 'body {background-color: #e9ecef;font-family: Arial, sans-serif;}h1 {color: #333;font-size: 24px;}.container {width: 800px;margin: 0 auto;padding: 20px;}@media(min-width: 768px) {.container-md,.container-sm, .container {max-width: 720px;}}';
    editor1.session.setMode("ace/mode/css");
    editor1.setValue(output);
}

function getExampleHTML() {
    var output = '<!DOCTYPE html>\n<html><head>\n <title>Sample Page</title>\n <link rel="stylesheet" type="text/css" href="styles.css">\n</head>\n<body>\n <header>\n <h1>Welcome to My Website</h1>\n </header>\n <div class="container">\n <p>This is a sample paragraph.</p>\n <a href="#">Click here</a>\n    </div>\n <script src="scripts.js"></script></body>\n</html>\n';
    editor1.session.setMode("ace/mode/html");
    editor1.setValue(output);
}

function getExampleJson(e) {
    var output = ['[\n  {\n    "id":1,    "name":"Johnson, Smith, and Jones Co.",\n    "amount":345.33,    "Remark":"Pays on time"\n  },\n  {\n    "id":2,    "name":"Sam \\"Mad Dog\\" Smith",\n    "amount":993.44,    "Remark":""\n  },\n  {\n    "id":3,    "name":"Barney & Company",\n    "amount":0,    "Remark":"Great to work with\\nand always pays with cash."\n  },\n  {\n    "id":4,    "name":"Johnson\'s Automotive",\n    "amount":2344,    "Remark":""\n  }\n]\n', '{ "data" : [\n  {    "id":1,    "name":"Johnson, Smith, and Jones Co."  },\n  {    "id":2,    "name":"Sam \\"Mad Dog\\" Smith"  },\n  {    "id":3,    "name":"Barney & Company"  },\n  {    "id":4,    "name":"Johnson\'s Automotive"  }\n] }\n', '{ "race" : \n { "entries" : [\n  {    "id":11,    "name":"Johnson, Smith, and Jones Co."  },\n  {    "id":22,    "name":"Sam \\"Mad Dog\\" Smith"  },\n  {    "id":33,    "name":"Barney & Company"  },\n  {    "id":44,    "name":"Johnson\'s Automotive"  }\n] }\n}\n', '{\n    "id":1,    "name":"Johnson, Smith, and Jones Co.",    "amount":345.33,    "Remark":"Pays on time"\n}\n', '[\n    [      1,      "Johnson, Smith, and Jones Co.",      345.33    ],\n    [      99,      "Acme Food Inc.",      2993.55    ]\n]'][e = (e || 1) - 1];
    editor1.session.setMode("ace/mode/json");
    editor1.setValue(output);
}

function getErrorMessage(code) {
    var errorCode = {
        // JSHint options
        E001: "不好的 {a} 选项: '{b}'。",
        E002: "不好的选项值。",
        // JSHint input
        E003: "预期为 JSON 值。",
        E004: "输入既不是字符串，也不是字符串数组。",
        E005: "输入为空。",
        E006: "意外的程序提前结束。",
        // 严格模式
        E007: "缺少 \"use strict\" 声明。",
        E008: "严格模式违例。",
        E009: "全局范围内不能使用 'validthis' 选项。",
        E010: "在严格模式下不允许使用 'with'。",
        // 常量
        E011: "'{a}' 已经被声明。",
        E012: "常量 '{a}' 缺少初始化器。",
        E013: "试图覆盖常量 '{a}'。",
        // 正则表达式
        E014: "正则表达式文本可能与 '/=' 混淆。",
        E015: "未关闭的正则表达式。",
        E016: "无效的正则表达式。",
        // 标记
        E017: "未闭合的注释。",
        E018: "未开始的注释。",
        E019: "不匹配的 '{a}'。",
        E020: "期望 '{a}' 与行 {c} 的 '{b}' 匹配，但实际看到了 '{d}'。",
        E021: "期望 '{a}'，实际看到了 '{b}'。",
        E022: "换行错误 '{a}'。",
        E023: "缺少 '{a}'。",
        E024: "意外的 '{a}'。",
        E025: "在 case 子句上缺少 ':'。",
        E026: "缺少 '}' 来匹配行 {a} 的 '{'。",
        E027: "缺少 ']' 来匹配行 {a} 的 '['。",
        E028: "非法逗号。",
        E029: "未闭合的字符串。",
        // 其他
        E030: "期望标识符，实际看到了 '{a}'。",
        E031: "错误的赋值。",
        E032: "期望小整数或 'false'，实际看到了 '{a}'。",
        E033: "期望操作符，实际看到了 '{a}'。",
        E034: "get/set 是 ES5 特性。",
        E035: "缺少属性名。",
        E036: "预期看到语句，实际看到了代码块。",
        E037: null,
        E038: null,
        E039: "函数声明不可调用。请用括号包裹整个函数调用。",
        E040: "每个值应该有自己的 case 标签。",
        E041: "不可恢复的语法错误。",
        E042: "停止。",
        E043: "错误太多。",
        E044: null,
        E045: "无效的 for each 循环。",
        E046: "yield 表达式只能出现在生成器函数中。",
        E047: null,
        E048: "{a} 声明不直接在块内部。",
        E049: "不可以将 {a} 命名为 '{b}'。",
        E050: "Mozilla 要求在此处为 yield 表达式加上括号。",
        E051: null,
        E052: "未闭合的模板字面量。",
        E053: "{a} 声明仅允许在模块范围的顶层。",
        E054: "类属性必须是方法。期望 '('，但实际看到 '{a}'。",
        E055: "'{a}' 选项不可在任何可执行代码之后设置。",
        E056: "'{a}' 在声明前被使用，对于 '{b}' 变量是非法的。",
        E057: "无效的元属性: '{a}.{b}'。",
        E058: "缺少分号。",
        E059: "'instanceof' 的第二个操作数不能是不可调用的值。",
        E060: "'yield' 表达式的位置无效（考虑用括号包裹起来）。",
        E061: "Rest 参数不支持默认值。",
        E062: "super 属性只能在方法体内部使用。",
        E063: "super 调用只能在类方法体内部使用。",
        E064: "在非严格模式下定义的具有非简单参数列表的函数可能不启用严格模式。",
        E065: "异步迭代仅适用于 for-of 循环。",
        E066: "格式错误的数字字面量: '{a}'。",
        E067: "小数点前带有前导零在严格模式下不允许。",
        E068: "严格模式下不允许带有前导零的十进制。",
        E069: "重复导出绑定: '{a}'。",
        E070: "import.meta 仅可在模块代码中使用。",
        W001: "'hasOwnProperty' 是一个非常糟糕的名称。",
        W002: "在 IE 8 及更早版本中，'{a}' 的值可能被覆盖。",
        W003: "'{a}' 在定义前被使用。",
        W004: "'{a}' 已经被定义。",
        W005: "数字后面的点可能会被误解为小数点。",
        W006: "令人困惑的负号。",
        W007: "令人困惑的加号。",
        W008: "前导小数点可能会被误解为点号: '{a}'。",
        W009: "首选使用数组文本符号 []。",
        W010: "首选使用对象文本符号 {}。",
        W011: null,
        W012: null,
        W013: null,
        W014: "在 '{a}' 前的误导性换行；读者可能会将其解释为表达式边界。",
        W015: null,
        W016: "意外使用 '{a}'。",
        W017: "错误的操作数。",
        W018: "令人困惑的 '{a}' 使用。",
        W019: "使用 isNaN 函数与 NaN 进行比较。",
        W020: "只读。",
        W021: "重新赋值 '{a}'，它是一个 {b}。使用 'var' 或 'let' 声明可能会变化的绑定。",
        W022: "不要对异常参数进行赋值。",
        W023: null,
        W024: "期望标识符，实际看到了 '{a}'（保留字）。",
        W025: "函数声明缺少名称。",
        W026: "内部函数应该列在外部函数的顶部。",
        W027: "在 '{b}' 之后的 '{a}' 不可达。",
        W028: "{b} 语句上的标签 '{a}'。",
        W030: "期望赋值或函数调用，实际看到的是表达式。",
        W031: "不要为副作用而使用 'new'。",
        W032: "不必要的分号。",
        W033: "缺少分号。",
        W034: "不需要的指示符 \"{a}\"。",
        W035: "空块。",
        W036: "意外的 /*member '{a}'。",
        W037: "'{a}' 是一个语句标签。",
        W038: "'{a}' 超出作用域。",
        W039: null,
        W040: "如果以函数调用的形式执行严格模式函数，其 'this' 值将为 undefined。",
        W041: null,
        W042: "避免 EOL 转义。",
        W043: "EOL 转义错误。如有需要，请使用 multistr 选项。",
        W044: "错误或不必要的转义。",
        W045: "由数字字面量描述的值不能准确表示为数值: '{a}'。",
        W046: "不要使用额外的前导零 '{a}'。",
        W047: "尾随小数点可能会被误解为点号: '{a}'。",
        W048: "正则表达式中出现了意外的控制字符。",
        W049: "正则表达式中出现了意外的转义字符 '{a}'。",
        W050: "JavaScript URL。",
        W051: "不应该删除变量。",
        W052: "意外的 '{a}'。",
        W053: "不要将 {a} 用作构造函数。",
        W054: "Function 构造函数是 eval 的一种形式。",
        W055: "构造函数名称应该以大写字母开头。",
        W056: "错误的构造函数。",
        W057: "奇怪的构造方式。是否必须使用 'new'？",
        W058: "缺少 '()' 调用构造函数。",
        W059: "避免 arguments.{a}。",
        W060: "document.write 可能是一种形式的 eval。",
        W061: "eval 可能具有危害性。",
        W062: "将立即函数调用用括号包裹起来，以帮助读者理解表达式是函数的结果，而不是函数本身。",
        W063: "Math 不是一个函数。",
        W064: "调用构造函数时缺少 'new' 前缀。",
        W065: "缺少基数参数。",
        W066: "隐式的 eval。考虑传递一个函数而不是一个字符串。",
        W067: "不规范的函数调用。",
        W068: "不必要地在非 IIFE 函数文字中使用括号是不必要的。",
        W069: "['{a}'] 最好用点符号表示。",
        W070: "额外的逗号。（这会破坏较旧版本的 IE）",
        W071: "此函数有太多语句。({a})",
        W072: "此函数有太多参数。({a})",
        W073: "嵌套块太深。({a})",
        W074: "此函数的圈复杂度太高。({a})",
        W075: "重复的 {a} '{b}'。",
        W076: "在 get {b} 函数中不应该出现参数 '{a}'。",
        W077: "在 set {a} 函数中期望一个参数。",
        W078: "setter 被定义而没有 getter。",
        W079: "'{a}' 重新定义。",
        W080: "将 '{a}' 初始化为 'undefined' 是不必要的。",
        W081: null,
        W082: "函数声明不应该放在块中。使用函数表达式或将语句移到外部函数的顶部。",
        W083: "在循环中声明的内部函数引用外部作用域的变量可能会导致混乱的语义。({a})",
        W084: "期望条件表达式，实际看到的是赋值。",
        W085: "不要使用 'with'。",
        W086: "在 '{a}' 前期望 'break' 语句。",
        W087: "忘记 'debugger' 语句？",
        W088: "创建全局 'for' 变量。应该是 'for (var {a} ...'。",
        W089: "for in 循环的主体应该被包裹在 if 语句中，以过滤原型链中不需要的属性。",
        W090: "'{a}' 不是一个语句标签。",
        W091: null,
        W093: "你是不是想返回条件表达式，而不是一个赋值？",
        W094: "意外的逗号。",
        W095: "期望字符串，实际看到 {a}。",
        W096: "'{a}' 键可能会产生意外的结果。",
        W097: "使用 \"use strict\" 函数形式。",
        W098: "'{a}' 被定义但从未被使用。",
        W099: null,
        W100: null,
        W101: "行太长。",
        W102: null,
        W103: "'{a}' 属性已废弃。",
        W104: "'{a}' 在 ES{b} 中可用（使用 'esversion: {b}'）或 Mozilla JS 扩展（使用 moz）。",
        W105: null,
        W106: "标识符 '{a}' 不符合驼峰命名规则。",
        W107: "脚本 URL。",
        W108: "字符串必须使用双引号。",
        W109: "字符串必须使用单引号。",
        W110: "混合使用双引号和单引号。",
        W112: "未闭合的字符串。",
        W113: "字符串中包含控制字符: {a}。",
        W114: "避免 {a}。",
        W115: "严格模式下不允许八进制字面量。",
        W116: "期望 '{a}'，实际看到 '{b}'。",
        W117: "'{a}' 未定义。",
        W118: "'{a}' 仅在 Mozilla JavaScript 扩展中可用（使用 moz 选项）。",
        W119: "'{a}' 仅在 ES{b} 中可用（使用 'esversion: {b}'）。",
        W120: "你可能泄露了一个变量 ({a})。",
        W121: null,
        W122: "无效的 typeof 值 '{a}'。",
        W123: "'{a}' 已经在外部作用域中定义。",
        W124: "生成器函数应包含至少一个 yield 表达式。",
        W125: "此行包含不间断空格：http://jshint.com/docs/options/#nonbsp",
        W126: "不必要的分组运算符。",
        W127: "意外使用了逗号操作符。",
        W128: "空数组元素需要 elision=true。",
        W129: "'{a}' 在 JavaScript 将来的版本中被定义。为避免迁移问题，请使用其他变量名。",
        W130: "rest 元素后面的元素无效。",
        W131: "rest 参数后面的参数无效。",
        W132: "禁止使用 'var' 声明。请使用 'let' 或 'const'。",
        W133: "无效的 for-{a} 循环左侧: {b}。",
        W134: "'{a}' 选项仅在检查 ECMAScript {b} 代码时才可用。",
        W135: "{a} 可能不被非浏览器环境支持。",
        W136: "'{a}' 必须在函数范围内。",
        W137: "空解构：这是不必要的，可以删除。",
        W138: "默认参数之后不应该有常规参数。",
        W139: "不应将函数表达式用作 instanceof 的第二个操作数。",
        W140: "缺少逗号。",
        W141: "空 {a}：这是不必要的，可以被移除。",
        W142: "空 {a}：考虑替换为 `import '{b}';`。",
        W143: "对映射的参数对象的属性进行赋值可能导致形式参数的意外更改。",
        W144: "'{a}' 是一个非标准的语言特性。请使用 '{b}' 不稳定选项启用它。",
        W145: "多余的 'case' 子句。",
        W146: "不必要的 `await` 表达式。",
        W147: "正则表达式应包括 'u' 标志。",
        I001: "通过 'laxcomma' 选项可以关闭逗号警告。",
        I002: null,
        I003: "ES5 选项现在默认设置。",
    };
    if (errorCode[code]) {
        return errorCode[code];
    } else if (errorCode[code] === null) {
        return "为'null";
    } else {
        return "未知错误。";
    }
}
