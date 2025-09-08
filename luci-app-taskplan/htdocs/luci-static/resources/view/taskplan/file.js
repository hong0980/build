'use strict';
'require fs';
'require ui';
'require uci';
'require view';

let oldcontent;
const scriptfilepath = '/etc/taskplan'
const notify = L.bind(ui.addTimeLimitedNotification || ui.addNotification, ui);
const has = (s = '', sub = '') => String(s).includes(String(sub));

function modalnotify(title, children, timeout, ...classes) {
	function fadeOut(element) {
		element?.classList.replace('fade-in', 'fade-out');
		setTimeout(() => element?.remove());
	};

	const modalContainer = document.querySelector('#modal_overlay .modal');
	if (!modalContainer) return;
	const msg = E('div', {
		class: 'alert-message fade-in',
		style: 'display:flex; margin: 10px 0;',
		transitionend: function (ev) {
			const node = ev.currentTarget;
			if (node.parentNode && node.classList.contains('fade-out')) {
				node.parentNode.removeChild(node);
			};
		}
	}, [
		E('div', { style: 'flex:10' }),
		E('div', { style: 'flex:1 1 auto; display:flex' }, [
			E('button', {
				class: 'btn', style: 'margin-left:auto; margin-top:auto',
				click: () => fadeOut(msg)
			}, _('Dismiss'))
		])
	]);

	L.dom.append(msg.firstElementChild, children);
	msg.classList.add(...classes);
	modalContainer.insertBefore(msg, modalContainer.firstChild);
	if (typeof timeout === 'number' && timeout > 0) {
		setTimeout(() => fadeOut(msg), timeout);
	};
	return msg;
};

