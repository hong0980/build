'use strict';
'require fs';
'require form';
'require view';
'require tools.nikki as nikki';

return view.extend({
    load: function () {
        return Promise.all([
            nikki.getAppLog(),
            nikki.getCoreLog()
        ]);
    },
    render: function ([appLog, coreLog]) {
        let m, s, o;

        m = new form.Map('nikki');

        s = m.section(form.NamedSection, 'log', 'log', _('Log'));

        s.tab('log_config', _('Log Config'));

        o = s.taboption('log_config', form.Flag, 'clear_at_stop', _('Clear At Stop'));
        o.rmempty = false;

        o = s.taboption('log_config', form.Flag, 'scheduled_clear', _('Scheduled Clear'));
        o.rmempty = false;

        o = s.taboption('log_config', form.Value, 'scheduled_clear_cron', _('Scheduled Clear Cron'));
        o.retain = true;
        o.rmempty = false;
        o.depends('scheduled_clear', '1');

        o = s.taboption('log_config', form.Value, 'scheduled_clear_size_limit', _('Scheduled Clear Size Limit'));
        o.retain = true;
        o.rmempty = false;
        o.datatype = 'uinteger';
        o.depends('scheduled_clear', '1');

        o = s.taboption('log_config', form.ListValue, 'scheduled_clear_size_limit_unit', _('Scheduled Clear Size Limit Unit'));
        o.retain = true;
        o.rmempty = false;
        o.depends('scheduled_clear', '1');
        o.value('KB', 'KB');
        o.value('MB', 'MB');
        o.value('GB', 'GB');

        s.tab('app_log', _('App Log'));

        o = s.taboption('app_log', form.Button, 'clear_app_log');
        o.inputstyle = 'negative';
        o.inputtitle = _('Clear Log');
        o.onclick = function (_, section_id) {
            s.getUIElement(section_id, '_app_log').setValue('');
            return nikki.clearAppLog();
        };

        o = s.taboption('app_log', form.TextValue, '_app_log');
        o.rows = 25;
        o.wrap = false;
        o.load = function (section_id) {
            return appLog;
        };
        o.write = function (section_id, formvalue) {
            return true;
        };

        o = s.taboption('app_log', form.Button, 'scroll_app_log_to_bottom');
        o.inputtitle = _('Scroll To Bottom');
        o.onclick = function (_, section_id) {
            const element = s.getUIElement(section_id, '_app_log').node.firstChild;
            element.scrollTop = element.scrollHeight;
        };

        s.tab('core_log', _('Core Log'));

        o = s.taboption('core_log', form.Button, 'clear_core_log');
        o.inputstyle = 'negative';
        o.inputtitle = _('Clear Log');
        o.onclick = function (_, section_id) {
            s.getUIElement(section_id, '_core_log').setValue('');
            return nikki.clearCoreLog();
        };

        o = s.taboption('core_log', form.TextValue, '_core_log');
        o.rows = 25;
        o.wrap = false;
        o.load = function (section_id) {
            return coreLog;
        };
        o.write = function (section_id, formvalue) {
            return true;
        };

        o = s.taboption('core_log', form.Button, 'scroll_core_log_to_bottom');
        o.inputtitle = _('Scroll To Bottom');
        o.onclick = function (_, section_id) {
            const element = s.getUIElement(section_id, '_core_log').node.firstChild;
            element.scrollTop = element.scrollHeight;
        };

        s.tab('debug_log', _('Debug Log'));

        o = s.taboption('debug_log', form.Button, '_generate_download_debug_log');
        o.inputstyle = 'negative';
        o.inputtitle = _('Generate & Download');
        o.onclick = function () {
            return nikki.debug().then(function () {
                fs.read_direct(nikki.debugLogPath, 'blob').then(function (data) {
                    // create url
                    const url = window.URL.createObjectURL(data, { type: 'text/markdown' });
                    // create link
                    const link = document.createElement('a');
                    link.href = url;
                    link.download = 'debug.log';
                    // append to body
                    document.body.appendChild(link);
                    // download
                    link.click();
                    // remove from body
                    document.body.removeChild(link);
                    // revoke url
                    window.URL.revokeObjectURL(url);
                });
            });
        };

        L.Poll.add(L.bind(function () {
            const option = this;
            return Promise.all([
                L.resolveDefault(nikki.getAppLog(), ''),
                L.resolveDefault(nikki.getCoreLog(), '')
            ]).then(function ([app_log, core_log]) {
                const appEl = document.getElementById(`${option.cbid('log')}_app_log`);
                if (appEl) appEl.value = app_log;
                const coreEl = document.getElementById(`${option.cbid('log')}_core_log`);
                if (coreEl) coreEl.value = core_log;
            });
        }, o));

        return m.render();
    }
});
