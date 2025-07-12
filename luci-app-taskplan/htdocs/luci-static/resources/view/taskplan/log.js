'use strict';
'require fs';
'require ui';
'require uci';
'require view';

const logPath = '/etc/taskplan/taskplan.log';

return view.extend({
    load: () => Promise.all([
        fs.lines(logPath),
        fs.trimmed(logPath),
        uci.load('taskplan')
    ]),

    render: function ([lines, content]) {
        let reversed = false;
        const log_length = uci.get('taskplan', 'globals', 'log_length');
        const textarea = new ui.Textarea(content ? content.split('\n').reverse().join('\n') : _('No log data available'), { rows: content ? 25 : 3 });
        const button = content
            ? E('p', {}, [
                E('button', {
                    'class': 'btn cbi-button-negative', 'title': _('Clear Log'), 'style': 'margin-left: 10px;',
                    'click': ui.createHandlerFn(this, () => {
                        Promise.all([
                            fs.write(logPath, ''),
                            fs.write('/var/run/taskplan_counter.dat', '0')
                        ])
                            .then(() => {
                                textarea.setValue('');
                                ui.addTimeLimitedNotification(null, E('p', _('Log cleared')), 3000, 'info');
                            })
                            .catch((err) => {
                                ui.addNotification(null, E('p',
                                    _('Failed to clear the log: %s').format(err.message)), 'error');
                            });
                    })
                }, _('Clear Log')),
                E('button', {
                    'class': 'btn cbi-button-apply', 'style': 'margin-left:10px',
                    'click': ui.createHandlerFn(this, (ev) => {
                        let newValue = reversed
                            ? textarea.getValue().split('\n').reverse().join('\n')
                            : content;

                        textarea.setValue(newValue);
                        ev.target.textContent = reversed
                            ? _('▽ Show Oldest First')
                            : _('△ Show Newest First');
                        reversed = !reversed;
                    })
                }, _('▽ Show Oldest First')),
                E('span', { 'style': 'margin-left: 20px;' }, [_('Number of logs retained'),
                E('select', {
                    'id': 'log_length', 'class': 'cbi-input-select',
                    'style': 'width: 80px; margin-left:10px'
                }, [50, 100, 200, 250, 300, 350].map(v =>
                    E('option', { value: v, selected: log_length == String(v) ? '' : null }, v)
                )),
                E('button', {
                    'style': 'margin-left: 10px;', 'class': 'btn cbi-button-apply',
                    'click': () => {
                        const val = document.getElementById('log_length').value;
                        if (val != log_length) {
                            uci.set('taskplan', 'globals', 'log_length', val);
                            uci.save();
                            uci.apply()
                                .then(() => ui.addTimeLimitedNotification(null, E('p', _('Save successfully')), 3000))
                                .catch((e) => ui.addTimeLimitedNotification(null, E('p', e.message), 3000));
                        };
                    }
                }, _('Save')),
                ]),
            ])
            : [];

        return E([
            E('style', { 'type': 'text/css' }, [
                `.cbi-input-textarea {
                    font-size:14px; color: #c5c5b2; border: 1px solid #555;
                    background-color: #272626; font-family: Consolas, monospace;
                }`
            ]),
            button,
            textarea.render()
        ]);
    },

    handleSave: null,
    handleReset: null,
    handleSaveApply: null
});
