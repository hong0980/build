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

return view.extend({
    load: function () {
        return Promise.all([
            L.resolveDefault(fs.read_direct(nikki.appLogPath), ''),
            L.resolveDefault(fs.read_direct(nikki.coreLogPath), ''),
            uci.load('system')
        ]);
    },

    render: function ([appLog, coreLog]) {
        let m, s, o;
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
                textareaEl.id = 'textarea_' + tab;
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

        o = s.taboption('log_config', form.HiddenValue, 'mihomo_running');
        o.write = function () {};
        o.cfgvalue = function () {
            return nikki.status('nikki').then((r) => r);
        };

        const mihomoAPIs = {
            a: { label: _('Version'),                method: 'GET',  path: '/version' },
            b: { label: _('Running Config'),         method: 'GET',  path: '/configs' },
            c: { label: _('Proxies'),                method: 'GET',  path: '/proxies' },
            d: { label: _('Proxy Groups'),           method: 'GET',  path: '/group' },
            e: { label: _('Rules'),                  method: 'GET',  path: '/rules' },
            f: { label: _('Rule Providers'),         method: 'GET',  path: '/providers/rules' },
            g: { label: _('Proxy Providers'),        method: 'GET',  path: '/providers/proxies' },
            h: { label: _('Connections (Snapshot)'), method: 'GET',  path: '/connections' },
            i: { label: _('DNS Query'),              method: 'GET',  path: '/dns/query', query: 'name=google.com&type=A' },
            j: { label: _('Flush FakeIP Cache'),     method: 'POST', path: '/cache/fakeip/flush' },
            k: { label: _('Flush DNS Cache'),        method: 'POST', path: '/cache/dns/flush' },
            l: { label: _('Reload Config'),          method: 'PUT',  path: '/configs', query: 'force=true', body: '{"path":"","payload":""}' },
            m: { label: _('Upgrade UI'),             method: 'POST', path: '/upgrade/ui' },
            n: { label: _('Update Geo (Upgrade)'),   method: 'POST', path: '/upgrade/geo', body: '{"path":"","payload":""}' },
            o: { label: _('Update Geo (Config)'),    method: 'POST', path: '/configs/geo', body: '{"path":"","payload":""}' },
            p: { label: _('Upgrade Core'),           method: 'POST', path: '/upgrade', query: 'force=true', body: '{"path":"","payload":""}' },
            q: { label: _('Restart Core'),           method: 'POST', path: '/restart', body: '{"path":"","payload":""}' },
            r: { label: _('restart rpcd') },
        };

        o = s.taboption('log_config', form.ListValue, '_api', _('Mihomo API'));
        o.depends('mihomo_running', 'true');
        o.write = () => {};
        Object.entries(mihomoAPIs).forEach(([k, v]) => o.value(k, v.label));

        o.renderWidget = function (section_id, option_index, cfgvalue) {
            const node = form.ListValue.prototype.renderWidget.apply(this, arguments);
            const btn = E('button', {
                'class': 'btn cbi-button-action',
                'click': ui.createHandlerFn(this, function () {
                    const value = s.formvalue(section_id, '_api');
                    let { label, method, path, body = '', query = '' } = mihomoAPIs[value];

                    if (value === 'r') {
                        ui.addNotification(null, E('p', _('rpcd is restarting, page will refresh in 3 seconds...')), 'info');
                        nikki.service('rpcd', 'restart');
                        setTimeout(function () { window.location.reload(); }, 3000);
                        return;
                    }

                    if (/^(PUT|POST|DELETE)$/.test(method))
                        if (!confirm(_('This will modify mihomo state. Continue?'))) return;

                    const content = E('div', { class: 'cbi-section', style: 'padding:10px;' }, [
                        E('div', { style: 'margin-bottom:10px;' }, [
                            E('strong', {}, _('Method: ')), E('span', {}, method), E('span', {}, ' | '),
                            E('strong', {}, _('Path: ')), E('span', {}, path)
                        ]),
                        E('p'),
                        E('div', { class: 'spinning', style: 'text-align:center;padding:60px 0;' }, _('Loading...'))
                    ]);

                    const md = ui.showModal(_('API Response: %s').format(label), [
                        content,
                        E('div', { class: 'right' }, [
                            E('button', { class: 'btn cbi-button', click: ui.hideModal }, _('Close'))
                        ])
                    ], 'cbi-modal');

                    return nikki.mihomoAPI(method, path, query, body).then(function (res) {
                        if (!res || !res.success) {
                            ui.hideModal();
                            return ui.addNotification(null, E('p', _('Request failed: %s').format(res?.message || ('HTTP ' + (res?.status || 0)))), 'error');
                        }

                        let { data = null, status = '' } = res;

                        if (/^(PUT|POST)$/.test(method) && (data == null || data?.status === 'ok')) {
                            content.innerHTML = '';
                            content.appendChild(E('div', { style: 'text-align:center;' }, [
                                E('div', { style: 'font-size:35px;margin-bottom:15px;color:#28a745;' }, '✓'),
                                E('div', { style: 'margin-top:20px;' }, [
                                    E('strong', _('Status') + '：'),
                                    E('span', { style: 'display:inline-block;padding:2px 8px;border-radius:4px;background:#28a745;color:#fff;font-size:12px;font-weight:bold;' }, String(status))
                                ])
                            ]));
                            md.style.maxWidth = '420px';
                            return;
                        }

                        md.style.maxWidth = '';
                        content.querySelector('div.spinning')?.remove();

                        let text = '';
                        if (data == null) {
                            text = _('No data returned (HTTP %s)').format(status);
                        } else if (typeof data === 'string') {
                            text = data;
                        } else {
                            text = JSON.stringify(data, null, 2);
                        }

                        if (typeof data === 'string' || data == null) {
                            content.appendChild(E('pre', {
                                style: 'max-height:300px;overflow:auto;background:#1e1e1e;color:#d4d4d4;padding:10px;font-size:13px;'
                            }, text));
                            return;
                        }

                        const aceDiv = E('div', { style: 'width:100%;height:300px;' });
                        content.appendChild(aceDiv);

                        return nikki.preloadAce().then(function () {
                            const editor = ace.edit(aceDiv);
                            editor.setOptions({
                                fontSize: '14px', printMarginColumn: -1, showPrintMargin: false,
                                mode: 'ace/mode/json', fontFamily: 'Consolas, monospace',
                                theme: 'ace/theme/monokai', readOnly: true
                            });
                            editor.setValue(text, -1);
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

        o = s.taboption('log_config', form.Button, '_do', _('Debug Log'));
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

        return m.render().then(function (nodes) {
            const el = m.findElement('data-name', 'mihomo_running');
            if (el) el.style.display = 'none';
            L.Poll.add(L.bind(function () {
                return Promise.all([
                    L.resolveDefault(fs.read_direct(nikki.appLogPath), ''),
                    L.resolveDefault(fs.read_direct(nikki.coreLogPath), ''),
                ]).then(function ([app_log, core_log]) {
                    const appEl = m.findElement('id', 'textarea_app_log');
                    if (appEl && appEl._logState) {
                        appEl._logState.raw = app_log.trim();
                        appEl._logRender();
                    }
                    const coreEl = m.findElement('id', 'textarea_core_log');
                    if (coreEl && coreEl._logState) {
                        coreEl._logState.raw = core_log.trim();
                        coreEl._logRender();
                    }
                });
            }, o));
            return nodes;
        })
    }
});
