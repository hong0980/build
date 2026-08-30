'use strict';
'require fs';
'require ui';
'require uci';
'require form';
'require view';
'require tools.nikki as nikki';

// curl -N -H "Authorization: Bearer $api_secret" "http://$api_listen/logs?format=structured" >> "$CORE_LOG_PATH" &

const parseCoreLogLine = (line, dateObj) => {
    const m = line.match(/^time="([^"]+)"\s+level=(\w+)\s+msg="(.*)"$/);
    if (!m) return null;
    const [, time, level, msg] = m;
    const t = dateObj.format(new Date(time));
    return { level, display: `[${t}] [${level.toUpperCase()}]: ${msg}` };
};


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
    load: function () {
        return Promise.all([
            L.resolveDefault(fs.read_direct(nikki.appLogPath), ''),
            L.resolveDefault(fs.read_direct(nikki.coreLogPath), ''),
            uci.load('system')
        ]);
    },

    formatted: function (rawLog, dateObj) {
        if (!rawLog) return '';
        return rawLog
            .split('\n')
            .map(parseLine)
            .filter(Boolean)
            .map(({ time, level, msg }) => {
                const d = new Date(time);
                const t = dateObj.format(d);
                return `[${t}] [${level.toUpperCase()}]: ${msg}`;
            })
            .join('\n');
    },

    render: function ([appLog, coreLog]) {
        let m, s, o;
        const self = this;
        const tz = uci.get('system', '@system[0]', 'zonename')?.replaceAll(' ', '_');
        const ts = uci.get('system', '@system[0]', 'clock_timestyle') || 0;
        const hc = uci.get('system', '@system[0]', 'clock_hourcycle') || 0;
        const dateObj = new Intl.DateTimeFormat(undefined, {
            dateStyle: 'medium',
            timeStyle: ts === 0 ? 'long' : 'full',
            hourCycle: hc === 0 ? undefined : hc,
            timeZone: tz
        });

        m = new form.Map('nikki');
        s = m.section(form.NamedSection, 'log', 'log', _('Log'));
        s.tab('core_log', _('Core Log'));
        s.tab('app_log', _('App Log'));
        s.tab('log_config', _('Log Config'));
        s.tab('mihomoapi', _('Mihomo API'));

        const createLogOption = (tab, initialLog, parseFn = null, withLevelFilter = false) => {
            const opt = s.taboption(tab, form.DummyValue, `_${tab}`);
            opt.rows = 25;
            opt.wrap = false;
            opt.renderWidget = function (section_id, option_index, cfgvalue) {
                let el = form.TextValue.prototype.renderWidget.apply(this, arguments);
                const textareaEl = el.firstElementChild;
                textareaEl.style.cssText = 'width: 100%; font-family: Consolas;';
                textareaEl.wrap = 'off';
                const state = { raw: cfgvalue || '', reversed: true, level: 'all' };
                const renderText = () => {
                    let items = parseFn
                        ? state.raw.split('\n').map(parseFn).filter(Boolean)
                        : state.raw.split('\n').map((line) => ({ level: null, display: line }));
                    if (withLevelFilter && state.level !== 'all') {
                        items = items.filter((item) => item.level === state.level);
                    }
                    if (state.reversed) items = items.slice().reverse();
                    textareaEl.value = items.map((item) => item.display).join('\n');
                };

                textareaEl._logState = state;
                textareaEl._logRender = renderText;
                renderText();
                const reverseLabel = () => state.reversed ? _('△ Show Newest First') : _('▽ Show Oldest First');

                const buttons = [
                    E('button', {
                        'class': 'btn cbi-button-remove',
                        'click': ui.createHandlerFn(this, function () {
                            state.raw = '';
                            renderText();
                            return nikki.clearLog(tab === 'core_log' ? nikki.coreLogPath : nikki.appLogPath)
                        })
                    }, _('Clear Log')),
                    E('button', {
                        'class': 'btn cbi-button-positive',
                        'click': ui.createHandlerFn(this, function (ev) {
                            textareaEl.wrap = textareaEl.wrap === 'off' ? 'soft' : 'off';
                        })
                    }, _('Wrap')),
                    E('button', {
                        'class': 'btn cbi-button-action',
                        'click': ui.createHandlerFn(this, function (ev) {
                            state.reversed = !state.reversed;
                            renderText();
                            ev.target.textContent = reverseLabel();
                        })
                    }, reverseLabel())
                ];

                if (withLevelFilter) {
                    buttons.push(E('select', {
                        'class': 'cbi-input-select',
                        'style': 'width: auto; margin-left: auto;',
                        'change': function (ev) {
                            state.level = ev.target.value;
                            renderText();
                        }
                    }, [
                        E('option', { value: 'all' }, _('All Levels')),
                        E('option', { value: 'debug' }, _('Debug')),
                        E('option', { value: 'info' }, _('Info')),
                        E('option', { value: 'warning' }, _('Warning')),
                        E('option', { value: 'error' }, _('Error'))
                    ]));
                }

                const toolbar = E('div', { 'style': 'display: flex; gap: 12px; margin-bottom: 6px;' }, buttons);
                el.insertBefore(toolbar, textareaEl);
                return el;
            };
            opt.load = () => initialLog.trim();
            return opt;
        };

        createLogOption('app_log', appLog);
        createLogOption('core_log', coreLog, (line) => parseCoreLogLine(line, dateObj), true);

        o = s.taboption('log_config', form.Flag, 'clear_at_stop', _('Clear At Stop'));
        o.rmempty = false;

        o = s.taboption('log_config', form.Flag, 'scheduled_clear', _('Scheduled Clear'));
        o.rmempty = false;

        o = s.taboption('log_config', form.Value, 'scheduled_clear_cron', _('Scheduled Clear Cron'));
        o.retain = true;
        o.rmempty = false;
        o.depends('scheduled_clear', '1');

        o = s.taboption('log_config', form.Value, 'limit', _('Scheduled Clear Size Limit'));
        o.retain = true;
        o.rmempty = false;
        o.default = '1';
        o.datatype = 'uinteger';
        o.depends('scheduled_clear', '1');

        o = s.taboption('log_config', form.ListValue, 'limit_unit', _('Scheduled Clear Size Limit Unit'));
        o.retain = true;
        o.rmempty = false;
        o.default = 'MB';
        o.depends('scheduled_clear', '1');
        o.value('KB', 'KB');
        o.value('MB', 'MB');
        o.value('GB', 'GB');

        o = s.taboption('log_config', form.Button, '_generate_download_debug_log', _('Debug Log'));
        o.inputstyle = 'action';
        o.inputtitle = _('Generate & Download');
        o.onclick = function () {
            function timestamp() {
                const d = new Date();
                const pad = n => String(n).padStart(2, '0');
                return `${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}`;
            }

            return nikki.debug()
                .then(() => fs.read_direct(nikki.debugLogPath, 'blob'))
                .then(data => {
                    const url = window.URL.createObjectURL(data);
                    const link = document.createElement('a');
                    link.href = url;
                    link.download = `debug-${timestamp()}.md`;
                    link.click();
                    window.URL.revokeObjectURL(url);
                })
                .catch(function (e) {
                    ui.addNotification(null, E('p', _('Failed to export debug log: ') + e), 'error');
                });
        };

        o = s.taboption('mihomoapi', form.ListValue, '_api', _('Mihomo API'));
        o.write = function () {};
        const mihomoAPIs = [
            { key: 'version',          label: _('Version'),                method: 'GET',  path: '/version' },
            { key: 'configs',          label: _('Running Config'),         method: 'GET',  path: '/configs' },
            { key: 'proxies',          label: _('Proxies'),                method: 'GET',  path: '/proxies' },
            { key: 'group',            label: _('Proxy Groups'),           method: 'GET',  path: '/group' },
            { key: 'rules',            label: _('Rules'),                  method: 'GET',  path: '/rules' },
            { key: 'rule_providers',   label: _('Rule Providers'),         method: 'GET',  path: '/providers/rules' },
            { key: 'providers',        label: _('Proxy Providers'),        method: 'GET',  path: '/providers/proxies' },
            { key: 'connections_once', label: _('Connections (Snapshot)'), method: 'GET',  path: '/connections' },
            { key: 'dns_query',        label: _('DNS Query'),              method: 'GET',  path: '/dns/query', query: 'name=google.com&type=A' },
            { key: 'flush_fakeip',     label: _('Flush FakeIP Cache'),     method: 'POST', path: '/cache/fakeip/flush' },
            { key: 'flush_dns',        label: _('Flush DNS Cache'),        method: 'POST', path: '/cache/dns/flush' },
            { key: 'reload',           label: _('Reload Config'),          method: 'PUT',  path: '/configs', query: 'force=true', body: '{"path":"","payload":""}' },
            { key: 'geo',              label: _('Update Geo'),             method: 'POST', path: '/configs/geo', body: '{"path":"","payload":""}' },
            { key: 'upgrade_geo',      label: _('Update Geo (Upgrade)'),   method: 'POST', path: '/upgrade/geo', body: '{"path":"","payload":""}' },
            { key: 'upgrade',          label: _('Upgrade Core'),           method: 'POST', path: '/upgrade', query: 'force=true', body: '{"path":"","payload":""}' },
            { key: 'upgrade_ui',       label: _('Upgrade UI'),             method: 'POST', path: '/upgrade/ui' },
            { key: 'restart',          label: _('Restart Core'),           method: 'POST', path: '/restart', body: '{"path":"","payload":""}' },
        ];

        const mihomoAPIMap = {};
        mihomoAPIs.forEach(function (api) {
            mihomoAPIMap[api.key] = api;
        });

        mihomoAPIs.forEach(function (api) { o.value(api.key, api.label); });
        o.renderWidget = function (section_id, option_index, cfgvalue) {
            const node = form.ListValue.prototype.renderWidget.apply(this, arguments);
            const btn = E('button', {
                'class': 'btn cbi-button-action',
                'click': ui.createHandlerFn(this, function () {
                    const selected = s.formvalue(section_id, '_api');
                    const api = mihomoAPIMap[selected];

                    if (!api) {
                        ui.addNotification(null, E('p', _('Unknown API: %s').format(selected)), 'error');
                        return;
                    }

                    const textarea = E('textarea', {
                        'style': 'width:100%;height:300px;box-sizing:border-box;' +
                                 'font-family:Consolas,monospace;white-space:pre;' +
                                 'word-break:break-all;background:#1e1e1e;color:#d4d4d4;' +
                                 'border:none;padding:10px;font-size:14px;'
                    });
                    const aceDiv = E('div', { 'style': 'width:100%;height:300px;display:none;' });

                    ui.showModal(_('API Response: %s').format(api.label), [
                        E('div', { class: 'cbi-section', style: 'padding:10px;' }, [
                            E('div', { style: 'margin-bottom:10px;' }, [
                                E('strong', {}, _('Method: ')), E('span', {}, api.method),
                                E('span', {}, ' | '),
                                E('strong', {}, _('Path: ')), E('span', {}, api.path)
                            ]),
                            E('p'), aceDiv, textarea
                        ]),
                        E('div', { class: 'right' }, [
                            E('button', { 'class': 'btn cbi-button', 'click': ui.hideModal }, _('Close'))
                        ])
                    ], 'cbi-modal');

                    return nikki.mihomoAPI(
                        api.method, api.path, api.query || '', api.body || ''
                    ).then(function (res) {
                        const success = res && res.success;
                        const status  = res ? res.status : 0;
                        const data    = res ? res.data : null;
                        const message = res ? res.message : null;

                        if (!success) {
                            ui.hideModal();
                            ui.addNotification(null, E('p', _('Request failed: %s').format(message || ('HTTP ' + status))), 'error');
                            return;
                        }

                        const isEmpty = (data === null || data === undefined);
                        const isOk = (typeof data === 'object' && data !== null && data.status === 'ok');
                        if (api.method === 'POST' && (isEmpty || isOk)) {
                            ui.showModal(_('API Response: %s').format(api.label), [
                                E('div', { class: 'cbi-section', style: 'text-align:center;padding:40px 20px;' }, [
                                    E('div', { style: 'font-size:56px;margin-bottom:15px;' }, '✓'),
                                    E('div', { style: 'font-size:18px;font-weight:bold;color:#28a745;margin-bottom:8px;' },
                                        _('Operation Successful')),
                                    E('div', { style: 'color:#666;font-size:14px;' },
                                        _('%s completed successfully').format(api.label)),
                                    E('div', { style: 'margin-top:20px;' }, [
                                        E('strong', {}, _('Status: ')),
                                        statusBadge
                                    ])
                                ]),
                                E('div', { class: 'right', style: 'margin-top:10px;' }, [
                                    E('button', {'class': 'btn cbi-button', 'click': ui.hideModal}, _('Close'))
                                ])
                            ]);
                            return;
                        }

                        let text = '';
                        if (data !== null && data !== undefined) {
                            if (typeof data === 'string')
                                text = data;
                            else {
                                try { text = JSON.stringify(data, null, 2); }
                                catch (e) { text = String(data); }
                            }
                        } else {
                            text = _('No data returned (HTTP %s)').format(status);
                        }

                        textarea.value = text;

                        return preloadAce().then(function () {
                            textarea.style.display = 'none';
                            aceDiv.style.display = '';
                            const editor = ace.edit(aceDiv);
                            editor.setOptions({
                                fontSize: '14px',
                                printMarginColumn: -1,
                                showPrintMargin: false,
                                mode: 'ace/mode/json',
                                fontFamily: 'Consolas, monospace',
                                theme: 'ace/theme/monokai',
                                readOnly: true
                            });
                            editor.session.setUseWrapMode(true);
                            editor.session.setOption('useWorker', false);
                            editor.setValue(text, -1);
                            aceDiv.env = { editor };
                            setTimeout(function () { editor.resize(true); }, 0);
                        }).catch(function () {
                            Object.assign(textarea.style, {
                                fontFamily: 'Consolas, monospace',
                                background: '#1e1e1e', color: '#d4d4d4'
                            });
                        });

                    }).catch(function (err) {
                        ui.hideModal();
                        ui.addNotification(null, E('p', _('Request error: %s').format(err.message || err)), 'error');
                    });
                })
            }, _('Execute'));

            node.classList.add('control-group');
            node.appendChild(btn);
            return node;
        };

        L.Poll.add(L.bind(function () {
            return Promise.all([
                L.resolveDefault(fs.read_direct(nikki.appLogPath), ''),
                L.resolveDefault(fs.read_direct(nikki.coreLogPath), ''),
            ]).then(function ([app_log, core_log]) {
                const appEl = document.getElementById(`widget.cbid.nikki.log._app_log`);
                if (appEl && appEl._logState) {
                    appEl._logState.raw = app_log.trim();
                    appEl._logRender();
                }
                const coreEl = document.getElementById(`widget.cbid.nikki.log._core_log`);
                if (coreEl && coreEl._logState) {
                    coreEl._logState.raw = core_log.trim();
                    coreEl._logRender();
                }
            });
        }, o));

        return m.render();
    }
});