function executescript(filepath, label) {
	ui.showModal(_('Are you sure you want to execute the %s script?').format(label), [
		E('style', ['.modal{max-width:400px;min-height:100px;width:auto;margin:17em auto;padding:1em;} h4{text-align:center;color:red;}']),
		E('div', { style: 'display: flex; justify-content: space-around; gap: 0.5em; margin-top: 1em;' }, [
			E('div', {
				class: 'btn cbi-button-positive',
				click: ui.createHandlerFn(this, () =>
					fs.read_direct(filepath).then(content => {
						const firstLine = content.split('\n')[0].match(/^#!\s*(.+)/);
						const interpreter = firstLine ? firstLine[1].trim() : '/bin/sh';

						fs.exec(interpreter, [filepath]).then(res => {
							const content = res.stdout || res.stderr || '';
							const textarea = E('textarea', {
								readonly: '', class: 'cbi-input-textarea', rows: Math.min(content.split('\n').length + 5, 20)
							}, content || _('No results were returned for execution'));
							L.dom.attr(textarea, 'style', 'white-space: pre;font-size:14px;');
							ui.showModal(_('%s execution result').format(label), [
								E('style', ['.modal{max-width: 650px;padding:.5em;}h4{text-align: center;}']),
								textarea,
								E('div', { style: 'display: flex; justify-content: space-around; gap: 0.5em;' }, [
									E('div', {
										class: 'btn cbi-button-neutral', click: ui.hideModal, title: _('Dismiss')
									}, _('Dismiss')),
									E('div', { style: 'display: flex; align-items: center; gap: 0.5em;' }, [
										E('input', {
											type: 'checkbox', id: 'wordwrap_toggle',
											change: (ev) => textarea.style.whiteSpace = ev.target.checked ? 'pre-wrap' : 'pre'
										}),
										E('label', { for: 'wordwrap_toggle', title: _('Enable automatic line wrapping') }, _('Wrap text')),
									]),
									E('div', {
										class: 'btn cbi-button-positive', title: _('Copy the current execution result'),
										click: ui.createHandlerFn(this, () => {
											const { selectionStart, selectionEnd, scrollTop } = textarea;
											textarea.select();
											document.execCommand('copy');
											textarea.setSelectionRange(selectionStart, selectionEnd);
											textarea.scrollTop = scrollTop;
											modalnotify(null, E('p', _('The execution result has been copied to the clipboard!')), 2000, 'info');
										})
									}, _('Copy')),
								])
							]);
							if (res.stderr) modalnotify(null, E('p', _('Script execution failed: %s').format(filepath)), 8000, 'error');
						}).catch(e => modalnotify(null, E('p', _('execution failed: %s').format(e.message)), 8000, 'error'));
					}))
			}, _('Confirm')),
			E('div', { class: 'btn cbi-button-neutral', click: ui.hideModal }, _('Dismiss'))
		])
	]);
};

function savescript(filepath, content, t = null) {
	const notifyFn = t ? modalnotify : notify;
	if (oldcontent === content)
		return notifyFn(null, E('p', _('No modifications detected. The content remains unchanged.')), 3000);
	if (!content.trim()) return;
	fs.write(filepath, content.trim().replace(/\r\n/g, '\n') + '\n')
		.then(() => notifyFn(null, E('p', `${filepath} ${_('Script saved successfully')}`), 3000, 'info'))
		.catch(e => notifyFn(null, E('p', _('Error saving script: %s').format(e)), 5000, 'error'));
};

function deletescript(filepath, label) {
	ui.showModal(_('Are you sure you want to delete script %s?').format(label.replace('script_', '').toUpperCase()), [
		E('style', ['.modal{max-width:400px;min-height:100px;width:auto;margin:17em auto;padding:1em;} h4{text-align:center;color:red;}']),
		E('div', { style: 'display: flex; justify-content: space-around; gap: 0.5em; margin-top: 1em;' }, [
			E('div', {
				class: 'btn cbi-button-remove',
				click: ui.createHandlerFn(this, () => {
					fs.remove(filepath)
						.then(() => window.location.reload())
						.catch(e => modalnotify(null, E('p', _('Error deleting script: %s').format(e)), 10000, 'error'));
				})
			}, _('Confirm Delete')),
			E('div', { class: 'btn cbi-button-neutral', click: ui.hideModal }, _('Dismiss'))
		])
	]);
};

function createscript() {
	const textarea = E('textarea', { rows: 18, class: 'cbi-input-textarea' });
	textarea.style.whiteSpace = 'pre';
	const selectEl = E('select', { style: 'width: 130px;', change: createui },
		['c', 'd', 'e', 'f', 'g'].map(c =>
			E('option', { value: `script_${c}` }, _('Custom Script %s').format(c.toUpperCase()))
		));
	const buttonsEl = E('div', { style: 'display: flex; justify-content: space-around; gap: 0.5em;' }, [
		E('style', ['.modal{max-width: 650px;padding:.5em;}h4{text-align: center;}']),
		E('div', {
			class: 'btn cbi-button-action important',
			click: ui.createHandlerFn(this, () =>
				ui.uploadFile(`${scriptfilepath}/${selectEl.value}`)
					.then(() => window.location.reload())
					.catch((e) => notify(null, E('p', e.message), 3000)))
		}, _('Upload')),
		E('div', {
			class: 'btn cbi-button-apply',
			click: ui.createHandlerFn(this, () => {
				savescript(`${scriptfilepath}/${selectEl.value}`, textarea.value, true);
			})
		}, _('Save')),
		E('div', { class: 'btn cbi-button-neutral', click: ui.hideModal }, _('Dismiss'))
	]);

	ui.showModal(_('Create/Edit Script'), [
		E('div', { style: 'display: flex; justify-content: space-around; gap: 0.5em;' }, [
			E('div', { style: 'display: flex; align-items: center; gap: 10px;' }, [
				E('div', _('Script name')),
				selectEl,
				E('div', { style: 'display: flex; align-items: center; gap: 0.5em;' }, [
					E('input', {
						type: 'checkbox', id: 'wordwrap_toggle',
						change: (ev) => textarea.style.whiteSpace = ev.target.checked ? 'pre-wrap' : 'pre'
					}),
					E('label', {
						for: 'wordwrap_toggle', title: _('Enable automatic line wrapping')
					}, _('Wrap text'))
				])
			]),
		]),
		textarea,
		buttonsEl
	]);

	function createui() {
		textarea.value = '';
		const scriptName = selectEl.value;
		const filePath = `${scriptfilepath}/${scriptName}`
		const scriptDisplayName = _('Custom Script %s').format(scriptName.replace('script_', '').toUpperCase());
		document.getElementById('delete_btn')?.remove();
		document.getElementById('execute_btn')?.remove();

		const executeBtn = E('div', {
			id: 'execute_btn', class: 'btn cbi-button-positive',
			click: ui.createHandlerFn(this, () => executescript(filePath, scriptDisplayName))
		}, _('Run'));

		const deleteBtn = E('div', {
			id: 'delete_btn', class: 'btn cbi-button-remove',
			click: ui.createHandlerFn(this, () => deletescript(filePath, scriptName))
		}, _('Delete'));

		fs.read(filePath)
			.then((content) => {
				// buttonsEl.insertBefore(executeBtn, buttonsEl.children[0]);
				buttonsEl.insertBefore(deleteBtn, buttonsEl.children[1]);
				oldcontent = content;
				textarea.value = content;
			})
			.catch(() => null);
	};
	createui();
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
				.sort((a, b) => a.name.localeCompare(b.name))
				.map(f => ({ name: f.name, display: f.name.replace('script_', '').toUpperCase() }))
		].map((s, i) => ({
			tab: `customscript${i + 1}`,
			filepath: `${scriptfilepath}/${s.name}`,
			label: _('Custom Script %s').format(s.display),
			description: _('Execution content of script %s').format(s.display)
		}))
	];
};

