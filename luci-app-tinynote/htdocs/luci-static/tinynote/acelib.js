var loadedScripts = new Set();

function renderAceEditor(id, model, only, theme = 'monokai', font_size, height, spacing) {
    var ic = {
        copy: '<svg viewBox="0 0 24 24" width="22" height="22"><path fill="currentColor" d="M19,21H8V7H19M19,5H8A2,2 0 0,0 6,7V21A2,2 0 0,0 8,23H19A2,2 0 0,0 21,21V7A2,2 0 0,0 19,5M16,1H4A2,2 0 0,0 2,3V17H4V3H16V1Z"/></svg>',
        save: '<svg viewBox="0 0 24 24" width="22" height="22"><path fill="currentColor" d="M15,9H5V5H15M12,19A3,3 0 0,1 9,16A3,3 0 0,1 12,13A3,3 0 0,1 15,16A3,3 0 0,1 12,19M17,3H5C3.89,3 3,3.9 3,5V19A2,2 0 0,0 5,21H19A2,2 0 0,0 21,19V7L17,3Z"/></svg>',
        wrap: '<svg viewBox="0 0 24 24" width="22" height="22"><path fill="currentColor" d="M4,6H20V8H4V6M4,11H17A3,3 0 0,1 20,14A3,3 0 0,1 17,17H15V19L12,16L15,13V15H17A1,1 0 0,0 18,14A1,1 0 0,0 17,13H4V11M4,18H10V20H4V18Z"/></svg>',
        delete: '<svg viewBox="0 0 24 24" width="22" height="22"><path fill="currentColor" d="M19,4H15.5L14.5,3H9.5L8.5,4H5V6H19M6,19A2,2 0 0,0 8,21H16A2,2 0 0,0 18,19V7H6V19Z"/></svg>',
        Upload: '<svg viewBox="0 0 24 24" width="22" height="22"><path fill="currentColor" d="M9,16V10H5L12,3L19,10H15V16H9M5,20V18H19V20H5Z"/></svg>',
        download: '<svg viewBox="0 0 24 24" width="22" height="22"><path fill="currentColor" d="M5,20H19V18H5M19,9H15V3H9V9H5L12,16L19,9Z"/></svg>',
        open_fullscreen: '<svg viewBox="0 0 24 24" width="22" height="22"><path fill="currentColor" d="M21,11V3H13L16.29,6.29L6.29,16.29L3,13V21H11L7.71,17.71L17.71,7.71L21,11Z"/></svg>',
        close_fullscreen: '<svg viewBox="0 0 24 24" width="22" height="22"><path fill="currentColor" d="M22,3.41L16.71,8.7L20,12H12V4L15.29,7.29L20.59,2L22,3.41M3.41,22L8.7,16.71L12,20V12H4L7.29,15.29L2,20.59L3.41,22Z"/></svg>'
    };

    $(`.cbi-value#cbi-luci-tinynote-${id}`)
        .prepend(`
            <div class="aceEditorMenu">
                <span class="has-text-left">
                    <i class="is-size-6 is-family-primary ">输入</i>
                </span>
                <div class="has-text-right editortoolbar">
                    <a id="fileInput${id}" class="icon is-hidden-mobile" title="上传文件">${ic.Upload}</a>
                    <a class="icon" title="保存" onclick="cbi_submit(this,'cbi.save')">${ic.save}</a>
                    <a id="down${id}"         class="icon" title="下载">${ic.download}</a>
                    <a id="clear${id}"        class="icon" title="清除">${ic.delete}</a>
                    <a id="copy${id}"         class="icon" title="复制输入代码">${ic.copy}</a>
                    <a id="${id}FullScreen"   class="icon" title="全屏" onclick="toggleFullScreenUI('${id}',true)">${ic.open_fullscreen}</a>
                    <a id="${id}CloseScreen" class="icon" style="display:none;" title="关闭全屏" onclick="toggleFullScreenUI('${id}',false)">${ic.close_fullscreen}</a>
                </div>
            </div>`)
        .append(`
            <div class="columns is-mobile m-0 aceStatusBar" id="StatusBar">
                <div class="column is-two-thirds p-0 pl-0"  id="${id}AceLineColumn">Ln: 1; Col: 1; Max Col: 0</div>
                <div class="column is-one-thirds p-0 has-text-right" id="${id}TextSize">Size: 0 Byte</div>
            </div>`)
        .addClass('column')
        .wrapInner(`<div class='aceEditorBorder' id='ace${id}'></div>`)
        .before(`
            <div class="columns is-centered" style="display:none;"></div>
            <div class="field state" style="display:none;"></div>
            <div class="field success" style="display:none;"></div>`);

    var $textarea = $('#' + id);
    var $editorContainer = $('<div>').css({ height: height + 'px', lineHeight: spacing, width: 'auto' })
        .insertBefore($textarea.hide());

    var xid = id;
    var editor = ace.edit($editorContainer[0]);
    editor.getSession().setValue($textarea.val());
    editor.setOptions({
        readOnly: only,
        mode: 'ace/mode/' + model,
        theme: 'ace/theme/' + theme,
        fontSize: font_size + 'px',
        fontFamily: 'Consolas, monospace',
        printMarginColumn: -1,
        wrap: true,
        showPrintMargin: true,
    });

    editor.on('input', function () {
        $textarea.val(editor.getValue());
        updateDisplay(editor, xid);
    });

    editor.selection.on('changeCursor', function () {
        updateDisplay(editor, xid);
    });

    var clipboard = new ClipboardJS('#copy' + xid, {
        text: function () { return editor.getValue().trim(); }
    }).on('success', function (e) {
        editor.execCommand('selectAll');
        showToast('内容已复制', 1000);
        e.clearSelection();
    }).on('error', function (e) {
        e.clearSelection();
        showToast(editor.getValue().trim() === '' ? '内容为空' : '复制出错', 3000);
    });

    $(`#clear${xid}`).click(function (e) {
        e.preventDefault();
        editor.setValue('');
    });

    $(`#down${xid}`).click(function () {
        console.log(id);
        var content = editor.getValue().trim();
        if (!content) { showErrorMessage('内容为空', true); return; }
        loadScripts('/luci-static/tinynote/FileSaver.js').then(function () {
            saveAs(new Blob([content], { type: 'text/plain; charset=utf-8' }), 'data.txt');
        });
    });

    $(`#fileInput${xid}`).click(function () {
        $('<input type="file">').on('change', function (e) {
            var file = e.target.files[0];
            if (!file) return;
            var reader = new FileReader();
            reader.readAsText(file, 'UTF-8');
            reader.onload = function (ev) { editor.setValue(ev.target.result); };
            e.target.value = '';
        }).click();
    });

    $(document).on('keydown', function (e) {
        if (e.key === 'F11') { e.preventDefault(); toggleFullScreen(editor); }
    });
}

