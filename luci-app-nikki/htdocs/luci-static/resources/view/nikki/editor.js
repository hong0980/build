'use strict';
'require fs';
'require ui';
'require view';
'require tools.nikki as nikki';

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
            nikki.listfiles(nikki.profilesDir),
            nikki.listfiles(nikki.ruleProvidersDir),
            nikki.listfiles(nikki.proxyProvidersDir),
            nikki.listfiles(nikki.subscriptionsDir),
            L.resolveDefault(fs.stat(nikki.mixinFilePath), { path: null }),
            L.resolveDefault(fs.stat(nikki.runProfilePath), { path: null }),
        ]).then(([pf, rp, pp, sp, mp, yp]) => {
            const build = (files, prefix, dir) => files.map(f => ({
                path: `${dir}/${f.name}`, mtime: f.mtime, size: f.size, name: prefix + f.name
            }));

            const allFiles = [
                ...build(pf, _('File:'), nikki.profilesDir),
                ...build(sp, _('Subscription:'), nikki.subscriptionsDir),
                ...build(rp, _('Rule Provider:'), nikki.ruleProvidersDir),
                ...build(pp, _('Proxy Provider:'), nikki.proxyProvidersDir),
                { path: mp.path, mtime: mp.mtime, size: mp.size, name: _('File for Mixin') },
                { path: yp.path, mtime: yp.mtime, size: yp.size, name: _('Profile for Startup') },
            ];

            return allFiles.filter(item => item.path).map(item => {
                const mtimeStr = item.mtime ? new Date(item.mtime * 1000).toLocaleString() : _('Unknown');
                item.stat = _('Last modified: %s, Size: %s bytes').format(mtimeStr, item.size || 0);
                return item;
            });
        });
    },

    render: function (data) {
        const statEl = E('span', {
            style: 'margin-left:10px;font-size:12px;color:#888;vertical-align:middle;'
        });

        this.textarea = E('textarea', {
            style: 'width:100%;height:380px;box-sizing:border-box;', wrap: 'off'
        });

        const aceDiv = E('div', { style: 'width:auto;height:100%;display:none;' });

        const container = E('div', { style: 'position:relative;width:auto;height:380px;margin-top:10px;' }, [
            aceDiv,
            this.textarea,
            E('button', {
                type: 'button', title: _('Fullscreen'),
                style: 'position:absolute;top:3px;right:15px;padding:3px 8px;font-size:18px;z-index:1000;background:#557ef1;color:#fff;border:none;cursor:pointer;border-radius:3px;line-height:1;',
                click: ui.createHandlerFn(this, () =>
                    (aceDiv.requestFullscreen || aceDiv.webkitRequestFullscreen).call(aceDiv))
            }, '⛶')
        ]);

        const select = E('select', { class: 'cbi-input-select' }, [
            E('option', { value: '' }, _('-- Please choose --')),
            ...data.map(item => E('option', { value: item.path }, item.name))
        ]);

        select.addEventListener('change', () => {
            const value = select.value;
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
                    // requestAnimationFrame(() => this.aceEditor.renderer.onResize(true));
                } else {
                    this.textarea.value = c;
                }
            });
        });

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
        }).catch(() => Object.assign(this.textarea.style, {
            fontFamily: 'Consolas', background: '#1e1e1e', color: '#d4d4d4'
        }));

        return E('div', { class: 'cbi-map' }, [
            E('h3', {}, _('Editor')),
            E('div', { class: 'cbi-section' }, [
                E('div', { class: 'cbi-value' }, [
                    E('label', { class: 'cbi-value-title' }, _('Choose File')),
                    E('div', { class: 'cbi-value-field' }, [select, statEl])
                ]),
                E('div', { class: 'cbi-value' }, [
                    // E('label', { class: 'cbi-value-title' }, _('File Content')),
                    E('div', { class: 'cbi-value-field' }, [container])
                ])
            ])
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
                return mode === '0' ? nikki.reload() : nikki.restart();
            })
            .catch((e) => ui.addTimeLimitedNotification(null, E('p', _(e.message)), 8000, 'error'));
    },

    handleReset: null
});
