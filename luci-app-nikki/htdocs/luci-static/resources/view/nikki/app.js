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

                const value = self.formvalue(section_id) || cfgvalue;
                const target = resolveTarget(value);
                if (!target) return;
                const { title, path } = target;
                const textarea = E('textarea', {
                    style: 'width:100%;height:400px;box-sizing:border-box;font-family:Consolas,monospace;white-space:pre-wrap;word-break:break-all;'
                });
                const aceDiv = E('div', { style: 'width:100%;height:400px;display:none;' });

                return L.resolveDefault(fs.read_direct(path), '').then((content) => {
                    textarea.value = content;

                    ui.showModal(_('Edit: %s').format(title), [
                        aceDiv, textarea,
                        E('div', { 'class': 'right', style: 'margin-top:10px;' }, [
                            E('button', { 'class': 'btn', 'click': ui.hideModal }, _('Cancel')),
                            ' ',
                            E('button', {
                                'class': 'btn cbi-button-positive',
                                'click': ui.createHandlerFn(self, function () {
                                    const finalValue = window.ace?.edit ? aceDiv.env?.editor?.getValue() ?? textarea.value : textarea.value;
                                    return nikki.writefile(path, finalValue)
                                        .then(() => {
                                            ui.addTimeLimitedNotification(null, E('p', _('Saved, reloading...')), 5000, 'info');
                                            ui.hideModal();
                                        })
                                        .catch((e) => {
                                            ui.addTimeLimitedNotification(null, E('p', e.message), 8000, 'error');
                                        });
                                })
                            }, _('Save'))
                        ])
                    ], 'cbi-modal');

                    return preloadAce().then(() => {
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

return view.extend({
    aceEditor: null,
    load: function () {
        return Promise.all([
            nikki.version(),
            nikki.status(),
            nikki.listfiles('/etc/nikki/mixin'),
            nikki.listfiles('/etc/nikki/profiles'),
            nikki.listfiles('/etc/nikki/subscriptions'),
            uci.load('nikki')
        ]);
    },
    render: function ([v, running, mixinfiles, profiles, subfiles]) {
        let m, s, o;
        preloadAce().catch(() => {});

        m = new form.Map('nikki', _('Nikki'), `${_('Transparent Proxy with Mihomo on OpenWrt.')} <a href="https://github.com/nikkinikki-org/OpenWrt-nikki/wiki" target="_blank">${_('How To Use')}</a>`);

        s = m.section(form.TypedSection);
        s.render = function () {
            return E('p', [
                E('button', {
                    'class': 'cbi-button cbi-button-apply',
                    'click': ui.createHandlerFn(this, () => {
                        let weight = document.getElementById('_connection_check_results');
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
                }, _('Connection check')),
                E('strong', { id: '_connection_check_results' }, [
                    E('span', { style: 'color:gray' }, ' ' + _('unchecked'))
                ])
            ])
        };

        s = m.section(form.TableSection, 'status', _('Status'));
        s.anonymous = true;

        o = s.option(form.DummyValue, '_app_version', _('App Version'));
        o.load = () => v.app;

        o = s.option(form.DummyValue, '_core_version', _('Core Version'));
        o.load = () => v.core ?? '';

        o = s.option(form.DummyValue, '_core_status', _('Core Status'));
        o.cfgvalue = function () {
            return setStatus(E('span', { id: 'core_status', style: 'font-style: italic; font-weight: bold;' }), running);
        };

        L.Poll.add(function () {
            return L.resolveDefault(nikki.status(), false).then(function (r) {
                setStatus(document.getElementById('core_status'), r);
            });
        });

        o = s.option(form.Button, 'reload');
        o.inputstyle = 'action';
        o.inputtitle = _('Reload Service');
        o.onclick = function () { return nikki.service('reload'); };

        o = s.option(form.Button, 'restart');
        o.inputstyle = 'negative';
        o.inputtitle = _('Restart Service');
        o.onclick = function () { return nikki.service('restart'); };

        o = s.option(form.ListValue, 'ui_url');
        o.ucisection = 'mixin';
        o.ucioption = 'ui_url';
        o.load = function (section_id) {
            const ui_path = uci.get('nikki', 'mixin', 'ui_path');
            this.install_status = {};
            return Promise.all(nikki.ui_array.map(([url, name]) =>
                fs.stat(`${nikki.runDir}/${ui_path}/${name}/index.html`)
                    .then(() => {
                        this.install_status[url] = true;
                        return [url, name];
                    })
                    .catch(() => {
                        this.install_status[url] = false;
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
            const self = this;
            const btn = E('button', {
                'class': 'btn cbi-button-positive',
                'click': ui.createHandlerFn(this, function () {
                    const select = el.firstChild;
                    const current_url = select.value;
                    const ui_entry = nikki.ui_array.find(x => x[0] === current_url);
                    const openOrDownload = self.install_status[current_url]
                        ? Promise.resolve()
                        : (() => {
                            btn.textContent = _('Please wait, downloading %s...').format(ui_entry[1]);
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
                                .finally(() => btn.textContent = default_label);
                        })();

                    return openOrDownload
                        .then(() => nikki.openDashboard(ui_entry[1]))
                        .catch(e => ui.addNotification(null, E('p', _('Update failed: ') + e), 'error'));
                })
            }, default_label);
            el.appendChild(btn);
            return el;
        };

        s = m.section(form.NamedSection, 'config', 'config', _('App Config'));

        o = s.option(form.Flag, 'enabled', _('Enable'));
        o.rmempty = false;

        o = s.option(form.ListValue, 'profile', _('Choose Profile'));
        o.optional = true;

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
            const lEl = this.map.lookupOption('core_only', section_id)[0];
            lEl?.getUIElement(section_id).setValue('0');
        };

        o = s.option(form.ListValue, 'mixin_file', _('Select mixin file'), _('Select files to add to mixin'));
        o.optional = true;
        o.depends({ profile: 'subscription', '!contains': true });

        for (const p of mixinfiles) o.value(p.name, _('Mixin:') + p.name);

        attachFileEditorButton(o, (value) => ({
            title: value, path: `/etc/nikki/mixin/${value}`
        }));

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
            const input = node.querySelector('input');
            const btn = E('button', {
                'class': 'btn cbi-button-positive',
                'click': ui.createHandlerFn(this, function (ev) {
                    ev.preventDefault();
                    const val = input.value.trim();
                    if (!val) {
                        ui.addNotification(null, E('p', _('Please enter a cron expression first.')));
                        return;
                    }
                    const encoded = val.split(/\s+/).join('_');
                    window.open('https://crontab.guru/#' + encoded, '_blank');
                })
            }, _('verify'));
            node.classList.add('control-group');
            node.appendChild(btn);
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

        return m.render();
    }
});
