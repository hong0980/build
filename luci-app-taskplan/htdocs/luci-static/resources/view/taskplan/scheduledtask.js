'use strict';
'require ui';
'require fs';
'require uci';
'require view';
'require form';

var css = '                                          \
@media (min-width: 992px) {                          \
    td[data-name="day"]    .cbi-input-text,          \
    td[data-name="hour"]   .cbi-input-text,          \
    td[data-name="month"]  .cbi-input-text,          \
    td[data-name="delay"]  .cbi-input-text,          \
    td[data-name="minute"] .cbi-input-text {         \
        max-width: 55px !important;                  \
        width: 100% !important;                      \
    }                                                \
    td[data-name="remarks"] .cbi-input-text {        \
        min-width: 190px !important;                 \
        width: 105% !important;                      \
    }                                                \
    td[data-name="week"]   .cbi-dropdown,            \
    td[data-name="stype"]  select.cbi-input-select { \
        min-width: 100px !important;                 \
        max-width: 100px !important;                 \
        width: 100% !important;                      \
    }                                                \
}                                                    \
';

function validateCrontabField(type, value) {
    var patterns = {
        'minute': /^(\*|\*\/[1-9]\d?|([0-5]?\d)(-[0-5]?\d)?(\/[1-9]\d?)?)(,(\*|\*\/[1-9]\d?|([0-5]?\d)(-[0-5]?\d)?(\/[1-9]\d?)?))*$/,
        'hour': /^(\*|\*\/[1-9]\d?|([01]?\d|2[0-3])(-([01]?\d|2[0-3]))?(\/[1-9]\d?)?)(,(\*|\*\/[1-9]\d?|([01]?\d|2[0-3])(-([01]?\d|2[0-3]))?(\/[1-9]\d?)?))*$/,
        'day': /^(\*|\*\/[1-9]\d?|([0-9]|[12]\d|3[01])(-([0-9]|[12]\d|3[01]))?(\/[1-9]\d?)?)(,(\*|\*\/[1-9]\d?|([0-9]|[12]\d|3[01])(-([0-9]|[12]\d|3[01]))?(\/[1-9]\d?)?))*$/,
        'month': /^(\*|\*\/[1-9]\d?|([0-9]|1[01])(-([0-9]|1[01]))?(\/[1-9]\d?)?)(,(\*|\*\/[1-9]\d?|([0-9]|1[01])(-([0-9]|1[01]))?(\/[1-9]\d?)?))*$/,
        'week': /^(\*|\*\/[1-9]\d?|[0-6](-[0-6])?(\/[1-9]\d?)?)(,(\*|\*\/[1-9]\d?|[0-6](-[0-6])?(\/[1-9]\d?)?))*$/
    };
    var maxStep = { 'minute': 59, 'hour': 23, 'day': 31, 'month': 11, 'week': 6 };
    var messages = {
        'day': _("Invalid crontab day value. It should be 1-31, '*', '*/N'."),
        'week': _("Invalid crontab week value. It should be 0-6, '*', '*/N'."),
        'hour': _("Invalid crontab hour value. It should be 0-23, '*', '*/N'."),
        'month': _("Invalid crontab month value. It should be 0-11, '*', '*/N'."),
        'minute': _("Invalid crontab minute value. It should be 0-59, '*', '*/N'.")
    };

    if (value === '' || value == null) return true;
    if (!patterns[type] || !patterns[type].test(value)) {
        return messages[type] || _('Invalid value');
    }

    let max = maxStep[type];
    let min = (type === 'day') ? 1 : 0;
    let parts = value.split(',');
    for (let part of parts) {
        let m = part.match(/^\*\/(\d+)$/);
        if (m) {
            let step = parseInt(m[1]);
            if (step < 1 || step > max) return _('Step value out of range (max %s)').format(max);
            continue;
        }
        m = part.match(/^(\d+)-(\d+)(?:\/(\d+))?$/);
        if (m) {
            let start = parseInt(m[1]);
            let end = parseInt(m[2]);
            if (start > end || start < min || end > max)
                return _('Range out of range for %s').format(type);
            if (m[3]) {
                let step = parseInt(m[3]);
                if (step < 1 || step > max) return _('Step value out of range (max %s)').format(max);
            }
            continue;
        }
        m = part.match(/^(\d+)\/(\d+)$/);
        if (m) {
            let val = parseInt(m[1]);
            let step = parseInt(m[2]);
            if (val < min || val > max)
                return _('Value out of range for %s').format(type);
            if (step < 1 || step > max)
                return _('Step value out of range (max %s)').format(max);
            continue;
        }
        m = part.match(/^\d+$/);
        if (m) {
            let val = parseInt(part);
            if (val < min || val > max)
                return _('Value out of range for %s').format(type);
            continue;
        }
        if (part === '*') continue;
    }
    return true;
};

