'use strict';
'require ui';
'require fs';
'require uci';
'require view';
'require form';

(function() {
    var styleTag = document.createElement('style');
    styleTag.textContent = '\
        @media (min-width: 992px) {                          \
            td[data-name="day"]    .cbi-input-text,          \
            td[data-name="hour"]   .cbi-input-text,          \
            td[data-name="month"]  .cbi-input-text,          \
            td[data-name="delay"]  .cbi-input-text,          \
            td[data-name="minute"] .cbi-input-text {         \
                max-width: 52px !important;                  \
                width: 100% !important;                      \
            }                                                \
            td[data-name="remarks"] .cbi-input-text {        \
                min-width: 180px !important;                 \
                width: 105% !important;                      \
            }                                                \
            td[data-name="week"] .cbi-dropdown,              \
            td[data-name="stype"] select.cbi-input-select {  \
                min-width: 100px !important;                 \
                max-width: 100px !important;                 \
                width: 100% !important;                      \
            }                                                \
            td:has(.cbi-button-remove) {                     \
              width: 50px !important;                        \
            }                                                \
            td[data-name="_apply"] {                         \
                max-width: 58px; !important;                 \
            }                                                \
        }';
    document.head.appendChild(styleTag);
})();

function validateCrontabField(type, value) {
    var types = {
        'day': { min: 1, max: 31, msg: _('1-31, \'*\', \'*/N\', ranges, or lists') },
        'hour': { min: 0, max: 23, msg: _('0-23, \'*\', \'*/N\', ranges, or lists') },
        'month': { min: 1, max: 12, msg: _('1-12, \'*\', \'*/N\', ranges, or lists') },
        'minute': { min: 0, max: 59, msg: _('0-59, \'*\', \'*/N\', ranges, or lists') },
        'week': { min: 0, max: 7, msg: _('0-7 (0/7=Sunday), \'*\', \'*/N\', ranges, or lists') }
    };

    var typeTranslations = {
        'day': _('days'),
        'hour': _('hours'),
        'week': _('weeks'),
        'month': _('months'),
        'minute': _('minutes')
    };

    value = (value || '').replace(/\s/g, '');
    if (value === '') return true;
    if (/[^0-9*\-,\/]/.test(value)) {
        return _('Invalid character in %s').format(typeTranslations[type] || type);
    }

    var parts = value.split(',').filter(Boolean);
    var isIncomplete = parts.some(part => {
        if (part.startsWith('-') || part.endsWith('-')) return true;
        if (part.endsWith('/')) return true;
        return false;
    });
    if (isIncomplete) return true;

    var field = types[type];
    if (!field) return _('Unknown field type: %s').format(type);

    var basePattern = /^(\*(\/\d+)?|\d+(-\d+)?(\/\d+)?)(,(\*(\/\d+)?|\d+(-\d+)?(\/\d+)?))*$/;
    if (!basePattern.test(value)) {
        return _('Invalid format for %s').format(typeTranslations[type] || type);
    }

    for (var part of parts) {
        if (part.startsWith('*/')) {
            var step = parseInt(part.substring(2), 10);
            if (isNaN(step) || step < 1 || step > field.max) {
                return _('Step value must be between 1 and %d').format(field.max);
            }
            continue;
        }

        if (/^\d+$/.test(part)) {
            var val = parseInt(part, 10);
            if (val < field.min || val > field.max) {
                return _('Value %d out of range (%d-%d)').format(val, field.min, field.max);
            }
            continue;
        }

        var rangeMatch = part.match(/^(\d+)-(\d+)(?:\/(\d+))?$/);
        if (rangeMatch) {
            var start = parseInt(rangeMatch[1], 10);
            var end = parseInt(rangeMatch[2], 10);
            var step = rangeMatch[3] ? parseInt(rangeMatch[3], 10) : 1;

            if (isNaN(start) || isNaN(end) || isNaN(step)) {
                return _('Invalid range or step value in %s').format(part);
            }

            var actualEnd = Math.max(start, end);
            var actualStart = Math.min(start, end);

            if (actualStart < field.min || actualEnd > field.max) {
                return _('Range %d-%d out of bounds (%d-%d)').format(start, end, field.min, field.max);
            }

            if (step < 1 || step > (actualEnd - actualStart + 1)) {
                return _('Step value %d out of range (1-%d)').format(step, rangeSpan);
            }
            continue;
        }

        if (part === '*') continue;

        if (/^\d+\/\d+$/.test(part)) {
            return _('Invalid syntax: %s. Step must be used with * or ranges').format(part);
        }

        return _('Invalid part: %s').format(part);
    }

    return true;
};

