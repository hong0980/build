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
	.item::after, .btn, .cbi-button{
	    line-height: 1.6em;
	}
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
	[777, _('777 - Full access for owner, group, and others (read, write, execute)')],
	[755, _('755 - Full access for owner; read and execute for group and others')],
	[700, _('700 - Full access for owner only')],
	[666, _('666 - Read and write for owner, group, and others (no execute)')],
	[644, _('644 - Read and write for owner; read-only for group and others')],
	[600, _('600 - Read and write for owner only')],
	[555, _('555 - Read and execute for owner, group, and others (no write)')],
	[444, _('444 - Read-only for owner, group, and others')]
];

const themes = [
	["monokai", "Monokai"], ["dracula", "Dracula"], ["one_dark", "One Dark"], ["github", "GitHub"],
	["github_dark", "GitHub Dark"], ["solarized_light", "Solarized Light"],
	["solarized_dark", "Solarized Dark"], ["tomorrow", "Tomorrow"],
	["tomorrow_night", "Tomorrow Night"], ["terminal", "Terminal"]
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
			history.replaceState({
				path, data: { path, files }
			}, '', '#' + path);

			return { path, files };
		}).catch(() => ({ path, files: [] }));
	},

	render: function (data) {
		if (!this._popBound) {
			this._popBound = true;

			window.addEventListener('popstate', e => {
				if (e.state && e.state.data) {
					this._path = e.state.path;
					this.render(e.state.data);
				}
			});
		};
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

			const btn = E('div', [
				!f.isDir ? E('button', {
					class: 'btn cbi-button-edit',
					click: ui.createHandlerFn(this, 'showFileEditor', f, false)
				}, _('open file')) : '',
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
						_('%d items • Total %s').format(files.length, this.formatSizeHuman(totalSize))),
					E('button', {
						class: 'btn cbi-button-positive',
						click: ui.createHandlerFn(this, 'reload', this._path)
					}, _('Reload page'))
				])
			]),
			E('div', { class: 'batch-action-bar' }, [
				E('div', { style: 'display:flex;align-items:center;gap:8px;' }, [
					E('button', {
						class: 'btn cbi-button-remove',
						click: ui.createHandlerFn(this, () => this.deleteFile(this.getSelectedFiles()))
					}, [_('Batch delete'), E('span', { id: 'delete-count' })]),
					E('button', {
						class: 'btn cbi-button-action',
						click: ui.createHandlerFn(this, () => this.downloadFile(this.getSelectedFiles()))
					}, [_('Batch download'), E('span', { id: 'download-count' })]),
					E('button', {
						class: 'btn cbi-button-remove',
						click: ui.createHandlerFn(this, 'clearSelectedFiles')
					}, _('Deselect'))
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
			[_('Create file (directory)'), () => this.createnew()],
			!file.isDir && [_('Edit file'), () => this.showFileEditor(file, true)],
			[_('Rename'), () => this.renameFile(file.path)],
			!file.isLink && [_('Create link'), () => this.createLink(file)],
			[_('Modify permissions'), () => this.chmodFile(file)],
			[_('Delete file'), () => this.deleteFile(file)],
			[_('download file'), () => this.downloadFile(file)],
			[_('upload file'), ev => this.Upload(ev)],
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
		}

		const modal = L.showModal(null, [
			E('p', editable ? _('Loading file for editing...') : _('Loading file content...')),
			E('div', { class: 'spinner' }),
			E('div', { class: 'right', style: 'flex:1' }, [
				E('button', { class: 'btn', click: L.hideModal }, _('Cancel'))
			])
		]);

		let path = file.isLink
			? (this.parseLinkString(file.path)?.targetPath || file.path)
			: file.path;
		path = path.startsWith('/') ? path : '/' + path;

		fs.stat(path).then(r => {
			if (r.size === 0) {
				throw new Error(_('The file is empty.'));
			} else if (r.type === 'file') {
				return fs.read_direct(path).then(content => {
					if (content.indexOf('\0') !== -1)
						throw new Error(_('This is a binary file and %s').format(action));

					L.hideModal();
					window._aceReady
						? this.showAceEditor(file, content, editable)
						: this.showSimpleEditor(file, content, editable);
				})
			} else if (r.type === 'directory') {
				L.hideModal();
				this.reload(path);
			} else throw new Error(_('Unknown file type'));
		}).catch((e) =>
			this.modalnotify(null, E('p', _('Failed to read file: %s').format(e.message || e)), '', 'error'));
	},

	showAceEditor: function (file, content, editable) {
		const originalContent = content;
		const containerId = 'ace-' + Date.now();
		const syntaxid = 'syntax-' + Date.now();
		let hasUnsavedChanges = false, editor = null;
		const mode = this.detectFileMode(file.name, content);
		const container = E('div', { id: containerId, style: 'width:100%;height:350px;border:1px solid #ccc;' });
		const changeIndicator = E('span', {
			style: 'display:none;cursor:pointer;color:#e74c3c;font-size:22px;',
			title: _('The document has been modified, click to undo all'),
			click: ui.createHandlerFn(this, () => editor && editor.setValue(originalContent, -1))
		}, '●');

		const saveBtn = E('button', {
			class: 'btn cbi-button-positive important',
			style: `display:${editable ? 'block' : 'none'};`,
			click: ui.createHandlerFn(this, () => {
				if (!editor) return;
				const val = editor.getValue();
				if (val === originalContent)
					return this.modalnotify(null, E('p', _('The file content has not changed')), 3000);

				fs.write(file.path, val).then(() => {
					L.hideModal();
					this.showNotification(_('%s File saved successfully!').format(file.path), 3000, 'success');
					this.reload(this._path);
				});
			})
		}, _('Save'));

		const btnFull = E('button', {
			class: 'btn', click: toggleFullscreen,
			style: 'padding: 0 8px; margin-left:auto;'
		}, _('full screen'));

		const btnExit = E('button', {
			click: toggleFullscreen, class: 'btn',
			style: 'display:none;margin-left:auto;'
		}, _('Exit full screen'));

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
					checked: !!editable || undefined,
					type: 'checkbox', id: 'editCheckbox',
					change: ui.createHandlerFn(this, ev => {
						if (!editor) return;
						const val = ev.target.checked;
						editor.setReadOnly(!val);
						saveBtn.style.display = val ? 'block' : 'none';
						changeIndicator.style.display =
							(hasUnsavedChanges && val) ? 'inline' : 'none';
						const modalTitle = document.querySelector('.modal h4');
						if (modalTitle) {
							modalTitle.textContent = (val ? _('Edit') : _('View')) + ': ' + file.name;
						}
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
			E('style', ['.modal{padding:.3em;h4{text-align:center;color:red;}}']),
			E('p', { style: 'padding:8px;background:#f0f0f0;font-size:12px;' }, [
				E('span', {}, _('Ace Editor version: %s').format(ace.version)),
				E('span', { style: 'margin:0 12px;color:#666;' }, '|'),
				E('span', {}, _('Size: %s').format(file.size)),
				E('span', { style: 'margin:0 12px;color:#666;' }, '|'),
				E('span', {}, _('Lines: %d').format(content.split('\n').length)),
				E('span', { style: 'margin:0 12px;color:#666;' }, '|'),
				E('span', {}, _('Path: %s').format(file.path))
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

	showSimpleEditor: function (file, content, editable) {
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
			E('span', {}, _('Path: %s').format(file.path))
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
					return this.modalnotify(null, E('p', _('The file content has not changed')), 3000);
				fs.write(file.path, newContent)
					.then(() => {
						L.hideModal();
						this.showNotification(_('%s File saved successfully!').format(file.path), 3000, 'success');
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
			E('span', _('file permissions')),
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
						placeholder: _('Enter text here'),
						class: 'cbi-input-text', type: 'text',
						style: 'width:100%;height:250px;font-family:Consolas;',
						change: ui.createHandlerFn(this, ev => fileContent = ev.target.value)
					}),
				])
		]);

		const pathInput = E('input', {
			title: _('Can create files (directories) in the current (absolute path) directory'),
			class: 'cbi-input-text', style: 'width:150px;', placeholder: '/tmp/c.txt', type: 'text',
			change: ui.createHandlerFn(this, ev => {
				result = this.parsePath(ev.target.value.trim());
				modeid = document.getElementById(syntaxid);
				if (result.valid && result.file) {
					mode = this.detectFileMode(result.file, null);
					if (editor && mode) {
						editor.session.setMode(`ace/mode/${mode}`);
						if (modeid) modeid.value = mode;
					}
				};
			})
		});

		L.showModal(_('Create file (directory)'), [
			E('style', ['h4 {text-align:center;color:red;}']),
			E('div', [
				E('div', { style: 'display:flex;align-items:center;gap:8px;' }, [
					E('span', _('Name')), pathInput,
					E('span', _('Directory permissions')),
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
					E('label', { for: 'createFileCheckbox' }, _('Create files simultaneously'))
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
										return this.modalnotify(null, E('p', _('Directory %s creation failed: %s').format(fullDir, res.stderr)), '', 'error');
									this.reload(this._path);
									this.showNotification(_('Directory %s created successfully').format(fullDir), 3000, 'success');
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
							this.showNotification(_('Created successfully: %s').format(fullFile), 3000, 'success');
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
					return result.error ? _(result.error) : _('Invalid path format');
				return true;
			}.bind(this), 'blur', 'keyup');
			this.Draggable();
		});
	},

	parsePath: function (path) {
		path = path.trim();

		if (!/^[A-Za-z0-9._\/-]+$/.test(path))
			return { valid: false, error: _('Path contains illegal characters') };

		if (path.split('/').includes('..'))
			return { valid: false, error: _('Path contains illegal segment (..)') };

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
				E('label', { style: 'min-width:60px;' }, _('newname')),
				E('input', {
					class: 'cbi-input-text', value: oldname,
					id: 'nameinput', style: 'width:100%', type: 'text',
					change: ui.createHandlerFn(this, ev => newname = ev.target.value.trim())
				}),
			]),
			E('div', { class: 'button-row' }, [
				E('button', {
					class: 'btn cbi-button-positive',
					click: ui.createHandlerFn(this, () => {
						if (!newname || newname === oldname)
							return this.modalnotify(null, E('p', _('Please enter a new name')), 3000);
						L.hideModal();
						fs.exec('/bin/mv', [path, path.replace(/[^/]+$/, newname)]).then(r => {
							if (r.code !== 0)
								return this.modalnotify(null, E('p', _('Rename failed: %s').format(r.stderr)), '', 'error');
							this.reload(this._path);
							this.showNotification(_('Renamed: %s to %s').format(path, newname), 3000, 'success');
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
				E('label', { style: 'min-width:60px;' }, _('Permission')),
				E('select', {
					style: 'width:100%;',
					change: ui.createHandlerFn(this, ev => n = ev.target.value)
				}, permissions.map(([id, name]) =>
					E('option', { value: id, selected: id === Number(file.permissionNum) || undefined }, name)
				))
			]),
			E('div', { class: 'button-row' }, [
				E('button', {
					class: 'btn cbi-button-positive',
					click: ui.createHandlerFn(this, () => {
						if (!n) return this.modalnotify(null, E('p', _('Please select a new value')), 3000);
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

		L.showModal(_('confirm deletion'), [
			E('style', ['h4 {text-align:center;color:red;}']),
			E('p', { style: 'text-align:center;' },
				files.length === 1
					? _('Confirm %s').format(files[0].name)
					: _('Confirm %d files?').format(files.length)
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
				E('label', { style: 'min-width:60px;' }, _('Create link')),
				pathInput,
				E('div', { style: 'display:flex;align-items:center;gap:8px;' }, [
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

		const focusAndSelectBase = () => {
			const input = document.getElementById('pack-name');
			if (!input) return;

			const baseLen = input.value.replace(/\.tar\.gz$/i, '').length;
			input.focus();
			input.setSelectionRange(0, baseLen);
		};
		let nameInput = '';
		const defaultName = isBatch ? 'files-' + Date.now() : (files.name || ('dir-' + Date.now()));

		L.showModal(isBatch ? _('Batch download') : _('Download catalog'), [
			E('style', ['h4 {text-align:center;}']),
			E('p', isBatch ? _('Number of files: %d').format(files.length) : _('Directory: %s').format(files.name)),
			E('p', { style: 'display:flex;align-items:center;gap:10px;' }, [
				E('label', isBatch ? _('Compressed package file name') : _('file name')),
				E('input', {
					id: 'pack-name', class: 'cbi-input-text',
					type: 'text', value: defaultName + '.tar.gz',
					input: ui.createHandlerFn(this, (ev) => nameInput = ev.target.value)
				}),
			]),
			E('div', { class: 'button-row' }, [
				E('button', {
					class: 'btn cbi-button-positive',
					click: ui.createHandlerFn(this, () => {
						L.hideModal();
						let name = this.sanitizeFilename(nameInput || defaultName);
						name = name.toLowerCase().endsWith('.tar.gz') ? name : name + '.tar.gz';
						const relPaths = files.map(f => f.path.replace(/^\//, ''));
						const args = relPaths.map(p => `"${p}"`).join(' ');
						const out = `/tmp/${name}`;

						fs.exec('/bin/sh', ['-c', `tar -czf "${out}" -C / ${args}`])
							.then(() => this.startDownload(out, name))
							.then(() => this.clearSelectedFiles())
							.catch(e => this.showNotification(_('Packaging failed: %s').format(e.message), 5000, 'error'))
							.finally(() => fs.remove(out).catch(() => {}));
					})
				}, isBatch ? _('Package download') : _('download')),
				E('button', { class: 'btn', click: L.hideModal }, _('Cancel'))
			])
		]);
		focusAndSelectBase();
	},

	startDownload: function (path, name) {
		fs.read_direct(path, 'blob').then((blob) => {
			const url = window.URL.createObjectURL(blob);
			let a = document.createElement('a');
			a.style.display = 'none';
			a.href = url;
			a.download = name;
			document.body.appendChild(a);
			a.click();
			window.URL.revokeObjectURL(url);
		}).catch((err) => {
			alert(_('Download failed: %s').format(err.message));
		});
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
