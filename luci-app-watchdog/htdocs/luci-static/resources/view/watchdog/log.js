'use strict';
'require ui';
'require fs';
'require poll';
'require view';

const logpath = '/tmp/watchdog/watchdog.log';
const notify = L.bind(ui.addTimeLimitedNotification || ui.addNotification, ui);

return view.extend({
    load: function () {
        return L.resolveDefault(fs.stat(logpath), null);
    },

    render: function (stat) {
        let lastLogContent = '', newContent = '';
        const logDisplay = E('div', {}, E('pre', { style: 'margin: 0;' }));

        poll.add(L.bind(() => L.resolveDefault(fs.read(logpath, 'text'), '')
            .then(res => {
                newContent = stat ? res ? res.trim() : _('Log is clean.') : _('Log file does not exist.');
                if (newContent !== lastLogContent) {
                    logDisplay.firstChild.textContent = newContent;
                    logDisplay.firstChild.scrollTop = logDisplay.firstChild.scrollHeight;
                    lastLogContent = newContent;
                }
            })
        ));

        const view = E('div', {}, [
            E('small', {}, _('Refresh every %s seconds.').format(L.env.pollinterval)),
            logDisplay,
            stat?.size > 0
                ? E('div', {}, [
                    E('div', { style: 'color:#888;font-size:90%;' }, _('Last modified: %s, Size: %s bytes').format(
                        new Date(stat.mtime * 1000).toLocaleString(), stat.size
                    )),
                    E('div', {
                        class: 'btn cbi-button-remove',
                        click: ui.createHandlerFn(this, () => fs.write(logpath, '')
                            .then(() => {
                                notify(null, E('p', _('Log cleared')), 3000, 'info');
                                lastLogContent = '';
                            })
                            .catch(e =>
                                notify(null, E('p', _('Failed to clear log: %s').format(e)), 5000, 'error')
                            )
                        )
                    }, _('Clear Logs')),
                ])
                : [],
        ]);
        return view;
    },

    handleSave: null,
    handleReset: null,
    handleSaveApply: null
});
