
function renderAceEditor(id, model, only, theme = 'monokai', font_size, height) {
    var htmlCode = `
        <div class="aceEditorMenu">
            <a style="float:left;">
                <i class="is-size-6 is-family-primary">输入</i>
            </a>
            <div class="editortoolbar btn-group-sm">
                <a id="fileInput${id}" class="icon is-hidden-mobile" title="上传文件">
                    <i class="material-icons">publish</i>
                </a>
                <a class="icon" title="保存" onclick="cbi_submit(this, 'cbi.save')">
                    <i class="material-icons">save</i>
                </a>
                <a id="down${id}" class="icon" title="下载">
                    <i class="material-icons">cloud_download</i>
                </a>
                <a id="clear${id}" class="icon" title="清除">
                    <i class="material-icons">delete_outline</i>
                </a>
                <a id="copy${id}" class="icon" title="复制输入代码">
                    <i class="material-icons">content_copy</i>
                </a>
                <a id="${id}FullScreen" class="icon" onclick="addFullScreen('${id}');" title="全屏">
                    <i class="material-icons">open_in_full</i>
                </a>
                <a id="${id}CloseScreen" style="display:none" class="icon" onclick="removeFullScreen('${id}');" title="关闭全屏">
                    <i class="material-icons">close_fullscreen</i>
                </a>
            </div>
        </div>`;

    var statusBarHtml = `
        <div class="columns is-mobile m-0 aceStatusBar" id="StatusBar">
            <div class="column is-two-thirds p-0 pl-0 status-left" id="${id}AceLineColumn">Ln: 1 Col: 0; Max Col: 0</div>
            <div class="column is-one-thirds p-0 has-text-centered status-right" id="${id}TextSize">Size: 0 Byte</div>
        </div>`;

    var wrapperContent = `
        <div class="columns is-centered" style="display: none;"></div>
        <div class="field state" style="display: none;"></div>
        <div class="field success" style="display: none;"></div>`;

    $(`.cbi-value#cbi-luci-tinynote-${id}`)
        .prepend(htmlCode)
        .append(statusBarHtml)
        .addClass('column')
        .wrapInner($(`<div class='aceEditorBorder' id='ace${id}'></div>`))
        .before(wrapperContent);

    var $textarea = $('#' + id);
    var $editorContainer = $('<div>').css({
        height: height + 'px',
        width: 'auto',
    }).insertBefore($textarea.hide());

    var xid = id;
    var id = ace.edit($editorContainer[0]);
    id.getSession().setValue($textarea.val());
    id.setOptions({
        readOnly: only,
        mode: 'ace/mode/' + model,
        theme: "ace/theme/" + theme,
        fontSize: font_size + "px",
        fontFamily: "Consolas, monospace",
        printMarginColumn: -1,
        wrap: true,
        showPrintMargin: true,
    });

    id.on("input", function () {
        $textarea.val(id.getValue());
        updateDisplay(id, $(`#${xid}TextSize`), $(`#${xid}AceLineColumn`));
    });

    $(`#copy${xid}`).click(function () {
        setupClipboard(id, `copy${xid}`);
    });

    $(`#clear${xid}`).click(function () {
        clearValue(id);
    });

    $(`#down${xid}`).click(function () {
        downloadFile(id);
    });

    $(`#fileInput${xid}`).click(function () {
        var fileInput = $('<input type="file" class="file-input">').on('change', function (event) {
            changeToFileContent(event.target, id);
        });
        fileInput.click();
    });

    $(document).on("keydown", function (event) {
        if (event.key === "F11") {
            event.preventDefault();
            if (id) toggleFullScreen(id);
        }
    });
}

function changeToFileContent(input, id) {
    var file = input.files[0];
    if (!file) return;

    var reader = new FileReader();
    reader.readAsText(file, "UTF-8");
    reader.onload = function (event) {
        var fileContent = event.target.result;
        if (id) id.setValue(fileContent);
    };

    input.value = "";
}

function getContent(editor) {
    var content = $.trim((editor).getValue());
    if (content === '') {
        showErrorMessage('内容为空', true)
        return false;
    }
    return content;
}

function downloadFile(id) {
    var content = getContent(id);
    if (!content) return;
    loadScripts("/luci-static/tinynote/FileSaver.js")
        .then(function () {
            var blob = new Blob(["" + content], {
                type: "text/plain; charset=utf-8"
            });
            saveAs(blob, "data.txt");
        });
}

