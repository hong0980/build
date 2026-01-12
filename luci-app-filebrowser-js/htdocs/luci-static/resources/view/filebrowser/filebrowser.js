'use strict';
'require fs';
'require ui';
'require dom';
'require view';

const CSS = `
.file-name-cell:hover {
	background: #f5f7fa;
}

.file-context-menu {
	margin: 0;
	padding: 5px 0;
	position: fixed;
	z-index: 10000;
	font-size: 12px;
	border-radius: 5px;
	border: 1px solid #dadada;
	background-color: #f5f5f5;
	font-family: Arial, sans-serif;
	box-shadow: 2px 2px 6px rgba(0,0,0,.1);
}
.file-context-menu .item {
    color: #333;
    display: block;
    cursor: pointer;
    padding: 5px 10px;
    transition: all 0.3s ease-in-out;
}
.file-context-menu .item:hover {
    color: #007bff;
    background-color: #fff;
}
.file-context-menu .item:not(:last-child) {
    border-bottom: 1px solid #ddd;
}
.file-checkbox {
	gap:5px;
	display:flex;
	align-items:center;
}
.ace-toolbar-select {
	min-width: 60px !important;
	max-width: 80px;
}
.batch-action-bar {
	display: none; /* 默认隐藏 */
	position: fixed; /* 固定定位 */
	top: 50px; /* 距离顶部50像素 */
	right: 0px; /* 距离右侧0像素 */
	z-index: 100; /* 层级索引 */
	background: #fff; /* 背景色白色 */
	border: 1px solid #ccc; /* 边框：1像素实线灰色 */
	border-radius: 5px; /* 边框圆角8像素 */
	padding: 5px; /* 内边距10像素 */
}

tr.selected {
	background-color: #e4efffff;
}
.table .th, .table .td {
	padding: 5px 10px 5px;
}

.ace-fullscreen {
	inset: 0;
	z-index: 9999;
	position: fixed;
	background: #fff;
	display: flex;
	flex-direction: column;
}

.ace-fullscreen .ace-editor-container {
	flex: 1;
	display: flex;
	flex-direction: column;
}

.ace-fullscreen .ace-editor-container .ace-wrapper {
	flex: 1;
	height: auto !important;
}

.ace-fullscreen-wrapper > div:last-child {
	border-top: 1px solid #eee;
	padding: .5em;
	background: #fafafa;
}

.ace-editor-container {
	height: 100%;
	display: flex;
	flex-direction: column;
}

.ace-editor-container > div:last-child {
	flex: 1 1 auto;
}

.ace-toolbar {
	flex: 0 0 auto;padding: 6px 6px;
}
.ace-toolbar-select {
	min-width: 60px !important;
	max-width: 80px;
}
@media (max-width: 768px) {
	.batch-action-bar {
		left: 50%;
		right: auto;
		transform: translateX(-50%);
	}
	.ace-toolbar .cbi-value-field {
		gap: 6px;
	}
}`;

const permissions = [
	[777, _('777 - All users have read, write and execute permissions')],
	[755, _('755 - All users have read and execute permissions, but only the file owner has write permissions')],
	[700, _('700 - Only the file owner has read, write, and execute permissions')],
	[666, _('666 - All users have read and write permissions but no execute permissions')],
	[644, _('644 - All users have read permissions, but only the file owner has write permissions')],
	[600, _('600 - Only the file owner has read and write permissions')],
	[555, _('555 - All users have execute permissions, but only the file owner has read and write permissions')],
	[444, _('444 - All users have read permissions but no write and execute permissions')]
];

const themes = [
	["ambiance", "Ambiance"], ["chaos", "Chaos"], ["chrome", "Chrome"],
	["cloud9_day", "Cloud9 Day"], ["cloud9_night", "Cloud9 Night"],
	["cloud9_night_low_color", "Cloud9 Night Low Color"], ["clouds", "Clouds"],
	["clouds_midnight", "Clouds Midnight"], ["cobalt", "Cobalt"],
	["crimson_editor", "Crimson Editor"], ["dawn", "Dawn"], ["dracula", "Dracula"],
	["dreamweaver", "Dreamweaver"], ["eclipse", "Eclipse"], ["github", "GitHub"],
	["github_dark", "GitHub Dark"], ["gob", "Gob"], ["gruvbox", "Gruvbox"],
	["gruvbox_dark_hard", "Gruvbox Dark Hard"], ["gruvbox_light_hard", "Gruvbox Light Hard"],
	["idle_fingers", "Idle Fingers"], ["iplastic", "IPlastic"], ["katzenmilch", "Katzenmilch"],
	["kr_theme", "KR Theme"], ["kuroir", "Kuroir"], ["merbivore", "Merbivore"],
	["merbivore_soft", "Merbivore Soft"], ["mono_industrial", "Mono Industrial"],
	["monokai", "Monokai"], ["nord_dark", "Nord Dark"], ["one_dark", "One Dark"],
	["pastel_on_dark", "Pastel on Dark"], ["solarized_dark", "Solarized Dark"],
	["solarized_light", "Solarized Light"], ["sqlserver", "SQL Server"],
	["terminal", "Terminal"], ["textmate", "TextMate"], ["tomorrow", "Tomorrow"],
	["tomorrow_night", "Tomorrow Night"], ["tomorrow_night_blue", "Tomorrow Night Blue"],
	["tomorrow_night_bright", "Tomorrow Night Bright"], ["tomorrow_night_eighties", "Tomorrow Night Eighties"],
	["twilight", "Twilight"], ["vibrant_ink", "Vibrant Ink"], ["xcode", "Xcode"]
];

const modes = [
	['javascript', 'JS'], ['sh', 'Shell'], ['lua', 'Lua'],
	['html', 'HTML'], ['json', 'JSON'], ['python', 'Python'],
	['text', 'Text'], ['css', 'CSS'], ['yaml', 'YAML'],
	['xml', 'XML'], ['toml', 'Toml'], ["sql", "SQL"],
	["ini", "ini"], ["diff", "patch(diff)"], ["makefile", "Makefile"]
];

