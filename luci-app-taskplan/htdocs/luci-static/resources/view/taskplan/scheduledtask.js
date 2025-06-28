'use strict';
'require ui';
'require fs';
'require uci';
'require view';
'require form';

var CSS = '                                 \
@media (min-width: 768px) {                 \
    [data-name="day"]    .cbi-input-text    \
    [data-name="hour"]   .cbi-input-text,   \
    [data-name="month"]  .cbi-input-text,   \
    [data-name="delay"]  .cbi-input-text,   \
    [data-name="minute"] .cbi-input-text {  \
        max-width: 55px !important;         \
        width: 100% !important;             \
    }                                       \
    [data-name="remarks"] .cbi-input-text   \
        min-width: 110px !important;        \
        width: 100% !important;             \
    }                                       \
    [data-name="week"] .cbi-dropdown,       \
    [data-name="stype"] .cbi-input-select { \
        min-width: 85px !important;         \
        max-width: 85px !important;         \
        width: 100% !important;             \
    }                                       \
    td:has(.cbi-button-remove) {            \
        width: 50px !important;             \
    }                                       \
}                                           \
';

var validateCrontabField = (type, value, monthValue) => {
    var types = {
        'day': { min: 1, max: 31, label: _('dayss'), msg: _('1-31, "*", "*/N", ranges, or lists. E.g.: 1,5,10 or 5-10,*/2'),
            getMaxDays: function(monthValue) {
                if (!monthValue || monthValue === '*') return 31; // 情况1：未指定月份或通配符
                var monthValidation = validateCrontabField('month', monthValue); // 情况2：验证月份值是否合法（递归调用）
                if (monthValidation !== true) return 31; // 非法月份按最大值处理

                var firstMonthPart = monthValue.split(',')[0].replace(/\/\d+$/, ''); // 取列表第一项，移除步长
                var month = parseInt(firstMonthPart.match(/\d+/)?.[0] || 1); // 提取数字
                if (month === 2) {
                    var year = new Date().getFullYear();
                    return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0 ? 29 : 28;
                }
                return [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1];
            }},
        'hour': { min: 0, max: 23, label: _('hours'), msg: _('0-23, "*", "*/N", ranges, or lists. E.g.: 0,12,18 or 8-17') },
        'month': { min: 1, max: 12, label: _('months'), msg: _('1-12, "*", "*/N", ranges, or lists. E.g.: 1,6,12 or 3-8,*/2') },
        'minute': { min: 0, max: 59, label: _('minutes'), msg: _('0-59, "*", "*/N", ranges, or lists. E.g.: 0,15,30,45 or 10-50,*/5') },
        'week': { min: 0, max: 6, label: _('weeks'), msg: _('0-6 (0/6=Sunday), "*", "*/N", ranges, or lists. E.g.: 0,1,5 or 1-5,*/2') }
    };

    value = (value || '').replace(/\s/g, '');
    if (value === '') return true;

    var field = types[type];
    if (!field) return _('Unknown field type: %s').format(type);

    var parts = value.split(',').filter(Boolean);
    var isIncomplete = parts.some(part => {
        if (part.startsWith('-') || part.endsWith('-')) return true;
        if (part.endsWith('/')) return true;
        return false;
    });
    if (isIncomplete) return true;

    // var basePattern = /^(?!.*(?:,,|--|\/\/|\*\*|,\/|-\/|\*\/\/))(?:\*(\/\d+)?|\d+(?:-\d+)?(?:\/\d+)?)(?:,(?:\*(\/\d+)?|\d+(?:-\d+)?(?:\/\d+)?))*$/;
    var basePattern = /^(\*(\/\d+)?|\d+(-\d+)?(\/\d+)?)(,(\*(\/\d+)?|\d+(-\d+)?(\/\d+)?))*$/;
    if (!basePattern.test(value)) {
        return _('Invalid format for %s. Example: (%s)').format(field.label, field.msg);
    }

    if (type === 'day') {
        field.max = types.day.getMaxDays(monthValue);
        if (monthValue && !/^\d+$/.test(monthValue)) {
            field.msg += _(' (Note: Actual days may be limited by specific months)');
        }
    }

    for (var part of parts) {
        if (part.startsWith('*/')) {
            var step = parseInt(part.substring(2), 10);
            if (isNaN(step) || step < 1 || step > field.max) {
                return _('Step value in %s must be between 1 and %d').format(field.label, field.max);
            }
            continue;
        }

        if (/^\d+$/.test(part)) {
            var val = parseInt(part, 10);
            if (val < field.min || val > field.max) {
                return _('%s value %s out of range (%d-%d)').format(field.label, val, field.min, field.max);
            }
            continue;
        }

        var rangeMatch = part.match(/^(\d+)-(\d+)(?:\/(\d+))?$/);
        if (rangeMatch) {
            var start = parseInt(rangeMatch[1], 10);
            var end = parseInt(rangeMatch[2], 10);
            var step = rangeMatch[3] ? parseInt(rangeMatch[3], 10) : 1;

            if (isNaN(start) || isNaN(end) || isNaN(step)) {
                return _('Invalid range or step value in %s (%s)').format(field.label, part);
            }

            var actualEnd = Math.max(start, end);
            var actualStart = Math.min(start, end);

            if (actualStart < field.min || actualEnd > field.max) {
                return _('Range %d-%d out of bounds (%d-%d) in %s').format(start, end, field.min, field.max, field.label);
            }

            if (step < 1 || step > (actualEnd - actualStart + 1)) {
                return _('Step value %d out of range (1-%d) in %s').format(step, actualEnd - actualStart + 1, field.label);
            }
            continue;
        }

        if (part === '*') continue;

        if (/^\d+\/\d+$/.test(part)) {
            return _('Invalid syntax: %s in (%s). Step must be used with * or ranges').format(field.label, part);
        }

        return _('Invalid part: %s in (%s)').format(field.label, part);
    }

    return true;
};