function updateDisplay(editor, sizeOutput, lineColumnOutput) {
    var content = $.trim(editor.getValue());
    if (!content) return;
    var size = content.length;
    sizeOutput.html("Size: " + (size < 1024 ? size + " Bytes" : (size / 1024).toFixed(2) + " KB"));
    var lineNumber = editor.session.getLength(),
        columnNumber = editor.selection.getCursor().column + 1,
        maxColumnCount = 0;
    for (var i = 0; i < lineNumber; i++) {
        maxColumnCount = Math.max(maxColumnCount, editor.session.getLine(i).length);
    }
    lineColumnOutput.html(`Ln: ${lineNumber}; Col: ${columnNumber}; Max Col: ${maxColumnCount}`);
}

function addFullScreen(id) {
    $(`#ace${id}.aceEditorBorder`).addClass('fullScreen');
    $(`#${id}FullScreen`).hide();
    $(`#${id}CloseScreen`).show();
    $('.ace_editor').css('height', 'calc(100% - 65px)');
    $('body').css({
        overflow: 'hidden',
        position: 'fixed'
    });
}

function removeFullScreen(id) {
    $(`#ace${id}.aceEditorBorder`).removeClass('fullScreen');
    $(`#${id}FullScreen`).show();
    $(`#${id}CloseScreen`).hide();
    $('.ace_editor').css('height', '60vh');
    $('body').css({
        overflow: '',
        position: ''
    });
}

function setupClipboard(id, buttonId) {
    return new ClipboardJS('#' + buttonId, {
        text: function () {
            var value = id.getValue().trim();
            if (value) return value;
        }
    }).on('success', function (e) {
        if (id) id.execCommand('selectAll');
        var alertCopyMessage = $('<div>').addClass('copy-message').text('内容已复制');
        $('body').append(alertCopyMessage);
        setTimeout(() => alertCopyMessage.remove(), 1000);
        e.clearSelection();
    }).on('error', function (e) {
        e.clearSelection();
        var errorMessage = '复制出错';
        if (id.getValue().trim() === '') {
            errorMessage = '内容为空';
        }
        var alertCopyMessage = $('<div>').addClass('copy-message').text(errorMessage);
        $('body').append(alertCopyMessage);
        setTimeout(() => alertCopyMessage.remove(), 3000); // 显示错误消息3秒后移除
    });
}

function clearValue(id) {
    event.preventDefault();
    if (id) {
        return id.setValue('');
    }
}

function showSuccessMessage(message, a) {
    var backgroundColor = "style='background:" + (a ? 'red' : '#3488ce') + ";'";
    $(".field.success").html('<div class="notification alert-message"' + backgroundColor + '>' + message + '</div>').show().delay(3000).fadeOut();
}

function state(time) {
    $(".field.state").html('<div class="button is-fullwidth alert-message" style="color:black;">用时: ' + timeEnd(time) + 'ms</div>').show().delay(3000).fadeOut();
}

function showErrorMessage(message, a) {
    if (a === undefined) {
        clearTimeout(window.hideTimer);
        $(".columns.is-centered").html('<div class="notification alert-message" style="color:black; border:0px; background:#f8d7da;"><p class="subtitle" style="color:red;">语法错误：</p><p>' + message + '</p><button class="is-medium delete"></button></div>').fadeIn();
        $(".delete").on("click", function (event) {
            event.preventDefault();
            $(".columns.is-centered").fadeOut();
        });
        var mouseEntered = false;
        $(".columns.is-centered").on({
            mouseenter: function () {
                mouseEntered = true;
                if (window.hideTimer) clearTimeout(window.hideTimer);
            },
            mouseleave: function () {
                window.hideTimer = setTimeout(function () {
                    if (!mouseEntered) $(".columns.is-centered").fadeOut();
                }, 5000);
            }
        }).trigger('mouseleave');
    } else {
        showSuccessMessage(message, true);
    }
}
var loadedScripts = [];

function loadScripts(scripts) {
    scripts = typeof scripts === 'string' ? [scripts] : scripts;
    var promises = scripts.map(function (script) {
        if (loadedScripts.indexOf(script) === -1) {
            return new Promise(function (resolve, reject) {
                $.getScript(script).done(function () {
                    loadedScripts.push(script);
                    resolve();
                }).fail(function (error) {
                    reject(error);
                });
            });
        } else {
            return Promise.resolve();
        }
    });
    return Promise.all(promises);
}

function toggleFullScreen(id) {
    loadScripts("/luci-static/tinynote/screenfull.js")
        .then(function () {
            if (screenfull.isEnabled) {
                if (id.isFocused()) {
                    screenfull.toggle(id.container);
                }
            }
        });
}