function showScriptEditModal(v) {
    var path = (v === '15') ? '/etc/taskplan/customscript1' : '/etc/taskplan/customscript2';
    fs.stat(path).then(function() {
        return fs.read(path).then(function(content) {
            var textareaContent = (typeof content === 'string' ? content : '') || '';
            var modalContent = [
                E('p', {}, _('Note: Please use valid sh syntax. The script runs as root. Avoid destructive commands (e.g., "rm -rf /"). The script should not require user interaction.')),
                E('textarea', {
                    'name': 'script',
                    'style': 'width: 600px; min-height: 200px; margin-bottom: 16px; font-family:Consolas, monospace;'
                }, '%h'.format(textareaContent)),
                E('div', { 'class': 'button-row' }, [
                    E('div', { 'click': ui.hideModal, 'class': 'btn cbi-button-neutral' }, _('Cancel')),
                    E('div', {
                        'class': 'btn cbi-button-positive',
                        'click': function(ev) {
                            var textarea = findParent(ev.target, '.modal').querySelector('textarea[name="script"]');
                            var value = textarea ? textarea.value : '';
                            fs.write(path, value).then(function() {
                                ui.addNotification(null, E('p',
                                    _('Contents of %s have been saved.').format(path)), 'info');
                                ui.hideModal();
                            }).catch(function(err) {
                                ui.addNotification(null, E('p',
                                    _('Unable to save contents: %s').format(err.message)), 'error');
                                ui.hideModal();
                            });
                        }
                    }, _('Save'))
                ])
            ];
            ui.showModal(_('Edit %s').format(path), modalContent);
            var textarea = document.querySelector('.modal textarea[name="script"]');
            if (textarea) {
                textarea.value = textareaContent;
            }
        }).catch(function(err) {
            ui.addNotification(null, E('p', {},
                _('Unable to read %s: %s').format(path, err.message)), 'error');
            ui.hideModal();
        });
    }).catch(function() {
        ui.addNotification(null, E('p', {}, _('No such file %s').format(path)), 'error');
        ui.hideModal();
    });
};