return view.extend({
    load: function() {
        return uci.load('taskplan');
    },

    render: function() {
        var m, s, e;
        m = new form.Map('taskplan', '', [
            E('style', { 'type': 'text/css' }, [ CSS ]),
            E('b', {}, [
                _('Timed task execution and startup task execution. More than 10 preset functions, including restart, shutdown, network restart, freeing memory, system cleaning, network sharing, shutting down the network, automatic detection of network disconnection and reconnection, MWAN3 load balancing reconnection detection, custom scripts, etc.'),
                E('a', { 'target': '_blank', 'style': 'margin-left: 10px;',
                    'href': 'https://github.com/sirpdboy/luci-app-taskplan'
                }, _('GitHub @sirpdboy/luci-app-taskplan'))
            ])
        ]);
        s = m.section(form.TableSection, 'stime', _('Scheduled task'), [
            E('div', { 'style': 'color:#666; margin-top:0.6em;' }, [
                _('Minute (0-59), Hour (0-23), Day of Month (1-31), Month (1-12), Day of Week (0-6, 0 and 6 = Sunday)'), E('br'),
                _('"*" any value, "," value list separator, "-" range of values, "/" step values'), E('br'),
                _('Examples: Range 2-5 (means 2 to 5), List 1,3,5 (means 1 and 3 and 5), Step */5 (means every 5 units)')
            ])
        ]);
        s.addremove = true;
        s.anonymous = true;

        e = s.option(form.Flag, 'enable', _('Enable'));
        e.rmempty = false;
        e.default = '0';

        e = s.option(form.Value, 'minute', _('Minute'));
        e.rmempty = true;
        e.default = '0';
        e.validate = function(section_id, value) {
            return validateCrontabField('minute', value);
        };

        e = s.option(form.Value, 'hour', _('Hours'));
        e.rmempty = true;
        e.default = '*';
        e.validate = function(section_id, value) {
            return validateCrontabField('hour', value);
        };

        e = s.option(form.Value, 'day', _('Day'));
        e.rmempty = true;
        e.default = '*';
        e.validate = function(section_id, value) {
            return validateCrontabField('day', value,
                this.section.formvalue(section_id, 'month'));
        };

        e = s.option(form.Value, 'month', _('Month'));
        e.rmempty = true;
        e.default = '*';
        e.validate = function(section_id, value) {
            return validateCrontabField('month', value);
        };

        e = s.option(form.Value, 'week', _('Week'));
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

        e = s.option(form.Button, 'button', _('verify'));
        e.inputstyle = 'apply';
        e.onclick = function(ev, section_id) {
            var crontab = document.getElementById(`widget.cbid.taskplan.${section_id}.month`).title;
            if (crontab) window.open(`https://crontab.guru/#${crontab.replace(/ /g, '_')}`);
        };

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

        var view = document.getElementById('view') ?? document.body;

        view && new MutationObserver(mutations => {
            mutations.flatMap(m => [...m.addedNodes])
                .filter(node => node.nodeType === Node.ELEMENT_NODE)
                .flatMap(node => [...node.querySelectorAll('tr')])
                .forEach(row => {
                    var fields = { minute: '', hour: '', day: '', month: '', week: '' };
                    var selectors = {
                        hour: 'cbi-input-text', day: 'cbi-input-text',
                        month: 'cbi-input-text', week: 'cbi-dropdown',
                        remarks: 'cbi-input-text', minute: 'cbi-input-text',
                        button: 'cbi-button-apply', stype: 'cbi-input-select'
                    };

                    Object.entries(selectors).forEach(([name, type]) => {
                        let elements = [...row.querySelectorAll(`[data-name="${name}"] .${type}`)];

                        elements.forEach(e => {
                            if (name === 'week') {
                                fields.week = e.querySelector('[type="hidden"]')?.value ?? '';
                            } else if (fields.hasOwnProperty(name)) {
                                fields[name] = e.value ?? '';
                            }

                            if (name === 'stype') {
                                e.addEventListener('change', () => {
                                    if (['15', '16'].includes(e.value)) this.showScriptEditModal(e.value);
                                });
                            }
                        });
                    });

                    let crontabString = Object.values(fields).filter(Boolean).join(' ');
                    if (crontabString) {
                        Object.entries(selectors).forEach(([name, type]) => {
                            row.querySelectorAll(`[data-name="${name}"] .${type}`).forEach(e => {
                                e.title = name === 'remarks' ? e.value ?? '' :
                                name === 'stype' ? e.options[e.selectedIndex].textContent :
                                name === 'button' ? _('Click to verify on crontab.guru: %s ').format(crontabString) :
                                crontabString;
                            });
                        });
                    }
                });
        }).observe(view, { childList: true, subtree: true });

        return m.render();
    },

    defineStypeOptions: function(s) {
        var e = s.option(form.ListValue, 'stype', _('Scheduled Type'));
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
        e.value('15', _('Custom Script 1'));
        e.value('16', _('Custom Script 2'));
        return e;
    },

    showScriptEditModal: function (v) {
        var path = '/etc/taskplan/customscript1', scriptLabel = _('Custom Script 1');
        if (v === '16') { path = '/etc/taskplan/customscript2'; scriptLabel = _('Custom Script 2')};
        fs.stat(path).then(function() {
            return fs.read(path).then(function(content) {
                var textareaContent = (typeof content === 'string' ? content : '') || '';
                var modalContent = [
                    E('b', { 'style': 'color:red;' },
                        _('Note: Please use valid sh syntax. The script runs as root. Avoid destructive commands (e.g., "rm -rf /"). The script should not require user interaction.')),
                    E('div', {}, [
                        E('button', { 'class': 'btn cbi-button-action',
                            'title': _('Click to upload the script to %s').format(path),
                            'click': function() {
                                return ui.uploadFile(path)
                                    .then(function() {
                                        ui.addTimeLimitedNotification(null, E('p',
                                            _('File saved to %s').format(path)), 3000, 'info');
                                        ui.hideModal();
                                    });
                            }}, [ _('Upload') ]),
                    ]),
                    E('textarea', { 'name': 'script',
                        'style': 'width: 600px; min-height: 200px; margin-bottom: 16px; font-family:Consolas, monospace;'
                    }, '%h'.format(textareaContent)),
                    E('div', { 'class': 'button-row' }, [
                        E('div', { 'click': ui.hideModal, 'class': 'btn cbi-button-neutral' }, _('Cancel')),
                        E('div', { 'class': 'btn cbi-button-positive',
                            'click': function(ev) {
                                var textarea = document.querySelector('textarea[name="script"]');
                                var value = textarea ? textarea.value.trim().replace(/\r\n/g, '\n') + '\n' : '';
                                fs.write(path, value).then(function() {
                                    ui.addTimeLimitedNotification(null, E('p',
                                        _('Contents of %s have been saved.').format(scriptLabel)), 3000, 'info');
                                    ui.hideModal();
                                }).catch(function(err) {
                                    ui.addTimeLimitedNotification(null, E('p',
                                        _('Unable to save contents: %s').format(err.message)), 8000, 'error');
                                    ui.hideModal();
                                });
                            }
                        }, _('Save'))
                    ])
                ];
                ui.showModal(_('Edit %s').format(scriptLabel), modalContent);
                var textarea = document.querySelector('textarea[name="script"]');
                if (textarea) textarea.value = textareaContent;
            }).catch(function(err) {
                ui.addTimeLimitedNotification(null, E('p', {},
                    _('Unable to read %s: %s').format(scriptLabel, err.message)), 8000, 'error');
                ui.hideModal();
            });
        }).catch(function() {
            ui.addTimeLimitedNotification(null, E('p', {}, _('No such file %s').format(scriptLabel)), 8000, 'error');
            ui.hideModal();
        });
    }
});