function showScriptEditModal(v) {
    var path = '/etc/taskplan/customscript1', scriptLabel = _('Custom Script 1');
    if (v === '16') { path = '/etc/taskplan/customscript2'; scriptLabel = _('Custom Script 2')};
    fs.stat(path).then(function() {
        return fs.read(path).then(function(content) {
            var textareaContent = (typeof content === 'string' ? content : '') || '';
            var modalContent = [
                E('p', { style: 'color:red;font-weight:bold;' }, _('Note: Please use valid sh syntax. The script runs as root. Avoid destructive commands (e.g., "rm -rf /"). The script should not require user interaction.')),
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
                                    _('Contents of %s have been saved.').format(scriptLabel)), 'info');
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
            ui.showModal(_('Edit %s').format(scriptLabel), modalContent);
            var textarea = document.querySelector('.modal textarea[name="script"]');
            if (textarea) {
                textarea.value = textareaContent;
            }
        }).catch(function(err) {
            ui.addNotification(null, E('p', {},
                _('Unable to read %s: %s').format(scriptLabel, err.message)), 'error');
            ui.hideModal();
        });
    }).catch(function() {
        ui.addNotification(null, E('p', {}, _('No such file %s').format(scriptLabel)), 'error');
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
        e.value('15', _('Custom Script 1'));
        e.value('16', _('Custom Script 2'));
        return e;
    },

    render: function() {
        var m, s, e;
        m = new form.Map('taskplan', '', [
            E('div', { 'style': 'font-weight:bold;' }, [
                _('Timed task execution and startup task execution. More than 10 preset functions, including restart, shutdown, network restart, freeing memory, system cleaning, network sharing, shutting down the network, automatic detection of network disconnection and reconnection, MWAN3 load balancing reconnection detection, custom scripts, etc.'),
                E('a', { 'target': '_blank', 'style': 'margin-left: 10px;',
                    'href': 'https://github.com/sirpdboy/luci-app-taskplan'
                }, [ _('GitHub @sirpdboy/luci-app-taskplan') ])
            ])
        ]);
        s = m.section(form.TableSection, 'stime', _('Scheduled task'),
            _('Minute (0-59), Hour (0-23), Day of Month (1-31), Month (1-12), Day of Week (0-7, 0 or 7 = Sunday)'));
        s.addremove = true;
        s.anonymous = true;

        e = s.option(form.Flag, 'enable', _('Enable'));
        e.rmempty = false;
        e.default = '0';

        e = s.option(form.Value, 'month', _('Month'));
        e.rmempty = true;
        e.default = '*';
        e.validate = function(section_id, value) {
            return validateCrontabField('month', value);
        };

        e = s.option(form.Value, 'day', _('Day'));
        e.rmempty = true;
        e.default = '*';
        e.validate = function(section_id, value) {
            return validateCrontabField('day', value);
        };

        e = s.option(form.Value, 'hour', _('Hours'));
        e.rmempty = true;
        e.default = '*';
        e.validate = function(section_id, value) {
            return validateCrontabField('hour', value);
        };

        e = s.option(form.Value, 'minute', _('Minute'));
        e.rmempty = true;
        e.default = '0';
        e.validate = function(section_id, value) {
            return validateCrontabField('minute', value);
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

        // e = s.option(form.Button, '_apply', _('执行'));
        // e.inputstyle = 'apply';
        // e.inputtitle = function(section_id) {
        //     console.log(section_id)
        // };
        // e.onclick = function() {
        //     console.log()
        // };

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
