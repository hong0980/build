'use strict';
'require fs';
'require ui';
'require dom';
'require view';

const CSS = `
.file-name-cell:hover {
	background: #f5f7fa;
}
tr.selected {
	background-color: #e4efffff;
}
.table .td .btn {
	line-height: 1.6em;
}
.path-hint {
	font-size: 0.9em;
	color: #666;
	margin-bottom: 8px;
	text-align: center;
}
.inline-form-group {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap:wrap;
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
    color: #fff;
    background-color: #007bff;
}
.file-context-menu .item:not(:last-child) {
    border-bottom: 1px solid #ddd;
}

.file-checkbox {
	gap:5px;
	display:flex;
	align-items:center;
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

.ace-fullscreen-wrapper > div:last-child {
	border-top: 1px solid #eee;
	padding: .5em;
	background: #fafafa;
}

.ace-toolbar {
	flex: 0 0 auto;
	padding: 6px;
	background: #eee;
	border: 1px solid #ccc;
	border-bottom: none;
}
.ace-toolbar-select {
	min-width: 12% !important;
	max-width: 15%;
}
.ace-editor-container {
	height: 100%;
	display: flex;
	flex-direction: column;
}
.ace-editor-container > div:last-child {
	flex: 1 1 auto;
}

.modal-custom-row {
	display: flex;
	align-items: center;
	padding: 9px 9px;
}
.modal-custom-label {
	font-weight: bold;
	min-width: 60px;
	color: #555;
}
.modal-custom-path {
	padding:8px;
	background:#f0f0f0;
	font-size:12px;
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
	.ace-toolbar-select {
		min-width: 60px !important;
		max-width: 80px;
	}
}`;

const permissions = [
	["777", _('777 - Full access for owner, group, and others (read, write, execute)')],
	["755", _('755 - Full access for owner; read and execute for group and others')],
	["700", _('700 - Full access for owner only')],
	["666", _('666 - Read and write for owner, group, and others (no execute)')],
	["644", _('644 - Read and write for owner; read-only for group and others')],
	["600", _('600 - Read and write for owner only')],
	["555", _('555 - Read and execute for owner, group, and others (no write)')],
	["444", _('444 - Read-only for owner, group, and others')]
];

const themes = [
	["monokai", "Monokai"], ["dracula", "Dracula"], ["one_dark", "One Dark"],
	["github_dark", "GitHub Dark"], ["solarized_light", "Solarized Light"],
	["solarized_dark", "Solarized Dark"], ["tomorrow", "Tomorrow"], ["github", "GitHub"],
	["tomorrow_night", "Tomorrow Night"], ["terminal", "Terminal"]
];

const modes = [
	['javascript', 'JS'], ['sh', 'Shell'], ['lua', 'Lua'],
	['html', 'HTML'], ['json', 'JSON'], ['python', 'Python'],
	['text', 'Text'], ['css', 'CSS'], ['yaml', 'YAML'],
	['xml', 'XML'], ['toml', 'Toml'], ["sql", "SQL"],
	["diff", "patch(diff)"], ["makefile", "Makefile"]
];

