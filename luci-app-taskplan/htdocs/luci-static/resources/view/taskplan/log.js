'use strict';
'require fs';
'require ui';
'require view';

const logPath = '/etc/taskplan/taskplan.log';

return view.extend({
    load: () => Promise.all([
        fs.lines(logPath),
        fs.trimmed(logPath)
    ]),

    render: function([lines, content]) {
        let reversed = false;
        const textarea = new ui.Textarea(content || _('No log data available'), { rows: content ? 25 : 3 });
        const button = content
            ?  E('p', {}, [
                    E('button', {
                        'class': 'btn cbi-button-negative', 'title': _('Clear Log'),
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
                        'title': _('Display logs in reverse order'),
                        'click': ui.createHandlerFn(this, () => {
                            var newValue = reversed
                                ? content
                                : textarea.getValue().split('\n').reverse().join('\n');

                            textarea.setValue(newValue);
                            reversed = !reversed;
                        })
                    }, _('Display logs in reverse order')),
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
