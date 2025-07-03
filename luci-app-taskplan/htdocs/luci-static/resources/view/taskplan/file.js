'use strict';
'require fs';
'require ui';
'require view';

var fileConfigs = [
    {
        tab: 'crontab',
        label: _('Scheduled Tasks'),
        filePath: '/etc/crontabs/root',
        description: _('This is the system crontab in which scheduled tasks can be defined.'),
        postSaveCallback: () => fs.exec('/etc/init.d/cron', ['reload'])
    },
    {
        tab: 'rc-local',
        label: _('Local Startup'),
        filePath: '/etc/rc.local',
        description: _('This is the content of /etc/rc.local. Insert your own commands here (in front of \'exit 0\') to execute them at the end of the boot process.')
    },
    {
        tab: 'customscript1',
        label: _('Custom Script 1'),
        filePath: '/etc/taskplan/customscript1',
        description: _('The execution content of the [Scheduled Customscript1] in the task name')
    },
    {
        tab: 'customscript2',
        label: _('Custom Script 2'),
        filePath: '/etc/taskplan/customscript2',
        description: _('The execution content of the [Scheduled Customscript2] in the task name')
    }
];

return view.extend({
    load: () => Promise.all(fileConfigs.map(cfg =>
        fs.stat(cfg.filePath)
            .catch(() => {
                if (cfg.tab.includes('script')) {
                    return fs.write(cfg.filePath, '#!/bin/sh\n');
                }
            })
            .then(() => Promise.all([
                L.resolveDefault(fs.stat(cfg.filePath), null),
                L.resolveDefault(fs.read_direct(cfg.filePath), '')
            ]))
    )),

    render: function(data) {
        var tabs = fileConfigs.map((cfg, idx) => {
            var stat = data[idx][0], content = data[idx][1];
            var textarea = new ui.Textarea(content, { rows: 18 });
            var textareaNode = textarea.render();
            // textarea.setChangeEvents(textareaNode.firstElementChild, 'change');
            return E('div', { 'data-tab': cfg.tab, 'data-tab-title': cfg.label }, [
                E('p', {}, [
                    E('span', { 'style': 'margin-right: 1em;' }, cfg.description),
                    stat
                        ? E('span', { 'style': 'color:#888;font-size:90%;' },
                            _('Last modified: %s, Size: %s bytes').format(
                                new Date(stat.mtime * 1000).toLocaleString(),
                                stat.size
                            )
                          )
                        : '',
                    cfg.tab.includes('crontab')
                        ? E('span', {}, [
                            E('select', { 'style': 'width: 100px; margin-left: 20px;', 'class': 'cbi-input-select' },
                                content.split('\n')
                                    .filter(l => l.trim())
                                    .map(l => {
                                        var label = l.split(/\s+/).slice(0, 5).join(' ');
                                        return E('option', { 'value': label }, label);
                                    })
                            ),
                            E('button', {
                                'style': 'margin-left: 15px;',
                                'class': 'btn cbi-button-apply',
                                'title': _('Click Verify after selecting'),
                                'click': ui.createHandlerFn(this, () => {
                                    var select = document.querySelector('.cbi-input-select');
                                    if (select && select.value) {
                                        window.open(`https://crontab.guru/#${select.value.replace(/\s/g, '_')}`);
                                    }
                                })
                            }, _('verify'))
                          ])
                        : '',
                    cfg.tab.includes('script')
                        ? E('div', {}, [
                            E('b', { 'style': 'color:red;' },
                                _('Note: Please use valid sh syntax. The script runs as root. Avoid destructive commands (e.g., "rm -rf /"). The script should not require user interaction.'))
                          ])
                        : '',
                ]),
                textareaNode,
                E('div', { 'class': 'cbi-page-actions' }, [
                    E('button', { 'class': 'btn cbi-button-save',
                        'click': () => {
                            if (!textarea.isChanged()) {
                                ui.addTimeLimitedNotification(null, E('p',
                                    _('No modifications detected. The content remains unchanged.')), 3000, 'info');
                                return;
                            };
                            var value = textarea.getValue().trim().replace(/\r\n/g, '\n') + '\n';
                            fs.write(cfg.filePath, value)
                                .then(() => cfg.postSaveCallback ? cfg.postSaveCallback() : null)
                                .then(() => ui.addTimeLimitedNotification(null, E('p',
                                    _('Contents have been saved.')), 3000, 'info'))
                                .catch(e => ui.addTimeLimitedNotification(null, E('p',
                                    _('Unable to save contents: %s').format(e.message), 8000, 'error')));
                            }
                    }, _('Save'))
                ])
            ]);
        });

        var view = E('div', {}, [
            E('style', { 'type': 'text/css' }, [
                `.cbi-input-textarea {
                    font-size:14px; color: #c5c5b2; border: 1px solid #555;
                    background-color: #272626; font-family: Consolas, monospace;
                }`
            ]),
            E('div', {}, [
                _('This page can be edited and saved directly. Changes will take effect immediately after saving.'),
                E('br'),
                _('Please ensure the syntax is correct, as incorrect syntax may cause the system to malfunction.')
            ]),
            E('div', {}, tabs)
        ]);

        ui.tabs.initTabGroup(view.lastElementChild.childNodes);
        return view;
    },

    handleSave: null,
    handleReset: null,
    handleSaveApply: null
});
