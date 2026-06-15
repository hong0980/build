'use strict';
'require form';
'require view';
'require ui';
'require uci';
'require tools.nikki as nikki';

function renderStatus(running) {
    return updateStatus(E('span', { id: 'core_status', style: 'font-style: italic; font-weight: bold;' }), running);
}

function updateStatus(element, running) {
    if (element) {
        element.style.color = running ? 'green' : 'red';
        element.textContent = running ? _('Running') : _('Not Running');
    }
    return element;
}

const ui_array = [
    ["https://github.com/Zephyruso/zashboard/releases/latest/download/dist-cdn-fonts.zip", "Zashboard (CDN Fonts)"],
    ["https://github.com/Zephyruso/zashboard/releases/latest/download/dist.zip", "Zashboard"],
    ["https://github.com/MetaCubeX/metacubexd/archive/refs/heads/gh-pages.zip", "MetaCubeXD"],
    ["https://github.com/MetaCubeX/Yacd-meta/archive/refs/heads/gh-pages.zip", "YACD"],
    ["https://github.com/MetaCubeX/Razord-meta/archive/refs/heads/gh-pages.zip", "Razord"]
];

return view.extend({
    load: function () {
        return Promise.all([
            nikki.version(),
            nikki.status(),
            nikki.listProfiles(),
            uci.load('nikki')
        ]);
    },
    render: function ([version, running, profiles]) {
        const appVersion = version.app ?? '';
        const coreVersion = version.core ?? '';

        let m, s, o;

        m = new form.Map('nikki', _('Nikki'), `${_('Transparent Proxy with Mihomo on OpenWrt.')} <a href="https://github.com/nikkinikki-org/OpenWrt-nikki/wiki" target="_blank">${_('How To Use')}</a>`);

        s = m.section(form.TableSection, 'status', _('Status'));
        s.anonymous = true;

        o = s.option(form.DummyValue, '_app_version', _('App Version'));
        o.readonly = true;
        o.load = function () {
            return appVersion;
        };
        o.write = function () {};

        o = s.option(form.DummyValue, '_core_version', _('Core Version'));
        o.readonly = true;
        o.load = function () {
            return coreVersion;
        };
        o.write = function () {};

        o = s.option(form.DummyValue, '_core_status', _('Core Status'));
        o.cfgvalue = function () {
            return renderStatus(running);
        };
        L.Poll.add(function () {
            return L.resolveDefault(nikki.status(), false).then(function (running) {
                updateStatus(document.getElementById('core_status'), running);
            });
        });

        o = s.option(form.Button, 'reload');
        o.inputstyle = 'action';
        o.inputtitle = _('Reload Service');
        o.onclick = function () {
            return nikki.reload();
        };

        o = s.option(form.Button, 'restart');
        o.inputstyle = 'negative';
        o.inputtitle = _('Restart Service');
        o.onclick = function () {
            return nikki.restart();
        };

        o = s.option(form.ListValue, 'ui_url');
        o.ucisection = 'mixin';
        o.ucioption = 'ui_url';
        ui_array.forEach(([url, name]) => {
            o.value(url, name);
        });
        o.renderWidget = function (section_id) {
            let el = form.ListValue.prototype.renderWidget.apply(this, arguments);
            el.classList.add('control-group');
            el.firstChild.style.width = '8em';
            const self = this;
            const btn = E('button', {
                'class': 'btn cbi-button-positive',
                'click': ui.createHandlerFn(this, function () {
                    const current_url = el.firstChild.value;
                    uci.set('nikki', 'mixin', 'ui_url', current_url);
                    return uci.save()
                        .then(() => uci.apply())
                        .then(() => {
                            if (ui.changes) ui.changes.setIndicator(0);
                            nikki.restart();
                            return nikki.updateDashboard()
                        })
                        .then(() => {
                            const ui_entry = ui_array.find(x => x[0] === current_url);
                            const openBtn = document.querySelector('#cbi-nikki-status-open_dashboard button');
                            if (openBtn) openBtn.textContent = _('Open Dashboard') + ' ' + ui_entry[1];
                        });
                })
            }, [_('Update Dashboard')]);
            el.appendChild(btn);
            return el;
        };

        const ui_url = uci.get('nikki', 'mixin', 'ui_url')
        const ui_entry = ui_array.find(x => x[0] === ui_url);
        o = s.option(form.Button, 'open_dashboard');
        o.inputstyle = 'action';
        o.inputtitle = ui_entry ? _('Open Dashboard') + ' ' + ui_entry[1] : _('Open Dashboard');
        o.onclick = function () {
            return nikki.openDashboard();
        };

        s = m.section(form.NamedSection, 'config', 'config', _('App Config'));

        o = s.option(form.Flag, 'enabled', _('Enable'));
        o.rmempty = false;

        o = s.option(form.ListValue, 'profile', _('Choose Profile'));
        o.optional = true;

        for (const profile of profiles) {
            o.value('file:' + profile.name, _('File:') + profile.name);
        };

        uci.sections('nikki', 'subscription', function (s, sid) {
            o.value('subscription:' + sid, _('Subscription:') + s['name']);
        });

        o = s.option(form.Value, 'start_delay', _('Start Delay'));
        o.datatype = 'uinteger';
        o.placeholder = _('Start Immidiately');

        o = s.option(form.Flag, 'scheduled_restart', _('Scheduled Restart'));
        o.rmempty = false;

        o = s.option(form.Value, 'scheduled_restart_cron', _('Scheduled Restart Cron'));
        o.retain = true;
        o.rmempty = false;
        o.depends('scheduled_restart', '1');

        o = s.option(form.Flag, 'test_profile', _('Test Profile'));
        o.rmempty = false;

        o = s.option(form.Flag, 'core_only', _('Core Only'));
        o.rmempty = false;

        s = m.section(form.NamedSection, 'procd', 'procd', _('procd Config'));

        s.tab('general', _('General Config'));

        o = s.taboption('general', form.Flag, 'fast_reload', _('Fast Reload'));
        o.rmempty = false;

        s.tab('rlimit', _('RLIMIT Config'));

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

        s.tab('environment_variable', _('Environment Variable Config'));

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
