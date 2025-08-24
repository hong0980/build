'use strict';
'require fs';
'require ui';
'require uci';
'require view';

const newfilepath = '/etc/taskplan'
const notify = L.bind(ui.addTimeLimitedNotification || ui.addNotification, ui);

function createscript(filestat) {
	const existingScripts = filestat.map(script => script.name);
	return E('div', {
		class: 'btn cbi-button-add',
		click: ui.createHandlerFn(this, () => {
			const modalContent = [
				E('div', { style: 'display: flex; justify-content: space-around; gap: 0.5em;' }, [
					E('div', { style: 'display: flex; align-items: center; gap: 10px;' }, [
						E('div', _('Script name')),
						E('select', {
							id: 'script-select', style: 'width: 130px;', class: 'cbi-input-select'
						}, ['c', 'd', 'e', 'f', 'g'].map(c =>
							E('option', { value: `script_${c}` }, _('Custom Script %s').format(c.toUpperCase()))
						))
					]),
				]),
				E('textarea', {
					wrap: 'off', rows: 18, id: 'script-content',
					style: 'width:100%; font-size:14px; color: #c5c5b2; background-color: #272626; font-family: Consolas, monospace;'
				}),
				E('div', { id: 'action-buttons', style: 'display: flex; justify-content: space-around; gap: 0.5em;' }, [
					E('style', { type: 'text/css' }, [`.modal{max-width: 650px;padding:.5em;}h4{text-align: center;}`]),
					E('div', { class: 'btn cbi-button-neutral', click: ui.hideModal }, _('Cancel')),
					E('div', { class: 'btn cbi-button-apply', click: ui.createHandlerFn(this, saveScript) }, _('Save')),
					E('div', { class: 'btn cbi-button-action', click: ui.createHandlerFn(this, upload) }, _('Upload')),
				])
			];

			ui.showModal(_('Create/Edit Script'), modalContent);

			const selectEl = document.getElementById('script-select');
			const textareaEl = document.getElementById('script-content');
			const buttonsEl = document.getElementById('action-buttons');

			const updateUI = () => {
				const scriptName = selectEl.value;
				const exists = existingScripts.includes(scriptName);
				const oldDeleteBtn = document.getElementById('delete-btn');
				if (oldDeleteBtn) buttonsEl.removeChild(oldDeleteBtn);

				if (exists) {
					const deleteBtn = E('div', {
						id: 'delete-btn', class: 'btn cbi-button-remove', click: ui.createHandlerFn(this, confirmDelete)
					}, _('Delete'));
					buttonsEl.insertBefore(deleteBtn, buttonsEl.lastChild);
				};

				if (exists) {
					fs.read(`${newfilepath}/${scriptName}`)
						.then(content => textareaEl.value = content)
						.catch(() => textareaEl.value = '');
				} else {
					textareaEl.value = '';
				};
			};

			function upload() {
				const name = selectEl.value;
				ui.uploadFile(`${newfilepath}/${name}`)
					.then(() => {
						notify(null, E('p', _('File saved to %s').format(`${newfilepath}/${name}`)), 3000, 'info');
						ui.hideModal();
						window.location.reload();
					})
					.catch((e) => notify(null, E('p', e.message), 3000))
			};

			function saveScript() {
				const name = selectEl.value;
				const content = textareaEl.value.trim();
				if (!content) return;

				fs.write(`${newfilepath}/${name}`, content.replace(/\r\n/g, '\n') + '\n')
					.then(() => {
						notify(null, E('p', _('Script saved successfully')), 3000, 'info');
						ui.hideModal();
						window.location.reload();
					})
					.catch(e => notify(null, E('p', _('Error saving script: %s').format(e)), 5000, 'error'));
			};

			function confirmDelete() {
				const name = selectEl.value;
				ui.showModal(_('Are you sure you want to delete script %s?').format(name.replace('script_', '').toUpperCase()), [
					E('style', { type: 'text/css' }, [`.modal{max-width:400px;min-height:100px;width:auto;margin:17em auto;padding:1em;} h4{text-align:center;color:red;}`]),
					E('div', { style: 'display: flex; justify-content: space-around; gap: 0.5em; margin-top: 1em;' }, [
						E('div', {
							class: 'btn cbi-button-remove',
							click: ui.createHandlerFn(this, () => {
								fs.remove(`${newfilepath}/${name}`)
									.then(() => {
										notify(null, E('p', _('Script deleted successfully')), 3000, 'info');
										ui.hideModal();
										window.location.reload();
									})
									.catch(e => notify(null, E('p', _('Error deleting script: %s').format(e)), 5000, 'error'));
							})
						}, _('Confirm Delete')),
						E('div', { class: 'btn cbi-button-neutral', click: ui.hideModal }, _('Cancel'))
					])
				]);
			};

			updateUI();
			selectEl.addEventListener('change', updateUI);
		})
	}, _('Create/Edit Script'));
};

