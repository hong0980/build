'use strict';
'require fs';
'require ui';
'require view';

return view.extend({
    load: function() {
        return fs.read_direct('/etc/taskplan/taskplan.log')
            .then(() => fs.read('/etc/taskplan/taskplan.log'))
            .catch(() => null);
    },

    render: function(data) {
        var reversed = false;
        var content = data != null ? data : '';
        var textarea = new ui.Textarea(content, { rows: 25 });
        var textareaNode = textarea.render();

        return E([
            E('style', { 'type': 'text/css' }, [
                `.cbi-input-textarea {
                    font-size:14px; color: #c5c5b2; border: 1px solid #555;
                    background-color: #272626; font-family: Consolas, monospace;
                }`
            ]),
            E('button', {
                'class': 'btn cbi-button-negative',
                'click': ui.createHandlerFn(this, () => {
                    Promise.all([
                        fs.write('/etc/taskplan/taskplan.log', ''),
                        fs.write('/var/run/taskplan_counter.dat', '0')
                    ])
                    .then(() => {
                        textarea.setValue('');
                        content = '';
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
                'click': ui.createHandlerFn(this, () => {
                    var newValue = reversed
                        ? content
                        : textarea.getValue().split('\n').reverse().join('\n');

                    textarea.setValue(newValue);
                    reversed = !reversed;
                })
            }, _('Display logs in reverse order')),
            E('p', { 'class': 'cbi-section-descr' }),
            textareaNode,
        ]);
    },

    handleSave: null,
    handleReset: null,
    handleSaveApply: null
});
