'use strict';
'require fs';
'require ui';
'require view';
'require tools.nikki as nikki';

function formatSize(bytes) {
    if (bytes == null || isNaN(bytes)) return _('Unknown');
    if (bytes === 0) return '0 B';
    const units = ['B', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    const idx = Math.min(i, units.length - 1);
    const value = bytes / Math.pow(1024, idx);
    const formatted = Number.isInteger(value) ? value : value.toFixed(2);
    return `${formatted} ${units[idx]}`;
}

function preloadAce() {
    if (window.ace?.edit) return Promise.resolve(true);
    if (window._acePromise) return window._acePromise;
    return window._acePromise = new Promise((resolve, reject) => {
        const script = E('script', { src: '/luci-static/resources/view/nikki/ace/ace.js' });
        script.onload = () => {
            ace.config.set('basePath', '/luci-static/resources/view/nikki/ace');
            resolve(true);
        };
        script.onerror = () => {
            window._acePromise = null;
            reject(new Error('Failed to load ace'));
        };
        document.head.appendChild(script);
    });
}

return view.extend({
    aceEditor: null,
    currentPath: null,

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
                ...build(rp, _('Rule Provider:'), '/etc/nikki/run/providers/rule'),
                ...build(pp, _('Proxy Provider:'), '/etc/nikki/run/providers/proxy'),
            ];

            return allFiles.filter(item => item.path).map(item => {
                const mtimeStr = item.mtime ? new Date(item.mtime * 1000).toLocaleString() : _('Unknown');
                item.stat = _('Last modified: %s, Size: %s').format(mtimeStr, formatSize(item.size));
                return item;
            });
        });
    },

    render: function (data) {
        this.textarea = E('textarea', { style: 'width:100%;height:380px;box-sizing:border-box;', wrap: 'off' });
        const statEl = E('span', { style: 'margin-left:10px;font-size:12px;color:#888;vertical-align:middle;' });
        const aceDiv = E('div', { style: 'width:auto;height:100%;display:none;' });

        preloadAce().then(() => {
            this.textarea.style.display = 'none';
            aceDiv.style.display = '';
            this.aceEditor = ace.edit(aceDiv);
            this.aceEditor.setOptions({
                wrap: true,
                fontSize: '14px',
                printMarginColumn: -1,
                showPrintMargin: true,
                mode: 'ace/mode/yaml',
                fontFamily: 'Consolas',
                theme: 'ace/theme/monokai'
            });
            this.aceEditor.setValue(this.textarea.value || '', -1);
        }).catch(() => Object.assign(this.textarea.style, {
            fontFamily: 'Consolas', background: '#1e1e1e', color: '#d4d4d4'
        }));

        return E('div', { class: 'cbi-map' }, [
            E('h3', {}, _('Editor')),
            E('div', { class: 'cbi-section' }, [
                E('div', { class: 'cbi-value' }, [
                    E('label', { class: 'cbi-value-title' }, _('Choose File')),
                    E('div', { class: 'cbi-value-field' }, [
                        E('select', {
                            class: 'cbi-input-select',
                            change: L.bind(function (ev) {
                                const value = ev.target.value;
                                this.currentPath = value || null;
                                const item = data.find(i => i.path === value);
                                statEl.textContent = item?.stat ?? '';
                                if (!value) {
                                    this.textarea.value = '';
                                    this.aceEditor?.setValue('', -1);
                                    return;
                                }
                                return L.resolveDefault(fs.read_direct(value), '').then((c) => {
                                    if (this.aceEditor) {
                                        this.aceEditor.setValue(c, -1);
                                        this.aceEditor.resize(true);
                                    }
                                    else this.textarea.value = c;
                                });
                            }, this)
                        }, [
                            E('option', { value: '' }, _('-- Please choose --')),
                            ...data.map(item => E('option', { value: item.path }, item.name))
                        ]), statEl])
                ])
            ]),
            E('div', {}, [
                E('div', { style: 'position:relative;width:auto;height:380px;margin-top:10px;' }, [
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
            ui.addTimeLimitedNotification(null, E('p', _('No file selected')), 5000, 'warning');
            return Promise.resolve();
        }
        const value = this.aceEditor ? this.aceEditor.getValue() : this.textarea.value;
        return nikki.writefile(this.currentPath, value.replace(/^\s+$/gm, '').trim()).then(() =>
            ui.addTimeLimitedNotification(null, E('p', _('Config saved, files updated')), 5000, 'info')
        );
    },

    handleSaveApply: function (ev, mode) {
        return this.handleSave(ev)
            .then(() => {
                ui.addTimeLimitedNotification(null, E('p', mode === '0' ? _('Saved, reloading...') : _('Saved, restarting...')), 5000, 'info');
                return nikki.service(mode === '0' ? 'reload' : 'restart');
            })
            .catch((e) => ui.addTimeLimitedNotification(null, E('p', e.message), 8000, 'error'));
    },

    handleReset: null
});
