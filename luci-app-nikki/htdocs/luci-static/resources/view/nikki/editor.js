'use strict';
'require fs';
'require ui';
'require uci';
'require form';
'require view';
'require tools.nikki as nikki';

function preloadAce() {
    if (window.ace?.edit) return Promise.resolve(true);
    if (window._acePromise) return window._acePromise;
    return window._acePromise = new Promise((resolve, reject) => {
        const script = E('script', { src: '/luci-static/resources/ace/ace.js' });
        script.onload = () => {
            ace.config.set('basePath', '/luci-static/resources/ace');
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
    load: function () {
        return Promise.all([
            nikki.listProfiles(),
            nikki.listRuleProviders(),
            nikki.listProxyProviders(),
            uci.load('nikki'),
        ]).then(([pf, rp, pp]) => {
            const sp = uci.sections('nikki', 'subscription');
            const allFiles = [
                ...pf.map(p => ({ path: `${nikki.profilesDir}/${p.name}`, name: _('File:') + p.name })),
                ...sp.map(s => ({ path: `${nikki.subscriptionsDir}/${s['.name']}.yaml`, name: _('Subscription:') + s.name })),
                ...rp.map(r => ({ path: `${nikki.ruleProvidersDir}/${r.name}`, name: _('Rule Provider:') + r.name })),
                ...pp.map(p => ({ path: `${nikki.proxyProvidersDir}/${p.name}`, name: _('Proxy Provider:') + p.name })),
                { path: nikki.mixinFilePath, name: _('File for Mixin') },
                { path: nikki.runProfilePath, name: _('Profile for Startup') },
            ];

            return Promise.all(allFiles.map(item =>
                fs.stat(item.path).then(stat => {
                    const mtime = new Date(stat.mtime * 1000).toLocaleString();
                    return { ...item, stat: _('Last modified: %s, Size: %s bytes').format(mtime, stat.size) };
                }).catch(() => {})
            )).then(r => r.filter(Boolean));
        });
    },

    render: function (data) {
        let m, s, o, aceEditor = null;

        m = new form.Map('nikki');
        s = m.section(form.NamedSection, 'editor', 'editor', _('Editor'));

        o = s.option(form.ListValue, '_file', _('Choose File'));
        o.optional = true;
        for (const item of data) {
            o.value(item.path, item.name);
        }
        o.load = () => null;
        o.write = () => true;
        o.renderWidget = function (section_id, option_index, cfgvalue) {
            const frameEl = form.ListValue.prototype.renderWidget.apply(this, arguments);
            const statEl = E('span', {
                id: `${this.cbid(section_id)}_stat`,
                style: 'margin-left:10px;font-size:12px;color:#888;vertical-align:middle;'
            });
            frameEl.appendChild(statEl);
            return frameEl;
        };
        o.onchange = function (ev, section_id, value) {
            if (!value) return;
            const item = data.find(i => i.path === value);
            const statEl = document.getElementById(`${this.cbid(section_id)}_stat`);
            if (statEl) statEl.textContent = item?.stat ?? '';

            return L.resolveDefault(fs.read_direct(value), '').then((c) => {
                if (aceEditor) {
                    aceEditor.setValue(c, -1);
                    requestAnimationFrame(() => {
                        const hbar = aceEditor.renderer.scrollBarH.element;
                        if (!aceEditor.renderer.scrollBarH.isVisible) hbar.style.display = 'none';
                        aceEditor.renderer.onResize(true);
                    });
                    return;
                }
                s.getUIElement(section_id, '_file_content')?.setValue(c);
            });
        };

        o = s.option(form.TextValue, '_file_content');
        o.rows = 25;
        o.wrap = false;
        o.renderWidget = function (section_id, option_index, cfgvalue) {
            let frameEl = form.TextValue.prototype.renderWidget.apply(this, arguments);
            const ta = frameEl.firstElementChild;
            const aceDiv = E('div', { style: 'width:auto;height:100%;' });
            const container = E('div', { style: 'position:relative;width:auto;height:380px;' }, [
                aceDiv,
                E('button', {
                    title: _('Fullscreen'),
                    style: 'position:absolute;top:3px;right:15px;padding:3px 8px;font-size:18px;z-index:1000;background:#557ef1;color:#fff;border:none;cursor:pointer;border-radius:3px;line-height:1;',
                    click: ui.createHandlerFn(this, (ev) =>
                        (aceDiv.requestFullscreen || aceDiv.webkitRequestFullscreen).call(aceDiv)
                    )
                }, '⛶')
            ]);

            preloadAce().then(() => {
                ta.style.display = 'none';
                ta.parentNode.insertBefore(container, ta);
                aceEditor = ace.edit(aceDiv);
                aceEditor.setOptions({
                    wrap: true,
                    fontSize: '14px',
                    printMarginColumn: -1,
                    showPrintMargin: true,
                    mode: 'ace/mode/yaml',
                    fontFamily: 'Consolas',
                    theme: 'ace/theme/monokai'
                });
                aceEditor.renderer.scrollBarH.on('hide', () => {
                    aceEditor.renderer.scrollBarH.element.style.display = 'none';
                });
            }).catch(() => Object.assign(ta.style, { fontFamily: 'Consolas', background: '#1e1e1e', color: '#d4d4d4' }));

            return frameEl;
        };
        o.formvalue = function (section_id) {
            return aceEditor?.getValue() ?? form.TextValue.prototype.formvalue.call(this, section_id);
        };
        o.write = function (section_id, value) {
            const path = s.getUIElement(section_id, '_file')?.getValue();
            return fs.write(path, value.replace(/^\s+$/gm, '').trim()).then(() =>
                ui.addTimeLimitedNotification(null, E('p', _('Config saved, files updated')), 5000, 'info')
            );
        };

        return m.render();
    },

    handleSaveApply: function (ev, mode) {
        return this.handleSave()
            .then(() => {
                ui.addTimeLimitedNotification(null, E('p', mode === '0' ? _('Saved, reloading...') : _('Saved, restarting...')), 5000, 'info');
                return mode === '0' ? nikki.reload() : nikki.restart();
            })
            .catch((e) => ui.addTimeLimitedNotification(null, E('p', _(e.message)), 8000, 'error'));
    },

    handleReset: null
});