return view.extend({
	load: () => fs.list(scriptfilepath).then(files =>
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
		const view = E('div', [
			E('style', ['.cbi-input-textarea {width:100%; font-size:13px; color: #c5c5b2; background-color: #272626; font-family: Consolas, monospace; white-space: pre;}']),
			E('b', [
				_('This page can be edited and saved directly. Changes will take effect immediately after saving.'),
				_('Please ensure the syntax is correct, as incorrect syntax may cause the system to malfunction.'),
			]),
		]);

		fs.list(scriptfilepath).then(filestat => {
			const tabs = generateFileConfigs(filestat).map((cfg, idx) => {
				const [content, stat] = data[idx];
				if (!stat) return;
				const { description, filepath, label, tab } = cfg;
				return E('div', { 'data-tab': tab, 'data-tab-title': label }, [
					E('p', { style: 'display: flex; align-items: center; gap: 10px;' }, [
						E('div', description),
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
												.then(() => fs.exec('/etc/init.d/cron', ['restart'])
													.then((res) => !res.stdout && notify(null, E('p', _("Cron's log level saved successfully")), 3000))
													.catch((e) => notify(null, E('p', e.message), 8000)));
										};
									})
								}, _('Save')),
							])
							: [],
						has(tab, 'customscript')
							? E('div', {
								click: createscript, class: 'btn cbi-button-add', style: 'margin-left: auto;'
							}, _('Create/Edit Script'))
							: [],
					]),
					E('div', { class: 'right' }, [
						E('small', _('Last modified: %s, Size: %s bytes').format(
							new Date(stat.mtime * 1000).toLocaleString(), stat.size)
						)
					]),
					E('textarea', { id: tab, class: 'cbi-input-textarea', rows: Math.min(content.split('\n').length + 3, 20) }, content),
					has(tab, 'script')
						? E('b', { style: 'color:red;' },
							_('Note: Please use valid syntax. The script runs as root. Avoid destructive commands (e.g., "rm -rf /"). The script should not require user interaction.'))
						: [],
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
								oldcontent = content;
								savescript(filepath, document.getElementById(tab).value || '');
							})
						}, _('Save')),
					])
				]);
			}).filter(Boolean);

			view.appendChild(E('div', tabs));
			ui.tabs.initTabGroup(view.lastElementChild.childNodes);
		});
		return view;
	},

	handleSave: null,
	handleReset: null,
	handleSaveApply: null
});
