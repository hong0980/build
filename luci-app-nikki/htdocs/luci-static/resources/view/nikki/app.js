'use strict';
'require form';
'require view';
'require ui';
'require fs';
'require uci';
'require tools.nikki as nikki';

const checkurls = [
    ['https://www.baidu.com', _('Baidu')],
    ['https://s1.music.126.net/style/favicon.ico', _('163Music')],
    ['https://github.com', _('GitHub')],
    ['https://www.google.com/generate_204', _('Google')],
    ['https://www.youtube.com', _('YouTube')]
];

// const callTestMirror = L.rpc.declare({
//     object: 'luci.nikki',
//     method: 'test_mirror',
//     params: ['url', 'target'],
//     expect: { '': {} }
// });

function setStatus(element, running) {
    if (element) {
        element.style.color = running ? 'green' : 'red';
        element.textContent = running ? _('Running') : _('Not Running');
    }
    return element;
}

function showButtonLoading(btn, text) {
    const bar = E('div', {
        'class': 'cbi-progressbar',
        'style': 'position:absolute;left:0;bottom:0;width:100%;height:2px;margin:0;min-width:0;border:0;border-radius:0;z-index:0;'
    }, E('div', {
        'style': 'width:0%;height:100%;transition:width 0.25s ease-in;'
    }));
    const label = E('span', { 'style': 'position:relative;z-index:1;' }, text);
    btn.innerHTML = '';
    btn.appendChild(bar);
    btn.appendChild(label);
    return bar;
};

function attachFileEditorButton(o, resolveTarget) {
    o.renderWidget = function (section_id, option_index, cfgvalue) {
        const self = this;
        const node = form.ListValue.prototype.renderWidget.apply(this, arguments);
        const select = node.firstChild;
        const btn = E('button', {
            'class': 'btn cbi-button-positive',
            'click': ui.createHandlerFn(this, function (ev) {
                const path = resolveTarget(select.value);
                if (!path) return;
                const aceDiv = E('div', { 'style': 'width:100%;height:350px;' });
                return L.resolveDefault(fs.read_direct(path), '').then(content => {
                    const md = ui.showModal(_('Edit: %s').format(path), [
                        aceDiv,
                        E('div', { 'class': 'button-row' }, [
                            E('button', {
                                'class': 'btn cbi-button-positive',
                                'click': ui.createHandlerFn(this, function () {
                                    const finalValue = aceDiv._aceEditor.getValue();
                                    if (content === finalValue) return;
                                    return nikki.writefile(path, finalValue)
                                        .then(() => nikki.modalnotify(null, E('p', _('Config saved, files updated')), 5000, 'success'))
                                        .catch(e => nikki.modalnotify(null, E('p', e.message || e), 8000, 'error'));
                                })
                            }, _('Save')),
                            E('button', { 'class': 'btn', 'click': ui.hideModal }, _('Dismiss'))
                        ])
                    ], 'cbi-modal');
                    md.style.setProperty('padding', '.75em .5em .5em .5em');
                    const title = md.querySelector('h3, h4');
                    if (title) title.style.fontSize = '14px';
                    nikki.initAceEditor(aceDiv, content, 'yaml');
                });
            })
        }, _('Edit'));

        if (!cfgvalue) btn.style.display = 'none';

        select.addEventListener('change', function (ev) {
            const el = self.map.lookupOption('core_only', section_id)[0];
            el?.getUIElement(section_id).setValue('0');
            btn.style.display = this.value ? '' : 'none';
        });

        node.classList.add('control-group');
        node.appendChild(btn);
        return node;
    };
}

