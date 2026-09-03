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

function setStatus(element, running) {
    if (element) {
        element.style.color = running ? 'green' : 'red';
        element.textContent = running ? _('Running') : _('Not Running');
    }
    return element;
}

function modalnotify(title, children, timeout, ...classes) {
    function fadeOut(element) {
        element?.classList.replace('fade-in', 'fade-out');
        setTimeout(() => element?.remove());
    };

    const modalContainer = document.querySelector('#modal_overlay .modal');
    if (!modalContainer) return;
    const msg = E('div', {
        'class': 'alert-message fade-in',
        'style': 'display:flex; margin: 10px 0;',
        transitionend: function (ev) {
            const node = ev.currentTarget;
            if (node.parentNode && node.classList.contains('fade-out')) {
                node.parentNode.removeChild(node);
            };
        }
    }, [
        E('div', { 'style': 'flex:10' }),
        E('div', { 'style': 'flex:1 1 auto; display:flex' }, [
            E('button', {
                'class': 'btn', 'style': 'margin-left:auto; margin-top:auto',
                'click': () => fadeOut(msg)
            }, _('Dismiss'))
        ])
    ]);

    L.dom.append(msg.firstElementChild, children);
    msg.classList.add(...classes);
    modalContainer.insertBefore(msg, modalContainer.firstChild);
    if (typeof timeout === 'number' && timeout > 0) {
        setTimeout(() => fadeOut(msg), timeout);
    };
    return msg;
};

function attachFileEditorButton(o, resolveTarget) {
    if (!o.vallist || o.vallist.length === 0) return;
    o.renderWidget = function (section_id, option_index, cfgvalue) {
        const self = this;
        const node = form.ListValue.prototype.renderWidget.apply(this, arguments);
        const btn = E('button', {
            'class': 'btn cbi-button-positive',
            'click': ui.createHandlerFn(this, function (ev) {
                ev.stopPropagation();
                ev.preventDefault();

                const target = resolveTarget(self.formvalue(section_id));
                if (!target) return;
                const { title, path } = target;
                const textarea = E('textarea', {
                    'style': 'width:100%;height:400px;box-sizing:border-box;font-family:Consolas,monospace;white-space:pre-wrap;word-break:break-all;'
                });
                const aceDiv = E('div', { 'style': 'width:100%;height:400px;display:none;' });

                return L.resolveDefault(fs.read_direct(path), '').then((content) => {
                    textarea.value = content;

                    ui.showModal(_('Edit: %s').format(title), [
                        aceDiv, textarea,
                        E('div', { 'class': 'button-row' }, [
                            E('button', {
                                'class': 'btn cbi-button-positive',
                                'click': ui.createHandlerFn(self, function () {
                                    const finalValue = window.ace?.edit ? aceDiv.env?.editor?.getValue() ?? textarea.value : textarea.value;
                                    return nikki.writefile(path, finalValue)
                                        .then(() => {
                                            ui.addTimeLimitedNotification(null,
                                                E('p', _('Config saved, files updated')), 5000, 'info');
                                            ui.hideModal();
                                        })
                                        .catch((e) => {
                                            ui.addTimeLimitedNotification(null, E('p', e.message), 8000, 'error');
                                        });
                                })
                            }, _('Save')),
                            E('button', { 'class': 'btn', 'click': ui.hideModal }, _('Dismiss'))
                        ])
                    ], 'cbi-modal');

                    return nikki.preloadAce().then(() => {
                        textarea.style.display = 'none';
                        aceDiv.style.display = '';
                        const editor = ace.edit(aceDiv);
                        editor.setOptions({
                            fontSize: '14px',
                            printMarginColumn: -1,
                            showPrintMargin: true,
                            mode: 'ace/mode/yaml',
                            fontFamily: 'Consolas',
                            theme: 'ace/theme/monokai'
                        });
                        editor.session.setUseWrapMode(true);
                        editor.session.setWrapLimitRange(null, null);
                        editor.setValue(content || '', -1);
                        aceDiv.env = { editor };
                        setTimeout(() => editor.resize(true), 0);
                    }).catch(() => Object.assign(textarea.style, {
                        fontFamily: 'Consolas', background: '#1e1e1e', color: '#d4d4d4'
                    }));
                });
            })
        }, _('Edit'));

        node.classList.add('control-group');
        node.appendChild(btn);
        return node;
    };
}