function executescript(filepath, label) {
	ui.showModal(_('Are you sure you want to execute the %s script?').format(label), [
		E('style', { type: 'text/css' }, [`.modal{max-width:400px;min-height:100px;width:auto;margin:17em auto;padding:1em;} h4{text-align:center;color:red;}`]),
		E('div', { style: 'display: flex; justify-content: space-around; gap: 0.5em; margin-top: 1em;' }, [
			E('div', {
				class: 'btn cbi-button-positive',
				click: ui.createHandlerFn(this, () => {
					fs.read_direct(filepath)
						.then(content => {
							const firstLine = content.split('\n')[0].match(/^#!\s*(.+)/);
							const interpreter = firstLine ? firstLine[1].trim() : '/bin/sh';
							fs.exec_direct(interpreter, [filepath])
								.then(response => ui.showModal(_('%s execution result').format(label), [
									E('style', { type: 'text/css' }, [`.modal{max-width: 650px;padding:.5em;}h4{text-align: center;}`]),
									E('textarea', {
										readonly: '', wrap: 'off', rows: Math.min(response.split('\n').length + 3, 20),
										style: 'width:100%; font-size:14px; color: #c5c5b2; background-color: #272626; font-family: Consolas, monospace;'
									}, response || _('No results were returned for execution')),
									E('div', { style: 'display: flex; justify-content: space-around; gap: 0.5em;' }, [
										E('div', {
											class: 'btn cbi-button-neutral', click: ui.hideModal, title: _('Cancel')
										}, _('Cancel')),
										E('div', { style: 'display: flex; align-items: center; gap: 0.5em;' }, [
											E('input', {
												type: 'checkbox', id: 'wordwrap-toggle',
												change: (ev) => {
													const textarea = document.querySelector('.modal textarea');
													textarea.style.whiteSpace = ev.target.checked ? 'pre-wrap' : 'pre';
												}
											}),
											E('label', { for: 'wordwrap-toggle', title: _('Enable automatic line wrapping') }, _('Wrap text')),
										]),
										E('div', {
											class: 'btn cbi-button-positive', title: _('Copy the current execution result'),
											click: ui.createHandlerFn(this, (ev) => {
												const textarea = ev.target.closest('.modal').querySelector('textarea');
												if (textarea) {
													textarea.select();
													document.execCommand('copy');
													notify(null, E('p', _('The execution result has been copied to the clipboard!')), 3000, 'info');
													ui.hideModal();
												};
											})
										}, _('Copy')),
									])]))
								.catch(e => {
									notify(null, E('p', _('Script execution failed: %s').format(e.message)), 8000, 'error');
								})
						})
				})
			}, _('Confirm')),
			E('div', { class: 'btn cbi-button-neutral', click: ui.hideModal }, _('Cancel'))
		])
	])
};

function deletescript(filepath, label) {
	ui.showModal(_('Are you sure you want to delete script %s?').format(label.replace('script_', '').toUpperCase()), [
		E('style', { type: 'text/css' }, [`.modal{max-width:400px;min-height:100px;width:auto;margin:17em auto;padding:1em;} h4{text-align:center;color:red;}`]),
		E('div', { style: 'display: flex; justify-content: space-around; gap: 0.5em; margin-top: 1em;' }, [
			E('div', {
				class: 'btn cbi-button-remove',
				click: ui.createHandlerFn(this, () => {
					fs.remove(filepath)
						.then(() => window.location.reload())
						.catch(e => notify(null, E('p', _('Error deleting script: %s').format(e)), 5000, 'error'));
				})
			}, _('Confirm Delete')),
			E('div', { class: 'btn cbi-button-neutral', click: ui.hideModal }, _('Cancel'))
		])
	])
};

function generateFileConfigs(files) {
	return [
		{
			tab: 'crontab',
			label: _('Scheduled Tasks'),
			filepath: '/etc/crontabs/root',
			description: _('This is the system crontab in which scheduled tasks can be defined.')
		},
		{
			tab: 'rc-local',
			label: _('Local Startup'),
			filepath: '/etc/rc.local',
			description: _('This is the content of /etc/rc.local. Insert your own commands here (in front of \'exit 0\') to execute them at the end of the boot process.')
		},
		...[
			{ name: 'script_a', display: 'A' },
			{ name: 'script_b', display: 'B' },
			...files.filter(f => !/script_[ab]|log/i.test(f.name))
				.map(f => ({ name: f.name, display: f.name.replace('script_', '').toUpperCase() }))
		].map((s, i) => ({
			tab: `customscript${i + 1}`,
			filepath: `${newfilepath}/${s.name}`,
			label: _('Custom Script %s').format(s.display),
			description: _('Execution content of script %s').format(s.display)
		}))
	];
};
const has = (s = '', sub = '') => String(s).includes(String(sub));

return view.extend({
	load: () => fs.list(newfilepath).then(files =>
		Promise.all(generateFileConfigs(files).map(({ tab, filepath }) => fs.stat(filepath)
			.catch(() => has(tab, 'script1')
				? L.resolveDefault(fs.exec_direct('/usr/bin/which', ['bash']), null)
					.then(sh => fs.write(filepath, `#!${(sh || '/bin/sh\n')}`))
				: has(tab, 'script2')
					? L.resolveDefault(fs.exec_direct('/usr/bin/which', ['python3']), null)
						.then(py => py
							? fs.write(filepath, `#!${py}`)
							: L.resolveDefault(fs.exec_direct('/usr/bin/which', ['bash']), null)
								.then(sh => fs.write(filepath, `#!${(sh || '/bin/sh\n')}`)))
					: null)
			.then(() => Promise.all([
				L.resolveDefault(fs.read(filepath), ''),
				fs.stat(filepath),
				uci.load('system')
			]))
		))
	),

	render: (data) => {
		const Level = uci.get('system', '@system[0]', 'cronloglevel');
		const view = E('div', {}, [
			E('b', {}, [
				_('This page can be edited and saved directly. Changes will take effect immediately after saving.'),
				_('Please ensure the syntax is correct, as incorrect syntax may cause the system to malfunction.'),
			]),
		]);

		fs.list(newfilepath).then(files => {
			const tabs = generateFileConfigs(files).map((cfg, idx) => {
				const [content, stat] = data[idx];
				if (!stat) return;
				const { description, filepath, label, tab } = cfg;
				return E('div', { 'data-tab': tab, 'data-tab-title': label }, [
					E('p', { style: 'display: flex; align-items: center; gap: 10px;' }, [
						description,
						has(tab, 'crontab')
							? E('div', { style: 'display: flex; align-items: center; gap: 10px;' }, [
								E('select', { id: 'cron_option', style: 'width: 80px;' },
									content.split('\n').filter(l => l.trim())
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
									class: 'btn cbi-button-apply', title: _("Save Cron's log level"),
									click: ui.createHandlerFn(this, () => {
										const val = document.getElementById('loglevel_option').value;
										if (val !== Level) {
											uci.set('system', '@system[0]', 'cronloglevel', val);
											uci.save();
											uci.apply()
												.then(() => fs.exec_direct('/etc/init.d/cron', ['restart'])
													.then(() => notify(null, E('p', _("Cron's log level saved successfully")), 3000))
													.catch((e) => notify(null, E('p', e.message), 3000)));
										};
									})
								}, _('Save')),
							])
							: [],
					]),
					E('textarea', {
						id: tab, rows: Math.min(content.split('\n').length + 1, 20),
						style: 'width:100%; font-size:13px; color: #c5c5b2; background-color: #272626; font-family: Consolas, monospace;'
					}, [content]),
					has(tab, 'script')
						? E('b', { style: 'color:red;' },
							_('Note: Please use valid syntax. The script runs as root. Avoid destructive commands (e.g., "rm -rf /"). The script should not require user interaction.'))
						: [],
					E('div', { style: 'color:#888;font-size:90%;', }, _('Last modified: %s, Size: %s bytes').format(
						new Date(stat.mtime * 1000).toLocaleString(), stat.size)),
					E('div', { style: 'display:flex;justify-content:flex-end;gap:10px;padding:17px 20px 18px 17px;background:#f8f8f8;border-top:1px solid #e0e0e0;border-radius:0 0 3px 3px;margin-bottom:18px' }, [
						/script_[c-g]/i.test(filepath)
							? E('div', {
								class: 'btn cbi-button-remove',
								click: ui.createHandlerFn(this, () => deletescript(filepath, label))
							}, '%s %s'.format(_('Delete'), label))
							: [],
						has(tab, 'script')
							? E('div', {
								class: 'btn cbi-button-apply',
								click: ui.createHandlerFn(this, () => executescript(filepath, label))
							}, '%s %s'.format(_('Run'), label))
							: [],
						E('div', {
							class: 'btn cbi-button-save',
							click: ui.createHandlerFn(this, () => {
								const value = document.getElementById(tab).value;
								if (value === content) {
									return notify(null, E('p',
										_('No modifications detected. The content remains unchanged.')), 3000);
								};
								fs.write(filepath, value.trim().replace(/\r\n/g, '\n') + '\n')
									.then(() => notify(null, E('p', _('%s Contents have been saved.').format(label)), 3000, 'info'))
									.catch(e => notify(null, E('p', _('Unable to save contents: %s').format(e.message)), 8000, 'error'));
							})
						}, _('Save')),
					])
				]);
			}).filter(Boolean);

			view.appendChild(E('div', { style: 'display: inline-block; margin-left: 10px;' }, createscript(files)));
			view.appendChild(E('div', {}, tabs));
			ui.tabs.initTabGroup(view.lastElementChild.childNodes);
		});
		return view;
	},

	handleSave: null,
	handleReset: null,
	handleSaveApply: null
});