return view.extend({
    load: function () {
        return Promise.all([
            nikki.version(),
            nikki.status('nikki'),
            nikki.listfiles('/etc/nikki/mixin'),
            nikki.listfiles('/etc/nikki/profiles'),
            nikki.listfiles('/etc/nikki/subscriptions'),
            nikki.listfiles('/etc/nikki/run/core'),
            uci.load('nikki')
        ]);
    },
    render: function ([v, running, mixinfiles, profiles, subfiles, list]) {
        const self = this;
        let m, s, o, os, lswitchBtn, lgbmBtn;
        m = new form.Map('nikki', _('Nikki'), _("Transparent Proxy with <a href='%s' target='_blank'>Mihomo</a> on OpenWrt.").format('https://wiki.metacubex.one/') +
            ` <a href="https://github.com/nikkinikki-org/OpenWrt-nikki/wiki" target="_blank">${_('How To Use')}</a>`);

        s = m.section(form.TypedSection);
        s.render = function () {
            const weight = E('strong', [E('span', { 'style': 'color:gray' }, ' ' + _('unchecked'))]);
            return E('p', [
                E('button', {
                    'class': 'btn cbi-button-apply',
                    'click': ui.createHandlerFn(this, () => {
                        weight.innerHTML = '';
                        return Promise.all(checkurls.map((site) => {
                            return L.resolveDefault(nikki.callConnStat(site[0]), {}).then((res) => {
                                let label = '%s (%dms)'.format(site[1], res.elapsed_ms), color = 'red';
                                if (res.httpcode && res.httpcode.match(/^20\d$/)) {
                                    color = (res.elapsed_ms < 300) ? 'green' : (res.elapsed_ms < 800) ? 'orange' : 'red';
                                } else {
                                    label = _('%s (Timeout)').format(site[1]);
                                }
                                weight.innerHTML += '<span style="color:%s">&ensp;%s</span>'.format(color, label);
                            });
                        }));
                    })
                }, _('Connection check')), weight
            ])
        };

        os = m.section(form.TableSection, 'status', _('Status'));
        os.anonymous = true;

        o = os.option(form.DummyValue, '_app_version', _('App Version'));
        o.load = () => v.app;

        o = os.option(form.DummyValue, '_core_version', _('Core Version'));
        o.load = () => v.core ?? '';

        o = os.option(form.DummyValue, '_core_status', _('Core Status'));
        o.cfgvalue = function () {
            return setStatus(E('span', { id: 'core_status', style: 'font-style: italic; font-weight: bold;' }), running);
        };

        o = os.option(form.Button, 'reload');
        o.inputstyle = 'action';
        o.inputtitle = _('Reload Service');
        o.onclick = function () { return nikki.service('nikki', 'reload'); };

        o = os.option(form.Button, 'restart');
        o.inputstyle = 'negative';
        o.inputtitle = _('Restart Service');
        o.onclick = function () { return nikki.service('nikki', 'restart'); };

        o = os.option(form.ListValue, 'ui_url');
        o.ucisection = 'mixin';
        o.ucioption = 'ui_url';
        o.retain = true;

        o.load = function (section_id) {
            self.install_status = {};
            const ui_path = uci.get('nikki', 'mixin', 'ui_path');
            return Promise.all(nikki.ui_array.map(([url, name]) =>
                fs.stat(`${nikki.runDir}/${ui_path}/${name}/index.html`)
                    .then(() => self.install_status[url] = { name, installed: true })
                    .catch(() => self.install_status[url] = { name, installed: false })
                    .then(() => [url, name + (self.install_status[url].installed ? '' : ` (${_('Not Installed')})`)])
            )).then(entries => {
                entries.forEach(([url, label]) => this.value(url, label));
                return form.ListValue.prototype.load.apply(this, arguments);
            });
        };

        o.renderWidget = function (section_id, option_index, cfgvalue) {
            const node = form.ListValue.prototype.renderWidget.apply(this, arguments);
            const select = node.firstChild;
            const btn = E('button', {
                'class': 'cbi-button cbi-button-positive',
                'click': ui.createHandlerFn(this, function (ev) {
                    const value = select.value;
                    const entry = self.install_status[value];
                    if (!entry) return;
                    if (entry.installed) return nikki.openDashboard(entry.name);

                    const bar = showButtonLoading(ev.target, _('Please wait, downloading %s...').format(entry.name));
                    return nikki.update_ui(value, entry.name, pct => bar.firstChild.style.width = pct + '%')
                        .then(res => {
                            if (res.status !== 'ok') return;
                            entry.installed = true;
                            const opt = select.querySelector(`option[value="${CSS.escape(value)}"]`);
                            if (opt) opt.textContent = entry.name;
                        })
                        .then(() => nikki.openDashboard(entry.name))
                        .catch(err => ui.addNotification(null, E('p', _('Update failed: %s').format(res.message || res)), 'error'))
                        .finally(() => btn.textContent = _('Open Dashboard'));
                })
            }, _('Open Dashboard'));

            node.classList.add('control-group');
            node.appendChild(btn);
            return node;
        };

        s = m.section(form.NamedSection, 'config', 'config', _('App Config'));
        o = s.option(form.Flag, 'enabled', _('Enable'));
        o.rmempty = false;

        o = s.option(form.ListValue, 'core', _('Core'));
        o.value('meta', _('Meta'));
        o.value('alpha', _('Alpha'));
        o.value('smart', _('Smart'));
        o.value('smart_oix', _('Smart-oix'));
        o.rmempty = false;
        o.onchange = function (ev, section_id, value) {
            if (!lswitchBtn) return;
            lswitchBtn.style.display = this.cfgvalue(section_id) !== value ? '' : 'none';
        };
        o.renderWidget = function (section_id, option_index, cfgvalue) {
            const self = this;
            const node = form.ListValue.prototype.renderWidget.apply(this, arguments);
            const core_version = uci.get('nikki', 'config', 'core_version');
            const default_label = _('Update Core');
            const coreBtn = E('button', {
                'class': 'btn cbi-button-action',
                'click': ui.createHandlerFn(this, function (ev) {
                    const tableEl = E('table', { 'class': 'table cbi-section-table' }, [
                        E('tr', { 'class': 'tr table-titles' }, [
                            E('th', { 'class': 'th' }, _('Type')),
                            E('th', { 'class': 'th' }, _('Local Version')),
                            E('th', { 'class': 'th' }, _('Remote Version')),
                            E('th', { 'class': 'th' }, _('Release Time')),
                            E('th', { 'class': 'th' }, _('Status')),
                            E('th', { 'class': 'th cbi-section-actions' })
                        ])
                    ]);

                    const options = Array.from(node.firstChild.options)
                        .filter(opt => opt.value)
                        .map(opt => ({ value: opt.value, text: opt.text }));

                    const md = ui.showModal(_('Core Version Management'), [
                        tableEl,
                        E('em', { 'class': 'spinning', 'style': 'display:block;margin-bottom:1em;' }, _('Checking latest version...')),
                        E('div', { 'class': 'button-row' }, [
                            E('button', {
                                'class': 'btn cbi-button-remove', 'click': ui.createHandlerFn(this, function (ev) {
                                    options.forEach(opt => fs.remove(`${nikki.TEMP_DIR}/${opt.value}.cache`));
                                })
                            }, _('Flush Cache')),
                            E('button', { 'class': 'btn', 'click': ui.hideModal }, _('Close'))
                        ])
                    ], 'cbi-modal');

                    return Promise.all(options.map(opt => {
                        return Promise.all([
                            nikki.get_core_version(opt.value)
                                .then(res => ({ version: res.version || '-' }))
                                .catch(() => ({ version: '-' })),
                            nikki.get_core_url(opt.value, core_version)
                                .then(res => {
                                    const version = opt.value === 'meta'
                                        ? (res.url.match(/\/download\/([^/]+)\//) || [, '-'])[1]
                                        : (res.url.match(/(alpha(?:-(?:smart|oix))*-[a-f0-9]+)\.gz$/) || [, '-'])[1];
                                    return { version, url: res.url, updated_at: res.updated_at || '-' };
                                })
                                .catch(() => ({ version: '-', url: null }))
                        ]).then(res => ({
                            type: opt.value, hasurl: res[1].url, updated_at: res[1].updated_at,
                            localver: res[0].version, remotever: res[1].version, name: opt.text,
                        }));
                    })).then((res) => {
                        md.querySelector('em.spinning')?.remove();
                        const render = () => {
                            const rows = [];
                            res.forEach(item => {
                                const { type, name, localver, remotever, hasurl, updated_at } = item;
                                const isInstalled = localver !== '-';
                                const iscore = v.core && v.core === localver;
                                const isLatest = isInstalled && localver === remotever;
                                const switchLabel = iscore ? _('In use') : _('Switch Core');
                                const switchBtn = E('button', {
                                    'style': 'min-width:5.5rem;position:relative;overflow:hidden;',
                                    'disabled': iscore || type == 'smart' ? true : null,
                                    'class': `btn cbi-button-action ${iscore ? 'important' : ''}`,
                                    'click': ui.createHandlerFn(this, function (ev) {
                                        const bar = showButtonLoading(ev.target, _('Switching...'));
                                        return nikki.switch_core(type, core_version, function (pct) {
                                            bar.firstChild.style.width = pct + '%';
                                        }).then(res => {
                                            if (res.status !== 'ok') {
                                                nikki.modalnotify(null, E('p', _('%s switch failed: %s').format(name, String(res.message))), 'error');
                                                render();
                                                return;
                                            };

                                            v.core = remotever;
                                            item.localver = remotever;
                                            render();
                                            nikki.modalnotify(null, E('p', _('%s switch successful, service restarted').format(name)), 3000, 'success');
                                            uci.unload('nikki');
                                            return uci.load('nikki')
                                                .then(() => self.map.load())
                                                .then(() => self.map.reset());
                                        });
                                    })
                                }, switchLabel);

                                const dlLabel = isLatest
                                    ? _('Redownload')
                                    : isInstalled ? _('Update Core') : _('Download');
                                const dlBtn = E('button', {
                                    'style': 'min-width:5.5rem;position:relative;overflow:hidden;',
                                    'disabled': hasurl ? null : true,
                                    'class': `btn cbi-button-${isLatest ? 'negative' : 'positive'}`,
                                    'click': ui.createHandlerFn(this, function (ev) {
                                        const bar = showButtonLoading(ev.target, _('Downloading...'));
                                        return nikki.cache_core(type, core_version, function (pct) {
                                            bar.firstChild.style.width = pct + '%';
                                        }).then(res => {
                                            if (res.status !== 'ok') {
                                                render();
                                                nikki.modalnotify(null, E('p', _('%s download failed: %s').format(name, String(res.message))), 'error');
                                                return;
                                            };
                                            nikki.modalnotify(null, E('p', _('%s download successful').format(name)), 3000, 'success');
                                            if (isInstalled) {
                                                nikki.switch_core(type, core_version, null)
                                                    .then(res => {
                                                        if (res.status !== 'ok')
                                                            nikki.modalnotify(null, E('p', _('Update failed: %s').format(name)), 'error');

                                                        nikki.modalnotify(null, E('p', _('Core %s updated successfully').format(name)), 3000, 'success');
                                                    });
                                            }
                                            item.localver = remotever;
                                            render();
                                        });
                                    })
                                }, dlLabel);

                                const remoteCell = hasurl
                                    ? E('a', { 'href': hasurl, 'target': '_blank', 'rel': 'noreferrer', 'title': _('Click to download locally') + '\n' + hasurl }, remotever)
                                    : remotever;
                                const status = hasurl
                                    ? isLatest
                                        ? E('span', { 'class': 'label success' }, _('Up to Date'))
                                        : isInstalled
                                            ? E('span', { 'class': 'label notice' }, _('Update Available'))
                                            : E('span', { 'class': 'label warning' }, _('Not Installed'))
                                    : E('span', { 'class': 'label warning' }, _('Fetch Failed'));

                                // const TestBtn = E('button', {
                                //     'class': 'btn cbi-button-action',
                                //     'click': ui.createHandlerFn(this, function (ev) {
                                //         return callTestMirror(hasurl, '')
                                //             .then(function (res) {
                                //                 if (res?.status !== 'ok') {
                                //                     const msg = res.message === 'HTTP 000'
                                //                         ? _('本机直连失败')
                                //                         : (res.message || _('测试失败'));
                                //                     nikki.modalnotify(null, E('p', _('%s: %s').format(name, msg)), 'error');
                                //                     return;
                                //                 };
                                //                 nikki.modalnotify(null, E('p', _('%s 延迟 %s ms').format(name, res.elapsed_ms)), 4000, 'info');
                                //             });
                                //     })
                                // }, _('verify'));

                                rows.push([
                                    name,
                                    E('code', localver), remoteCell,
                                    E('span', { 'style': 'color:#666;font-size:90%;' }, updated_at), status,
                                    // E('div', { 'style': 'display:flex;gap:.5rem;' }, [TestBtn, dlBtn, switchBtn])
                                    E('div', { 'style': 'display:flex;gap:.5rem;' }, [dlBtn, switchBtn])
                                ]);
                            });
                            cbi_update_table(tableEl, rows, _('No data available'));
                        };
                        render();
                    });
                })
            }, default_label);
            lswitchBtn = E('button', {
                'style': `display:none;position:relative;overflow:hidden;`,
                'class': 'btn cbi-button-positive',
                'click': ui.createHandlerFn(this, function (ev) {
                    if (!core_version)
                        return ui.addNotification(null, E('p', _('Unknown device architecture, cannot download core.')), 'error');

                    const val = self.formvalue(section_id);
                    const bar = showButtonLoading(ev.target, _('Switching...'));
                    return nikki.switch_core(val, core_version, function (pct) {
                        bar.firstChild.style.width = pct + '%';
                    }).then(res => {
                        if (res.status !== 'ok') {
                            lswitchBtn.style.display = 'none';
                            ui.addNotification(null, E('p', _('Switch failed: %s').format(err.message || err)), 'error');
                            return;
                        };

                        return self.map.save(null, true).then(function () {
                            return uci.save()
                                .then(L.bind(ui.changes.init, ui.changes))
                                .then(L.bind(ui.changes.apply, ui.changes));
                        });
                    });
                })
            }, _('Switch Core'));
            node.classList.add('control-group');
            node.appendChild(lswitchBtn);
            node.appendChild(coreBtn);
            return node;
        };

        o = s.option(form.Flag, 'uselightgbm', _('Enable LightGBM'));
        o.default = '0';
        o.rmempty = false;
        o.depends('core', /smart/);

        o = s.option(form.ListValue, 'lgbm', _('Model Version'));
        o.rmempty = true;
        o.retain = true;
        o.default = 'Model.bin';
        o.value('Model.bin', _('Light'));
        o.value('Model-middle.bin', _('Middle'));
        o.value('Model-large.bin', _('Large'));
        o.depends('uselightgbm', '1');
        o.onchange = function (ev, section_id, value) {
            if (!lgbmBtn) return;
            const saved = this.cfgvalue(section_id);
            lgbmBtn.style.display = !saved || saved !== value ? '' : 'none';
        };
        o.renderWidget = function (section_id, option_index, cfgvalue) {
            const node = form.ListValue.prototype.renderWidget.apply(this, arguments);
            const defaultLabel = _('Download Model');
            lgbmBtn = E('button', {
                'class': 'btn cbi-button-action',
                'style': 'display:none;position:relative;overflow:hidden;',
                'click': ui.createHandlerFn(this, function () {
                    const mode = this.formvalue(section_id);
                    const bar = showButtonLoading(lgbmBtn, _('Please wait, downloading %s...').format(mode));
                    return nikki.download_file({
                        path: '/etc/nikki/run/Model.bin', task_id: 'Model',
                        url: 'https://github.com/vernesong/mihomo/releases/download/LightGBM-Model/' + mode,
                        onProgress: pct => bar.firstChild.style.width = pct + '%'
                    }).then(res => {
                        if (res?.status !== 'ok') {
                            ui.addNotification(null, E('p', _('Update failed: %s').format(res.message || res)), 'error');
                            return;
                        }
                        lgbmBtn.textContent = _('Model updated successfully!');
                        nikki.uciCommit('nikki', 'config', 'lgbm', mode);
                    }).catch(err => {
                    }).finally(() => {
                        setTimeout(() => {
                            lgbmBtn.textContent = defaultLabel;
                            lgbmBtn.style.display = 'none';
                        }, 2000);
                    });
                })
            }, defaultLabel);

            node.classList.add('control-group');
            node.appendChild(lgbmBtn);
            return node;
        };

        o = s.option(form.Flag, 'collectdata', _('Collect Training Data'));
        o.default = '0';
        o.rmempty = false;
        o.retain = true;
        o.depends('uselightgbm', '1');

        o = s.option(form.Value, 'sample_rate', _('Sample Rate'));
        o.datatype = 'range(0.1, 1.0)';
        o.default = '1.0';
        o.retain = true;
        o.placeholder = '0.1 ~ 1.0';
        // o.rmempty = false;
        o.depends('collectdata', '1');

        o = s.option(form.Value, 'smart_collector_size', _('Collector Size (MB)'));
        o.datatype = 'uinteger';
        o.placeholder = '100';
        o.retain = true;
        // o.rmempty = false;
        o.depends('collectdata', '1');

        o = s.option(form.Flag, 'prefer_asn', _('Prefer ASN'));
        o.default = '1';
        o.rmempty = false;
        o.retain = true;
        o.depends('uselightgbm', '1');

        o = s.option(form.ListValue, 'smart_strategy', _('Strategy'));
        o.value('sticky-sessions', _('Sticky Sessions (Recommended)'));
        o.value('round-robin', _('Round Robin'));
        o.value('consistent-hashing', _('Consistent Hashing'));
        o.default = 'sticky-sessions';
        o.rmempty = false;
        o.retain = true;
        o.depends('uselightgbm', '1');

        o = s.option(form.Value, 'policy_priority', _('Policy Priority'));
        o.placeholder = 'Premium:0.9;SG:1.2;HK:1.1';
        o.depends('uselightgbm', '1');

        o = s.option(form.ListValue, 'profile', _('Choose Profile'));
        o.optional = true;
        o.rmempty = false;

        for (const p of profiles) o.value('file:' + p.name, _('File:') + p.name);
        uci.sections('nikki', 'subscription', function (s, sid) {
            if (subfiles.length > 0) o.value('subscription:' + s['.name'], _('Subscription:') + s.name);
        });

        attachFileEditorButton(o, (value) => {
            const [type, id] = value.split(/:(.+)/);
            if (type === 'file') {
                const profile = profiles.find(p => p.name === id);
                return profile ? profile.path : null;
            }

            const subName = uci.get('nikki', id, 'name');
            if (!subName) return null;

            const subfile = subfiles.find(p => p.path.includes(subName));
            return subfile ? subfile.path : null;
        });

        o = s.option(form.ListValue, 'mixin_file', _('Select mixin file'), _('Select files to add to mixin'));
        o.optional = true;
        o.depends({ profile: 'subscription', '!contains': true });
        for (const p of mixinfiles) o.value(p.name, _('Mixin:') + p.name);
        attachFileEditorButton(o, (value) => {
            const mixinfile = mixinfiles.find(p => p.name === value);
            return mixinfile ? mixinfile.path : null;
        });

        o = s.option(form.Flag, 'url_enabled', _('Subscription'), _('为启动配置添加已经存在订阅的地址'));
        o.depends({ profile: 'file', '!contains': true, core_only: 0 });

        o = s.option(form.Flag, 'core_only', _('Core Only'), _('When enabled, mixin configs will not be used; Mihomo will auto-configure instead'));
        o.depends({ profile: 'file', '!contains': true });
        o.rmempty = false;

        o = s.option(form.Flag, 'test_profile', _('Test Profile'));
        o.rmempty = false;

        o = s.option(form.Value, 'start_delay', _('Start Delay'));
        o.datatype = 'uinteger';
        o.placeholder = _('Start Immidiately');

        o = s.option(form.Flag, 'scheduled_restart', _('Scheduled Restart'));
        o.rmempty = false;

        o = s.option(form.Value, 'scheduled_restart_cron', _('Scheduled Restart Cron'));
        o.retain = true;
        o.rmempty = false;
        o.depends('scheduled_restart', '1');
        o.renderWidget = function (section_id, option_index, cfgvalue) {
            const node = form.Value.prototype.renderWidget.apply(this, arguments);
            const btn = E('button', {
                'class': 'btn cbi-button-positive',
                'click': ui.createHandlerFn(this, function (ev) {
                    const val = this.formvalue(section_id).trim().replace(/\s+/g, ' ');
                    if (!val)
                        return ui.addNotification(null, E('p', _('Please enter a cron expression first.')));

                    const fields = val.split(' ');
                    if (fields.length !== 5)
                        return ui.addNotification(null, E('p', _('Invalid cron expression.')));
                    window.open('https://crontab.guru/#' + fields.join('_'), '_blank');
                })
            }, _('verify'));
            node.classList.add('control-group');
            node.appendChild(btn);
            return node;
        };

        o = s.option(form.Value, 'github_token', _('GitHub token'));
        o.password = true;
        o.renderWidget = function () {
            let node = form.Value.prototype.renderWidget.apply(this, arguments);
            (node.querySelector('.control-group') || node).appendChild(E('button', {
                'class': 'btn cbi-button-apply', 'title': _('Save'),
                'click': ui.createHandlerFn(this, () => {
                    return this.map.save(null, true).then(() => {
                        ui.changes.apply(true);
                    });
                }, this.option)
            }, _('Save')));
            return node;
        };

        s = m.section(form.NamedSection, 'procd', 'procd', _('procd Config'));
        s.tab('general', _('General Config'));
        s.tab('rlimit', _('RLIMIT Config'));
        s.tab('environment_variable', _('Environment Variable Config'));

        o = s.taboption('general', form.Flag, 'fast_reload', _('Fast Reload'));
        o.rmempty = false;

        o = s.taboption('rlimit', form.Value, 'rlimit_nproc_soft', _('Number of Processes Soft Limit'));
        o.datatype = 'uinteger';

        o = s.taboption('rlimit', form.Value, 'rlimit_nproc_hard', _('Number of Processes Hard Limit'));
        o.datatype = 'uinteger';

        o = s.taboption('rlimit', form.Value, 'rlimit_address_space_soft', _('Address Space Size Soft Limit'));
        o.datatype = 'uinteger';
        o.placeholder = _('Unlimited');

        o = s.taboption('rlimit', form.Value, 'rlimit_address_space_hard', _('Address Space Size Hard Limit'));
        o.datatype = 'uinteger';
        o.placeholder = _('Unlimited');

        o = s.taboption('rlimit', form.Value, 'rlimit_data_soft', _('Heap Size Soft Limit'));
        o.datatype = 'uinteger';
        o.placeholder = _('Unlimited');

        o = s.taboption('rlimit', form.Value, 'rlimit_data_hard', _('Heap Size Hard Limit'));
        o.datatype = 'uinteger';
        o.placeholder = _('Unlimited');

        o = s.taboption('rlimit', form.Value, 'rlimit_stack_soft', _('Stack Size Soft Limit'));
        o.datatype = 'uinteger';
        o.placeholder = _('Unlimited');

        o = s.taboption('rlimit', form.Value, 'rlimit_stack_hard', _('Stack Size Hard Limit'));
        o.datatype = 'uinteger';
        o.placeholder = _('Unlimited');

        o = s.taboption('rlimit', form.Value, 'rlimit_nofile_soft', _('Number of Open Files Soft Limit'));
        o.datatype = 'uinteger';

        o = s.taboption('rlimit', form.Value, 'rlimit_nofile_hard', _('Number of Open Files Hard Limit'));
        o.datatype = 'uinteger';

        o = s.taboption('environment_variable', form.Value, 'env_go_max_procs', 'GOMAXPROCS');
        o.datatype = 'uinteger';
        o.placeholder = _('Unlimited');

        o = s.taboption('environment_variable', form.Value, 'env_go_mem_limit', 'GOMEMLIMIT');
        o.datatype = 'uinteger';
        o.placeholder = _('Unlimited');

        o = s.taboption('environment_variable', form.DynamicList, 'env_safe_paths', _('Safe Paths'));
        o.load = function (section_id) {
            return this.super('load', section_id)?.split(':');
        };
        o.write = function (section_id, formvalue) {
            this.super('write', section_id, formvalue?.join(':'));
        };

        o = s.taboption('environment_variable', form.Flag, 'env_disable_loopback_detector', _('Disable Loopback Detector'));
        o.rmempty = false;

        o = s.taboption('environment_variable', form.Flag, 'env_disable_quic_go_gso', _('Disable GSO of quic-go'));
        o.rmempty = false;

        o = s.taboption('environment_variable', form.Flag, 'env_disable_quic_go_ecn', _('Disable ECN of quic-go'));
        o.rmempty = false;

        o = s.taboption('environment_variable', form.Flag, 'env_skip_system_ipv6_check', _('Skip System IPv6 Check'));
        o.rmempty = false;

        return m.render().then(L.bind(function (m, nodes) {
            L.Poll.add(L.bind(function () {
                nikki.status('nikki').then((r) => {
                    ['reload', 'ui_url'].forEach(p => {
                        const el = m.findElement('id', 'cbi-nikki-status-' + p);
                        el.querySelectorAll('select, button').forEach(ctrl => {
                            ctrl.disabled = !r;
                        });
                    });
                    setStatus(m.findElement('id', 'core_status'), r);
                });
            }, this), 5);
            return nodes;
        }, this, m));
    }
});
