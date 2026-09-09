'use strict';
'require fs';
'require ui';
'require view';
'require tools.nikki as nikki';

function formatSize(bytes) {
    if (bytes == null || isNaN(bytes)) return _('Unknown');
    if (bytes === 0) return '0 B';
    const units = ['B', 'KB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    const idx = Math.min(i, units.length - 1);
    const value = bytes / Math.pow(1024, idx);
    const formatted = Number.isInteger(value) ? value : value.toFixed(2);
    return `${formatted} ${units[idx]}`;
}

return view.extend({
    aceEditor: null,
    currentPath: null,

    setEditorValue: function (content) {
        if (this.aceEditor) {
            this.aceEditor.setValue(content, -1);
            this.aceEditor.resize(true);
        } else {
            this.textarea.value = content;
        }
    },

    load: function () {
        return Promise.all([
            L.resolveDefault(fs.stat(nikki.runProfilePath), { path: null }),
            nikki.listfiles('/etc/nikki/subscriptions'),
            nikki.listfiles('/etc/nikki/profiles'),
            nikki.listfiles('/etc/nikki/mixin'),
            nikki.listfiles('/etc/nikki/run/providers/rule'),
            nikki.listfiles('/etc/nikki/run/providers/proxy'),
        ]).then(([yp, sp, pf, mp, rp, pp]) => {
            const build = (files, prefix, dir) => files.map(f => ({
                path: `${dir}/${f.name}`, mtime: f.mtime, size: f.size, name: prefix + f.name
            }));

            const allFiles = [
                { path: yp.path, mtime: yp.mtime, size: yp.size, name: _('Profile for Startup') },
                ...build(sp, _('Subscription:'), '/etc/nikki/subscriptions'),
                ...build(pf, _('File:'), '/etc/nikki/profiles'),
                ...build(mp, _('Mixin:'), '/etc/nikki/mixin'),
                // ...build(rp, _('Rule Provider:'), '/etc/nikki/run/providers/rule'),
                // ...build(pp, _('Proxy Provider:'), '/etc/nikki/run/providers/proxy'),
            ];

            return allFiles.filter(item => item.path).map(item => {
                const mtimeStr = item.mtime ? new Date(item.mtime * 1000).toLocaleString() : _('Unknown');
                item.stat = _('Last modified: %s, Size: %s').format(mtimeStr, formatSize(item.size));
                return item;
            });
        });
    },

    render: function (data) {
        this.textarea = E('textarea', { style: 'width:100%;height:350px;box-sizing:border-box;', wrap: 'off' });
        const statEl = E('span', { style: 'margin-left:10px;font-size:12px;color:#888;vertical-align:middle;' });
        const aceDiv = E('div', { style: 'width:auto;height:100%;display:none;' });

        nikki.initAceEditor(aceDiv, '', 'yaml', { showPrintMargin: true })
            .then(editor => {
                this.textarea.style.display = 'none';
                aceDiv.style.display = '';
                this.aceEditor = editor;
            })
            .catch(() => {
                Object.assign(this.textarea.style, {
                    fontFamily: 'Consolas', background: '#1e1e1e', color: '#d4d4d4'
                });
            });

        return E('div', { class: 'cbi-map' }, [
            E('h3', {}, _('Editor')),
            E('div', { class: 'cbi-section' }, [
                E('div', { class: 'cbi-value' }, [
                    E('label', { class: 'cbi-value-title' }, _('Choose File')),
                    E('div', { class: 'cbi-value-field' }, [
                        E('select', {
                            class: 'cbi-input-select',
                            change: L.bind(function (ev) {
                                this.content = '';
                                const value = ev.target.value;
                                this.currentPath = value || null;
                                const item = data.find(i => i.path === value);
                                statEl.textContent = item?.stat ?? '';

                                if (!value) {
                                    this.setEditorValue('');
                                    return;
                                }

                                return L.resolveDefault(fs.read_direct(value), '').then((c) => {
                                    this.setEditorValue(c);
                                    this.content = this.aceEditor ? this.aceEditor.getValue() : this.textarea.value;
                                });
                            }, this)
                        }, [
                            E('option', { value: '' }, _('-- Please choose --')),
                            ...data.map(item => E('option', { value: item.path }, item.name))
                        ]), statEl])
                ])
            ]),
            E('div', {}, [
                E('div', { style: 'position:relative;width:auto;height:350px;margin-top:10px;' }, [
                    aceDiv, this.textarea,
                    E('button', {
                        type: 'button', title: _('Fullscreen'),
                        style: 'position:absolute;top:3px;right:15px;padding:3px 8px;font-size:18px;z-index:1000;background:#557ef1;color:#fff;border:none;cursor:pointer;border-radius:3px;line-height:1;',
                        click: ui.createHandlerFn(this, () =>
                            (aceDiv.requestFullscreen || aceDiv.webkitRequestFullscreen).call(aceDiv))
                    }, '⛶')
                ])])
        ]);
    },

    handleSave: function (ev) {
        if (!this.currentPath) {
            this._showTip(_('No file selected'), 'warning', 2000);
            return Promise.resolve();
        }
        const value = (this.aceEditor ? this.aceEditor.getValue() : this.textarea.value).trim();
        const original = (this.content || '').trim();
        if (value === original) return Promise.resolve();

        return nikki.writefile(this.currentPath, value)
            .then(() => {
                this.content = value;
                this._showTip(_('Config saved, files updated'), 'success', 2000);
            });
    },

    _showTip: function (msg, type, ms) {
        const tip = E('div', {
            'class': 'alert-message ' + (type || 'info'),
            'style': 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);z-index:9999;white-space:nowrap;font-size:16px;font-weight:bold;padding:1em 2.5em;border-radius:6px;box-shadow:0 8px 24px rgba(0,0,0,.4);'
        }, E('p', { 'style': 'margin:0' }, msg));
        document.body.appendChild(tip);
        setTimeout(() => tip.remove(), ms || 2000);
    },

    // handleSaveApply: function (ev, mode) {
    //     return this.handleSave(ev)
    //         .then(() => {
    //             this._showTip(mode === '0' ? _('Saved, reloading...') : _('Saved, restarting...'), 5000, 'info');
    //             return nikki.service('nikki', mode === '0' ? 'reload' : 'restart');
    //         })
    //         .catch((e) => this._showTip(e.message, 8000, 'error'));
    // },

    handleReset: null,
    handleSaveApply: null
});