return view.extend({
	load: function (p = null) {
		let path = (typeof p === 'string' ? p : (location.hash.slice(1) || '/'));
		path = path.replace(/\/+/g, '/').replace(/(.+)\/$/, '$1');
		this._path = path || '/';

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
					path: (`${path}/${name}`).replace(/\/+/g, '/')
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
		if (!window._popBound) {
			window._popBound = true;
			window.addEventListener('popstate', e => {
				if (e.state && e.state.path && e.state.path !== this._path) {
					this.reload(e.state.path);
				}
			});
		};
		this._path = data.path;
		if (history.state?.path !== data.path) {
			history.pushState({ path: data.path, data: data }, '', '#' + data.path);
		}
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
			[_('Name'), _('owner'), _('Size'), _('Change the time'), _('Rights'), _('')],
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
					class: 'file-name-cell', style: 'flex:1',
					contextmenu: ui.createHandlerFn(this, ev => this.showContextMenu(ev, f))
				}, [
					E('span', {
						title: f.name,
						click: f.isDir ? ui.createHandlerFn(this, 'reload', f.path) : null,
						style: `${f.isDir ? 'cursor:pointer;color:#0066cc;' : ''}display:inline-block;`
					}, `${icon} ${nameText}`)
				])
			]);

			const btn = E('button', {
				class: 'btn cbi-button-edit',
				click: ui.createHandlerFn(this, 'showFileEditor', f, false)
			}, _('open'));

			return [nameCell, f.owner, f.size, f.date, `[${f.permissionNum}] ${f.perm}`, f.isDir ? '' : btn];
		}));

		root.append(
			E('style', CSS),
			E('h2', _('File management')),
			E('p', { style: 'display:flex;justify-content:space-between;align-items:center;margin-top:10px;' }, [
				crumbs,
				E('div', { class: 'inline-form-group' }, [
					E('span', { style: 'color:#666;font-size:12px;' },
						_('%d items • Total %s').format(files.length, this.formatSizeHuman(totalSize))),
					E('button', {
						class: 'btn cbi-button-positive important',
						click: ui.createHandlerFn(this, 'reload')
					}, _('Reload page'))
				])
			]),
			E('div', { class: 'batch-action-bar' }, [
				E('div', { class: 'inline-form-group' }, [
					E('button', {
						class: 'btn cbi-button-remove',
						click: ui.createHandlerFn(this, () => this.deleteFile(this.getSelectedFiles()))
					}, [_('Batch delete'), E('span', { id: 'delete-count' })]),
					E('button', {
						class: 'btn cbi-button-action',
						click: ui.createHandlerFn(this, () => this.downloadFile(this.getSelectedFiles()))
					}, [_('Batch Download'), E('span', { id: 'download-count' })]),
					E('button', {
						class: 'btn cbi-button-remove',
						click: ui.createHandlerFn(this, 'clearSelectedFiles')
					}, _('Deselect'))
				])
			]),
			table.render()
		);

		if (!window._aceReady && !window._acePromise) {
			if ('requestIdleCallback' in window) {
				requestIdleCallback(() => this.preloadAceEditor(), { timeout: 1500 });
			} else {
				setTimeout(this.preloadAceEditor.bind(this), 800);
			}
		}

		return root;
	},

	reload: function (p) {
		return this.load(p || this._path).then(d => this.render(d));
	},

	showContextMenu: function (ev, file) {
		ev.preventDefault();
		ev.stopPropagation();
		if (this._contextMenuHandler)
			document.removeEventListener('click', this._contextMenuHandler);

		this.hideContextMenu();

		const menu = E('div', { class: 'file-context-menu' });
		this._menu = menu;

		[
			[_('Create file (directory)'), () => this.createnew()],
			!file.isDir && [_('Edit'), () => this.showFileEditor(file, true)],
			[_('Rename'), () => this.renameFile(file.path)],
			[_('Modify permissions'), () => this.chmodFile(file)],
			!file.isLink && [_('Create link'), () => this.createLink(file.path)],
			[_('Delete file'), () => this.deleteFile(file)],
			[_('download file'), () => this.downloadFile(file)],
			[_('upload file'), ev => this.Upload(ev)]
		].filter(Boolean).forEach(([label, action]) => {
			menu.appendChild(E('div', {
				class: 'item',
				click: ui.createHandlerFn(this, ev => {
					this.hideContextMenu();
					action(ev);
				})
			}, label));
		});

		document.body.appendChild(menu);
		const { clientX: x0, clientY: y0 } = ev;
		const { innerWidth: w, innerHeight: h } = window;
		const { width, height } = menu.getBoundingClientRect();

		menu.style.left = Math.min(x0, w - width - 5) + 'px';
		menu.style.top = (y0 + height > h ? Math.max(0, y0 - height) : y0) + 'px';

		this._contextMenuHandler = (e) => {
			this.hideContextMenu();
			this._contextMenuHandler = null;
		};

		document.addEventListener('click', this._contextMenuHandler, { once: true });
		document.addEventListener('contextmenu', this._contextMenuHandler, { once: true });
	},

	showFileEditor: function (file, editable) {
		const fileSize = this.parseSizeToBytes(file.size);
		const maxSize = editable ? 512 * 1024 : 1024 * 1024;
		const maxSizeStr = editable ? '512KB' : '1MB';
		const action = editable
			? _('cannot be edited')
			: _('cannot be displayed');

		if (fileSize > maxSize) {
			return this.showNotification(
				_('File too large (%s), %s. Maximum allowed size is %s.')
					.format(file.size, action, maxSizeStr),
				8000, 'error'
			);
		};

		let path = file.isLink
			? (this.parseLinkString(file.path)?.targetPath || file.path)
			: file.path;
		path = path.startsWith('/') ? path : '/' + path;

		fs.stat(path).then(r => {
			if (r.type === 'file') {
				return fs.read_direct(path).then(content => {
					if (content.indexOf('\0') !== -1)
						throw new Error(_('This is a binary file and %s').format(action));

					hideModal();
					window._aceReady
						? this.showAceEditor(file, content, editable)
						: this.showSimpleEditor(file, content, editable);
				})
			} else if (r.type === 'directory') {
				hideModal();
				this.reload(path);
			} else throw new Error(_('Unknown file type'));
		}).catch((e) =>
			this.showNotification(_('Failed to read file: %s').format(e.message), 8000, 'error'));
	},

	toggleFS: function (config) {
		this._isFullscreen = !this._isFullscreen;
		const { wrapper, container, btnFull, btnExit, getEditor } = config;

		if (!this._escHandler) {
			this._escHandler = (e) => {
				if (e.key === 'Escape' && this._isFullscreen)
					this.toggleFS(config);
			};
		}

		if (this._isFullscreen) {
			document.addEventListener('keydown', this._escHandler);
			config.originalParent = wrapper.parentNode;
			config.originalNext = wrapper.nextSibling;

			document.body.appendChild(wrapper);
			wrapper.classList.add('ace-fullscreen');
			container.style.height = '100%';
			container.style.flex = '1';
		} else {
			document.removeEventListener('keydown', this._escHandler);
			if (config.originalParent)
				config.originalParent.insertBefore(wrapper, config.originalNext);

			wrapper.classList.remove('ace-fullscreen');
			container.style.height = '320px';
			container.style.flex = '';
		}

		btnFull.style.display = this._isFullscreen ? 'none' : 'block';
		btnExit.style.display = this._isFullscreen ? 'block' : 'none';

		// if (typeof getEditor === 'function') {
		// 	requestAnimationFrame(() => getEditor().resize());
		// }
	},

	showAceEditor: function (file, content, editable) {
		let editor = null;
		const originalContent = content;
		const containerId = 'ace-' + Date.now();
		const syntaxid = 'syntax-' + Date.now();
		const mode = this.detectFileMode(file.name, content);
		const container = E('div', { id: containerId, style: 'width:100%;height:320px;border:1px solid #ccc;' });
		const changeIndicator = E('span', {
			style: 'display:none;cursor:pointer;color:#e74c3c;font-size:22px;line-height:1;',
			title: _('The document has been modified, click to undo all'),
			click: ui.createHandlerFn(this, () => {
				if (editor && confirm(_('Undo all changes?')))
					editor.setValue(originalContent, -1);
			})
		}, '●');
		const wrapCheckbox = E('input', { type: 'checkbox', checked: true, id: 'wrapCheckbox' });
		const editCheckbox = E('input', {
			type: 'checkbox', id: 'editCheckbox', checked: !!editable || undefined,
			change: ui.createHandlerFn(this, (ev) => {
				if (!editor) return;
				document.querySelector('.modal h4')
					.textContent = ev.target.checked ? _('edit mode') : _('view mode');
			})
		});
		const saveBtn = E('button', {
			style: 'display:none;',
			class: 'btn cbi-button-positive important',
			click: ui.createHandlerFn(this, () => {
				if (!editor) return;
				const val = editor.getValue();
				fs.write(file.path, val).then(() => {
					hideModal();
					this.showNotification(_('%s File saved successfully!').format(file.path), '', 'success');
					this.reload();
				}).catch(error => this.modalnotify(null, E('p', _('Save failed: %s').format(error.message || error)), '', 'warning'));
			})
		}, _('Save'));
		const btnFull = E('button', { class: 'btn', style: 'padding: 0 8px; margin-left:auto;' }, _('full screen'));
		const btnExit = E('button', { class: 'btn', style: 'display:none;margin-left:auto;' }, _('Exit full screen'));
		const toolbar = E('div', { class: 'ace-toolbar' }, [
			E('div', { class: 'inline-form-group' }, [
				E('span', _('Syntax')),
				E('select', {
					id: syntaxid, class: 'ace-toolbar-select',
					change: (ev) => editor && editor.session.setMode('ace/mode/' + ev.target.value)
				}, modes.map(([id, name]) => E('option', { value: id, selected: id === mode || undefined }, name))),
				E('span', _('Theme')),
				E('select', {
					class: 'ace-toolbar-select',
					change: (ev) => editor && editor.setTheme('ace/theme/' + ev.target.value)
				}, themes.map(([id, name]) =>
					E('option', { value: id, selected: id === 'monokai' || undefined }, name))
				),
				E('span', _('Font')),
				E('select', {
					class: 'ace-toolbar-select',
					change: (ev) => editor && editor.setFontSize(ev.target.value + 'px')
				}, ['12', '13', '14', '15', '16'].map(id =>
					E('option', { value: id, selected: id === '14' || undefined }, id + 'px')
				)),
				wrapCheckbox, E('label', { for: 'wrapCheckbox' }, _('wrap')),
				editCheckbox, E('label', { for: 'editCheckbox' }, _('Edit')),
				changeIndicator, btnFull, btnExit
			])
		]);
		const fullscreenWrapper = E('div', { class: 'ace-fullscreen-wrapper' }, [
			E('div', { class: 'ace-editor-container' }, [toolbar, container]),
			E('div', { style: 'display:flex;gap:.5em;justify-content:space-around;padding-top:8px;' }, [
				E('button', {
					class: 'btn cbi-button-action',
					click: ui.createHandlerFn(this, () => editor && this.copyText(editor.getValue()))
				}, _('Copy')),
				saveBtn,
				E('button', {
					class: 'btn',
					click: ui.createHandlerFn(this, () => {
						if (editor && editor.getValue() !== originalContent)
							if (!confirm(_('You have unsaved changes. Discard them?'))) return;
						if (this._isFullscreen) btnExit.click();
						hideModal();
					})
				}, _('Close'))
			])
		]);

		btnFull.onclick = btnExit.onclick = ui.createHandlerFn(this, 'toggleFS', {
			wrapper: fullscreenWrapper, container, btnFull, btnExit, getEditor: () => editor
		});

		L.showModal(editable ? _('edit mode') : _('view mode'), [
			E('style', [
				'.modal > h4{text-align:center;}',
				'.ace-toolbar-select { height:25px!important; padding: 0 4px !important; min-width:13%!important; }'
			]),
			E('div', { class: 'path-hint' }, [
				_('Ace Editor version: %s').format(ace.version), ' | ',
				_('Size: %s').format(file.size), ' | ',
				_('Source: %s').format(file.path)
			]),
			fullscreenWrapper
		]);

		requestAnimationFrame(() => {
			this.initAceEditor({
				content, editable, syntaxid,
				mode, changeIndicator, saveBtn,
				originalContent, wrapCheckbox,
				editCheckbox, containerId
			}).then(ed => {
				editor = ed;
				editor.resize();
			});

			if (container) {
				container.addEventListener('keydown', (e) => {
					if ((e.ctrlKey || e.metaKey) && e.key === 's') {
						e.preventDefault();
						e.stopPropagation();
						if (saveBtn.style.display !== 'none')
							saveBtn.click();
					}
				}, true);
			}
			this.Draggable();
		});
	},

	showSimpleEditor: function (file, content, editable) {
		const originalContent = content;
		const textarea = E('textarea', {
			class: 'cbi-input-text', readonly: !editable || undefined, type: 'text',
			input: function (ev) {
				const isDirty = ev.target.value !== originalContent;
				saveBtn.style.display = (isDirty && !ev.target.readOnly) ? 'inline-block' : 'none';
			},
			style: 'width:100%;height:320px;font-family:Consolas;background-color:#212121;color:#fff;font-size:14px;'
		}, content);
		const saveBtn = E('button', {
			class: 'btn cbi-button-positive important',
			style: `display:none`,
			click: ui.createHandlerFn(this, () => {
				fs.write(file.path, textarea.value).then(() => {
					hideModal();
					this.showNotification(_('%s File saved successfully!').format(file.path), '', 'success');
					this.reload();
				}).catch(error => this.modalnotify(null, E('p', _('Save failed: %s').format(error.message || error)), '', 'warning'));
			})
		}, _('Save'));
		const btnFull = E('button', { class: 'btn', style: 'padding: 0 8px; margin-left:auto;' }, _('full screen'));
		const btnExit = E('button', { class: 'btn', style: 'display:none;margin-left:auto;' }, _('Exit full screen'));
		const modeToggle = E('div', { class: 'ace-toolbar' }, [
			E('div', { class: 'inline-form-group' }, [
				E('span', _('Font')),
				E('select', {
					class: 'cbi-input-select', style: 'width: 35%;',
					change: ui.createHandlerFn(this, ev => textarea.style.fontSize = ev.target.value + 'px')
				}, ['12', '13', '14', '15', '16'].map(id =>
					E('option', { value: id, selected: id === '14' || undefined }, id + 'px')
				)),
				E('input', {
					type: 'checkbox', checked: true, id: 'wrapCheckbox',
					change: ui.createHandlerFn(this, ev =>
						textarea.style.whiteSpace = ev.target.checked ? 'pre-wrap' : 'pre')
				}),
				E('label', { class: 'inline-form-group', for: 'wrapCheckbox' }, _('wrap')),
				E('input', {
					id: 'editCheckbox', type: 'checkbox',
					checked: !!editable || undefined,
					change: ui.createHandlerFn(this, ev => {
						const isChecked = ev.target.checked;
						textarea.readOnly = !isChecked;
						document.querySelector('.modal h4')
							.textContent = isChecked ? _('edit mode') : _('view mode');
					})
				}),
				E('label', { class: 'inline-form-group', for: 'editCheckbox' }, _('Edit')),
				btnFull, btnExit
			])
		]);
		const fullscreenWrapper = E('div', { class: 'ace-fullscreen-wrapper' }, [
			modeToggle, textarea,
			E('div', { style: 'display:flex;gap:.5em;justify-content:space-around;padding-top:8px;' }, [
				E('button', {
					class: 'btn cbi-button-positive',
					click: ui.createHandlerFn(this, 'copyText', textarea.value)
				}, _('Copy')),
				saveBtn,
				E('button', {
					class: 'btn',
					click: ui.createHandlerFn(this, () => {
						if (textarea.value !== originalContent && !textarea.readOnly)
							if (!confirm(_('You have unsaved changes. Discard them?'))) return;
						if (this._isFullscreen) btnExit.click();
						hideModal();
					})
				}, _('Close'))
			])
		]);
		btnFull.onclick = btnExit.onclick = ui.createHandlerFn(this, 'toggleFS', {
			wrapper: fullscreenWrapper, container: textarea, btnFull, btnExit, getEditor: () => null
		});

		L.showModal(editable ? _('edit mode') : _('view mode'), [
			E('style', ['.modal > h4{text-align:center;}']),
			E('div', { class: 'path-hint' }, [
				_('Size: %s').format(file.size), ' | ',
				_('Lines: %d').format(content.split('\n').length), ' | ',
				_('Source: %s').format(file.path)
			]),
			fullscreenWrapper
		]);
		requestAnimationFrame(() => this.Draggable());
	},

	createnew: function () {
		let fileContent = '', fullDir, fullFile, result = '';
		let mode, editor = null, dirPerm = '755', filePerm = '644';
		const syntaxid = 'syntax-' + Date.now();
		const containerId = 'ace-' + Date.now();
		const setmode = () => {
			if (result && result.file && editor) {
				mode = this.detectFileMode(result.file, null);
				editor.session.setMode(`ace/mode/${mode}`);
				const modeElem = document.getElementById(syntaxid);
				if (modeElem) modeElem.value = mode;
			}
		};
		const fileElem = [
			E('span', _('file permissions')),
			E('select', {
				class: 'ace-toolbar-select',
				change: ui.createHandlerFn(this, ev => filePerm = ev.target.value)
			}, permissions.map(([id, name]) =>
				E('option', { value: id, selected: id === filePerm || undefined }, name)
			))
		];
		const toolbar = E('span', { style: 'display:none;' }, [
			window._aceReady
				? E('span', [
					E('div', [
						E('div', { class: 'ace-toolbar inline-form-group' }, [
							E('span', _('Syntax')),
							E('select', {
								class: 'ace-toolbar-select', id: syntaxid,
								change: ui.createHandlerFn(this, ev => editor && editor.session.setMode('ace/mode/' + ev.target.value))
							}, modes.map(([id, name]) => E('option', { value: id, selected: id === mode || undefined }, name))
							),
							E('span', _('Theme')),
							E('select', {
								class: 'ace-toolbar-select',
								change: ui.createHandlerFn(this, ev => editor && editor.setTheme('ace/theme/' + ev.target.value))
							}, themes.map(([id, name]) => E('option', { value: id, selected: id === 'monokai' || undefined }, name))
							),
							E('span', _('Font')),
							E('select', {
								class: 'ace-toolbar-select',
								change: ui.createHandlerFn(this, ev => editor && editor.setFontSize(ev.target.value + 'px'))
							}, ['12', '13', '14', '15', '16'].map(id =>
								E('option', { value: id, selected: id === '14' || undefined }, id + 'px')
							)),
							...fileElem
						])
					]),
					E('div', { id: containerId, style: 'width:100%;height:250px;' })
				])
				: E('div', [
					E('style', ['.ace-toolbar-select {max-width:100%;flex:1;}']),
					E('div', { class: 'ace-toolbar inline-form-group' }, [...fileElem]),
					E('textarea', {
						placeholder: _('Enter text here'),
						class: 'cbi-input-text', type: 'text',
						style: 'width:100%;height:250px;font-family:Consolas;background-color:#212121;color:#fff;font-size:14px;',
						change: ui.createHandlerFn(this, ev => fileContent = ev.target.value)
					}),
				])
		]);
		const pathRules = [
			" 📂 " + _("End with '/' to create a Directory"),
			" 📄 " + _("No '/' at end to create a File"),
			" 🚩 " + _("Start with '/' for Absolute path"),
			" 🏠 " + _("No '/' at start for Current path")
		].join("\n");
		const pathInput = E('input', {
			title: pathRules, style: 'flex:1;',
			placeholder: _('e.g. file.txt or folder/'),
			change: ui.createHandlerFn(this, ev => {
				const val = ev.target.value.trim();
				if (!val)
					return ev.target.title = pathRules;
				result = this.parsePath(val);
				const formatPath = (p) => p.replace(/\/+/g, '/');
				const base = result.isAbsolute ? '' : this._path + '/';
				fullDir = formatPath(result.isDir ? base + result.path : base + result.dir);
				fullFile = result.isFile ? formatPath(base + result.path) : null;

				const parent = ev.target.parentNode;
				const oldHint = parent.querySelector('.path-hint');
				if (oldHint) oldHint.remove()
				if (fullFile) {
					const targetHint = E('div', {
						class: 'path-hint', style: 'color:#007bff;margin:0 !important;padding:0 !important;'
					}, _('Target') + ': ' + fullFile);
					parent.insertBefore(targetHint, ev.target.nextSibling);
					document.getElementById('dirperm').style.display = 'none';
					toolbar.style.display = 'block';
					ev.target.title = '📄 ' + _('This will create a file at: %s').format(fullFile);
				} else if (fullDir) {
					document.getElementById('dirperm').style.display = 'flex';
					toolbar.style.display = 'none';
					ev.target.title = '📂 ' + _('This will create a directory at: %s').format(fullDir);
				};
				setmode();
			})
		});
		L.showModal(_('Create file (directory)'), [
			E('style', ['.modal > h4{text-align:center;color:red;}']),
			E('div', { class: 'inline-form-group' }, [
				E('span', _('name(path)')), pathInput,
				E('span', { id: 'dirperm', class: 'inline-form-group', style: 'display:none;' }, [
					E('span', _('Directory permissions')),
					E('select', {
						style: 'flex:1;',
						change: ui.createHandlerFn(this, ev => dirPerm = ev.target.value)
					}, permissions.map(([id, name]) =>
						E('option', { value: id, selected: id === dirPerm || undefined }, name)
					))
				]),
			]),
			toolbar,
			E('div', { class: 'button-row' }, [
				E('button', {
					class: 'btn cbi-button-positive important',
					click: ui.createHandlerFn(this, () => {
						hideModal();
						const content = (window._aceReady && editor) ? editor.getValue() : fileContent;
						const p = fullDir ? fs.exec('/bin/mkdir', ['-p', '-m', dirPerm, fullDir]) : Promise.resolve();
						p.then(res => {
							if (res && res.code !== 0) throw new Error(res.stderr);

							if (!fullFile) {
								this.showNotification(_('Directory %s created successfully').format(fullDir), '', 'success');
								return this.reload(fullDir);
							}

							return fs.write(fullFile, content).then(() => {
								return fs.exec('/bin/chmod', [filePerm, fullFile]);
							}).then(res => {
								if (res && res.code !== 0) throw new Error(res.stderr);
								this.reload(fullDir);
								this.showNotification(_('Created successfully: %s').format(fullFile), '', 'success');
							});
						}).catch(e => {
							this.modalnotify(null, E('p', _('Create failed: %s').format(e.message || e)), '', 'error');
						});
					})
				}, _('Create')),
				E('button', { class: 'btn', click: hideModal }, _('Cancel'))
			])
		]);

		requestAnimationFrame(() => {
			if (window._aceReady)
				this.initAceEditor({ containerId, editable: true }).then(ed => {
					editor = ed;
					setmode();
				});
			ui.addValidator(pathInput, 'string', false, function (value) {
				const result = this.parsePath(value.trim());
				if (!result.valid)
					return result.error ? _(result.error) : _('Invalid path format');
				return true;
			}.bind(this));
			this.Draggable();
		});
	},

	parsePath: function (path) {
		if (!/^[A-Za-z0-9._\-\/~@()+,=]+$/.test(path))
			return { valid: false, error: _('Path contains unsupported characters') };

		if (path.split('/').includes('..'))
			return { valid: false, error: _('Path contains illegal segment (..)') };

		const parts = path.split('/');
		const last = parts.pop() || '';
		const isDir = path.endsWith('/');
		const isFile = !isDir;
		const dir = isFile
			? path.slice(0, path.lastIndexOf('/') + 1)
			: (path.endsWith('/') ? path : path + '/');

		return {
			isFile, isDir, dir, path,
			file: isFile ? last : '', valid: true,
			isAbsolute: path.startsWith('/')
		};
	},

	renameFile: function (path) {
		let newname = '';
		const oldname = path.split(/[/\\]/).pop() || '';

		L.showModal(_('Rename'), [
			E('style', ['.modal > h4{text-align:center;color:red;}']),
			E('div', { class: 'modal-custom-path' }, [
				E('strong', _('Source: %s').format(path))
			]),
			E('div', { class: 'modal-custom-row' }, [
				E('label', { class: 'modal-custom-label' }, _('newname')),
				E('input', {
					class: 'cbi-input-text', value: oldname,
					id: 'nameinput', style: 'flex:1', type: 'text',
					change: ui.createHandlerFn(this, ev => newname = ev.target.value.trim())
				}),
			]),
			E('div', { class: 'right' }, [
				E('button', { class: 'btn', click: hideModal }, _('Cancel')),
				' ',
				E('button', {
					class: 'btn cbi-button-positive important',
					click: ui.createHandlerFn(this, () => {
						if (!newname || newname === oldname)
							return this.modalnotify(null, E('p', _('Please enter a new name')), 3000);
						hideModal();
						fs.exec('/bin/mv', [path, path.replace(/[^/]+$/, newname)]).then(r => {
							if (r.code !== 0)
								return this.modalnotify(null, E('p', _('Rename failed: %s').format(r.stderr)), '', 'error');
							this.reload();
							this.showNotification(_('Renamed: %s to %s').format(path, newname), '', 'success');
						});
					})
				}, _('Rename'))
			])
		]);

		requestAnimationFrame(() => {
			const input = document.querySelector('#nameinput');
			if (!input) return;
			const pos = oldname.lastIndexOf('.');
			input.setSelectionRange(0, pos > 0 ? pos : oldname.length);
			input.focus();
		});
	},

	chmodFile: function ({ path, permissionNum }) {
		let val = '';
		L.showModal(_('Change permissions'), [
			E('style', ['.modal > h4{text-align:center;color:red;}']),
			E('div', { class: 'modal-custom-path' }, [
				E('strong', _('Source: %s').format(path))
			]),
			E('div', { class: 'modal-custom-row' }, [
				E('label', { class: 'modal-custom-label' }, _('Permission')),
				E('select', {
					class: 'cbi-input-select', style: 'flex:1',
					change: ui.createHandlerFn(this, () => val = ev.target.value)
				}, permissions.map(([id, name]) =>
					E('option', { value: id, selected: id === permissionNum || undefined }, name)
				))
			]),

			E('div', { class: 'right' }, [
				E('button', { class: 'btn', click: hideModal }, _('Cancel')),
				' ',
				E('button', {
					class: 'btn cbi-button-positive important',
					click: ui.createHandlerFn(this, () => {
						if (!val)
							return this.showNotification(_('Please select a new value'), 5000, 'error');

						hideModal();
						fs.exec('/bin/chmod', [val, path])
							.then(r => {
								if (r.code !== 0) throw new Error(r.stderr);
								this.reload();
								this.showNotification(_('Permissions updated: %s').format(path), 2000, 'success');
							})
							.catch(e =>
								this.showNotification(_('Failed to change permissions: %s').format(e.message || e), 5000, 'error'));
					})
				}, _('Apply'))
			])
		]);
	},

	deleteFile: function (files) {
		files = [].concat(files);
		if (files.length === 0) return;
		const previewList = files.slice(0, 5).map(f => f.name).join('\n');
		const moreSuffix = files.length > 5 ? '\n...' : '';

		L.showModal(_('Delete project'), [
			E('style', [
				`.file-preview {
					font-size: 0.9em; color: #6c757d; word-break: break-all;
					margin-top: 10px; white-space: pre-line; max-height: 150px;
					overflow-y: auto; background: rgba(0,0,0,0.03); padding: 5px;
					border-radius: 3px;
				}`,
				`.modal > h4 {text-align:center !important; color:red !important;}`,
				`.modal-delete-warning {background:#fff3cd; border-left:4px solid #ffc107; padding:12px; margin-bottom:15px; text-align:left;}`,
				`.modal-delete-msg {text-align:center; padding:10px 5px; font-weight:bold; color: #dc3545; font-size:1.1em;}`
			]),
			E('div', { class: 'modal-delete-warning' }, [
				E('strong', { style: 'color:#856404; display:block;' }, _('⚠️ Warning:')),
				E('span', { style: 'color:#856404;' }, _('This action is irreversible! Files will be permanently removed.'))
			]),
			E('div', { class: 'modal-delete-msg' }, [
				files.length === 1
					? _('Delete "%s"?').format(files[0].name)
					: _('Delete %d selected items?').format(files.length),
				E('div', { class: 'file-preview' },
					files.length === 1 ? '' : _('Items to be deleted:') + '\n%s%s'.format(previewList, moreSuffix)
				)
			]),
			E('div', { class: 'button-row' }, [
				E('button', {
					class: 'btn cbi-button-negative important',
					click: ui.createHandlerFn(this, ev => {
						ev.target.disabled = true;
						ev.target.textContent = _('Deleting...');
						const paths = files.map(({ path, isLink }) => {
							if (isLink) {
								const linkInfo = this.parseLinkString(path);
								return linkInfo ? linkInfo.linkPath : path;
							}
							return path;
						});

						hideModal();
						fs.exec('/bin/rm', ['-rf', ...paths]).then(r => {
							if (r.code !== 0) throw new Error(r.stderr);
							this.clearSelectedFiles();
							this.reload();
							this.showNotification(
								files.length === 1
									? _('Deleted: %s').format(files[0].name)
									: _('Successfully deleted %d files').format(files.length),
								2000, 'success'
							);
						}).catch(e => {
							this.showNotification(_('Delete failed: %s').format(e.message || e), 5000, 'error');
						});
					})
				}, _('Confirm Delete')),
				E('button', { class: 'btn', click: hideModal }, _('Cancel'))
			])
		]);
	},

	createLink: function (path) {
		let linkPath = '', isHardLink = false;
		const pathInput = E('input', {
			class: 'cbi-input-text', style: 'flex:1',
			placeholder: '/path/to/target', type: 'text',
			change: ui.createHandlerFn(this, ev => linkPath = ev.target.value.trim())
		});

		L.showModal(_('Create link'), [
			E('style', ['.modal > h4 {text-align:center;color:red;}']),
			E('div', { class: 'modal-custom-path' }, [
				E('strong', _('Source: %s').format(path))
			]),
			E('div', { class: 'modal-custom-row' }, [
				E('label', { class: 'modal-custom-label' }, _('Target')),
				pathInput
			]),
			E('div', { class: 'modal-custom-row', style: 'padding-top:0' }, [
				E('label', { class: 'modal-custom-label' }),
				E('div', { class: 'inline-form-group' }, [
					E('input', {
						type: 'checkbox', id: 'is_hardlink',
						change: ui.createHandlerFn(this, ev => isHardLink = ev.target.checked)
					}),
					E('label', { for: 'is_hardlink', style: 'font-size:12px; cursor:pointer;' }, _('Create hard link'))
				])
			]),
			E('div', { class: 'right' }, [
				E('button', { class: 'btn', click: hideModal }, _('Cancel')),
				' ',
				E('button', {
					class: 'btn cbi-button-positive important',
					click: ui.createHandlerFn(this, () => {
						const finalPath = linkPath.trim();
						if (!finalPath)
							return this.showNotification(_('Please enter a valid target path'), 3000, 'error');

						hideModal();
						const args = isHardLink ? [path, finalPath] : ['-s', path, finalPath];
						fs.exec('/bin/ln', args).then(r => {
							if (r.code !== 0) throw new Error(r.stderr);
							this.reload();
							this.showNotification(_('Link "%s" created successfully').format(finalPath), '', 'success');
						}).catch(e =>
							this.showNotification(_('Failed to create link: %s').format(e.message || e), 5000, 'error'));
					})
				}, _('Apply'))
			])
		]);

		requestAnimationFrame(() => {
			ui.addValidator(pathInput, 'string', false, function (value) {
				const result = this.parsePath(value.trim());
				if (!result.valid)
					return result.error ? _(result.error) : _('Invalid path format');

				return true;
			}.bind(this), 'blur', 'keyup');
			this.Draggable();
		});
	},

	downloadFile: function (files) {
		const isBatch = Array.isArray(files);

		if (!isBatch && !files.isDir) {
			const path = files.isLink
				? this.parseLinkString(files.path)?.targetPath
				: files.path;
			return this.startDownload(path, files.name);
		};

		const defaultName = isBatch ? 'files-' + Date.now() : (files.name || 'archive');
		let nameInput = '';

		L.showModal(isBatch ? _('Batch Download') : _('Download Directory'), [
			E('div', { class: 'modal-custom-path' },
				isBatch ? _('Number of files: %d').format(files.length) : _('Source: %s').format(files.path)
			),
			E('div', { class: 'modal-custom-row' }, [
				E('label', { class: 'modal-custom-label' }, _('Filename')),
				E('input', {
					id: 'pack-name', class: 'cbi-input-text',
					type: 'text', style: 'flex:1',
					value: defaultName + '.tar.gz',
					input: (ev) => nameInput = ev.target.value
				}),
			]),
			E('div', { class: 'right' }, [
				E('button', { class: 'btn', click: hideModal }, _('Cancel')),
				' ',
				E('button', {
					class: 'btn cbi-button-positive important',
					click: ui.createHandlerFn(this, () => {
						let name = (nameInput || (defaultName + '.tar.gz')).replace(/[\/\\:*?"<>|]/g, '_').trim();
						if (!name.endsWith('.tar.gz')) name += '.tar.gz';

						const out = `/tmp/${name}`;
						hideModal();
						this.showNotification(_('Packaging... please wait'), 0, 'info');

						const args = (isBatch ? files : [files])
							.map(({ path }) => `"${path.replace(/^\//, '').replace(/"/g, '\\"')}"`)
							.join(' ');

						fs.exec('/bin/sh', ['-c', `tar -czf "${out}" -C / -- ${args}`])
							.then(r => {
								if (r.code !== 0) throw new Error(r.stderr);
								return this.startDownload(out, name);
							})
							.then(() => {
								this.clearSelectedFiles();
								setTimeout(() => fs.remove(out).catch(() => {}), 30000);
							})
							.catch(e => this.showNotification(_('Download failed: %s').format(e.message), 5000, 'error'));
					})
				}, isBatch ? _('Package and Download') : _('Download'))
			])
		]);

		requestAnimationFrame(() => {
			const input = document.getElementById('pack-name');
			if (input) {
				input.focus();
				const baseLen = input.value.replace(/\.tar\.gz$/i, '').length;
				input.setSelectionRange(0, baseLen);
			}
			this.Draggable();
		});
	},

	startDownload: function (path, name) {
		return fs.read_direct(path, 'blob').then((blob) => {
			const url = window.URL.createObjectURL(blob);
			const a = E('a', { href: url, download: name, style: 'display:none' });
			document.body.appendChild(a);
			a.click();
			document.body.removeChild(a);
			setTimeout(() => window.URL.revokeObjectURL(url), 100);
			this.showNotification(_('Download started: %s').format(name), 2000, 'success');
		}).catch((err) => {
			this.showNotification(_('Read failed: %s').format(err.message), 5000, 'error');
		});
	},

	Upload: function () {
		const tmpPath = '/tmp/luci-upload-' + Math.random().toString(36).substring(2, 9);
		ui.uploadFile(tmpPath)
			.then(reply => {
				const destPath = `${this._path}/${reply.name}`.replace(/\/+/g, '/');
				return fs.exec('/bin/mv', [tmpPath, destPath]).then(res => {
					if (res.code !== 0) throw new Error(res.stderr);
					this.reload();
					this.modalnotify(_('Successfully uploaded: %s').format(reply.name), '', 'success');
				});
			})
			.catch(e => {
				if (e && e.message !== 'Upload has been cancelled')
					this.modalnotify(_('Upload failed: %s').format(e.message || e), 5000, 'error');
			})
			.finally(() => {
				fs.remove(tmpPath).catch(() => {});
			});
	},

	detectFileMode: function (filename, content) {
		const name = filename.toLowerCase();
		const ext = name.includes('.') ? name.split('.').pop() : '';
		const extMap = {
			js: 'javascript', json: 'json', html: 'html', htm: 'html',
			css: 'css', xml: 'xml', py: 'python', sh: 'sh', bash: 'sh',
			php: 'php', lua: 'lua', pl: 'perl', rb: 'ruby', md: 'markdown',
			yaml: 'yaml', yml: 'yaml', uc: 'javascript', ut: 'javascript',
			ts: 'javascript', toml: 'toml', svg: 'html',
			config: 'sh', mk: 'makefile', Makefile: 'makefile'
		};

		if (extMap[ext]) return extMap[ext];
		if (name === 'makefile') return 'makefile';

		const trimmed = (content || '').trim();
		const firstLine = trimmed.split('\n')[0] || '';
		const byShebang = this.detectByShebang(firstLine);
		if (byShebang) return byShebang;

		if (trimmed) {
			if (trimmed[0] === '{' || trimmed[0] === '[') {
				try { JSON.parse(trimmed); return 'json'; } catch (e) {}
			}

			if (/^\s*<\?xml\b/i.test(trimmed)) return 'xml';
			if (/<html\b/i.test(trimmed) || /<!doctype\s+html/i.test(trimmed)) return 'html';

			if (trimmed[0] === '#') {
				if (trimmed.includes(':') && !trimmed.includes('=')) return 'yaml';
				return 'sh';
			}
		}
		return 'text';
	},

	detectByShebang: function (firstLine) {
		if (!firstLine || !firstLine.startsWith('#!'))
			return null;

		const s = firstLine.toLowerCase();
		const patterns = [
			{ re: /\/lua\b/, mode: 'lua' },
			{ re: /(ba)?sh\b|busybox\b/, mode: 'sh' },
			{ re: /node\b|ucode\b/, mode: 'javascript' },
			{ re: /python\d?(\.\d+)?\b/, mode: 'python' },
			{ re: /perl\b/, mode: 'perl' },
			{ re: /ruby\b/, mode: 'ruby' },
			{ re: /php\b/, mode: 'php' },
			{ re: /[zkp]sh\b/, mode: 'sh' },
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
				_('%d files selected').format(selectedCount),
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
		if (window._aceReady) return Promise.resolve(true);
		if (window._acePromise) return window._acePromise;

		return window._acePromise = new Promise(resolve => {
			if (window.ace?.edit) {
				window._aceReady = true;
				return resolve(true);
			}

			const version = '1.43.3';
			const cdns = [
				`https://lib.baomitu.com/ace/${version}/ace.min.js?v=${version}`,
				`https://cdn.bootcdn.net/ajax/libs/ace/${version}/ace.min.js?v=${version}`,
				`https://cdn.jsdelivr.net/npm/ace-builds@${version}/src-min-noconflict/ace.min.js?v=${version}`,
				`https://cdnjs.cloudflare.com/ajax/libs/ace/${version}/ace.min.js?v=${version}`,
			];

			let i = 0;
			const load = () => {
				if (i >= cdns.length) {
					window._acePromise = null;
					window._aceReady = false;
					return resolve(false);
				}

				const s = document.createElement('script');
				const currentSrc = cdns[i++];
				s.src = currentSrc;

				s.onload = () => {
					const aceObj = window.ace;
					if (aceObj && aceObj.edit) {
						const path = currentSrc.substring(0, currentSrc.lastIndexOf('/'));
						const cleanPath = path.replace(/\/$/, '');

						aceObj.config.set('basePath', cleanPath);
						aceObj.config.set('modePath', cleanPath);
						aceObj.config.set('themePath', cleanPath);
						aceObj.config.set('workerPath', cleanPath);

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
		if (this._menu)
			this._menu.remove();
		if (this._contextMenuHandler) {
			document.removeEventListener('click', this._contextMenuHandler);
			this._contextMenuHandler = null;
		}
	},

	initAceEditor: function (options = {}) {
		const defaults = {
			content: '',
			mode: 'text',
			containerId: '',
			saveBtn: null,
			editable: false,
			syntaxid: null,
			editCheckbox: null,
			wrapCheckbox: null,
			changeIndicator: null,
			originalContent: undefined
		};

		const config = Object.assign({}, defaults, options);

		return new Promise((resolve, reject) => {
			const init = () => {
				const el = document.getElementById(config.containerId);
				if (!el || !el.offsetHeight)
					return requestAnimationFrame(init);

				try {
					const editor = ace.edit(el);
					el.env = { editor };
					editor.setOptions({
						fontSize: 14,
						showPrintMargin: false,
						highlightActiveLine: true,
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

					if (config.syntaxid) {
						const sel = document.getElementById(config.syntaxid);
						if (sel && config.mode) sel.value = config.mode;
					};

					if (config.changeIndicator || config.saveBtn) {
						editor.session.on('change', () => {
							const isDirty = editor.getValue() !== config.originalContent;

							if (config.changeIndicator)
								config.changeIndicator.style.display = isDirty ? 'inline' : 'none';

							if (config.saveBtn)
								config.saveBtn.style.display = isDirty ? 'block' : 'none';
						});
					}

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

					if (config.editCheckbox) {
						config.editCheckbox.addEventListener('change', () => {
							editor.setOption('readOnly', !config.editCheckbox.checked);
						});
					}
					resolve(editor);
				} catch (err) {
					reject(err);
				}
			};
			requestAnimationFrame(init);
		});
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
		if (!text) return;

		try {
			const textarea = E('textarea', {
				style: 'position:fixed;top:0;left:0;opacity:0;z-index:-1;pointer-events:none;'
			}, text);

			document.body.appendChild(textarea);
			textarea.select();
			const successful = document.execCommand('copy');
			document.body.removeChild(textarea);

			if (successful)
				return this.showNotification(_('Copied to clipboard!'), '', 'success');
			throw new Error('execCommand failed');
		} catch (err) {
			this.showNotification(_('Copy failed!'), 5000, 'error');
		}
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

	showNotification: function (message, timeout, type = 'info') {
		const existing = document.querySelector('.file-notification');
		if (existing) existing.remove();

		const colors = { success: '#4CAF50', error: '#F44336', warning: '#FF9800', info: '#2196F3' };
		const notification = E('div', {
			class: 'file-notification',
			style: `
            position: fixed; top: 20px; right: 20px; z-index: 20000;
            padding: 12px 24px; border-radius: 4px; color: white;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            cursor: pointer; font-weight: 500;
            background: ${colors[type] || colors.info};
            opacity: 0; transform: translateX(30px);
            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        `, click: ui.createHandlerFn(this, ev => {
				ev.target.style.opacity = '0';
				setTimeout(() => ev.target.remove(), 300);
			})
		}, message);

		document.body.appendChild(notification);

		requestAnimationFrame(() => {
			requestAnimationFrame(() => {
				notification.style.opacity = '1';
				notification.style.transform = 'translateX(0)';
			});
		});

		const duration = (typeof timeout === 'number' && timeout > 0) ? timeout : 3000;
		setTimeout(() => {
			if (notification && notification.parentNode) {
				notification.style.opacity = '0';
				notification.style.transform = 'translateX(30px)';
				notification.addEventListener('transitionend', () => notification.remove(), { once: true });
			}
		}, duration);
	},

	Draggable: function () {
		const modal = document.querySelector('#modal_overlay .modal');
		if (!modal || modal.dataset.draggable === 'true') return;

		const rect = modal.getBoundingClientRect();
		modal.style.position = 'fixed';
		modal.style.margin = '0';
		modal.style.top = rect.top + 'px';
		modal.style.left = rect.left + 'px';
		modal.style.transform = 'none';
		modal.dataset.draggable = 'true';

		const dragArea = modal.querySelector('h4');
		if (!dragArea) return;

		dragArea.style.cursor = 'move';
		dragArea.style.userSelect = 'none';

		let dragData = null;
		let ticking = false;

		const onMouseMove = (e) => {
			if (!dragData) return;

			if (!ticking) {
				requestAnimationFrame(() => {
					if (!dragData) return;

					let newTop = dragData.startTop + e.clientY - dragData.startY;
					let newLeft = dragData.startLeft + e.clientX - dragData.startX;
					const viewW = window.innerWidth;
					const viewH = window.innerHeight;
					const modalW = modal.offsetWidth;
					const modalH = modal.offsetHeight;
					const headerH = dragArea.offsetHeight;
					newTop = Math.max(0, newTop);
					newTop = Math.min(newTop, viewH - headerH);

					const visibleEdge = 40;
					newLeft = Math.max(visibleEdge - modalW, Math.min(newLeft, viewW - visibleEdge));

					modal.style.top = newTop + 'px';
					modal.style.left = newLeft + 'px';

					ticking = false;
				});
				ticking = true;
			}
		};

		const onMouseUp = () => {
			dragData = null;
			modal.classList.remove('dragging');
			document.removeEventListener('mouseup', onMouseUp);
			document.removeEventListener('mousemove', onMouseMove);
		};

		dragArea.addEventListener('mousedown', (e) => {
			if (e.button !== 0 || e.target.tagName === 'BUTTON') return;

			dragData = {
				startX: e.clientX,
				startY: e.clientY,
				startTop: parseFloat(modal.style.top),
				startLeft: parseFloat(modal.style.left)
			};

			modal.classList.add('dragging');
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
