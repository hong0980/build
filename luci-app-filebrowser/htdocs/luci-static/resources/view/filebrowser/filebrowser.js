'use strict';
'require fs';
'require ui';
'require dom';
'require view';
'require request';

const CSS = `
.modal > h4 {
	text-align:center;
	color:red;
	cursor:move;
	userSelect:none;
}
.file-name-cell:hover {
	background: #f5f7fa;
}
tr.selected {
	background-color: #e4efffff;
}
.table .td .btn {
	line-height: 1.6em;
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
	z-index: 1000; /* 层级索引 */
	background: #fff; /* 背景色白色 */
	border: 1px solid #ccc; /* 边框：1像素实线灰色 */
	border-radius: 5px; /* 边框圆角8像素 */
	padding: 5px; /* 内边距5像素 */
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
	padding-top: 9px;
}
.modal-custom-label {
	font-weight: bold;
	min-width: 60px;
	color: #555;
}
.modal-custom-path {
	padding:8px;
	background:#f0f0f0;
	font-size: 0.9em;
	text-align: center;
}

.fb-container {
	display: flex;
	align-items: center;
	gap: 8px;
	padding:0 0 8px;
	transition: all 0.3s ease;
}
.fb-container.floating {
	position:fixed;
	border: 1px solid #ccc;
	padding: 4px;
	background: #f0f0f0;
	border-radius: 5px;
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
	styleInjected: false,
	load: function (p = null, useCache = false) {
		this._cache = this._cache || new Map();

		const TTL = 300000;
		for (const [k, v] of this._cache) {
			if (v.data && Date.now() - v.time > TTL) this._cache.delete(k);
		};

		const path = (typeof p === 'string' ? p : (location.hash.slice(1) || '/'))
			.replace(/\/+/g, '/').replace(/(.+)\/$/, '$1');

		if (useCache && this._cache.has(path))
			return this._cache.get(path).promise;

		const promise = fs.exec_direct('/bin/ls', ['-Ah', '--full-time', path])
			.then(out => {
				const data = { path, files: this.parseLsOutput(path, out) };
				this._cache.set(path, { time: Date.now(), data, promise: Promise.resolve(data) });
				return data;
			})
			.catch(err => {
				this._cache.delete(path);
				throw err;
			});

		this._cache.set(path, { time: Date.now(), data: null, promise });
		this._isMobile = ('ontouchstart' in window && window.innerWidth <= 768)
			|| /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
		return promise;
	},

	render: function (data) {
		if (!this.styleInjected) {
			document.head.appendChild(E('style', { id: 'fb-css' }, CSS));
			this.styleInjected = true;
		}
		if (!window._popBound) {
			window._popBound = true;
			window.addEventListener('popstate', e => {
				const path = e.state?.path || location.hash.slice(1) || '/';
				if (e.state?.data && Date.now() - (e.state.timestamp || 0) < 300000) {
					this.render(e.state.data);
				} else {
					this.load(path, true).then(d => this.render(d));
				}
			});
		};
		if (!history.state || history.state.path !== data.path) {
			history.pushState({
				path: data.path, data: data, timestamp: Date.now()
			}, '', '#' + data.path);
		};

		this._path = data.path;
		const root = this._root || (this._root = E('div'));
		root.innerHTML = '';

		this.currentFiles = data.files || [];
		const files = this.currentFiles;
		const parts = data.path.split('/').filter(Boolean);
		let path = '';

		const crumbs = E('div', [
			E('a', {
				href: '#',
				click: ui.createHandlerFn(this, 'reload', '/')
			}, E('em', _('(root)')))
		]);

		parts.forEach(p => {
			path += '/' + p;
			dom.append(crumbs, [
				E('span', ' / '),
				E('a', {
					href: '#',
					click: ui.createHandlerFn(this, 'reload', path)
				}, p)
			]);
		});

		const totalSize = files.reduce((s, f) =>
			(!f.isDir && !f.linkName) ? s + this.parseSizeToBytes(f.size) : s, 0);

		const table = new ui.Table(
			[_('Name'), _('owner'), _('Size'), _('Change the time'), _('Rights'), _('')],
			{ sortable: true, classes: 'cbi-section-table' },
			E('em', _('No files found'))
		);

		table.update(files.map(f => {
			const icon = f.isDir ? '📂' : (f.linkName ? '🔗' : '📄');
			const nameText = f.name.length > 18
				? `${f.name.slice(0, 11)}...${f.name.slice(-7)}`
				: f.name;

			const nameCell = E('div', { class: 'file-checkbox' }, [
				E('input', {
					type: 'checkbox', 'data-path': f.path,
					change: ev => {
						const row = ev.target.closest('tr');
						if (row) {
							row.classList.toggle('selected', ev.target.checked);
							this.toggleBatchBar();
						}
					}
				}),
				E('div', {
					class: 'file-name-cell', style: 'flex:1',
					contextmenu: ui.createHandlerFn(this, ev => this.showContextMenu(ev, f))
				}, [
					E('span', {
						title: f.name,
						style: `${f.isDir ? 'color:#0066cc;' : ''}cursor:pointer;`,
						click: ui.createHandlerFn(this, f.isDir ? 'reload' : 'showFileEditor', f, false)
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
			E('h2', _('File management')),
			E('div', { style: 'display:flex;justify-content:space-between;align-items:center;padding:8px 0 8px;' }, [
				crumbs,
				E('span', { style: 'color:#666;font-size:12px;' },
					_('%d items • Total %s').format(files.length, this.formatSizeHuman(totalSize))),
			]),
			E('div', { class: "fb-container" }, [
				E('button', {
					class: "btn cbi-button-save", id: 'createnew',
					click: ui.createHandlerFn(this, 'createnew')
				}, _('Create')),
				// E('button', { class: "btn cbi-button-action important", click: ui.createHandlerFn(this, 'Upload') }, _('Upload')),
				E('input', { id: 'current-path', style: 'width:100%', value: this._path }),
				E('button', {
					class: "btn cbi-button cbi-button-apply",
					click: ui.createHandlerFn(this, () => {
						const path = document.getElementById("current-path").value
							.trim().replace(/\/+/g, '/').replace(/(.+)\/$/, '$1');
						if (!path || path === this._path) return;

						return fs.stat(path)
							.then(r => {
								if (r.type !== 'directory') throw new Error(_('Not a directory'));
								return this.reload(r.path)
							})
							.catch(e => this.showNotification(_('%s: %s').format(path, e.message), 6000, 'error'));
					})
				}, _('Go to')),
				this._path === '/'
					? ''
					: E('button', {
						class: "btn cbi-button-apply",
						click: ui.createHandlerFn(this, () => {
							return this.reload(this._path.replace(/\/[^\/]+\/?$/, '') || '/');
						})
					}, _('Back'))
			]),
			E('div', { class: 'batch-action-bar' }, [
				E('div', { class: 'inline-form-group' }, [
					E('button', {
						class: 'btn cbi-button-remove',
						click: ui.createHandlerFn(this, () => this.deleteFile(this.manageFiles('get')))
					}, [_('Batch delete'), E('span', { id: 'delete-count' })]),
					E('button', {
						class: 'btn cbi-button-action',
						click: ui.createHandlerFn(this, () => this.downloadFile(this.manageFiles('get')))
					}, [_('Batch Download'), E('span', { id: 'download-count' })]),
					E('button', {
						class: 'btn cbi-button-remove',
						click: ui.createHandlerFn(this, 'manageFiles', 'clear')
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
			};
		};

		function fixFloat() {
			const header = document.querySelector('header');
			const container = root.querySelector('.fb-container');
			const createnew = document.getElementById('createnew');
			if (!container || !header) return;

			const navH = header.offsetHeight || 0;
			const offset = container.offsetTop;
			const headerZIndex = parseInt(getComputedStyle(header).zIndex, 10) || 799;

			const check = () => {
				if (window.scrollY > offset - navH) {
					if (this._isMobile)
						createnew.style.display = 'none';

					container.style.cssText = `top:${navH}px;width:${root.offsetWidth}px;z-index:${headerZIndex - 1}`;
					container.classList.add('floating');
				} else {
					createnew.style.display = 'block';
					container.style.cssText = '';
					container.classList.remove('floating');
				};
			};

			['scroll', 'resize'].forEach(e =>
				window.addEventListener(e, e === 'resize'
					? () => setTimeout(check, 100) : check
				)
			);

			check();
		};

		setTimeout(L.bind(fixFloat, this), 100);
		return root;
	},

	reload: function (p) {
		const path = (typeof p === 'string' ? p : p?.path) || this._path;
		return this.load(path).then(d => this.render(d));
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
			!file.linkName && [_('Create link'), () => this.createLink(file.path)],
			[_('Delete file'), () => this.deleteFile(file)],
			[_('download file'), () => this.downloadFile(file)],
			[_('upload file'), ev => this.Upload()]
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

		let path = file.linkTarget || file.path;
		return fs.stat(path).then(r => {
			if (r.type === 'file') {
				return fs.read_direct(path).then(content => {
					if (content.indexOf('\0') !== -1)
						throw new Error(_('This is a binary file and %s').format(action));

					window._aceReady
						? this.showAceEditor(file, content, editable)
						: this.showSimpleEditor(file, content, editable);
				})
			} else if (r.type === 'directory') {
				this.reload(path);
			} else throw new Error(_('Unknown file type'));
		}).catch((e) =>
			this.showNotification(_('Failed to read file: %s').format(e.message), 8000, 'error'));
	},

	showAceEditor: function (file, content, editable) {
		let editor = null;
		const originalContent = content;
		const containerId = 'ace-' + Date.now();
		const syntaxid = 'syntax-' + Date.now();
		const path = file.linkTarget || file.path;
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
			change: ev => {
				if (!editor) return;
				document.querySelector('.modal h4')
					.textContent = ev.target.checked ? _('edit mode') : _('view mode');
			}
		});
		const saveBtn = E('button', {
			style: 'display:none;',
			class: 'btn cbi-button-positive important',
			click: ui.createHandlerFn(this, () => {
				if (!editor) return;
				const val = editor.getValue();
				fs.write(path, val)
					.then(() => {
						this.showNotification(_('%s File saved successfully!').format(path), '', 'success');
						this.reload();
					})
					.catch(error => this.modalnotify(null, E('p', _('Save failed: %s').format(error.message || error)), '', 'warning'))
					.finally(() => ui.hideModal());
			})
		}, _('Save'));
		const btnFull = E('button', { class: 'btn', style: 'padding: 0 8px;margin-left:auto;' }, _('full screen'));
		const btnExit = E('button', { class: 'btn', style: 'display:none;margin-left:auto;' }, _('Exit full screen'));
		const toolbar = E('div', { class: 'ace-toolbar' }, [
			E('div', { class: 'inline-form-group' }, [
				E('span', _('Syntax')),
				E('select', {
					id: syntaxid, class: 'ace-toolbar-select',
					change: ev => editor && editor.session.setMode('ace/mode/' + ev.target.value)
				}, modes.map(([id, name]) => E('option', { value: id, selected: id === mode || undefined }, name))),
				E('span', _('Theme')),
				E('select', {
					class: 'ace-toolbar-select',
					change: ev => editor && editor.setTheme('ace/theme/' + ev.target.value)
				}, themes.map(([id, name]) =>
					E('option', { value: id, selected: id === 'monokai' || undefined }, name))
				),
				E('span', _('Font')),
				E('select', {
					class: 'ace-toolbar-select',
					change: ev => editor && editor.setFontSize(ev.target.value + 'px')
				}, ['12', '13', '14', '15', '16'].map(id =>
					E('option', { value: id, selected: id === '14' || undefined }, id + 'px')
				)),
				wrapCheckbox, E('label', { for: 'wrapCheckbox' }, _('wrap')),
				editCheckbox, E('label', { for: 'editCheckbox' }, _('Edit')),
				changeIndicator, btnFull, btnExit
			])
		]);
		const fullscreenWrapper = E('div', [
			E('div', { class: 'ace-editor-container' }, [toolbar, container]),
			E('div', { style: 'display:flex;justify-content:space-around;padding:.5em;' }, [
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
						ui.hideModal();
					})
				}, _('Close'))
			])
		]);

		btnFull.onclick = btnExit.onclick = ui.createHandlerFn(this, 'toggleFS', {
			wrapper: fullscreenWrapper, container, btnFull, btnExit
		});

		L.showModal(editable ? _('edit mode') : _('view mode'), [
			E('style', [
				'.modal {padding: 1em .3em .3em .3em;}',
				'.ace-toolbar-select { height:25px!important;padding: 0 4px !important;min-width:13%!important; }'
			]),
			E('div', { class: 'modal-custom-path' }, [
				_('Ace Editor version: %s').format(ace.version), ' | ',
				_('Size: %s').format(file.size), ' | ',
				_('Source: %s').format(path)
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
			input: ev => {
				const isDirty = ev.target.value !== originalContent;
				saveBtn.style.display = (isDirty && !ev.target.readOnly) ? 'inline-block' : 'none';
			},
			style: 'width:100%;height:320px;font-family:Consolas;background-color:#212121;color:#fff;font-size:14px;'
		}, content);
		const saveBtn = E('button', {
			class: 'btn cbi-button-positive important', style: 'display:none',
			click: ui.createHandlerFn(this, () => {
				fs.write(file.path, textarea.value)
					.then(() => {
						this.showNotification(_('%s File saved successfully!').format(file.path), '', 'success');
						this.reload();
					})
					.catch(error => this.modalnotify(null, E('p', _('Save failed: %s').format(error.message || error)), '', 'warning'))
					.finally(() => ui.hideModal());
			})
		}, _('Save'));
		const btnFull = E('button', { class: 'btn', style: 'padding: 0 8px;margin-left:auto;' }, _('full screen'));
		const btnExit = E('button', { class: 'btn', style: 'display:none;margin-left:auto;' }, _('Exit full screen'));
		const modeToggle = E('div', { class: 'ace-toolbar' }, [
			E('div', { class: 'inline-form-group' }, [
				E('span', _('Font')),
				E('select', {
					class: 'cbi-input-select', style: 'width:35%;',
					change: ev => textarea.style.fontSize = ev.target.value + 'px'
				}, ['12', '13', '14', '15', '16'].map(id =>
					E('option', { value: id, selected: id === '14' || undefined }, id + 'px')
				)),
				E('input', {
					type: 'checkbox', checked: true, id: 'wrapCheckbox',
					change: ev =>
						textarea.style.whiteSpace = ev.target.checked ? 'pre-wrap' : 'pre'
				}),
				E('label', { class: 'inline-form-group', for: 'wrapCheckbox' }, _('wrap')),
				E('input', {
					id: 'editCheckbox', type: 'checkbox',
					checked: !!editable || undefined,
					change: ev => {
						const isChecked = ev.target.checked;
						textarea.readOnly = !isChecked;
						document.querySelector('.modal h4')
							.textContent = isChecked ? _('edit mode') : _('view mode');
					}
				}),
				E('label', { class: 'inline-form-group', for: 'editCheckbox' }, _('Edit')),
				btnFull, btnExit
			])
		]);
		const fullscreenWrapper = E('div', [
			modeToggle, textarea,
			E('div', { style: 'display:flex;justify-content:space-around;padding:.5em;' }, [
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
						ui.hideModal();
					})
				}, _('Close'))
			])
		]);
		btnFull.onclick = btnExit.onclick = ui.createHandlerFn(this, 'toggleFS', {
			wrapper: fullscreenWrapper, container: textarea, btnFull, btnExit
		});

		L.showModal(editable ? _('edit mode') : _('view mode'), [
			E('style', ['.modal {padding:0;padding-top:1em;}']),
			E('div', { class: 'modal-custom-path' }, [
				_('Size: %s').format(file.size), ' | ',
				_('Lines: %d').format(content.split('\n').length), ' | ',
				_('Source: %s').format(file.linkTarget || file.path)
			]),
			fullscreenWrapper
		]);
		requestAnimationFrame(() => this.Draggable());
	},

	createnew: function () {
		let fileContent = '', fullDir, fullFile, result;
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
				change: ev => filePerm = ev.target.value
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
								change: ev => editor && editor.session.setMode('ace/mode/' + ev.target.value)
							}, modes.map(([id, name]) => E('option', { value: id, selected: id === mode || undefined }, name))
							),
							E('span', _('Theme')),
							E('select', {
								class: 'ace-toolbar-select',
								change: ev => editor && editor.setTheme('ace/theme/' + ev.target.value)
							}, themes.map(([id, name]) => E('option', { value: id, selected: id === 'monokai' || undefined }, name))
							),
							E('span', _('Font')),
							E('select', {
								class: 'ace-toolbar-select',
								change: ev => editor && editor.setFontSize(ev.target.value + 'px')
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
					E('div', { class: 'ace-toolbar inline-form-group' }, [
						E('span', _('Font')),
						E('select', {
							class: 'ace-toolbar-select',
							change: (ev) => {
								const container = ev.target.closest('div').parentNode;
								const textarea = container.querySelector('textarea');
								textarea.style.fontSize = ev.target.value + 'px';
							}
						}, ['12', '13', '14', '15', '16'].map(id =>
							E('option', { value: id, selected: id === '14' || undefined }, id + 'px')
						)),
						...fileElem
					]),
					E('textarea', {
						placeholder: _('Enter text here'),
						class: 'cbi-input-text', type: 'text',
						style: 'width:100%;height:250px;font-family:Consolas;background-color:#212121;color:#fff;font-size:14px;',
						change: ev => fileContent = ev.target.value
					}),
				])
		]);

		const pathInput = E('input', {
			style: 'flex:1;', title: [
				" 📂 " + _("End with '/' to create a Directory"),
				" 📄 " + _("No '/' at end to create a File"),
				" 🚩 " + _("Start with '/' for Absolute path"),
				" 🏠 " + _("No '/' at start for Current path")
			].join("\n"),
			placeholder: _('e.g. file.txt or folder/'),
			input: ev => {
				const create = document.getElementById('create');
				document.querySelectorAll('.modal-custom-path').forEach(hint => hint.remove());
				const val = ev.target.value.trim();
				if (!val) {
					create.style.display = 'none';
					toolbar.style.display = 'none';
					document.getElementById('dirperm').style.display = 'none';
					return;
				};
				result = this.parsePath(val);
				create.style.display = 'inline-block';
				const formatPath = (p) => p.replace(/\/+/g, '/');
				const base = result.isAbsolute ? '' : this._path + '/';
				fullDir = formatPath(result.isDir ? base + result.path : base + result.dir);
				fullFile = result.isFile ? formatPath(base + result.path) : null;

				const targetHint = E('div', {
					class: 'modal-custom-path', style: `background:#ffe6e6;font-size:13px;${fullFile ? 'margin:0;' : ''}`
				}, fullFile
					? '📄 ' + _('File path: %s').format(fullFile)
					: '📂 ' + _('Directory path: %s').format(fullDir)
				);
				if (fullFile) {
					ev.target.after(targetHint);
					toolbar.style.display = 'block';
					document.getElementById('dirperm').style.display = 'none';
				} else if (fullDir) {
					toolbar.after(targetHint);
					toolbar.style.display = 'none';
					document.getElementById('dirperm').style.display = 'flex';
				};
				setmode();
			}
		});
		L.showModal(_('Create file (directory)'), [
			E('style', ['.modal {padding: 1em .3em .3em .3em;}']),
			E('div', { class: 'inline-form-group' }, [
				E('span', _('name(path)')), pathInput,
				E('span', { id: 'dirperm', class: 'inline-form-group', style: 'display:none;' }, [
					E('span', _('Directory permissions')),
					E('select', {
						style: 'flex:1;',
						change: ev => dirPerm = ev.target.value
					}, permissions.map(([id, name]) =>
						E('option', { value: id, selected: id === dirPerm || undefined }, name)
					))
				]),
			]),
			toolbar,
			E('div', { class: 'right' }, [
				E('button', {
					id: 'create', style: 'display:none;',
					class: 'btn cbi-button-positive important',
					click: ui.createHandlerFn(this, () => {
						const content = (window._aceReady && editor) ? editor.getValue() : fileContent;
						const p = fullDir ? fs.exec('/bin/mkdir', ['-p', '-m', dirPerm, fullDir]) : Promise.resolve({ code: 0 });
						p.then(res => {
							if (res && res.code !== 0) throw new Error(res.stderr);

							if (!fullFile) {
								this.showNotification(_('Directory %s created successfully').format(fullDir), '', 'success');
								return this.reload(fullDir);
							}

							return fs.write(fullFile, content)
								.then(() => fs.exec('/bin/chmod', [filePerm, fullFile]))
								.then(res => {
									if (res && res.code !== 0) throw new Error(res.stderr);
									this.showNotification(_('File %s created successfully').format(fullFile), '', 'success');
									return this.reload(fullDir);
								});
						}).catch(e => {
							this.modalnotify(null, E('p', _('Create failed: %s').format(e.message || e)), '', 'error');
							throw e;
						}).finally(() => ui.hideModal());
					})
				}, _('Create')),
				' ',
				E('button', { class: 'btn', click: ui.hideModal }, _('Cancel'))
			])
		]);

		requestAnimationFrame(() => {
			if (window._aceReady)
				this.initAceEditor({ containerId, editable: true }).then(ed => {
					editor = ed;
					setmode();
				});
			ui.addValidator(pathInput, 'string', false, function (value) {
				const res = this.parsePath(value.trim());
				if (!res.valid)
					return res.error ? _(res.error) : _('Invalid path format');
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
			E('div', { class: 'modal-custom-path' }, _('Source: %s').format(path)),
			E('div', { class: 'modal-custom-row' }, [
				E('label', { class: 'modal-custom-label' }, _('newname')),
				E('input', {
					value: oldname, id: 'nameinput', style: 'flex:1',
					change: ev => newname = ev.target.value.trim()
				}),
			]),
			E('div', { class: 'right' }, [
				E('button', { class: 'btn', click: ui.hideModal }, _('Cancel')),
				' ',
				E('button', {
					class: 'btn cbi-button-positive important',
					click: ui.createHandlerFn(this, () => {
						if (!newname || newname === oldname)
							return this.modalnotify(null, E('p', _('Please enter a new name')), 3000);

						return fs.exec('/bin/mv', [path, path.replace(/[^/]+$/, newname)]).then(r => {
							if (r.code !== 0)
								throw new Error(r.stderr || _('Unknown error during rename'));

							this.showNotification(_('Renamed: %s to %s').format(path, newname), '', 'success');
							return this.reload();
						}).catch(e => {
							this.modalnotify(null, E('p', _('Rename failed: %s').format(e.message || e)), '', 'error');
							throw e;
						}).finally(() => ui.hideModal());
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
			this.Draggable();
		});
	},

	chmodFile: function ({ path, permissionNum }) {
		let val = '';
		L.showModal(_('Change permissions'), [
			E('div', { class: 'modal-custom-path' }, _('Source: %s').format(path)),
			E('div', { class: 'modal-custom-row' }, [
				E('label', { class: 'modal-custom-label' }, _('Permission')),
				E('select', {
					class: 'cbi-input-select', style: 'flex:1',
					change: ev => val = ev.target.value
				}, permissions.map(([id, name]) =>
					E('option', { value: id, selected: id === permissionNum || undefined }, name)
				))
			]),

			E('div', { class: 'right' }, [
				E('button', { class: 'btn', click: ui.hideModal }, _('Cancel')),
				' ',
				E('button', {
					class: 'btn cbi-button-positive important',
					click: ui.createHandlerFn(this, () => {
						if (!val)
							return this.showNotification(_('Please select a new value'), 5000, 'error');

						return fs.exec('/bin/chmod', [val, path])
							.then(r => {
								if (r.code !== 0) throw new Error(r.stderr);
								this.reload();
								this.showNotification(_('Permissions updated: %s').format(path), 2000, 'success');
							})
							.catch(e =>
								this.showNotification(_('Failed to change permissions: %s').format(e.message || e), 5000, 'error'))
							.finally(() => ui.hideModal());
					})
				}, _('Apply'))
			])
		]);
		requestAnimationFrame(() => this.Draggable());
	},

	deleteFile: function (files) {
		files = L.toArray(files);
		if (files.length === 0) return;
		const paths = files.map(({ path }) => path);
		const previewList = paths.slice(0, 5).map(f => f).join('\n');
		const moreSuffix = paths.length > 5 ? '\n...' : '';

		L.showModal(_('Delete project'), [
			E('style', [
				'.file-preview {font-size:.9em;color:#6c757d;margin-top:9px;white-space:pre-line;}',
				'.modal-delete-warning {background:#fff3cd; border-left:4px solid #ffc107; padding:12px; margin-bottom:1em; text-align:left;}',
				'.modal-delete-msg {text-align:center;font-weight:bold;color:#dc3545;font-size:1.1em;}'
			]),
			E('div', { class: 'modal-delete-warning' }, [
				E('strong', { style: 'color:#856404;display:block;' }, _('⚠️ Warning:')),
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
						if (paths.length === 0) return;
						ev.target.textContent = _('Deleting...');
						return fs.exec('/bin/rm', ['-rf', ...paths]).then(r => {
							if (r.code !== 0) throw new Error(r.stderr);
							this.manageFiles('clear');
							this.reload();
							this.showNotification(
								files.length === 1
									? _('Deleted: %s').format(files[0].name)
									: _('Successfully deleted %d files').format(files.length),
								2000, 'success'
							);
						}).catch(e => {
							this.showNotification(_('Delete failed: %s').format(e.message || e), 5000, 'error');
						}).finally(() => ui.hideModal());
					})
				}, _('Confirm Delete')),
				E('button', { class: 'btn', click: ui.hideModal }, _('Cancel'))
			])
		]);
		requestAnimationFrame(() => this.Draggable());
	},

	createLink: function (path) {
		let linkPath = '', isHardLink = false;
		L.showModal(_('Create link'), [
			E('div', { class: 'modal-custom-path' }, _('Source: %s').format(path)),
			E('div', { class: 'modal-custom-row' }, [
				E('label', { class: 'modal-custom-label' }, _('Target')),
				E('input', {
					style: 'flex:1',
					placeholder: '/path/to/target', id: 'linkPath',
					change: ev => linkPath = ev.target.value.trim()
				})
			]),
			E('div', { class: 'modal-custom-row' }, [
				E('label', { class: 'modal-custom-label' }),
				E('div', { class: 'inline-form-group' }, [
					E('input', {
						type: 'checkbox', id: 'is_hardlink',
						change: ev => isHardLink = ev.target.checked
					}),
					E('label', { for: 'is_hardlink', style: 'font-size:12px;cursor:pointer;' }, _('Create hard link'))
				])
			]),
			E('div', { class: 'right' }, [
				E('button', { class: 'btn', click: ui.hideModal }, _('Cancel')),
				' ',
				E('button', {
					class: 'btn cbi-button-positive important',
					click: ui.createHandlerFn(this, () => {
						if (!linkPath)
							return this.showNotification(_('Please enter a valid target path'), 3000, 'error');

						const args = isHardLink ? [path, linkPath] : ['-s', path, linkPath];
						return fs.exec('/bin/ln', args)
							.then(r => {
								if (r.code !== 0) throw new Error(r.stderr);
								this.reload();
								this.showNotification(_('Link "%s" created successfully').format(linkPath), '', 'success');
							})
							.catch(e =>
								this.showNotification(_('Failed to create link: %s').format(e.message || e), 5000, 'error'))
							.finally(() => ui.hideModal());
					})
				}, _('Apply'))
			])
		]);

		requestAnimationFrame(() => {
			const pathInput = document.getElementById('linkPath');
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
			return this.startDownload(files.path, (files.linkName || files.name));
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
					value: defaultName + '.tar.gz',
					id: 'pack-name', style: 'flex:1',
					change: (ev) => nameInput = ev.target.value
				}),
			]),
			E('div', { class: 'right' }, [
				E('button', { class: 'btn', click: ui.hideModal }, _('Cancel')),
				' ',
				E('button', {
					class: 'btn cbi-button-positive important',
					click: ui.createHandlerFn(this, () => {
						let name = (nameInput || (defaultName + '.tar.gz')).replace(/[\/\\:*?"<>|]/g, '_').trim();
						if (!name.endsWith('.tar.gz')) name += '.tar.gz';

						const out = `/tmp/${name}`;
						const args = files
							.filter(({ linkName }) => !linkName)
							.map(({ path }) => `"${path.replace(/^\//, '').replace(/"/g, '\\"')}"`)
							.join(' ');

						return fs.exec('/bin/sh', ['-c', `tar -czf "${out}" -C / -- ${args}`])
							.then(r => {
								if (r.code !== 0) throw new Error(r.stderr);
								this.startDownload(out, name);
								this.manageFiles('clear');
							})
							.catch(e => this.showNotification(_('Download failed: %s').format(e.message), 5000, 'error'))
							.finally(() => {
								fs.remove(out).catch(() => {});
								ui.hideModal();
							});
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
		L.showModal(_('Upload'), [
			E('div', { class: 'upload ace-toolbar inline-form-group' }, [
				E('input', {
					type: 'file',
					change: function (ev) {
						const form = ev.target.parentNode;
						const nameinput = document.getElementById('nameinput')
						const uploadbtn = form.querySelector('button.cbi-button-save');
						nameinput.value = ev.target.value.replace(/^.+[\/\\]/, '');
						uploadbtn.disabled = false;
					}
				}),
				E('input', { type: 'text', placeholder: _('Filename'), id: 'nameinput' }),
				E('button', {
					disabled: true,
					class: 'btn cbi-button-save',
					click: ui.createHandlerFn(this, (ev) => {
						ev.preventDefault();
						const form = ev.target.parentNode;
						const fileinput = form.querySelector('input[type="file"]');
						const nameinput = document.getElementById('nameinput');
						const filename = (nameinput?.value || '').trim();

						if (!filename || !fileinput?.files?.[0])
							return Promise.resolve();

						const isAbsolute = filename.startsWith('/');
						const reloadPath = isAbsolute
							? filename.substring(0, filename.lastIndexOf('/')) : this._path;
						const directoryCheck = isAbsolute
							? fs.stat(reloadPath).catch(() => {
								throw new Error(_('%s 目录不存在').format(reloadPath));
							})
							: Promise.resolve();
						const fullPath = isAbsolute ? filename : `${this._path}/${filename}`;
						const uploadUrl = `${L.env.cgi_base}/cgi-upload`;
						const progress = L.bind((btn, ev) => {
							const percent = (ev.loaded / ev.total) * 100;
							btn.firstChild.data = '%.2f%%'.format(percent);
						}, this, ev.target);

						const data = new FormData();
						data.append('filename', fullPath);
						data.append('sessionid', L.env.sessionid);
						data.append('filedata', fileinput.files[0]);

						return directoryCheck
							.then(() => request.post(uploadUrl, data, { progress }))
							.then(L.bind((path, ev, res) => {
								const reply = res.json();
								if (L.isObject(reply) && reply.failure) {
									this.showNotification(_('Upload request failed: %s').format(reply.message), 5000, 'error');
									return Promise.reject(reply.message);
								}

								const displayName = isAbsolute
									? filename.split('/').pop() : filename;

								return this.reload(reloadPath).then(() =>
									this.showNotification(
										_('File "%s" uploaded to "%s"').format(displayName, this._path), '', 'success'
									));
							}, this, this._path, ev))
							.catch((error) => {
								this.showNotification(_('Upload failed: %s').format(error.message), 5000, 'error');
								return Promise.reject(error);
							})
							.finally(() => ui.hideModal());
					})
				}, _('Upload file'))
			]),

			E('div', { class: 'right' }, [
				E('button', { class: 'btn', click: ui.hideModal }, _('Cancel'))
			])
		]);

		requestAnimationFrame(() => {
			const nameinput = document.getElementById('nameinput')
			ui.addValidator(nameinput, 'string', true, function (value) {
				if (!value.startsWith('/')) return true;
				value = value.trim().replace(/^(\/[^\/]+).*$/, '$1');
				const res = this.parsePath(value);
				if (!res.valid)
					return res.error ? _(res.error) : _('Invalid path format');
				return true;
			}.bind(this));
			this.Draggable()
		});
	},

	toggleFS: function (config) {
		this._isFullscreen = !this._isFullscreen;
		const { wrapper, container, btnFull, btnExit } = config;

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
	},

	parseLsOutput: function (path, out) {
		const files = [];
		if (!out) return files;

		const lines = out.trim().split('\n');
		for (let i = 0; i < lines.length; i++) {
			const parts = lines[i].split(/\s+/);
			if (parts.length < 9) continue;

			const [perm, , owner, , size, d1, d2] = parts;
			const date = `${d1} ${d2}`;
			const isDir = perm[0] === 'd';
			let name = parts.slice(8).join(' ');
			let linkName = '', linkTarget = null;

			if (perm[0] === 'l') {
				const arrowIdx = name.indexOf(' -> ');
				linkName = name;
				if (arrowIdx !== -1) {
					linkName = name.substring(0, arrowIdx);
					linkTarget = name.substring(arrowIdx + 4);
				};
			};

			files.push({
				date, isDir, owner, linkTarget, name,
				size: isDir ? '' : size, perm, linkName,
				permissionNum: this.permissionsToOctal(perm),
				path: (path + '/' + (linkName || name)).replace(/\/+/g, '/')
			});
		};

		return files.sort((a, b) => {
			if (a.isDir !== b.isDir) return a.isDir ? -1 : 1;
			if (a.linkName !== b.linkName) return a.linkName ? 1 : -1;
			return a.name.localeCompare(b.name);
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

			if (trimmed.startsWith('---') || /^\s*[\w.-]+\s*:\s+\S/m.test(trimmed)) {
				if (!trimmed.includes('=')) return 'yaml';
			}

			if (trimmed[0] === '#') {
				if (/^#\s+[^:]+$/.test(firstLine)) return 'markdown';
				if (trimmed.startsWith('#!')) return 'sh';
				if (trimmed.includes(': ') && !trimmed.includes('=')) return 'yaml';

				return 'sh';
			}
		}

		const shFeatures = [
			/^\s*\[\s+.*?\s+\]\s+(&&|\|\|)/,
			/^\s*(if|case|while|for|function)\b/m,
			/^\s*\w+=\".*?\"\s*(;|&&|\|\||$)/m,
			/(\||&&|\|\|)\s*\/(usr\/|bin\/|sbin\/)/
		];

		if (shFeatures.some(re => re.test(trimmed))) {
			return 'sh';
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
		const selectedCount = this.manageFiles('count');

		if (deleteCount)
			deleteCount.textContent = selectedCount > 0 ? `(${selectedCount})` : '';
		if (downloadCount)
			downloadCount.textContent = selectedCount > 0 ? `(${selectedCount})` : '';
		if (selectedCount > 0) {
			ui.showIndicator('selected-files',
				_('%d files selected').format(selectedCount),
				() => this.manageFiles('clear'),
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

	manageFiles(action = 'get') {
		const { _path, _root, currentFiles } = this;

		if (!this._fileMap || this._fileMapVersion !== _path) {
			this._fileMap = new Map(currentFiles.map(f => [f.path, f]));
			this._fileMapVersion = _path;
		};

		const checkedBoxes = Array.from(_root.querySelectorAll('.file-checkbox input:checked'));

		switch (action) {
			case 'get':
				return checkedBoxes.map(cb => this._fileMap.get(cb.dataset.path)).filter(Boolean);

			case 'clear':
				checkedBoxes.forEach(cb => {
					cb.checked = false;
					cb.closest('tr')?.classList.remove('selected');
				});
				this.toggleBatchBar();
				return true;

			case 'count':
				return checkedBoxes.length;

			case 'has':
				return checkedBoxes.length > 0;
		}
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

	parseSizeToBytes: function (s) {
		const units = { K: 1024, M: 1024 ** 2, G: 1024 ** 3, T: 1024 ** 4 };
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

		const colors = { success: '#4CAF50', error: 'red', warning: '#FF9800', info: '#2196F3' };
		const notification = E('div', {
			class: 'file-notification',
			style: `
			position:fixed;top:20px;right:20px;z-index:20000;
			padding:12px 24px;border-radius:4px;color:white;
			box-shadow: 0 4px 12px rgba(0,0,0,0.15);
			cursor:pointer;font-weight:500;
			background:${colors[type] || colors.info};
			opacity:0;transform:translateX(30px);
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
		if (!modal) return;
		modal.removeAttribute('style');

		const dragArea = modal.querySelector('h4');
		const rect = modal.getBoundingClientRect();
		Object.assign(modal.style, {
			position: 'fixed', margin: '0', transform: 'none',
			top: rect.top + 'px', left: rect.left + 'px'
		});

		const handleMouseDown = (e) => {
			if (e.button !== 0 || e.target.closest('button, input, select, textarea, a, .btn')) return;

			const dragData = {
				startX: e.clientX,
				startY: e.clientY,
				startTop: parseFloat(modal.style.top) || 0,
				startLeft: parseFloat(modal.style.left) || 0
			};

			modal.classList.add('dragging');

			const handleMouseMove = (moveEvent) => {
				let newTop = dragData.startTop + moveEvent.clientY - dragData.startY;
				let newLeft = dragData.startLeft + moveEvent.clientX - dragData.startX;

				const viewW = window.innerWidth, viewH = window.innerHeight;
				const modalW = modal.offsetWidth, headerH = dragArea.offsetHeight;
				const edge = 40;

				newTop = Math.max(0, Math.min(newTop, viewH - headerH));
				newLeft = Math.max(edge - modalW, Math.min(newLeft, viewW - edge));

				modal.style.top = newTop + 'px';
				modal.style.left = newLeft + 'px';
			};

			const handleMouseUp = () => {
				modal.classList.remove('dragging');
				document.removeEventListener('mousemove', handleMouseMove);
				document.removeEventListener('mouseup', handleMouseUp);
			};

			document.addEventListener('mousemove', handleMouseMove);
			document.addEventListener('mouseup', handleMouseUp);
			e.preventDefault();
		};

		dragArea.addEventListener('mousedown', handleMouseDown);
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
			E('div', { style: 'flex:1 1 auto;display:flex' }, [
				E('button', {
					class: 'btn',
					style: 'margin-left:auto;margin-top:auto',
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