const coreDownload = function (list, current) {
    if (!current) return false;
    if (current === 'alpha') return true;
    const exists = (list?.some(f =>
        f.type === 'file' && f.name.includes(`${current}-mihomo`)
    ) ?? false);
    return !exists;
};

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
                    'class': 'cbi-button cbi-button-apply',
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
        o.depends('nikki.config.mihomo_running', 'true');
        o.onclick = function () { return nikki.service('nikki', 'reload'); };

        o = os.option(form.Button, 'restart');
        o.inputstyle = 'negative';
        o.inputtitle = _('Restart Service');
        o.depends('nikki.config.mihomo_running', 'true');
        o.onclick = function () { return nikki.service('nikki', 'restart'); };

        o = os.option(form.ListValue, 'ui_url');
        o.ucisection = 'mixin';
        o.ucioption = 'ui_url';
        o.depends('nikki.config.mihomo_running', 'true');
        o.load = function (section_id) {
            self.install_status = {};
            const ui_path = uci.get('nikki', 'mixin', 'ui_path');
            return Promise.all(nikki.ui_array.map(([url, name]) =>
                fs.stat(`${nikki.runDir}/${ui_path}/${name}/index.html`)
                    .then(() => {
                        self.install_status[url] = true;
                        return [url, name];
                    })
                    .catch(() => {
                        self.install_status[url] = false;
                        return [url, `${name} (${_('Not Installed')})`];
                    })
            )).then(entries => {
                entries.forEach(([url, label]) => this.value(url, label));
                return form.ListValue.prototype.load.apply(this, arguments);
            });
        };
        o.renderWidget = function (section_id) {
            let el = form.ListValue.prototype.renderWidget.apply(this, arguments);
            el.classList.add('control-group');
            const default_label = _('Open Dashboard');
            const uibtn = E('button', {
                'class': 'btn cbi-button-positive',
                'click': ui.createHandlerFn(this, function () {
                    const select = el.firstChild;
                    const current_url = select.value;
                    const ui_entry = nikki.ui_array.find(x => x[0] === current_url);
                    const openOrDownload = self.install_status[current_url]
                        ? Promise.resolve()
                        : (() => {
                            uibtn.textContent = _('Please wait, downloading %s...').format(ui_entry[1]);
                            return nikki.update_ui(current_url, ui_entry[1])
                                .then(result => {
                                    if (result?.status === 'ok') {
                                        self.install_status[current_url] = true;
                                        const opt = Array.from(select.options).find(o => o.value === current_url);
                                        if (opt) opt.textContent = ui_entry[1];
                                        return;
                                    }
                                    throw new Error(result?.message);
                                })
                                .finally(() => uibtn.textContent = default_label);
                        })();

                    return openOrDownload
                        .then(() => nikki.openDashboard(ui_entry[1]))
                        .catch(e => ui.addNotification(null, E('p', _('Update failed: ') + e), 'error'));
                })
            }, default_label);
            el.appendChild(uibtn);
            return el;
        };

        s = m.section(form.NamedSection, 'config', 'config', _('App Config'));
        o = s.option(form.Flag, 'enabled', _('Enable'));
        o.rmempty = false;

        o = s.option(form.HiddenValue, 'mihomo_running');
        o.write = function () {};
        o.cfgvalue = () => running;

        o = s.option(form.ListValue, 'core', _('Core'));
        o.value('meta', _('Meta'));
        o.value('alpha', _('Alpha'));
        o.value('smart', _('Smart'));
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
                    const select = node.firstChild;
                    const options = Array.from(select.options)
                        .filter(opt => opt.value)
                        .map(opt => ({ value: opt.value, text: opt.text || opt.value }));

                    const tableEl = E('table', { 'class': 'table cbi-section-table' }, [
                        E('tr', { 'class': 'tr table-titles' }, [
                            E('th', { 'class': 'th' }, _('Type')),
                            E('th', { 'class': 'th' }, _('Local Version')),
                            E('th', { 'class': 'th' }, _('Remote Version')),
                            E('th', { 'class': 'th' }, _('Status')),
                            E('th', { 'class': 'th cbi-section-actions' })
                        ])
                    ]);

                    const content = E('div', { 'class': 'cbi-section' }, [
                        tableEl, E('em', { 'class': 'spinning' }, _('Loading...'))
                    ]);

                    ui.showModal(_('Core Version Management'), [
                        content,
                        E('div', { 'class': 'right' }, [
                            E('button', { 'class': 'btn', 'click': ui.hideModal }, _('Close'))
                        ])
                    ], 'cbi-modal');
                    return Promise.all(options.map((opt) => {
                        return Promise.all([
                            nikki.get_core_version(opt.value)
                                .then(res => ({ version: res.version || '-' }))
                                .catch(() => ({ version: '-' })),
                            nikki.get_core_url(opt.value, core_version)
                                .then(res => {
                                    const version = opt.value === 'meta'
                                        ? (res.url.match(/\/download\/([^/]+)\//) || [, '-'])[1]
                                        : (res.url.match(/compatible-([^/]+)\.gz$/) || [, '-'])[1];
                                    return { version, url: res.url };
                                })
                                .catch(() => ({ version: '-', url: null })),
                            // fs.read_direct('/etc/nikki/resources.json')
                            //     .then(s => JSON.parse(s))
                            //     .then(j => {
                            //         const item = j[opt.value];
                            //         return item ? { version: item.remoteVer, url: item.url } : { version: '-', url: null };
                            //     }).catch(() => ({ version: '-', url: null }))
                        ]).then(res => ({
                            type: opt.value, name: opt.text, hasurl: res[1].url,
                            localver: res[0].version, remotever: res[1].version,
                        }));
                    })).then((res) => {
                        content.querySelector('em.spinning')?.remove();
                        const render = () => {
                            const rows = [];
                            res.forEach(item => {
                                const { type, name, localver, remotever, hasurl } = item;
                                const isInstalled = localver !== '-';
                                const iscore = v.core && v.core === localver;
                                const isLatest = isInstalled && localver === remotever;

                                const switchLabel = iscore ? _('In use') : _('Switch Core');
                                const switchBtn = E('button', {
                                    'style': 'min-width: 5.5rem;',
                                    'disabled': iscore || type == 'smart' ? true : null,
                                    'class': `btn cbi-button-action ${iscore ? '' : 'important'}`,
                                    'click': ui.createHandlerFn(this, function (ev) {
                                        const b = ev.target;
                                        b.textContent = _('Switching...');
                                        return nikki.switch_core(type, core_version, hasurl)
                                            .then((ret) => {
                                                const pending = ret && ret.status === 'pending';
                                                if (!pending) {
                                                    v.core = remotever;
                                                    item.localver = remotever;
                                                    render();
                                                }
                                                modalnotify(null, E('p', (pending
                                                    ? _('%s is downloading, please refresh later')
                                                    : _('%s switch successful, service restarted')
                                                ).format(name)), 3000, pending ? 'info' : 'success');
                                            })
                                            .catch((err) => {
                                                b.textContent = switchLabel;
                                                modalnotify(null, E('p', _('%s switch failed: %s').format(name, String(err))), 'error');
                                            });
                                    })
                                }, switchLabel);

                                const dlLabel = isLatest
                                    ? _('Redownload')
                                    : isInstalled ? _('Update') : _('Download');
                                const dlBtn = E('button', {
                                    'style': 'min-width: 5.5rem;',
                                    'disabled': hasurl ? null : true,
                                    'class': `btn cbi-button-${isLatest ? 'negative' : 'positive'}`,
                                    'click': ui.createHandlerFn(this, function (ev) {
                                        const b = ev.target;
                                        b.textContent = _('Downloading...');
                                        return nikki.cache_core(type, core_version, hasurl)
                                            .then(() => {
                                                item.localver = remotever;
                                                render();
                                                modalnotify(null, E('p', _('%s download successful').format(name)), 3000, 'success');
                                            })
                                            .catch((err) => {
                                                b.textContent = dlLabel;
                                                modalnotify(null, E('p', _('%s download failed: %s').format(name, String(err))), 'error');
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

                                rows.push([
                                    name, E('code', [localver]), remoteCell, status,
                                    E('div', { 'style': 'display: flex; gap: .5rem;' }, [dlBtn, switchBtn])
                                ]);
                            });
                            cbi_update_table(tableEl, rows, _('No data available'));
                        };

                        render();
                    }).catch((err) => {
                        content.innerHTML = '';
                        content.appendChild(E('p', { 'style': 'text-align: center; color: #f44336; padding: 2rem 0;' }, _('Request exception: %s').format(String(err))));
                    });
                })
            }, default_label);
            lswitchBtn = E('button', {
                'style': 'display:none',
                'class': 'btn cbi-button-positive',
                'click': ui.createHandlerFn(this, function (ev) {
                    ev.preventDefault();
                    if (!core_version)
                        return ui.addNotification(null,
                            E('p', _('Unknown device architecture, cannot download core.')), 'error');

                    const val = self.formvalue(section_id).trim();
                    if (!val)
                        return ui.addNotification(null, E('p', _('Please select a core first.')), 'error');
                    const saved = self.cfgvalue(section_id);
                    if (saved === val) return;

                    return nikki.switch_core(val, core_version)
                        .then(function (res) {
                            if (res?.status !== 'ok')
                                throw new Error(res.message || _('Switch failed'));

                            return self.map.save(null, true).then(function () {
                                return uci.save()
                                    .then(L.bind(ui.changes.init, ui.changes))
                                    .then(L.bind(ui.changes.apply, ui.changes));
                            });

                        })
                        .catch(function (err) {
                            ui.addNotification(null,
                                E('p', _('Switch failed: %s').format(err.message || err)), 'error');
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
        o.depends('core', 'smart');

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
            const lgbm = this.cfgvalue(section_id);
            lgbmBtn.style.display = !lgbm || lgbm != value ? '' : 'none';
        };

        o.renderWidget = function (section_id, option_index, cfgvalue) {
            const default_label = _('Download Model');
            const node = form.ListValue.prototype.renderWidget.apply(this, arguments);
            lgbmBtn = E('button', {
                'class': 'btn cbi-button-action',
                'style': !cfgvalue ? '' : 'display:none',
                'click': ui.createHandlerFn(this, function () {
                    const mode = this.formvalue(section_id).trim();
                    if (!mode) return false;

                    lgbmBtn.textContent = _('Please wait, downloading %s...').format(mode);
                    return nikki.download_file({
                        url: 'https://github.com/vernesong/mihomo/releases/download/LightGBM-Model/' + mode,
                        path: '/etc/nikki/run/Model.bin'
                    }).then(function (res) {
                        if (res?.status !== 'ok')
                            throw new Error(res.message || _('Update failed'));

                        lgbmBtn.textContent = _('Model updated successfully! Path: %s').format('/etc/nikki/run/Model.bin');
                        setTimeout(function () {
                            lgbmBtn.style.display = 'none';
                        }, 3000);
                        nikki.uciSetAndCommit('nikki', 'config', 'lgbm', mode);
                        return nikki.service('nikki', 'reload');
                    }).catch(function (err) {
                        ui.addNotification(null,
                            E('p', _('Update failed: %s').format(err.message || err)), 'error');
                    });
                })
            }, default_label);
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
            if (type === 'file') return { title: id, path: `/etc/nikki/profiles/${id}` };

            const subName = uci.get('nikki', id, 'name');
            if (!subName) return null;

            const fileName = subName + '.yaml';
            return { title: fileName, path: `/etc/nikki/subscriptions/${fileName}` };
        });

        o.onchange = function (ev, section_id, value) {
            const el = this.map.lookupOption('core_only', section_id)[0];
            el?.getUIElement(section_id).setValue('0');
        };

        o = s.option(form.ListValue, 'mixin_file', _('Select mixin file'), _('Select files to add to mixin'));
        o.optional = true;
        o.depends({ profile: 'subscription', '!contains': true });

        for (const p of mixinfiles) o.value(p.name, _('Mixin:') + p.name);

        attachFileEditorButton(o, (value) => {
            if (!value) return null;
            return { title: value, path: `/etc/nikki/mixin/${value}` }
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
                    ev.preventDefault();
                    const val = this.formvalue(section_id).trim().replace(/\s+/g, ' ');
                    if (!val)
                        return ui.addNotification(null,
                            E('p', _('Please enter a cron expression first.')));
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
                'class': 'cbi-button cbi-button-apply',
                'title': _('Save'),
                'click': ui.createHandlerFn(this, () => {
                    return this.map.save(null, true).then(() => {
                        ui.changes.apply(true);
                    });
                }, this.option)
            }, [_('Save')]));

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
            const el = m.findElement('data-name', 'mihomo_running');
            if (el) el.style.display = 'none';
            L.Poll.add(L.bind(function () {
                nikki.status('nikki').then((r) => {
                    const res = m.lookupOption('mihomo_running', 'config', 'nikki')[0];
                    if (res) {
                        res.getUIElement('config').setValue(r);
                        os.checkDepends();
                    }
                    setStatus(m.findElement('id', 'core_status'), r);
                });
            }, this), 5);
            return nodes;
        }, this, m));
    }
});