return view.extend({
	load: function (p = null) {
		const pathFromUrl = location.hash ? location.hash.slice(1) : null;
		const path = (p && typeof p === 'string')
			? p.replace(/\/+/g, '/').replace(/\/$/, '')
			: (pathFromUrl || '/');

		location.hash = path;
		this._path = path;

		return fs.exec_direct('/bin/ls', ['-Ah', '--full-time', path]).then(out => {
			const files = [];
			out.trim().split('\n').forEach(line => {
				if (!line.trim()) return;

				const m = line.match(
					/^(\S+)\s+(\d+)\s+(\S+)\s+(\S+)\s+(\S+)\s+(\S+\s+\S+)\s+\S+\s+(.+)$/
				);
				if (!m) return;

				const [, perm, , owner, , size, date, name] = m;
				const isDir = perm[0] === 'd';
				const isLink = perm[0] === 'l';

				files.push({
					perm: perm, isLink: isLink, isDir,
					size: isDir ? '' : size, name, owner, date,
					permissionNum: this.permissionsToOctal(perm),
					path: path === '/' ? `/${name}` : `${path}/${name}`
				});
			});

			files.sort((a, b) => {
				if (a.isDir !== b.isDir)
					return a.isDir ? -1 : 1;
				if (a.isLink !== b.isLink)
					return a.isLink ? 1 : -1;
				return a.name.localeCompare(b.name);
			});

			return { path, files };
		}).catch(() => ({ path, files: [] }));
	},

	render: function (data) {
		const root = this._root || (this._root = E('div'));
		root.innerHTML = '';
		root.oncontextmenu = ev => { ev.preventDefault(); return false; };

		this.currentFiles = data.files || [];
		const files = this.currentFiles;
		const parts = data.path.split('/').filter(Boolean);
		let cur = '';

		const crumbs = E('div', [
			E('span', {
				style: 'cursor:pointer;color:#0066cc',
				click: ui.createHandlerFn(this, 'reload', '/')
			}, _('Root')),
			...parts.flatMap(p => {
				cur += '/' + p;
				return [
					E('span', '/'),
					E('span', {
						style: 'cursor:pointer;color:#0066cc',
						click: ui.createHandlerFn(this, 'reload', cur)
					}, p)
				];
			})
		]);

		const totalSize = files.reduce((s, f) =>
			(!f.isDir && !f.isLink) ? s + this.parseSizeToBytes(f.size) : s, 0);

		const table = new ui.Table(
			[_('Name'), _('Owner'), _('Size'), _('Change the time'), _('Rights'), _('')],
			{ sortable: true, classes: 'cbi-section-table' },
			E('em', _('No files found'))
		);

		table.update(files.map(f => {
			const icon = f.isDir ? '📂' : (f.isLink ? '🔗' : '📄');
			const nameText = f.name.length > 18
				? `${f.name.slice(0, 11)}...${f.name.slice(-7)}`
				: f.name;

			const nameCell = E('div', { class: 'file-checkbox' }, [
				E('input', {
					type: 'checkbox', 'data-path': f.path,
					change: ui.createHandlerFn(this, ev => {
						ev.target.closest('tr')?.classList.toggle('selected', ev.target.checked);
						this.toggleBatchBar();
					})
				}),
				E('div', {
					class: 'file-name-cell', style: 'width:100%',
					contextmenu: ui.createHandlerFn(this, ev => this.showContextMenu(ev, f))
				}, [
					E('span', {
						title: f.name,
						click: f.isDir ? ui.createHandlerFn(this, 'reload', f.path) : null,
						style: `${f.isDir ? 'cursor:pointer;color:#0066cc;' : ''}display:inline-block;`
					}, `${icon} ${nameText}`)
				])
			]);

			const btn = E('div', { style: 'display:flex;gap:3px;' }, [
				E('button', {
					class: 'btn cbi-button-edit', style: 'padding:0 10px',
					click: ui.createHandlerFn(this, 'renameFile', f.path)
				}, _('Rename')),
				E('button', {
					class: 'btn cbi-button-remove', style: 'padding:0 10px',
					click: ui.createHandlerFn(this, 'deleteFile', f)
				}, _('Delete')),
				!f.isDir
					? E('button', {
						class: 'btn cbi-button-edit', style: 'padding:0 10px',
						click: ui.createHandlerFn(this, 'showFileEditor', f, false)
					}, _('open'))
					: ''
			]);

			return [nameCell, f.owner, f.size, f.date, `[${f.permissionNum}] ${f.perm}`, btn];
		}));

		root.append(
			E('style', CSS),
			E('h2', _('File management')),
			E('p', { style: 'display:flex;justify-content:space-between;align-items:center;margin-top:10px;' }, [
				crumbs,
				E('div', { style: 'display:flex;align-items:center;gap:10px;' }, [
					E('span', { style: 'color:#666;font-size:12px;' },
						_('%d items • Total %s').format(files.length, this.formatSizeHuman(totalSize)))
				])
			]),
			E('div', { class: 'batch-action-bar' }, [
				E('div', { style: 'display:flex;align-items:center;gap:8px;' }, [
					E('button', {
						class: 'btn cbi-button-negative',
						click: ui.createHandlerFn(this, () => this.deleteFile(this.getSelectedFiles()))
					}, [_('批量删除'), E('span', { id: 'delete-count' })]),
					E('button', {
						class: 'btn cbi-button-action',
						click: ui.createHandlerFn(this, () => this.downloadFile(this.getSelectedFiles()))
					}, [_('批量下载'), E('span', { id: 'download-count' })]),
					E('button', {
						class: 'btn',
						click: ui.createHandlerFn(this, 'clearSelectedFiles')
					}, _('取消选择'))
				])
			]),
			table.render()
		);

		if (window._aceReady === undefined && !window._acePromise) {
			if ('requestIdleCallback' in window) {
				requestIdleCallback(() => this.preloadAceEditor(), { timeout: 1500 });
			} else {
				setTimeout(() => this.preloadAceEditor(), 800);
			}
		}

		return root;
	},

	reload: function (p) {
		return this.load(p).then(d => this.render(d));
	},

	showContextMenu: function (ev, file) {
		ev.preventDefault();
		ev.stopPropagation();
		this.hideContextMenu();

		const menu = E('div', { class: 'file-context-menu' });
		const items = [
			[_('Refresh Page'), () => this.reload(this._path)],
			[_('Create file (directory)'), () => this.createnew()],
			!file.isDir && [_('Edit file'), () => this.showFileEditor(file, true)],
			!file.isLink && [_('Create link'), () => this.createLink(file)],
			[_('download file'), () => this.downloadFile(file)],
			[_('Upload'), ev => this.Upload(ev)],
			[_('Modify permissions'), () => this.chmodFile(file)]
		].filter(Boolean);

		items.forEach(([label, action]) => {
			menu.appendChild(E('div', {
				class: 'item',
				click: ui.createHandlerFn(this, ev => {
					action(ev);
					this.hideContextMenu();
				})
			}, label));
		});

		document.body.appendChild(menu);
		const { clientX: x0, clientY: y0 } = ev;
		const { innerWidth: w, innerHeight: h } = window;
		const { width, height } = menu.getBoundingClientRect();

		menu.style.left = Math.min(x0, w - width - 5) + 'px';
		menu.style.top = (y0 + height > h ? Math.max(0, y0 - height) : y0) + 'px';

		this._contextMenu = menu;
		document.addEventListener('click', () => this.hideContextMenu(), { once: true });
	},

	showFileEditor: function (file, editable) {
		const fileSize = this.parseSizeToBytes(file.size);
		const maxSize = editable ? 512 * 1024 : 1024 * 1024;
		const sizeLimit = editable ? '512KB' : '1MB';

		if (fileSize > sizeLimit) {
			return this.showNotification([
				E('p', _('The file is too large (%s).').format(file.size)),
				E('p', _('Maximum size is %s.').format(sizeLimit))], 8000, 'error'
			);
		}

		const modal = L.showModal(_('Loading file...'), [
			E('p', editable ? _('Loading file for editing...') : _('Loading file content...')),
			E('div', { class: 'spinner' }),
			E('div', { class: 'left', style: 'flex:1' }, [
				E('button', { class: 'btn', click: L.hideModal }, _('Cancel'))
			])
		]);
		const path = file.isLink
			? (this.parseLinkString(file.path)?.targetPath || file.path)
			: file.path;

		fs.read_direct(path)
			.then(content => {
				L.hideModal();
				window._aceReady
					? this.showAceEditor(file, content, path, editable)
					: this.showSimpleEditor(file, content, path, editable)
			})
			.catch(e => {
				this.modalnotify(null, E('p', _('Failed to read file: %s').format(e.message || e)), '', 'error')
			});
	},

	showAceEditor: function (file, content, path, editable) {
		const originalContent = content;
		const containerId = 'ace-' + Date.now();
		const syntaxid = 'syntax-' + Date.now();
		let hasUnsavedChanges = false, editor = null;
		const mode = this.detectFileMode(file.name, content);
		const container = E('div', { id: containerId, style: 'width:100%;height:350px;border:1px solid #ccc;' });
		const changeIndicator = E('span', {
			style: 'display:none;color:#e74c3c;font-size:22px;margin-left:5px;',
			title: _('Unsaved changes')
		}, '●');

		const saveBtn = E('button', {
			class: 'btn cbi-button-positive important',
			style: `display:${editable ? 'block' : 'none'};`,
			click: ui.createHandlerFn(this, () => {
				if (!editor) return;
				const val = editor.getValue();
				if (val === originalContent)
					return this.modalnotify(null, E('p', _('文档没有变动')), 3000);

				fs.write(path, val).then(() => {
					L.hideModal();
					this.showNotification(_('File saved successfully!'), 3000, 'success');
					this.reload(this._path);
				});
			})
		}, _('Save'));

		const btnFull = E('button', {
			style: 'margin-left:auto;',
			class: 'btn', click: toggleFullscreen
		}, _('全屏'));

		const btnExit = E('button', {
			click: toggleFullscreen, class: 'btn',
			style: 'display:none;margin-left:auto;',
		}, _('退出全屏'));

		const toolbar = E('div', { class: 'ace-toolbar' }, [
			E('div', { style: 'display:flex;flex-wrap:wrap;align-items:center;gap:8px;' }, [
				E('span', _('Syntax')),
				E('select', {
					id: syntaxid, class: 'cbi-input-select ace-toolbar-select',
					change: ui.createHandlerFn(this, ev => editor && editor.session.setMode('ace/mode/' + ev.target.value))
				}, modes.map(([id, name]) => E('option', { value: id, selected: id === mode || undefined }, name))
				),
				E('span', _('Theme')),
				E('select', {
					class: 'cbi-input-select ace-toolbar-select',
					change: ui.createHandlerFn(this, ev => editor && editor.setTheme('ace/theme/' + ev.target.value))
				}, themes.map(([id, name]) =>
					E('option', { value: id, selected: id === 'monokai' || undefined }, name)
				)),

				E('span', _('Font')),
				E('select', {
					class: 'cbi-input-select ace-toolbar-select',
					change: ui.createHandlerFn(this, ev => editor && editor.setFontSize(ev.target.value + 'px'))
				}, [
					E('option', { value: '12' }, '12px'),
					E('option', { value: '14', selected: true }, '14px'),
					E('option', { value: '16' }, '16px')
				]),
				E('input', {
					type: 'checkbox', checked: true, id: 'wrapCheckbox',
					change: ui.createHandlerFn(this, ev => editor && editor.setOption('wrap', ev.target.checked))
				}),
				E('label', { style: 'display:flex;align-items:center;gap:5px;', for: 'wrapCheckbox' }, _('wrap')),
				E('input', {
					type: 'checkbox', id: 'editCheckbox',
					checked: !!editable || undefined,
					change: ui.createHandlerFn(this, ev => {
						if (!editor) return;
						const on = ev.target.checked;
						editor.setReadOnly(!on);
						saveBtn.style.display = on ? 'block' : 'none';
						changeIndicator.style.display =
							(hasUnsavedChanges && on) ? 'inline' : 'none';
					})
				}),
				E('label', { style: 'display:flex;align-items:center;gap:5px;', for: 'editCheckbox' }, _('Edit')),
				changeIndicator, btnFull, btnExit
			])
		]);

		const fullscreenWrapper = E('div', { class: 'ace-fullscreen-wrapper' }, [
			E('div', { class: 'ace-editor-container', style: 'width:auto;' }, [
				toolbar, container
			]),
			E('div', { style: 'display:flex;gap:.5em;justify-content:space-around;' }, [
				E('button', {
					class: 'btn cbi-button-positive',
					click: ui.createHandlerFn(this, () => editor && this.copyText(editor.getValue()))
				}, _('Copy')),
				saveBtn,
				E('button', {
					class: 'btn', click: ui.createHandlerFn(this, () => {
						if (isFullscreen) toggleFullscreen();
						L.hideModal();
					})
				}, editable ? _('Cancel') : _('Close'))
			])
		]);

		L.showModal(_('%s: %s').format(editable ? _('Edit') : _('View'), file.name), [
			E('style', ['h4 {text-align:center;color:red;}.modal{padding:.3em;}']),
			E('p', { style: 'padding:8px;background:#f0f0f0;font-size:12px;' }, [
				E('span', {}, _('Ace Editor version: %s').format(ace.version)),
				E('span', { style: 'margin:0 12px;color:#666;' }, '|'),
				E('span', {}, _('Size: %s').format(file.size)),
				E('span', { style: 'margin:0 12px;color:#666;' }, '|'),
				E('span', {}, _('Lines: %d').format(content.split('\n').length)),
				E('span', { style: 'margin:0 12px;color:#666;' }, '|'),
				E('span', {}, _('Path: %s').format(path))
			]), fullscreenWrapper
		]);

		let isFullscreen = false, originalParent = null, originalNext = null;

		function toggleFullscreen() {
			if (!editor) return;
			isFullscreen = !isFullscreen;

			if (isFullscreen) {
				document.addEventListener('keydown', escHandler);
				originalParent = fullscreenWrapper.parentNode;
				originalNext = fullscreenWrapper.nextSibling;

				document.body.appendChild(fullscreenWrapper);
				fullscreenWrapper.classList.add('ace-fullscreen');
				container.style.height = 'calc(100vh - 42px - 48px)';
			} else {
				document.removeEventListener('keydown', escHandler);
				if (originalParent)
					originalParent.insertBefore(fullscreenWrapper, originalNext);

				fullscreenWrapper.classList.remove('ace-fullscreen');
				container.style.height = '350px';
			}

			btnFull.style.display = isFullscreen ? 'none' : 'block';
			btnExit.style.display = isFullscreen ? 'block' : 'none';
			requestAnimationFrame(() => editor.resize());
		}

		function escHandler(e) {
			if (e.key === 'Escape') toggleFullscreen();
		}

		requestAnimationFrame(() => {
			this.initAceEditor(containerId, {
				content, editable, syntaxid,
				mode, changeIndicator, saveBtn,
				onChange: (ed, hasChanges) => {
					hasUnsavedChanges = hasChanges;
				}
			}).then(ed => {
				editor = ed;
				editor.resize();
			});
			this.Draggable();
		});
	},

	showSimpleEditor: function (file, content, path, editable) {
		const textarea = E('textarea', {
			class: 'cbi-input-text', readonly: !editable,
			style: 'width:100%;height:400px;font-family:Consolas;background-color:#212121;color:#fff;font-size:14px;'
		}, content);

		const originalContent = content;

		const info = E('p', { style: 'padding:8px;background:#f0f0f0;border-radius:4px;' }, [
			E('span', {}, _('Size: %s').format(file.size)),
			E('span', { style: 'margin:0 12px;color:#666;' }, '|'),
			E('span', {}, _('Lines: %d').format(content.split('\n').length)),
			E('span', { style: 'margin:0 12px;color:#666;' }, '|'),
			E('span', {}, _('Path: %s').format(path))
		]);

		const editCheckbox = E('input', {
			type: 'checkbox', id: 'editCheckbox',
			change: ui.createHandlerFn(this, ev => {
				const isChecked = ev.target.checked;
				textarea.readOnly = !isChecked;
				saveBtn.style.display = isChecked ? 'inline-block' : 'none';
				cancelBtn.textContent = isChecked ? _('Cancel') : _('Close');
			})
		});
		editCheckbox.checked = !!editable;

		const wrapCheckbox = E('input', {
			type: 'checkbox', id: 'wrapCheckbox',
			change: ui.createHandlerFn(this, ev =>
				textarea.style.whiteSpace = ev.target.checked ? 'pre-wrap' : 'pre')
		});
		wrapCheckbox.checked = true;

		const modeToggle = E('div', [
			E('div', { style: 'display:flex;flex-wrap:wrap;align-items:center;gap:8px;' }, [
				E('span', _('Font')),
				E('select', {
					class: 'cbi-input-select ace-toolbar-select',
					change: ui.createHandlerFn(this, ev =>
						textarea.style.fontSize = ev.target.value + 'px')
				}, [
					E('option', { value: '12' }, '12px'),
					E('option', { value: '14', selected: true }, '14px'),
					E('option', { value: '16' }, '16px')
				]),
				wrapCheckbox,
				E('label', { style: 'display:flex;align-items:center;gap:5px;', for: 'wrapCheckbox' }, _('wrap')),
				editCheckbox,
				E('label', { style: 'display:flex;align-items:center;gap:5px;', for: 'editCheckbox' }, _('Edit')),
			])
		]);

		const saveBtn = E('button', {
			class: 'btn cbi-button-positive',
			style: `display:${editable ? 'inline-block' : 'none'};`,
			click: ui.createHandlerFn(this, () => {
				const newContent = textarea.value;
				if (newContent === originalContent)
					return this.modalnotify(null, E('p', _('文档没有变动')), 3000);
				fs.write(path, newContent)
					.then(() => {
						L.hideModal();
						this.showNotification(_('File saved successfully!'), 3000, 'success');
						this.reload(this._path);
					})
					.catch(error =>
						this.modalnotify(null, E('p', _('Save failed: %s').format(error.message || error)), '', 'warning'));
			})
		}, _('Save'));

		const cancelBtn = E('button', {
			class: 'btn',
			click: ui.createHandlerFn(this, () => {
				if (textarea.value !== originalContent && editable)
					if (!confirm(_('You have unsaved changes. Discard them?'))) return;
				L.hideModal();
			})
		}, editable ? _('Cancel') : _('Close'));

		const copyBtn = E('button', {
			class: 'btn cbi-button-positive',
			click: ui.createHandlerFn(this, 'copyText', textarea.value)
		}, _('Copy'));

		const buttons = E('div', {
			style: 'display:flex;justify-content:space-around;gap:0.5em;',
		}, [copyBtn, saveBtn, cancelBtn]);

		L.showModal(_('%s: %s').format(editable ? _('Edit') : _('View'), file.name), [
			E('style', ['h4 {text-align:center;color:red;}.modal{padding: .3em .3em .3em .3em;}']),
			info, modeToggle, textarea, buttons
		]);
		requestAnimationFrame(() => this.Draggable());
	},

	createnew: function () {
		let editor = null, createFileToo = false, mode = '', result = '';
		let filePerm = 755, dirPerm = 644, fileContent = '', modeid = '';
		const syntaxid = 'syntax-select-' + Date.now();
		const containerId = 'ace-editor-' + Date.now();
		const fileElem = E('span', { style: 'display:flex;flex-wrap:wrap;align-items:center;gap:8px;' }, [
			E('span', _('文件权限')),
			E('select', {
				class: 'cbi-input-select ace-toolbar-select',
				change: ui.createHandlerFn(this, ev => filePerm = parseInt(ev.target.value, 10))
			}, permissions.map(([id, name]) =>
				E('option', { value: id, selected: id === filePerm || undefined }, name)
			))
		]);
		const toolbar = E('span', { style: 'display:none;' }, [
			window._aceReady
				? E('span', [
					E('p', { class: 'ace-toolbar', }, [
						E('div', { style: 'display:flex;align-items:center;gap:8px;' }, [
							E('span', _('Syntax')),
							E('select', {
								class: 'cbi-input-select ace-toolbar-select', id: syntaxid,
								change: ui.createHandlerFn(this, ev => editor && editor.session.setMode('ace/mode/' + ev.target.value))
							}, modes.map(([id, name]) =>
								E('option', { value: id, selected: id === mode || undefined }, name))
							),
							E('span', _('Theme')),
							E('select', {
								class: 'cbi-input-select ace-toolbar-select',
								change: ui.createHandlerFn(this, ev => editor && editor.setTheme('ace/theme/' + ev.target.value))
							}, themes.map(([id, name]) =>
								E('option', { value: id, selected: id === 'monokai' || undefined }, name))
							),
							E('span', _('Font')),
							E('select', {
								class: 'cbi-input-select ace-toolbar-select',
								change: ui.createHandlerFn(this, ev => editor && editor.setFontSize(ev.target.value + 'px'))
							}, [
								E('option', { value: '12' }, '12px'),
								E('option', { value: '14', selected: true }, '14px'),
								E('option', { value: '16' }, '16px')
							]),
							fileElem
						])
					]),
					E('div', { id: containerId, style: 'width:100%;height:250px;' })
				])
				: E('span', [
					fileElem,
					E('textarea', {
						class: 'cbi-input-text', type: 'text',
						style: 'width:100%;height:250px;font-family:Consolas;',
						placeholder: _('File content (optional)'),
						change: ui.createHandlerFn(this, ev => fileContent = ev.target.value)
					}),
				])
		]);

		const pathInput = E('input', {
			title: _('可以创建当前(绝对路径)的文件(目录)'), type: 'text',
			class: 'cbi-input-text', style: 'width:150px;', placeholder: '/tmp/c.txt',
			change: ui.createHandlerFn(this, ev => {
				result = this.parsePath(ev.target.value.trim());
				modeid = document.getElementById(syntaxid);
				if (editor && result.valid && result.file) {
					mode = this.detectFileMode(result.file, null);
					if (mode) {
						editor.session.setMode(`ace/mode/${mode}`);
						if (modeid) modeid.value = mode;
					}
				};
			})
		});

		L.showModal(_('New directory'), [
			E('style', ['h4 {text-align:center;color:red;}']),
			E('div', [
				E('div', { style: 'display:flex;align-items:center;gap:8px;' }, [
					E('span', _('Name')), pathInput,
					E('span', _('目录权限')),
					E('select', {
						class: 'cbi-input-select ace-toolbar-select',
						change: ui.createHandlerFn(this, ev => dirPerm = parseInt(ev.target.value, 10))
					}, permissions.map(([id, name]) =>
						E('option', { value: id, selected: id === dirPerm || undefined }, name)
					)),
					E('input', {
						type: 'checkbox', id: 'createFileCheckbox',
						change: ui.createHandlerFn(this, ev => {
							createFileToo = ev.target.checked;
							toolbar.style.display = createFileToo ? 'block' : 'none';
						})
					}),
					E('label', { for: 'createFileCheckbox' }, _('同时创建文件'))
				]),
				toolbar
			]),
			E('div', { class: 'button-row' }, [
				E('button', {
					class: 'btn cbi-button-positive',
					click: ui.createHandlerFn(this, () => {
						L.hideModal();
						const base = result.isAbsolute ? '' : this._path + '/';
						const fullDir = result.isDir ? base + result.path : base + result.dir;
						const fullFile = (result.isFile && createFileToo) ? base + result.path : null;

						if (fullDir) {
							fs.exec('/bin/mkdir', ['-p', fullDir, '-m', String(dirPerm)]).then(res => {
								if (!fullFile) {
									if (res.code !== 0)
										return this.modalnotify(null, E('p', _('目录 %s 创建失败: %s').format(fullDir, res.stderr)), '', 'error');
									this.reload(this._path);
									this.showNotification(_('目录 %s 创建成功').format(fullDir), 3000, 'success');
								}
							});
						};

						if (!fullFile) return;
						const content = (window._aceReady && editor) ? editor.getValue() : fileContent;
						const cmd = `(cat > ${JSON.stringify(fullFile)} <<'EOF'\n${content}\nEOF\n) && /bin/chmod ${filePerm} ${JSON.stringify(fullFile)}`;
						return fs.exec('/bin/sh', ['-c', cmd]).then(res => {
							if (res.code !== 0)
								return this.modalnotify(null, E('p', _('Create failed: %s').format(res.stderr)), '', 'error');
							this.reload(this._path);
							this.showNotification(_('创建成功: %s').format(fullFile), 3000, 'success');
						});
					})
				}, _('Create')),
				E('button', { class: 'btn', click: L.hideModal }, _('Cancel'))
			])
		]);

		requestAnimationFrame(() => {
			if (window._aceReady)
				this.initAceEditor(containerId, { editable: true }).then(ed => {
					editor = ed;
					if (result.valid && result.file) {
						mode = this.detectFileMode(result.file, null);
						if (mode && modeid) {
							editor.session.setMode(`ace/mode/${mode}`);
							modeid.value = mode;
						}
					};
				});
			ui.addValidator(pathInput, 'string', false, function (value) {
				result = this.parsePath(value.trim());
				if (!result.valid)
					return result.error ? _(result.error) : _('无效的路径格式');
				return true;
			}.bind(this), 'blur', 'keyup');
			this.Draggable();
		});
	},

	parsePath: function (path) {
		path = path.trim();

		if (!/^[A-Za-z0-9._\/-]+$/.test(path))
			return { valid: false, error: _('路径包含非法字符') };

		if (path.split('/').includes('..'))
			return { valid: false, error: _('路径包含非法段(..)') };

		const parts = path.split('/');
		const last = parts.pop() || parts.pop() || '';
		const isFile = /^[^.].*\.[^.]+$/.test(last) && !path.endsWith('/');
		const dir = path.endsWith('/') ? path : path.slice(0, path.lastIndexOf('/') + 1);
		const isAbsolute = path.startsWith('/');

		return {
			isFile, valid: true, dir, path, isAbsolute,
			file: isFile ? last : '', isDir: !isFile,
			ext: isFile ? last.replace(/^.*\./, '') : ''
		};
	},

	renameFile: function (path) {
		let newname = '';
		const oldname = path.split(/[/\\]/).pop() || '';

		L.showModal(_('Rename %s').format(path), [
			E('style', ['h4 {text-align:center;color:red;}']),
			E('div', { style: 'display:flex;align-items:center;gap:10px;' }, [
				E('label', { style: 'min-width:80px;font-weight:bold;' }, _('newname:')),
				E('input', {
					class: 'cbi-input-text', value: oldname,
					id: 'nameinput', style: 'width:auto', type: 'text',
					change: ui.createHandlerFn(this, ev => newname = ev.target.value.trim())
				}),
			]),
			E('div', { class: 'button-row' }, [
				E('button', {
					class: 'btn cbi-button-positive',
					click: ui.createHandlerFn(this, () => {
						if (!newname) return this.modalnotify(null, E('p', _('请输入新的名称')), 3000);
						L.hideModal();
						fs.exec('/bin/mv', [path, path.replace(/[^/]+$/, newname)]).then(r => {
							if (r.code !== 0)
								return this.modalnotify(null, E('p', _('Rename failed: %s').format(r.stderr)), '', 'error');
							this.reload(this._path);
							this.showNotification(_('Renamed: %s').format(newname), 3000, 'success');
						});
					})
				}, _('Rename')),
				E('button', { class: 'btn', click: L.hideModal }, _('Cancel'))
			])
		]);

		setTimeout(() => {
			const input = document.querySelector('#nameinput');
			const pos = oldname.lastIndexOf('.');
			input.setSelectionRange(0, pos > 0 ? pos : oldname.length);
			input.focus();
		}, 10);
	},

	chmodFile: function (file) {
		let n = '';
		L.showModal(_('Change permissions %s').format(file.path), [
			E('style', ['h4 {text-align:center;color:red;}']),
			E('div', { style: 'display:flex;align-items:center;gap:10px;' }, [
				E('label', { style: 'min-width:80px;font-weight:bold;' }, _('Permission:')),
				E('select', {
					style: 'width:auto;',
					change: ui.createHandlerFn(this, ev => n = ev.target.value)
				}, permissions.map(([id, name]) =>
					E('option', { value: id, selected: id === Number(file.permissionNum) || undefined }, name)
				))
			]),
			E('div', { class: 'button-row' }, [
				E('button', {
					class: 'btn cbi-button-positive',
					click: ui.createHandlerFn(this, () => {
						if (!n) return this.modalnotify(null, E('p', _('请选择新的值')), 3000);
						L.hideModal();
						fs.exec('/bin/chmod', [n, file.path]).then(r => {
							if (r.code !== 0)
								return this.modalnotify(null, E('p', _('Permission change failed: %s').format(r.stderr)), '', 'error');
							this.reload(this._path);
							this.showNotification(_('Permissions updated: %s').format(file.path), 3000, 'success');
						});
					})
				}, _('Apply')),
				E('button', { class: 'btn', click: L.hideModal }, _('Cancel'))
			])
		]);
	},

	deleteFile: function (fileOrArray) {
		const files = Array.isArray(fileOrArray) ? fileOrArray : [fileOrArray];
		if (files.length === 0) return;

		L.showModal(_('Confirm deletion'), [
			E('style', ['h4 {text-align:center;color:red;}']),
			E('p', { style: 'text-align:center;' },
				files.length === 1
					? _('Delete %s ?').format(files[0].name)
					: _('Delete %d files?').format(files.length)
			),
			E('div', { class: 'button-row' }, [
				E('button', {
					class: 'btn cbi-button-negative',
					click: ui.createHandlerFn(this, () => {
						const paths = files.map(f => {
							const path = f.path;
							return f.isLink ? (this.parseLinkString(path)?.linkPath || path) : path;
						});

						fs.exec('/bin/rm', ['-rf', ...paths]).then(r => {
							if (r.code !== 0)
								return this.modalnotify(null, E('p', _('Delete failed: %s').format(r.stderr)), '', 'error');

							L.hideModal();
							this.clearSelectedFiles();
							this.reload(this._path);
							this.showNotification(
								files.length === 1
									? _('Deleted: %s').format(files[0].name)
									: _('Deleted %d files').format(files.length),
								3000, 'success'
							);
						});
					})
				}, _('Delete')),
				E('button', { class: 'btn', click: L.hideModal }, _('Cancel'))
			])
		]);
	},

	createLink: function (file) {
		let linkPath = '', isHardLink = false;
		const pathInput = E('input', {
			id: 'linkinput', style: 'width:60%;', type: 'text',
			class: 'cbi-input-text', placeholder: '/path/to/link',
			change: ui.createHandlerFn(this, ev => linkPath = ev.target.value.trim())
		});
		L.showModal(_('%s Create link').format(file.path), [
			E('style', ['h4 {text-align:center;color:red;}']),
			E('div', { style: 'display:flex;align-items:center;gap:10px;' }, [
				E('label', { style: 'min-width:80px;font-weight:bold;' }, _('Create link')),
				pathInput,
				E('div', { style: 'display:flex;flex-wrap:wrap;align-items:center;gap:8px;' }, [
					E('input', {
						type: 'checkbox', id: 'checkbox',
						change: ui.createHandlerFn(this, ev => isHardLink = ev.target.value)
					}),
					E('label', { for: 'checkbox', style: 'display:flex;align-items:center;gap:5px;' }, _('Create hard link'))
				]),
			]),
			E('div', { class: 'button-row' }, [
				E('button', {
					class: 'btn cbi-button-positive',
					click: ui.createHandlerFn(this, () => {
						if (!linkPath)
							return this.modalnotify(null, E('p', _('Please enter link path')), '', 'error');
						L.hideModal();
						const args = isHardLink ? [file.path, linkPath] : ['-s', file.path, linkPath];
						fs.exec('/bin/ln', args).then(r => {
							if (r.code !== 0)
								return this.modalnotify(null, E('p', _('Link creation failed: %s').format(r.stderr)), '', 'error');
							this.reload(this._path);
							this.showNotification(_('%s Link created successfully: %s').format(file.path, linkPath), 3000, 'success');
						});
					})
				}, _('Apply')),
				E('button', { class: 'btn', click: L.hideModal }, _('Cancel'))
			])
		]);
		requestAnimationFrame(() => {
			ui.addValidator(pathInput, 'string', false, function (value) {
				const result = this.parsePath(value.trim());
				if (!result.valid)
					return result.error ? _(result.error) : _('无效的路径格式');

				return true;
			}.bind(this), 'blur', 'keyup');
			this.Draggable();
		});
	},

	downloadFile: function (input) {
		if (
			(Array.isArray(input) && input.length === 1 && !input[0].isDir) ||
			(!Array.isArray(input) && !input.isDir)
		) {
			try {
				const file = Array.isArray(input) ? input[0] : input;
				const path = file.isLink
					? this.parseLinkString(file.path)?.targetPath
					: file.path;

				return fs.read_direct(path, 'blob')
					.then(blob => this.startDownload(blob, file.name));
			} catch (e) {
				return this.showNotification(_('下载失败: %s').format(e.message), 5000, 'error');
			}
		};

		const focusAndSelectBase = (input = null, base = null) => {
			input = input || document.getElementById('pack-name');
			base = base || input.value.replace(/\.(tar\.gz|tgz|zip)$/i, '');

			requestAnimationFrame(() => {
				input.focus({ preventScroll: true });
				requestAnimationFrame(() => {
					input.setSelectionRange(0, base.length);
				});
			});
		};

		const updateExtension = () => {
			const fmt = document.querySelector('[name=fmt]:checked')?.value;
			const nameInput = document.getElementById('pack-name');
			if (!nameInput)
				return;

			const base = nameInput.value.replace(/\.(tar\.gz|tgz|zip)$/i, '');
			const ext = fmt === 'zip' ? '.zip' : '.tar.gz';

			nameInput.value = base + ext;
			focusAndSelectBase(nameInput, base);
		};

		const files = Array.isArray(input) ? input : [input];
		const isBatch = Array.isArray(input);
		const defaultName = isBatch ? 'files-' + Date.now() : (input.name || ('dir-' + Date.now()));

		L.showModal(isBatch ? _('批量下载') : _('下载目录'), [
			E('style', ['h4 {text-align:center;}']),
			E('p', isBatch ? _('文件数量: %d').format(files.length) : _('目录: %s').format(input.name)),
			E('p', { class: 'cbi-value ace-toolbar' }, [
				E('div', { style: 'display:flex;flex-wrap:wrap;align-items:center;gap:10px;' }, [
					E('label', isBatch ? _('压缩包文件名') : _('文件名')),
					E('input', {
						id: 'pack-name', class: 'cbi-input-text',
						type: 'text', value: defaultName + '.tar.gz'
					}),
					E('label', _('后缀')),
					E('input', {
						type: 'radio', name: 'fmt', value: 'tar.gz',
						checked: true, click: updateExtension, id: 'tar'
					}),
					E('label', { for: 'tar' }, ' .tar.gz'),
					E('input', {
						type: 'radio', name: 'fmt', id: 'zip',
						value: 'zip', click: updateExtension
					}),
					E('label', { for: 'zip' }, ' .zip'),
				]),
			]),

			E('div', { class: 'button-row' }, [
				E('button', {
					class: 'btn cbi-button-positive',
					click: ui.createHandlerFn(this, () => {
						const nameInput = document.getElementById('pack-name');
						const fmt = document.querySelector('[name=fmt]:checked').value;
						let fname = this.sanitizeFilename(nameInput?.value || defaultName);

						if (!fname) fname = defaultName;
						L.hideModal();
						this.packAndDownload(files, fmt, fname);
					})
				}, isBatch ? _('打包下载') : _('下载')),
				E('button', { class: 'btn', click: L.hideModal }, _('取消'))
			])
		]);
		focusAndSelectBase();
	},

	packAndDownload: async function (files, format = 'tar.gz', filename = null) {
		const t = Date.now();
		const base = this.sanitizeFilename(filename || ('files-' + t));
		const out = `/tmp/${base}.${format}`;
		const selectedPaths = files.map(f => f.path);

		try {
			const relPaths = files.map(f => f.path.replace(/^\/+/, ''));
			const args = relPaths.map(p => `"${p}"`).join(' ');

			if (format === 'zip') {
				await fs.exec('/bin/sh', ['-c', `cd / && zip -qr "${out}" ${args}`]);
			} else {
				await fs.exec('/bin/sh', ['-c', `tar -czf "${out}" -C / ${args}`]);
			}

			const blob = await fs.read_direct(out, 'blob');
			await this.startDownload(blob, `${base}.${format}`);
			this.clearSelectedFiles();

		} catch (e) {
			this.showNotification(_('打包失败: %s').format(e.message), 5000, 'error');
		} finally {
			fs.remove(out).catch(() => {});
		}
	},

	startDownload: function (blob, name) {
		const a = Object.assign(document.createElement('a'), {
			href: URL.createObjectURL(blob),
			download: name
		});
		document.body.appendChild(a);
		a.click();
		setTimeout(() => {
			URL.revokeObjectURL(a.href);
			a.remove();
		}, 200);
	},

	Upload: function (ev) {
		const tmp = '/tmp/upload-' + Date.now();
		ui.uploadFile(tmp, ev.target.firstChild)
			.then(L.bind(function (btn, reply) {
				return fs.exec('/bin/mv', [tmp, `${this._path}/${reply.name}`]).then(res => {
					if (res.code !== 0)
						return this.modalnotify(null, E('p', _('Upload failed: %s').format(res.stderr)), '', 'error');
					this.reload(this._path);
					this.showNotification(_('Uploaded: %s').format(`${this._path}/${reply.name}`), 3000, 'success');
				});
			}, this, ev.target))
			.catch(e => this.showNotification(_('Error Uploaded: %s').format(e.message || e), 5000, 'error'));
	},

	detectFileMode: function (filename, content) {
		const name = filename.toLowerCase();
		const ext = name.includes('.') ? name.split('.').pop() : '';

		if (name === 'dockerfile') return 'sh';
		if (name === 'makefile') return 'text';
		if (name === '.gitignore') return 'text';

		const extMap = {
			js: 'javascript', json: 'json', html: 'html', htm: 'html',
			css: 'css', xml: 'xml', py: 'python', sh: 'sh', bash: 'sh',
			php: 'php', lua: 'lua', pl: 'perl', rb: 'ruby', md: 'markdown',
			yaml: 'yaml', yml: 'yaml', uc: 'javascript', ut: 'javascript',
			lua: 'lua', toml: 'toml'
		};

		if (extMap[ext]) return extMap[ext]
		const trimmed = (content || '').trim();
		const firstLine = trimmed.split('\n')[0] || '';
		const byShebang = this.detectByShebang(firstLine);
		if (byShebang) return byShebang;

		if (trimmed) {
			if (trimmed[0] === '{' || trimmed[0] === '[') {
				try {
					JSON.parse(trimmed);
					return 'json';
				} catch (e) {}
			}

			if (/^\s*<\?xml\b/i.test(trimmed)) return 'xml';
			if (/<html\b/i.test(trimmed) || /<!doctype\s+html/i.test(trimmed)) return 'html';
		}
		return 'text';
	},

	detectByShebang: function (firstLine) {
		if (!firstLine || !firstLine.startsWith('#!'))
			return null;

		const s = firstLine.toLowerCase();
		const patterns = [
			{ re: /\/lua\b/, mode: 'lua' },
			{ re: /(ba)?sh\b/, mode: 'sh' },
			{ re: /python\d?(\.\d+)?\b/, mode: 'python' },
			{ re: /ucode\b/, mode: 'javascript' },
			{ re: /perl\b/, mode: 'perl' },
			{ re: /ruby\b/, mode: 'ruby' },
			{ re: /node\b/, mode: 'javascript' },
			{ re: /php\b/, mode: 'php' },
			{ re: /zsh\b/, mode: 'sh' },
			{ re: /ksh\b/, mode: 'sh' },
		];

		for (const { re, mode } of patterns)
			if (re.test(s)) return mode;

		return null;
	},

	toggleBatchBar: function () {
		const deleteCount = this._root.querySelector('#delete-count');
		const downloadCount = this._root.querySelector('#download-count');
		const selectedCount = this.getSelectedFiles().length;

		if (deleteCount)
			deleteCount.textContent = selectedCount > 0 ? `(${selectedCount})` : '';
		if (downloadCount)
			downloadCount.textContent = selectedCount > 0 ? `(${selectedCount})` : '';
		if (selectedCount > 0) {
			ui.showIndicator('selected-files',
				_('已选择 %d 个文件').format(selectedCount),
				() => this.clearSelectedFiles(),
				'active'
			);
		} else {
			ui.hideIndicator('selected-files');
		}
		const bar = this._root.querySelector('.batch-action-bar');
		bar.style.display = selectedCount > 0 ? 'block' : 'none';
	},

	preloadAceEditor: function () {
		if (window._aceReady !== undefined) return Promise.resolve(window._aceReady);
		if (window._acePromise) return window._acePromise;

		return window._acePromise = new Promise(resolve => {
			if (window.ace?.edit) return resolve(true);

			const version = '1.43.3';
			const cdns = [
				`https://lib.baomitu.com/ace/${version}/ace.min.js?v=${version}`,
				`https://cdn.bootcdn.net/ajax/libs/ace/${version}/ace.min.js?v=${version}`,
				`https://cdn.jsdelivr.net/npm/ace-builds@${version}/src-min-noconflict/ace.min.js?v=${version}`,
				`https://cdnjs.cloudflare.com/ajax/libs/ace/${version}/ace.min.js?v=${version}`,
			];

			let i = 0;
			const load = () => {
				if (i >= cdns.length) return (window._acePromise = null, resolve(false));
				const s = document.createElement('script');
				s.src = cdns[i++];

				s.onload = () => {
					if (i >= cdns.length) {
						window._aceReady = false;
						window._acePromise = null;
						resolve(false);
						return;
					}
					if (window.ace?.edit) {
						const path = s.src.replace(/\/[^\/]*$/, '');
						ace.config?.set?.('basePath', path);
						ace.config?.set?.('modePath', path);
						ace.config?.set?.('themePath', path);
						window._aceReady = true;
						resolve(true);
					} else {
						s.remove();
						load();
					}
				};

				s.onerror = () => {
					s.remove();
					load();
				};

				document.head.appendChild(s);
			};
			load();
		});
	},

	hideContextMenu: function () {
		if (this._contextMenu) {
			this._contextMenu.remove();
			this._contextMenu = null;
		}
	},

	initAceEditor: function (containerId, options = {}) {
		const defaults = {
			content: '',
			mode: 'text',
			saveBtn: null,
			onChange: null,
			onError: null,
			editable: false,
			syntaxid: null,
			wrapCheckbox: null,
			changeIndicator: null,
			originalContent: undefined
		};

		const config = Object.assign({}, defaults, options);

		return new Promise((resolve, reject) => {
			const init = () => {
				const el = document.getElementById(containerId);
				if (!el || !el.offsetHeight)
					return requestAnimationFrame(init);

				try {
					const editor = ace.edit(el);
					el.env = { editor };
					editor.setOptions({
						fontSize: 14,
						showPrintMargin: false,
						readOnly: !config.editable,
						wrap: config.wrapCheckbox
							? !!config.wrapCheckbox.checked
							: true
					});

					if (config.mode)
						editor.session.setMode('ace/mode/' + config.mode);
					editor.setTheme('ace/theme/monokai');
					editor.session.setUseWorker(false);
					editor.setValue(config.content || '', -1);

					if (typeof config.originalContent !== 'string')
						config.originalContent = editor.getValue();

					if (config.syntaxid) {
						const sel = document.getElementById(config.syntaxid);
						if (sel && config.mode) sel.value = config.mode;
					};

					if (config.onChange || config.changeIndicator) {
						editor.session.on('change', () => {
							const hasUnsavedChanges =
								editor.getValue() !== config.originalContent;

							if (config.onChange) config.onChange(editor, hasUnsavedChanges);
							if (config.changeIndicator && config.changeIndicator.style) {
								config.changeIndicator.style.display =
									(hasUnsavedChanges && !editor.getReadOnly())
										? 'inline'
										: 'none';
							};
						});
					};

					if (config.editable && config.saveBtn) {
						editor.commands.addCommand({
							name: 'save',
							bindKey: { win: 'Ctrl-S', mac: 'Command-S' },
							exec: () => config.saveBtn.click()
						});
					};

					if (config.wrapCheckbox) {
						config.wrapCheckbox.addEventListener('change', () => {
							editor.setOption('wrap', !!config.wrapCheckbox.checked);
						});
					};
					resolve(editor);
				} catch (err) {
					reject(err);
				}
			};

			requestAnimationFrame(init);
		});
	},

	sanitizeFilename: function (name) {
		return name
			.replace(/[\/\\:*?"<>|\x00-\x1F]+/g, '_')
			.replace(/\.\.+/g, '.')
			.replace(/^\.+/, '')
			.replace(/\s+/g, ' ')
			.trim()
			.substring(0, 255);
	},

	getSelectedFiles: function () {
		const map = new Map(this.currentFiles.map(f => [f.path, f]));
		return Array.from(
			this._root.querySelectorAll('.file-checkbox input[type="checkbox"]:checked'),
			cb => map.get(cb.dataset.path)
		).filter(Boolean);
	},

	clearSelectedFiles: function () {
		this._root.querySelectorAll('.file-checkbox input:checked')
			.forEach(cb => {
				cb.checked = false;
				cb.closest('tr')?.classList.remove('selected');
			});

		this.toggleBatchBar();
	},

	copyText: function (text) {
		const textarea = document.createElement('textarea');
		textarea.value = text;
		textarea.style.opacity = '0';
		textarea.style.position = 'fixed';
		document.body.appendChild(textarea);
		textarea.select();

		const successful = document.execCommand('copy');
		if (successful) {
			this.showNotification(_('Copied to clipboard!'), 3000);
		} else {
			this.showNotification(_('Copy failed!'), '', 'error');
		}

		document.body.removeChild(textarea);
	},

	parseLinkString: function (path) {
		if (!path || typeof path !== 'string') return null;
		const match = path.match(/^(.*?)\s+->\s+(.*)$/);
		if (!match) return null;

		return {
			original: path,
			linkPath: match[1].trim(),
			targetPath: match[2].trim()
		};
	},

	parseSizeToBytes: function (s) {
		const units = { K: 1024, M: 1024 ** 2, G: 1024 ** 3 };
		const match = s.match(/^([\d.]+)([KMGT]?)/i);
		if (!match) return 0;

		const num = parseFloat(match[1]);
		const unit = match[2].toUpperCase();
		return unit ? Math.round(num * units[unit]) : num;
	},

	formatSizeHuman: function (s) {
		let n = parseInt(s, 10);
		if (isNaN(n) || n < 0) return '0B';

		const units = [' B', ' KB', ' MB', ' GB'];
		let i = 0;

		while (n >= 1024 && i < units.length - 1) {
			n /= 1024; i++;
		}

		return n.toFixed(n % 1 ? 2 : 0) + units[i];
	},

	permissionsToOctal: function (p) {
		let v = '', o = '';
		const m = { 'r': 4, 'w': 2, 'x': 1, 't': 1, '-': 0 };
		for (let i = 1; i < p.length; i += 3) {
			v = p.slice(i, i + 3).split('').reduce(function (a, c) {
				return a + m[c];
			}, 0);
			o += v.toString(8);
		}
		return o;
	},

	/** 显示通知 */
	showNotification: function (message, timeout, type = 'info') {
		const existing = document.querySelector('.file-notification');
		if (existing) existing.remove();

		const notification = E('div', {
			class: 'file-notification',
			style: `
            position: fixed;
            opacity: 0;
            top: 20px;
            color: white;
            right: 70px;
            z-index: 10000;
            padding: 10px 25px;
            border-radius: 4px;
            transform: translateX(100px);
            box-shadow: 0 2px 5px rgba(0,0,0,0.2);
            background: ${type === 'success' ? '#4CAF50' : type === 'error' ? 'red' : '#2196F3'};
            transition: transform 0.3s ease, opacity 0.3s ease;
        `}, message);

		document.body.appendChild(notification);

		notification.offsetHeight;
		notification.style.transform = 'translateX(0)';
		notification.style.opacity = '1';

		setTimeout(() => {
			if (notification.parentNode) {
				notification.style.opacity = '0';
				notification.style.transform = 'translateX(100px)';
				setTimeout(() => notification.remove(), 300);
			}
		}, (typeof timeout === 'number' && timeout > 0) ? timeout : 3000);
	},

	Draggable: function () {
		const modal = document.querySelector('#modal_overlay .modal');
		if (!modal) return;

		const rect = modal.getBoundingClientRect();
		modal.style.margin = '0';
		modal.style.transform = 'none';
		modal.style.position = 'fixed';
		modal.style.top = rect.top + 'px';
		modal.style.left = rect.left + 'px';

		const dragArea = modal.querySelector('h4');
		if (!dragArea) return;

		dragArea.style.cursor = 'move';
		let dragData = null;

		const onMouseMove = (e) => {
			if (!dragData) return;
			modal.style.top = (dragData.startTop + e.clientY - dragData.startY) + 'px';
			modal.style.left = (dragData.startLeft + e.clientX - dragData.startX) + 'px';
		};

		const onMouseUp = () => {
			dragData = null;
			document.removeEventListener('mouseup', onMouseUp);
			document.removeEventListener('mousemove', onMouseMove);
		};

		dragArea.addEventListener('mousedown', (e) => {
			if (e.button !== 0) return;
			dragData = {
				startX: e.clientX,
				startY: e.clientY,
				startTop: parseInt(modal.style.top, 10) || 0,
				startLeft: parseInt(modal.style.left, 10) || 0
			};

			document.addEventListener('mousemove', onMouseMove);
			document.addEventListener('mouseup', onMouseUp);
			e.preventDefault();
		});
	},

	modalnotify: function (title, children, timeout, ...classes) {
		const msg = E('div', {
			style: 'display:flex',
			class: 'alert-message fade-in',
			transitionend: function (ev) {
				const node = ev.currentTarget;
				if (node.parentNode && node.classList.contains('fade-out'))
					node.parentNode.removeChild(node);
			}
		}, [
			E('div', { style: 'flex:10' }),
			E('div', { style: 'flex:1 1 auto; display:flex' }, [
				E('button', {
					class: 'btn',
					style: 'margin-left:auto; margin-top:auto',
					click: function (ev) {
						dom.parent(ev.target, '.alert-message').classList.add('fade-out');
					},
				}, [_('Dismiss')])
			])
		]);

		if (title != null) dom.append(msg.firstElementChild, E('h4', {}, title));

		dom.append(msg.firstElementChild, children);
		msg.classList.add(...classes);

		const overlay = document.getElementById('modal_overlay');
		if (overlay && getComputedStyle(overlay).visibility !== 'hidden') {
			overlay.firstElementChild?.prepend(msg);
		} else {
			const mc = document.querySelector('#maincontent') ?? document.body;
			mc.insertBefore(msg, mc.firstElementChild);
		};

		function fadeOutNotification(element) {
			if (element) {
				element.classList.add('fade-out');
				element.classList.remove('fade-in');
				setTimeout(() => {
					if (element.parentNode) {
						element.parentNode.removeChild(element);
					};
				});
			};
		};

		if (typeof timeout === 'number' && timeout > 0) setTimeout(() => fadeOutNotification(msg), timeout);
		return msg;
	},

	handleSave: null,
	handleReset: null,
	handleSaveApply: null
});
