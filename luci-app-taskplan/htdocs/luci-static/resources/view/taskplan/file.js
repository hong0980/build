'use strict';
'require fs';
'require ui';
'require view';

var handleFileSave = (ev, opts) => {
    var value = (document.getElementById(opts.textareaId).value || '').trim().replace(/\r\n/g, '\n') + '\n';
    return fs.write(opts.filePath, value).then(() => {
        document.getElementById(opts.textareaId).value = value;
        return opts.postSaveCallback ? opts.postSaveCallback() : null;
    }).then(() => {
        ui.addTimeLimitedNotification(null, E('p', _('Contents have been saved.')), 3000, 'info');
        ui.hideModal();
    }).catch(e => {
        ui.addTimeLimitedNotification(null, E('p', _('Unable to save contents: %s').format(e.message), 8000, 'error'));
        ui.hideModal();
    });
};

var fileConfigs = [
    {
        label: _('Scheduled Tasks'),
        textareaId: 'crontab_textarea',
        filePath: '/etc/crontabs/root',
        description: _('This is the system crontab in which scheduled tasks can be defined.'),
        tab: 'crontab',
        postSaveCallback: () => fs.exec('/etc/init.d/cron', ['reload'])
    },
    {
        label: _('Local Startup'),
        textareaId: 'rc_local_textarea',
        filePath: '/etc/rc.local',
        description: _('This is the content of /etc/rc.local. Insert your own commands here (in front of \'exit 0\') to execute them at the end of the boot process.'),
        tab: 'rc-local'
    },
    {
        label: _('Custom Script 1'),
        textareaId: 'customscript1_textarea',
        filePath: '/etc/taskplan/customscript1',
        description: _('The execution content of the [Scheduled Customscript1] in the task name'),
        tab: 'customscript1'
    },
    {
        label: _('Custom Script 2'),
        textareaId: 'customscript2_textarea',
        filePath: '/etc/taskplan/customscript2',
        description: _('The execution content of the [Scheduled Customscript2] in the task name'),
        tab: 'customscript2'
    }
];

return view.extend({
    load: () => Promise.all(fileConfigs.map(cfg =>
        Promise.all([
            L.resolveDefault(fs.read(cfg.filePath), ''),
            L.resolveDefault(fs.stat(cfg.filePath), null)
        ])
    )),

    render: data => {
        var tabs = fileConfigs.map((cfg, idx) => {
            var fileContent = data[idx][0], stat = data[idx][1];
            return E('div', { 'data-tab': cfg.tab, 'data-tab-title': cfg.label }, [
                E('p', {}, [
                    E('span', { 'style': 'margin-right: 1em;' }, cfg.description),
                    E('span', { 'style': 'color:#888;font-size:90%;' },
                        stat ? _('Last modified: %s, Size: %s bytes').format(
                            stat.mtime ? new Date(stat.mtime * 1000).toLocaleString() : _('Unknown'),
                            typeof stat.size === 'number' ? stat.size : '?'
                        ) : ui.addTimeLimitedNotification(null, E('p', _('File not found %s').format(cfg.filePath)), 8000, 'error'), ui.hideModal()
                    ),
                    cfg.tab === 'crontab' ?
                        (() => {
                            var exprs = (fileContent || '').split('\n')
                                .filter(line => line.trim() !== '')
                                .map(line => ({
                                    title: line.trim(),
                                    label: line.trim().split(/\s+/).slice(0, 5).join(' ')
                                }));

                            var selectNode = E('select', { 'style': 'width: 100px; margin-left: 25px;' },
                                exprs.map(expr =>
                                    E('option', { 'value': expr.label, 'title': expr.title }, expr.label)
                                ));

                            var buttonNode = E('button', {
                                'class': 'btn cbi-button-apply', 'style': 'margin-left: 15px;',
                                'title': _('Click Verify after selecting'),
                                'click': () => {
                                    var expr = selectNode.value;
                                    if (expr) window.open('https://crontab.guru/#' + expr.replace(/ /g, '_'));
                                }
                            }, _('verify'));
                            return [selectNode, buttonNode];
                        })()
                    : []
                ].flat()),
                cfg.tab === 'customscript1' || cfg.tab === 'customscript2' ?
                E('b', { 'style': 'color:red;' }, _('Note: Please use valid sh syntax. The script runs as root. Avoid destructive commands (e.g., "rm -rf /"). The script should not require user interaction.'))
                : "",
                E('textarea', {
                    'id': cfg.textareaId, 'rows': 18,
                    'style': 'width:100%; background-color:#272626; color:#c5c5b2; border:1px solid #555; font-family:Consolas, monospace; font-size:14px;'
                }, [fileContent != null ? fileContent : '']),
                E('div', { 'class': 'cbi-page-actions' }, [
                    E('button', {
                        'class': 'btn cbi-button-save',
                        'click': ui.createHandlerFn(this, ev => handleFileSave(ev, cfg))
                    }, _('Save'))
                ])
            ]);
        });

        var viewRoot = E('div', {}, [
            E('div', {}, [
                _('This page can be edited and saved directly. Changes will take effect immediately after saving.'),
                E('br'),
                _('Please ensure the syntax is correct, as incorrect syntax may cause the system to malfunction.')
            ]),
            E('div', {}, tabs)
        ]);

        ui.tabs.initTabGroup(viewRoot.lastElementChild.childNodes);

        return viewRoot;
    },

    handleSave: null,
    handleReset: null,
    handleSaveApply: null
});
