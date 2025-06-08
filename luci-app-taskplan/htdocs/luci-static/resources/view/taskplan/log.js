'use strict';
'require view';
'require fs';
'require ui';

return view.extend({
    load: function() {
        return L.resolveDefault(fs.read('/etc/taskplan/taskplan.log'), '');
    },

    render: function(content) {
        let reversed = false;
        let originalContent = content != null ? content : '';
        let textarea = E('textarea', { 'style': 'width:100%; background-color:#272626; color:#c5c5b2; border:1px solid #555; font-family:Consolas, monospace; font-size:14px;', 'rows': 25 }, [ content != null ? content : '' ]);

        return E([
            E('button', {
                'class': 'btn cbi-button-negative',
                'click': ui.createHandlerFn(this, function() {
                    fs.write('/etc/taskplan/taskplan.log', '')
                        .then(function() {
                            textarea.value = '';
                            originalContent = '';
                            ui.addNotification(null, E('p', _('Log cleared')), 'info');
                        })
                        .catch(function(err) {
                            ui.addNotification(null, E('p',
                                _('Failed to clear the log: %s').format(err.message)), 'error');
                        });
                })
            }, _('Clear Log')),
            E('button', {
                'class': 'btn cbi-button-apply',
                'style': 'margin-left:10px',
                'click': function() {
                    if (!reversed) {
                        textarea.value = originalContent.split('\n').reverse().join('\n');
                        reversed = true;
                    } else {
                        textarea.value = originalContent;
                        reversed = false;
                    }
                }
            }, _('Display logs in reverse order')),
            E('p', { 'class': 'cbi-section-descr' }),
            E('p', {}, textarea)
        ]);
    },

    handleSave: null,
    handleSaveApply: null,
    handleReset: null
});