function updateDisplay(editor, xid) {
    var content = editor.getValue().trim();
    var size = content.length;
    $(`#${xid}TextSize`).html(
        size === 0 ? 'Size: 0 Byte' :
            size < 1024 ? 'Size: ' + size + ' Bytes' :
                'Size: ' + (size / 1024).toFixed(2) + ' KB'
    );

    var cursor = editor.selection.getCursor();
    var maxCol = 0;
    var lines = editor.session.getLength();
    for (var i = 0; i < lines; i++) maxCol = Math.max(maxCol, editor.session.getLine(i).length);
    $(`#${xid}AceLineColumn`).html(`Ln: ${cursor.row + 1}; Col: ${cursor.column + 1}; Max Col: ${maxCol}`);
}

function toggleFullScreenUI(id, enter) {
    $(`#ace${id}.aceEditorBorder`).toggleClass('fullScreen', enter);
    $(`#${id}FullScreen`).toggle(!enter);
    $(`#${id}CloseScreen`).toggle(enter);
    $('.ace_editor').css('height', enter ? 'calc(100% - 65px)' : '60vh');
    $('body').css({ overflow: enter ? 'hidden' : '', position: enter ? 'fixed' : '' });
}

function toggleFullScreen(editor) {
    loadScripts('/luci-static/tinynote/screenfull.js').then(function () {
        if (screenfull.isEnabled && editor.isFocused()) screenfull.toggle(editor.container);
    });
}

function showToast(text, duration) {
    var el = $('<div>').addClass('copy-message').text(text).appendTo('body');
    setTimeout(function () { el.remove(); }, duration);
}

function showErrorMessage(message, isToast) {
    if (isToast) {
        $(".field.success")
            .html('<div class="notification alert-message" style="background:red;">' + message + '</div>')
            .show().delay(3000).fadeOut();
        return;
    }
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

function state(time) {
    $(".field.state")
        .html('<div class="button is-fullwidth alert-message" style="color:black;">用时: ' + timeEnd(time) + 'ms</div>')
        .show().delay(3000).fadeOut();
}

function loadScripts(scripts) {
    scripts = typeof scripts === 'string' ? [scripts] : scripts;
    return Promise.all(scripts.map(function (src) {
        if (loadedScripts.has(src)) return Promise.resolve();
        return new Promise(function (resolve, reject) {
            $.getScript(src).done(function () { loadedScripts.add(src); resolve(); }).fail(reject);
        });
    }));
}