return view.extend({
    load: function() {
        return uci.load('taskplan');
    },

    defineStypeOptions: function(section) {
        var e = section.option(form.ListValue, 'stype', _('Scheduled Type'));
        e.default = '1';
        e.value('01', _('Scheduled Reboot'));
        e.value('02', _('Scheduled Poweroff'));
        e.value('03', _('Scheduled ReNetwork'));
        e.value('04', _('Scheduled RestartSamba'));
        e.value('05', _('Scheduled Restartlan'));
        e.value('06', _('Scheduled Restartwan'));
        e.value('07', _('Scheduled Closewan'));
        e.value('08', _('Scheduled Clearmem'));
        e.value('09', _('Scheduled Sysfree'));
        e.value('10', _('Scheduled DisReconn'));
        e.value('11', _('Scheduled DisRereboot'));
        e.value('12', _('Scheduled Restartmwan3'));
        e.value('13', _('Scheduled Wifiup'));
        e.value('14', _('Scheduled Wifidown'));
        e.value('15', _('Scheduled Customscript1'));
        e.value('16', _('Scheduled Customscript2'));
        return e;
    },

    render: function() {
        var m, s, e;
        m = new form.Map('taskplan', '', E('style', { 'type': 'text/css' }, [ css ]),
            _('<b>The original [Timing Settings] includes scheduled task execution and startup task execution. ' +
                 'Presets include over 10 functions, including restart, shutdown, network restart, memory release, system cleaning, ' +
                 'network sharing, network shutdown, automatic detection of network disconnects and reconnection, ' +
                 'MWAN3 load balancing detection of reconnection, and custom scripts</b><br/>'));

        s = m.section(form.TableSection, 'stime',
            E('div', { style: 'display: flex; align-items: center; gap: 12px;' }, [
                _('Scheduled task'),
                E('button', {
                    'class': 'btn cbi-button-apply',
                    'click': function() { window.open('https://tool.lu/crontab'); }
                }, _('verify/example'))
            ]),
            E('p', {}, _('Minute (0-59) Hour (0-23) Day (1-31) Month (1-12) Weekday (0-6, 0=Sunday, 6=Saturday)'))
        );
        s.addremove = true;
        s.anonymous = true;

        e = s.option(form.Flag, 'enable', _('Enable'));
        e.rmempty = false;
        e.default = '0';

        e = s.option(form.Value, 'minute', _('minute'));
        e.rmempty = true;
        e.default = '*';
        e.validate = function(section_id, value) {
            return validateCrontabField('minute', value);
        };

        e = s.option(form.Value, 'hour', _('Hour'));
        e.rmempty = true;
        e.default = '*';
        e.validate = function(section_id, value) {
            return validateCrontabField('hour', value);
        };

        e = s.option(form.Value, 'day', _('day'));
        e.rmempty = true;
        e.default = '*';
        e.validate = function(section_id, value) {
            return validateCrontabField('day', value);
        };

        e = s.option(form.Value, 'month', _('Month'));
        e.rmempty = true;
        e.default = '*';
        e.validate = function(section_id, value) {
            return validateCrontabField('month', value);
        };

        e = s.option(form.Value, 'week', _('weeks'));
        e.rmempty = true;
        e.default = '*';
        e.value('*', _('Everyday'));
        e.value('0', _('Sunday'));
        e.value('1', _('Monday'));
        e.value('2', _('Tuesday'));
        e.value('3', _('Wednesday'));
        e.value('4', _('Thursday'));
        e.value('5', _('Friday'));
        e.value('6', _('Saturday'));
        e.value('0,6', _('Weekend'));
        e.value('1-5', _('Workdays'));
        e.validate = function(section_id, value) {
            return validateCrontabField('week', value);
        };

        this.defineStypeOptions(s);

        e = s.option(form.Value, 'remarks', _('Remarks'));

        s = m.section(form.TableSection, 'ltime', _('Startup task'),
            _('The task to be executed upon startup, with a startup delay time unit of seconds.'));
        s.addremove = true;
        s.anonymous = true;

        e = s.option(form.Flag, 'enable', _('Enable'));
        e.rmempty = false;
        e.default = '0';

        this.defineStypeOptions(s);

        e = s.option(form.Value, 'delay', _('Delayed Start(seconds)'));
        e.default = '10';
        e.datatype = 'uinteger';

        e = s.option(form.Value, 'remarks', _('Remarks'));

        setTimeout(function() {
            document.querySelectorAll('select.cbi-input-select').forEach(function(sel) {
                if (!sel._custombind) {
                    sel._custombind = true;
                    sel.addEventListener('change', function() {
                        var value = sel.value;
                        if (value === '15' || value === '16') {
                            showScriptEditModal(value);
                        }
                    });
                }
            });
        }, 1000);

        return m.render();
    }
});
