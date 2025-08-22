'use strict';
'require fs';
'require ui';
'require uci';
'require view';

const fileConfigs = [
	{
		tab: 'crontab',
		label: _('Scheduled Tasks'),
		filepath: '/etc/crontabs/root',
		description: _('This is the system crontab in which scheduled tasks can be defined.'),
		savecall: () => fs.exec('/etc/init.d/cron', ['reload'])
	},
	{
		tab: 'rc-local',
		label: _('Local Startup'),
		filepath: '/etc/rc.local',
		description: _('This is the content of /etc/rc.local. Insert your own commands here (in front of \'exit 0\') to execute them at the end of the boot process.')
	},
	{
		tab: 'customscript1',
		label: _('Custom Script a'),
		filepath: '/etc/taskplan/script_a',
		description: _('The execution content of the [Scheduled Customscript1] in the task name')
	},
	{
		tab: 'customscript2',
		label: _('Custom Script b'),
		filepath: '/etc/taskplan/script_b',
		description: _('The execution content of the [Scheduled Customscript2] in the task name')
	}
];
const notify = L.bind(ui.addTimeLimitedNotification || ui.addNotification, ui);

const executeScript = (filepath, label) =>
	ui.showModal(_('Are you sure you want to execute the %s script?').format(label), [
		E('style', { type: 'text/css' }, [`.modal{max-width:400px;min-height:100px;width:auto;margin:17em auto;padding:1em;} h4{text-align:center;color:red;}`]),
		E('br'),
		E('div', { style: 'display: flex; justify-content: space-around; gap: 0.5em;' }, [
			E('div', {
				class: 'btn cbi-button-positive',
				click: () => fs.read_direct(filepath)
					.then(content => {
						const firstLine = content.split('\n')[0].match(/^#!\s*(.+)/);
						const interpreter = firstLine ? firstLine[1].trim() : '/bin/sh';
						return fs.exec_direct(interpreter, [filepath])
							.then(response => ui.showModal(_('%s execution result').format(label), [
								E('style', { type: 'text/css' }, [`.modal{max-width: 650px;padding:.5em;}h4{text-align: center;}`]),
								E('div', {}, [
									E('textarea', {
										readonly: '', wrap: 'off', rows: 18,
										style: 'width:100%; font-size:14px; color: #c5c5b2; background-color: #272626; font-family: Consolas, monospace;'
									}, response || _('No results were returned for execution'))
								]),
								E('div', { style: 'display: flex; justify-content: space-around; gap: 0.5em;' }, [
									E('div', {
										class: 'btn cbi-button-neutral', click: ui.hideModal, title: _('Cancel')
									}, _('Cancel')),
									E('div', { style: 'display: flex; align-items: center; gap: 0.5em;' }, [
										E('input', {
											type: 'checkbox', id: 'wordwrap-toggle',
											change: ev => {
												const textarea = document.querySelector('.modal textarea');
												textarea.style.whiteSpace = ev.target.checked ? 'pre-wrap' : 'pre';
											}
										}),
										E('label', { for: 'wordwrap-toggle', title: _('Enable automatic line wrapping') }, _('Wrap text')),
									]),
									E('div', {
										class: 'btn cbi-button-positive', title: _('Copy the current execution result'),
										click: (ev) => {
											const textarea = ev.target.closest('.modal').querySelector('textarea');
											if (textarea) {
												textarea.select();
												document.execCommand('copy');
												notify(null, E('p', _('The execution result has been copied to the clipboard!')), 3000, 'info');
												ui.hideModal();
											}
										}
									}, _('Copy')),
								])]))
							.catch(e => {
								notify(null, E('p', _('Script execution failed: %s').format(e.message)), 8000, 'error');
							})
					})
			}, _('Confirm')),
			E('div', { class: 'btn cbi-button-neutral', click: ui.hideModal }, _('Cancel'))
		])
	]);

return view.extend({
	load: () => Promise.all(fileConfigs.map(({ tab, filepath }) =>
		fs.stat(filepath)
			.catch(() =>
				tab === 'customscript1'
					? L.resolveDefault(fs.exec_direct('/usr/bin/which', ['bash']), null)
						.then(sh => fs.write(filepath, `#!${(sh || '/bin/sh\n')}`))
					: tab === 'customscript2'
						? L.resolveDefault(fs.exec_direct('/usr/bin/which', ['python3']), null)
							.then(py => py
								? fs.write(filepath, `#!${py}`)
								: L.resolveDefault(fs.exec_direct('/usr/bin/which', ['bash']), null)
									.then(sh => fs.write(filepath, `#!${(sh || '/bin/sh\n')}`))
							)
						: null)
			.then((stat) => Promise.all([
				L.resolveDefault(fs.read_direct(filepath), ''),
				fs.stat(filepath), uci.load('system')
			])),
	)),

	render: (data) => {
		const Level = uci.get('system', '@system[0]', 'cronloglevel');
		const tabs = fileConfigs.map((cfg, idx) => {
			const [content, stat] = data[idx];
			if (!stat) return;
			const { description, filepath, label, tab, savecall } = cfg
			return E('div', { 'data-tab': tab, 'data-tab-title': label }, [
				E('p', { style: 'display: flex; align-items: center; gap: 10px;' }, [
					description,
					tab.includes('crontab')
						? E('div', { style: 'display: flex; align-items: center; gap: 10px;' }, [
							E('select', { id: 'cron_option', style: 'width: 80px;' },
								content.split('\n')
									.filter(l => l.trim())
									.map(l => {
										const label = l.split(/\s+/).slice(0, 5).join(' ');
										return E('option', { value: label }, label);
									})
							),
							E('div', {
								class: 'btn cbi-button-apply',
								title: _('After selecting, click to crontab.guru to verify'),
								click: ui.createHandlerFn(this, () => {
									const select = document.getElementById('cron_option');
									if (select && select.value) {
										window.open(`https://crontab.guru/#${select.value.replace(/\s/g, '_')}`);
									}
								})
							}, _('verify')),
							E('div', _('Cron Log Level')),
							E('select', { id: 'loglevel_option', style: 'width: 80px;', class: 'cbi-input-select' }, [
								E('option', { value: 5, selected: Level == '5' ? '' : null }, _('Debug')),
								E('option', { value: 9, selected: Level == '9' ? '' : null }, _('Disabled')),
								E('option', { value: 7, selected: Level == '7' ? '' : null }, _('Normal')),
							]),
							E('div', {
								class: 'btn cbi-button-apply',
								title: _("Save Cron's log level"),
								click: ui.createHandlerFn(this, () => {
									const val = document.getElementById('loglevel_option').value;
									if (val !== Level) {
										uci.set('system', '@system[0]', 'cronloglevel', val);
										uci.save();
										uci.apply()
											.then(() => notify(null, E('p', _("Cron's log level saved successfully")), 3000))
											.catch((e) => notify(null, E('p', e.message), 3000));
									};
								})
							}, _('Save')),
						])
						: [],
				]),
				E('textarea', {
					id: tab, rows: 13,
					style: 'width:100%; font-size:13px; color: #c5c5b2; background-color: #272626; font-family: Consolas, monospace;'
				}, [content]),
				tab.includes('script')
					? E('div', { class: 'cbi-value-description' }, [
						E('b', { style: 'color:red;' },
							_('Note: Please use valid sh syntax. The script runs as root. Avoid destructive commands (e.g., "rm -rf /"). The script should not require user interaction.'))
					])
					: [],
				E('div', { style: 'color:#888;font-size:90%;', }, _('Last modified: %s, Size: %s bytes').format(
					new Date(stat.mtime * 1000).toLocaleString(), stat.size)),
				E('div', { class: 'cbi-page-actions' }, [
					E('div', {
						class: 'btn cbi-button-save',
						click: ui.createHandlerFn(this, () => {
							const value = document.getElementById(tab).value;
							if (value === content) {
								return notify(null, E('p',
									_('No modifications detected. The content remains unchanged.')), 3000);
							};
							fs.write(filepath, value.trim().replace(/\r\n/g, '\n') + '\n')
								.then(() => tab.includes('crontab') ? savecall() : [])
								.then(() => notify(null, E('p', _('%s Contents have been saved.').format(label)), 3000, 'info'))
								.catch(e => notify(null, E('p', _('Unable to save contents: %s').format(e.message)), 8000, 'error'));
						})
					}, _('Save')),
					tab.includes('script')
						? E('div', {
							class: 'btn cbi-button-apply', style: 'margin-left: 6px;',
							click: ui.createHandlerFn(this, () => executeScript(filepath, label))
						}, '%s %s'.format(_('Run'), label))
						: [],
				])
			]);
		}).filter(Boolean);

		const view = E('div', {}, [
			E('b', {}, [
				_('This page can be edited and saved directly. Changes will take effect immediately after saving.'),
				_('Please ensure the syntax is correct, as incorrect syntax may cause the system to malfunction.'),
			]),
			E('div', {}, typeof data === 'object' ? tabs : [])
		]);

		ui.tabs.initTabGroup(view.lastElementChild.childNodes);
		return view;
	},

	handleSave: null,
	handleReset: null,
	handleSaveApply: null
});
