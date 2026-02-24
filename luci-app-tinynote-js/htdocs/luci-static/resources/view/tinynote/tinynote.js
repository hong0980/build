'use strict';
'require fs';
'require ui';
'require uci';
'require form';
'require view';

const note_type_array = [
	['lua', 'Lua', 'lua', 'lua'],
	['sh', 'Shell Script', 'sh', 'shell'],
	['py', 'Python', 'python', 'python'],
	['txt', 'Plain Text', 'text', 'null']
];

const ace_theme_array = [
	['monokai', 'Monokai (Dark)'],
	['dracula', 'Dracula (Dark)'],
	['tomorrow_night', 'Tomorrow Night (Dark)'],
	['one_dark', 'One Dark (Dark)'],
	['nord_dark', 'Nord Dark (Dark)'],
	['gruvbox', 'Gruvbox (Dark)'],
	['cobalt', 'Cobalt (Dark)'],
	['vibrant_ink', 'Vibrant Ink (Dark)'],
	['twilight', 'Twilight (Dark)'],
	['chaos', 'Chaos (Dark)'],
	['terminal', 'Terminal (Dark)'],
	['github', 'GitHub (Light)'],
	['xcode', 'Xcode (Light)'],
	['chrome', 'Chrome (Light)'],
	['eclipse', 'Eclipse (Light)'],
	['textmate', 'TextMate (Light)'],
	['dawn', 'Dawn (Light)'],
	['dreamweaver', 'Dreamweaver (Light)'],
	['crimson_editor', 'Crimson Editor (Light)'],
	['clouds', 'Clouds (Light)'],
	['kuroir', 'Kuroir (Light)']
];

const codemirror_theme_array = [
	['monokai', 'Monokai (Dark)'],
	['ayu-dark', 'Ayu Dark (Dark)'],
	['dracula', 'Dracula (Dark)'],
	['material', 'Material (Dark)'],
	['nord', 'Nord (Dark)'],
	['midnight', 'Midnight (Dark)'],
	['eclipse', 'Eclipse (Light)'],
	['elegant', 'Elegant (Light)'],
	['neat', 'Neat (Light)']
];

const templates = {
	sh: "#!/bin/sh /etc/rc.common\n",
	py: "#!/usr/bin/env python\nimport os, re, sys, time\n",
	lua: "#!/usr/bin/env lua\nlocal fs = require 'nixio.fs'\nlocal sys  = require 'luci.sys'\nlocal util = require 'luci.util'\nlocal uci = require 'luci.model.uci'.cursor()\n"
};

const CSS = `
.editorMenu {
	width: 100%;
	height: 35px;
	display: flex;
	justify-content: flex-end;
	background-color: #363636;
}
.editorMenu a {
	display: flex;
	margin: 0 5px;
	color: #f5f5f5;
	cursor: pointer;
	align-items: center;
	text-decoration: none;
	transition: border-color 0.2s;
	border-bottom: 2px solid transparent;
}

.editorMenu a:hover {
	border-bottom-color: #f5f5f5;
}

.inline-form-group {
	gap: 8px;
	display: flex;
	flex-wrap:wrap;
	align-items: center;
}

.inline-form-group span {
	color: #f5f5f5;
}

.inline-form-group select {
	width: 8em;
	height: 23px;
	font-size: 12px;
	padding: 0 0 0 5px;
	box-sizing: border-box;
}

.statusBar {
	padding: 5px;
	display: flex;
	color: #f5f5f5;
	align-items: center;
	background-color: #363636;
}

.status-left {
	flex-grow: 1;
	padding-left: 10px;
}

.status-right {
	padding-right: 10px;
}
.fullScreen {
	top: 0;
	left: 0;
	right: 0;
	bottom: 0;
	width: 100%;
	z-index: 9999;
	position: fixed;
}

@media screen and (max-width: 767px) {
	.inline-form-group {
		display: none !important;
	}
}`

const ICONS = {
	Upload: '<svg viewBox="0 0 24 24" width="22" height="22" style="vertical-align:middle;"><path fill="currentColor" d="M5,4V6H19V4H5M5,14H9V20H15V14H19L12,7L5,14Z"/></svg>',
	save: '<svg viewBox="0 0 24 24" width="22" height="22" style="vertical-align:middle;"><path fill="currentColor" d="M15,9H5V5H15M12,19A3,3 0 0,1 9,16A3,3 0 0,1 12,13A3,3 0 0,1 15,16A3,3 0 0,1 12,19M17,3H5C3.89,3 3,3.9 3,5V19A2,2 0 0,0 5,21H19A2,2 0 0,0 21,19V7L17,3Z"/></svg>',
	download: '<svg viewBox="0 0 24 24" width="22" height="22" style="vertical-align:middle;"><path fill="currentColor" d="M17,13L12,18L7,13H10V9H14V13M19.35,10.04C18.67,6.59 15.64,4 12,4C9.11,4 6.6,5.64 5.35,8.04C2.34,8.36 0,10.91 0,14A6,6 0 0,0 6,20H19A5,5 0 0,0 24,15C24,12.36 21.95,10.22 19.35,10.04Z"/></svg>',
	delete: '<svg viewBox="0 0 24 24" width="22" height="22" style="vertical-align:middle;"><path fill="currentColor" d="M19,4H15.5L14.5,3H9.5L8.5,4H5V6H19M6,19A2,2 0 0,0 8,21H16A2,2 0 0,0 18,19V7H6V19Z"/></svg>',
	copy: '<svg viewBox="0 0 24 24" width="22" height="22" style="vertical-align:middle;"><path fill="currentColor" d="M19,21H8V7H19M19,5H8A2,2 0 0,0 6,7V21A2,2 0 0,0 8,23H19A2,2 0 0,0 21,21V7A2,2 0 0,0 19,5M16,1H4A2,2 0 0,0 2,3V17H4V3H16V1Z"/></svg>',
	open_fullscreen: '<svg viewBox="0 0 24 24" width="22" height="22" style="vertical-align:middle;"><path fill="currentColor" d="M21,11V3H13L16.29,6.29L6.29,16.29L3,13V21H11L7.71,17.71L17.71,7.71L21,11Z"/></svg>',
	close_fullscreen: '<svg viewBox="0 0 24 24" width="22" height="22" style="vertical-align:middle;"><path fill="currentColor" d="M22,3.41L16.71,8.7L20,12H12V4L15.29,7.29L20.59,2L22,3.41M3.41,22L8.7,16.71L12,20V12H4L7.29,15.29L2,20.59L3.41,22Z"/></svg>'
};

return view.extend({
	cmEditors: {},
	aceEditors: {},

	loadJS: function (cdns, checkFn, onLoad) {
		const urls = Array.isArray(cdns) ? cdns : [cdns];

		return new Promise(resolve => {
			if (checkFn && checkFn()) {
				return resolve(true);
			}

			let loaded = false;
			let i = 0;

			const load = () => {
				if (loaded) return;
				if (i >= urls.length) return resolve(false);

				const script = document.createElement('script');
				script.src = urls[i++];

				script.onload = () => {
					if (loaded) {
						script.remove();
						return;
					}

					if (checkFn && !checkFn()) {
						script.remove();
						load();
						return;
					}

					loaded = true;
					if (onLoad) onLoad(script.src);
					resolve(true);
				};

				script.onerror = () => {
					script.remove();
					load();
				};

				document.head.appendChild(script);
			};

			load();
		});
	},

	loadCSS: function (cdns) {
		const urls = Array.isArray(cdns) ? cdns : [cdns];

		return new Promise(resolve => {
			let loaded = false;
			let i = 0;

			const load = () => {
				if (loaded) return;
				if (i >= urls.length) return resolve(false);

				const link = document.createElement('link');
				link.rel = 'stylesheet';
				link.href = urls[i++];

				link.onload = () => {
					if (loaded) return;
					loaded = true;
					resolve(true);
				};

				link.onerror = () => {
					link.remove();
					load();
				};

				document.head.appendChild(link);
			};

			load();
		});
	},

	preloadAceEditor: function () {
		if (window._aceReady) return Promise.resolve(true);
		if (window._acePromise) return window._acePromise;
		const version = '1.43.3';
		return window._acePromise = this.loadJS([
			`https://lib.baomitu.com/ace/${version}/ace.min.js`,
			`https://cdn.bootcdn.net/ajax/libs/ace/${version}/ace.min.js`,
			`https://cdn.jsdelivr.net/npm/ace-builds@${version}/src-min-noconflict/ace.min.js`,
			`https://cdnjs.cloudflare.com/ajax/libs/ace/${version}/ace.min.js`
		], () => window.ace?.edit, (src) => {
			const path = src.substring(0, src.lastIndexOf('/')).replace(/\/$/, '');
			window.ace.config.set('basePath', path);
			window._aceReady = true;
		}).then(ok => {
			if (!ok) throw new Error('ace load failed');
			return true;
		});
	},

	preloadCodeMirror: function () {
		if (window._cmReady) return Promise.resolve(true);
		if (window._cmPromise) return window._cmPromise;
		const version = '6.65.7';
		const cdns = [
			{
				base: `https://lib.baomitu.com/codemirror/${version}`,
				js: `https://lib.baomitu.com/codemirror/${version}/codemirror.min.js`,
				css: `https://lib.baomitu.com/codemirror/${version}/codemirror.min.css`
			},
			{
				base: `https://cdn.bootcdn.net/ajax/libs/codemirror/${version}`,
				js: `https://cdn.bootcdn.net/ajax/libs/codemirror/${version}/codemirror.min.js`,
				css: `https://cdn.bootcdn.net/ajax/libs/codemirror/${version}/codemirror.min.css`
			},
			{
				base: `https://cdn.jsdelivr.net/npm/codemirror@${version}`,
				js: `https://cdn.jsdelivr.net/npm/codemirror@${version}/lib/codemirror.min.js`,
				css: `https://cdn.jsdelivr.net/npm/codemirror@${version}/lib/codemirror.min.css`
			},
			{
				base: `https://cdn.staticfile.net/codemirror/${version}`,
				js: `https://cdn.staticfile.net/codemirror/${version}/codemirror.min.js`,
				css: `https://cdn.staticfile.net/codemirror/${version}/codemirror.min.css`
			}
		];

		return window._cmPromise = this.loadJS(
			cdns.map(c => c.js),
			() => window.CodeMirror,
			(src) => {
				const cdn = cdns.find(c => c.js === src);
				this.loadCSS(cdn.css);
				window._cmReady = true;
				window._cmBase = cdn.base;
			}
		).then(ok => {
			if (!ok) {
				window._cmPromise = null;
				throw new Error('cm load failed');
			}
			return true;
		});
	},

	loadCMResource: function (type, name) {
		if (!window.CodeMirror) return Promise.resolve(true);
		if (type === 'mode' && name === 'null') return Promise.resolve(true);
		if (type === 'theme' && name === 'default') return Promise.resolve(true);

		if (type === 'theme') {
			const url = `${window._cmBase}/theme/${name}.min.css`;
			return this.loadCSS(url);
		} else {
			const url = `${window._cmBase}/mode/${name}/${name}.min.js`;
			return this.loadJS(url);
		}
	},

	loadLibrary: function (name) {
		const libs = {
			jquery: {
				urls: [
					"/luci-static/tinynote/jquery.min.js",
					'https://cdn.staticfile.net/jquery/3.7.1/jquery.min.js',
					'https://lib.baomitu.com/jquery/3.7.1/jquery.min.js',
					'https://cdn.jsdelivr.net/npm/jquery@3.7.1/dist/jquery.min.js',
					'https://cdn.bootcdn.net/ajax/libs/jquery/3.7.1/jquery.min.js'
				],
				check: () => window.jQuery
			},
			filesaver: {
				urls: [
					'https://lib.baomitu.com/FileSaver.js/2.0.5/FileSaver.min.js',
					'https://cdn.bootcdn.net/ajax/libs/FileSaver.js/2.0.5/FileSaver.min.js',
					'https://cdn.jsdelivr.net/npm/file-saver@2.0.5/dist/FileSaver.min.js'
				],
				check: () => window.saveAs
			},
			clipboard: {
				urls: [
					'https://cdn.staticfile.net/clipboard.js/2.0.11/clipboard.min.js',
					'https://lib.baomitu.com/clipboard.js/2.0.9/clipboard.min.js',
					'https://cdn.bootcdn.net/ajax/libs/clipboard.js/2.0.9/clipboard.min.js',
					'https://cdn.jsdelivr.net/npm/clipboard@2.0.9/dist/clipboard.min.js'
				],
				check: () => window.ClipboardJS
			}
		};

		const lib = libs[name.toLowerCase()];
		if (!lib) return Promise.reject(new Error(`Unknown library: ${name}`));
		return this.loadJS(lib.urls, lib.check).then(ok => {
			if (!ok) throw new Error(`Failed to load library: ${name}`);
			return true;
		});
	},

	loadCSSLibrary: function (name) {
		const libs = {
			bulma: [
				'/luci-static/tinynote/bulma.css',
				'https://cdn.staticfile.net/bulma/1.0.4/css/bulma.css',
				'https://lib.baomitu.com/bulma/1.0.4/css/bulma.min.css',
				'https://cdn.bootcdn.net/ajax/libs/bulma/1.0.4/css/bulma.min.css',
				'https://cdn.jsdelivr.net/npm/bulma@1.0.4/css/bulma.min.css'
			],
			bootstrap: [
				'https://cdn.staticfile.net/bootstrap/5.3.3/css/bootstrap.min.css',
				'https://lib.baomitu.com/bootstrap/5.3.8/css/bootstrap.min.css',
				'https://cdn.bootcdn.net/ajax/libs/bootstrap/5.3.8/css/bootstrap.min.css',
				'https://cdn.jsdelivr.net/npm/bootstrap@5.3.8/dist/css/bootstrap.min.css'
			],
			fontawesome: [
				'https://cdn.staticfile.net/font-awesome/6.5.1/css/all.min.css',
				'https://lib.baomitu.com/font-awesome/6.5.1/css/all.min.css',
				'https://cdn.bootcdn.net/ajax/libs/font-awesome/6.5.1/css/all.min.css',
				'https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.5.1/css/all.min.css'
			]
		};

		const urls = libs[name.toLowerCase()];
		if (!urls) return Promise.reject(new Error(`Unknown CSS library: ${name}`));

		return this.loadCSS(urls).then(ok => {
			if (!ok) throw new Error(`Failed to load library: ${name}`);
			return true;
		});
	},

	load: function () {
		if (!this.styleInjected) {
			document.head.appendChild(E('style', CSS));
			this.styleInjected = true;
		}
		return uci.load('luci').then((d) => {
			if (!uci.get(d, 'tinynote')) {
				uci.add(d, 'tinynote', 'tinynote');
				return uci.save().then(() => uci.apply(10)).then(() => {
					uci.unload(d);
					return uci.load(d);
				});
			}
			return d;
		});
	},

	render: function () {
		// this.loadLibrary('jquery');
		let m, s, o;
		const con = uci.get_first('luci', 'tinynote');
		const note_sum = parseInt(con.note_sum) || 1;
		const note_suffix = con.note_suffix || "txt";
		const note_path = con.note_path || "/etc/tinynote";
		const code_cmenable = uci.get_bool('luci', 'tinynote', 'cmenable');
		const code_aceenable = uci.get_bool('luci', 'tinynote', 'aceenable');

		m = new form.Map('luci', '');
		s = m.section(form.NamedSection, 'tinynote', 'tinynote', '');

		s.tab("note", _('Basic Settings'));
		s.tab("ace", _("Ace Support"));
		s.tab("codemirror", _("CodeMirror Support"));

		o = s.taboption("note", form.Value, 'note_path', _('Save Path'));
		o.default = "/etc/tinynote";

		o = s.taboption("note", form.Value, 'note_sum', _('Number of Texts'));
		o.default = 1;
		o.rmempty = false;
		o.datatype = "range(1,20)";

		o = s.taboption("note", form.ListValue, 'note_suffix', _('Text Type'));
		o.default = 'txt';
		// o.depends('cmenable', '1');
		// o.depends('aceenable', '1');
		note_type_array.forEach(([val, text]) => o.value(val, text));

		let aceenable = s.taboption("note", form.Flag, 'aceenable', _('Enable Ace Support'));
		aceenable.depends('cmenable', '0');
		aceenable.depends('cmenable', null);

		let cmenable = s.taboption("note", form.Flag, 'cmenable', _('Enable CodeMirror Support'));
		cmenable.depends('aceenable', '0');
		cmenable.depends('aceenable', null);

		o = s.taboption("ace", form.Flag, 'aceonly', _('Read-Only Mode'));
		o.depends('aceenable', '1');
		o.enabled = 'true';
		o.disabled = 'false';

		o = s.taboption("ace", form.ListValue, 'acetheme', _('Theme'));
		o.depends('aceenable', '1');
		o.default = 'monokai';
		ace_theme_array.forEach(([val, text]) => o.value(val, text));

		o = s.taboption("ace", form.ListValue, 'acefont_size', _('Font Size'));
		o.depends('aceenable', '1');
		o.default = '13';
		['10', '12', '13', '14', '15', '16'].forEach(size => o.value(size, size + 'px'));

		o = s.taboption("ace", form.ListValue, 'aceline_spacing', _('Line Spacing'));
		o.depends('aceenable', '1');
		o.default = '1.2';
		['1.0', '1.2', '1.3', '1.5'].forEach(v => o.value(v, v));

		o = s.taboption("ace", form.Value, 'aceheight', _('Display Height'));
		o.depends('aceenable', '1');
		o.default = '300';
		o.datatype = 'range(100,1000)';

		o = s.taboption("codemirror", form.Flag, 'only', _('Read-Only Mode'));
		o.depends('cmenable', '1');
		o.enabled = 'true';
		o.disabled = 'false';

		o = s.taboption("codemirror", form.ListValue, 'cmtheme', _('Theme'));
		o.depends('cmenable', '1');
		o.default = 'monokai';
		codemirror_theme_array.forEach(([val, text]) => o.value(val, text));

		o = s.taboption("codemirror", form.ListValue, 'font_size', _('Font Size'));
		o.depends('cmenable', '1');
		o.default = '13';
		['10', '12', '13', '14', '15', '16'].forEach(size => o.value(size, size + 'px'));

		o = s.taboption("codemirror", form.ListValue, 'line_spacing', _('Line Spacing'));
		o.depends('cmenable', '1');
		o.default = '1.2';
		['1.0', '1.2', '1.3', '1.5'].forEach(v => o.value(v, v));

		o = s.taboption("codemirror", form.Value, 'height', _('Display Height'));
		o.depends('cmenable', '1');
		o.default = '300';
		o.datatype = 'range(100,1000)';

		if (note_sum > 0) {
			s = m.section(form.NamedSection, 'tinynote', 'tinynote');
			for (let i = 1; i <= note_sum; i++) {
				const tabId = `file${i}`;
				s.tab(tabId, _('Note %s').format(String(i).padStart(2, '0')));

				o = s.taboption(tabId, form.Flag, `enablenote${i}`, _('Note %s Settings').format(String(i).padStart(2, '0')));
				o.enabled = 'true';
				o.disabled = 'false';
				o.default = 'false';

				o = s.taboption(tabId, form.ListValue, `model_note${i}`, _('Type'));
				o.depends(`enablenote${i}`, 'true');
				o.rmempty = true;
				note_type_array.forEach(([val, text]) => o.value(val, text));

				o = s.taboption(tabId, form.Flag, `only_note${i}`, _('Read-only'));
				o.depends(`enablenote${i}`, 'true');
				o.enabled = 'true';
				o.disabled = 'false';
				o.default = 'false';

				o = s.taboption(tabId, form.DummyValue, `_editor${i}`);
				o.rawhtml = true;
				o.render = L.bind(function () {
					const currentCon = uci.get_first('luci', 'tinynote');
					const useCustomSettings = currentCon[`enablenote${i}`] === 'true';
					const fileType = useCustomSettings && currentCon[`model_note${i}`]
						? currentCon[`model_note${i}`]
						: note_suffix;
					const id = `editor-${i}`;
					const height = code_aceenable ? (currentCon.aceheight || '300') : (currentCon.height || '300');
					return E('div', {}, [
						code_aceenable
							? E('div', { id: id, style: `height:${height}px;border:1px solid #ccc;border-radius:4px;` })
							: E('textarea', { id: id, style: `width:100%;height:${height}px;` }),
					]);
				}, this);
			}

			fs.stat(note_path)
				.catch(() => fs.exec('/bin/mkdir', ['-p', note_path]))
				.then(() => {
					const currentCon = uci.get_first('luci', 'tinynote');
					const fallbackToTextarea = () => {
						for (let i = 1; i <= note_sum; i++) {
							const useCustom = currentCon[`enablenote${i}`] === 'true';
							const fileType = useCustom && currentCon[`model_note${i}`]
								? currentCon[`model_note${i}`]
								: note_suffix;
							const filePath = `${note_path}/note${String(i).padStart(2, '0')}.${fileType}`;
							const fileReadOnly = useCustom
								? (currentCon[`only_note${i}`] === 'true')
								: false;

							setTimeout(() => {
								const id = `editor-${i}`;
								const el = document.getElementById(id);
								if (!el) return;
								const parentNode = el.parentNode;
								const height = el.style.height || '300px';
								const textarea = document.createElement('textarea');
								textarea.style.cssText = `width:100%;height:${height};font-family:Consolas;background-color:#212121;color:#fff;font-size:13px;box-sizing:border-box;border:none;padding:8px;resize:vertical;border-radius:0px`;
								textarea.readOnly = fileReadOnly;

								const getEditor = () => ({
									getValue: () => textarea.value,
									setValue: (v) => { textarea.value = v; }
								});

								const wrapperDiv = buildToolbar.call(this, i, getEditor, filePath, () => {}, currentCon);
								wrapperDiv.appendChild(textarea);
								wrapperDiv.appendChild(E('div', { class: 'statusBar' }, [
									E('div', { class: 'status-left', id: `${id}LineColumn` }, 'Ln: 0 '),
									E('div', { class: 'status-right', id: `${id}TextSize` }, 'Size: 0 Bytes')
								]));
								parentNode.innerHTML = '';
								parentNode.appendChild(wrapperDiv);

								const updateStatus = () => {
									const content = textarea.value;
									const lines = content ? content.split('\n').length : 0;
									document.getElementById(`${id}LineColumn`).textContent = `Line: ${lines}`;
									document.getElementById(`${id}TextSize`).textContent = `Size: ${new Blob([content]).size} Bytes`;
								};
								textarea.addEventListener('input', updateStatus);

								fs.read(filePath).then(content => {
									textarea.value = content || '';
									updateStatus();
								}).catch(() => {});

								const btn = buildButton(i, filePath, fileReadOnly);
								if (btn) parentNode.appendChild(btn);
							}, i * 100);
						}
					};
					const buildButton = (i, filePath, fileReadOnly) => {
						const id = `editor-${i}`;
						return E('div', { style: 'margin-top:10px;padding:0 0 8px;' }, [
							E('button', {
								class: 'btn cbi-button-save', disabled: fileReadOnly ? '' : null,
								click: ui.createHandlerFn(this, () => {
									const editor = this.aceEditors[id] || this.cmEditors[id];
									const content = editor?.getValue();
									content && fs.write(filePath, content)
										.then(() => this.showNotification(_('保存成功'), 3000, 'success'))
										.catch(err => this.showNotification(_('保存出错: %s').format(err.message), 3000, 'error'));
								})
							}, _('Save') + ' ' + _('Note %s').format(String(i).padStart(2, '0'))),
							E('button', {
								class: 'btn cbi-button-reset', style: 'margin-left:5px;',
								click: ui.createHandlerFn(this, () => {
									const editor = this.aceEditors[id] || this.cmEditors[id];
									fs.read(filePath).then(content => {
										editor?.setValue(content || '', -1);
										this.showNotification(_('已重载'), 3000, 'success');
									}).catch(err => this.showNotification(_('重载失败: %s').format(err.message), 3000, 'error'));
								})
							}, _('Reload') + ' ' + _('Note %s').format(String(i).padStart(2, '0')))
						]);
					};
					function svgIcon(name) {
						const span = document.createElement('span');
						span.innerHTML = (ICONS[name] || '').trim();
						return span.querySelector('svg');
					}
					function buildToolbar(i, getEditor, filePath, resizeFn, currentCon) {
						const id = `editor-${i}-wrapper`;
						return E('div', { id: id }, [
							E('div', { class: 'editorMenu' }, [
								E('div', { class: 'inline-form-group status-left' }, [
									(code_cmenable || code_aceenable)
										? E('span', { class: 'inline-form-group' }, [
											E('span', _('Syntax')),
											E('select', {
												change: ui.createHandlerFn(this, ev => {
													const editor = getEditor();
													const modeMap = note_type_array.find(t => t[0] === ev.target.value);
													if (code_aceenable) {
														const mode = modeMap ? modeMap[2] : 'text';
														editor?.session?.setMode('ace/mode/' + mode);
													} else if (code_cmenable) {
														const mode = modeMap ? modeMap[3] : null;
														if (mode && mode !== 'null') {
															this.loadCMResource('mode', mode).then(() => {
																editor?.setOption('mode', mode);
															});
														} else {
															editor?.setOption('mode', null);
														}
													}
												})
											}, note_type_array.map(([id, name]) =>
												E('option', { value: id, selected: id === (con[`model_note${i}`] || con.note_suffix || '') || undefined }, name))),
											E('span', _('Theme')),
											E('select', {
												change: ui.createHandlerFn(this, ev => {
													const editor = getEditor();
													const val = ev.target.value;
													if (code_aceenable) {
														editor?.setTheme('ace/theme/' + val);
													} else if (code_cmenable) {
														this.loadCMResource('theme', val).then(() => {
															editor?.setOption('theme', val);
														});
													}
												})
											}, (code_aceenable ? ace_theme_array : codemirror_theme_array).map(([val, name]) => E('option', { value: val, selected: val === (con.acetheme || con.cmtheme || 'monokai') || undefined }, name))
											),
										]) : '',
									E('span', _('Font')),
									E('select', {
										change: ui.createHandlerFn(this, ev => {
											const editor = getEditor();
											const val = ev.target.value;
											if (code_aceenable) {
												editor?.setFontSize(val + 'px');
											} else if (code_cmenable) {
												const wrapper = editor?.getWrapperElement();
												if (wrapper) wrapper.style.fontSize = val + 'px';
												editor?.refresh();
											} else {
												const wrapperEl = document.getElementById(id);
												const ta = wrapperEl?.querySelector('textarea');
												if (ta) ta.style.fontSize = val + 'px';
											}
										})
									}, ['12', '13', '14', '15', '16'].map(id =>
										E('option', { value: id, selected: id === (con.acefont_size || con.font_size || '14') || undefined }, id + 'px')
									)),
								]),
								E('a', {
									title: _('Save'), click: ui.createHandlerFn(this, () => {
										fs.write(filePath, getEditor().getValue())
											.then(() => this.showNotification(_('保存成功'), 3000, 'success'))
											.catch(err => this.showNotification(_('保存出错: %s').format(err.message), 3000, 'error'));
									})
								}, [svgIcon('save')]),
								E('a', {
									title: _('Upload File'), click: ui.createHandlerFn(this, () => {
										const fileInput = document.createElement('input');
										fileInput.type = 'file';
										fileInput.onchange = (e) => {
											const file = e.target.files[0];
											if (!file) return;
											const reader = new FileReader();
											reader.readAsText(file, 'UTF-8');
											reader.onload = (ev) => {
												const content = ev.target.result;
												getEditor().setValue(content, -1);
												fs.write(filePath, content)
													.then(() => this.showNotification(_('替换成功'), 3000, 'success'))
													.catch(err => this.showNotification(_('替换出错: %s').format(err.message), 3000, 'error'));
											};
										};
										fileInput.click();
									})
								}, [svgIcon('Upload')]),
								E('a', {
									title: _('Download'), click: ui.createHandlerFn(this, () => {
										const content = getEditor().getValue().trim();
										if (!content) return;
										const a = document.createElement('a');
										a.href = URL.createObjectURL(new Blob([content], { type: 'text/plain;charset=utf-8' }));
										a.download = 'data.txt';
										a.click();
										setTimeout(() => URL.revokeObjectURL(a.href), 100);
									})
								}, [svgIcon('download')]),
								E('a', { title: _('Clear'), click: () => getEditor().setValue('', -1) }, [svgIcon('delete')]),
								E('a', {
									title: _('Copy'), click: ui.createHandlerFn(this, () => {
										const content = getEditor().getValue().trim();
										if (!content) { this.showNotification(_('内容为空'), 3000, 'error'); return; }
										const ta = document.createElement('textarea');
										ta.value = content;
										ta.style.cssText = 'position:fixed;top:-9999px;left:-9999px;';
										document.body.appendChild(ta);
										ta.select();
										try {
											document.execCommand('copy');
											this.showNotification(_('内容已复制'), 3000, 'success');
										} catch (e) {
											this.showNotification(_('复制出错'), 3000, 'error');
										} finally {
											document.body.removeChild(ta);
										}
									})
								}, [svgIcon('copy')]),
								E('a', {
									title: _('full screen'),
									click: ui.createHandlerFn(this, ev => {
										const wrapper = document.getElementById(`${id}-wrapper`);
										const editorEl = wrapper.querySelector('.ace_editor, .CodeMirror, textarea');
										const isFull = wrapper.classList.toggle('fullScreen');
										const btn = ev.currentTarget;
										btn.title = isFull ? _('Exit full screen') : _('full screen');
										btn.innerHTML = ICONS[isFull ? 'close_fullscreen' : 'open_fullscreen'];

										const setSize = (h) => Object.assign(editorEl.style, { height: h + 'px', width: '100%' });

										if (isFull) {
											requestAnimationFrame(() => {
												const menuH = wrapper.querySelector('.editorMenu').offsetHeight;
												const statusH = wrapper.querySelector('.statusBar').offsetHeight;
												setSize(wrapper.offsetHeight - menuH - statusH);
												resizeFn();
											});
										} else {
											setSize(currentCon.aceheight || currentCon.height || '300');
											resizeFn();
											setTimeout(() => wrapper.scrollIntoView({ block: 'center' }), 0);
										}
									})
								}, [svgIcon('open_fullscreen')])
							]),
						]);
					}
					if (code_aceenable) {
						return this.preloadAceEditor().then(() => {
							for (let i = 1; i <= note_sum; i++) {
								const useCustom = currentCon[`enablenote${i}`] === 'true';
								const fileType = useCustom && currentCon[`model_note${i}`] ? currentCon[`model_note${i}`] : note_suffix;
								const fileReadOnly = useCustom ? (currentCon[`only_note${i}`] === 'true') : (currentCon.aceonly === 'true');
								const modeMap = note_type_array.find(t => t[0] === fileType);
								const mode = modeMap ? modeMap[2] : 'text';

								setTimeout(() => {
									const id = `editor-${i}`;
									const el = document.getElementById(id);
									if (!el) return;
									const parentNode = el.parentNode;
									const filePath = `${note_path}/note${String(i).padStart(2, '0')}.${fileType}`;
									if (this.aceEditors[id]) this.aceEditors[id].destroy();
									const editorDiv = E('div', { id: id + '_ace', style: `height:${currentCon.aceheight || '300'}px;width:100%;` });
									const wrapperDiv = buildToolbar.call(this, i, () => this.aceEditors[id], filePath, () => this.aceEditors[id].resize(), currentCon);
									wrapperDiv.appendChild(editorDiv);
									wrapperDiv.appendChild(E('div', { class: 'statusBar' }, [
										E('div', { class: 'status-left', id: `${id}AceLine` }, 'Ln: 1;Col: 1;Max Col: 1'),
										E('div', { class: 'status-right', id: `${id}TextSize` }, 'Size: 0 Bytes')
									]));

									parentNode.innerHTML = '';
									parentNode.appendChild(wrapperDiv);
									const btn = buildButton(i, filePath, fileReadOnly);
									if (btn) parentNode.appendChild(btn);

									const editor = ace.edit(editorDiv);
									editor.setTheme(`ace/theme/${currentCon.acetheme || 'monokai'}`);
									editor.session.setMode(`ace/mode/${mode}`);
									editor.setFontSize(parseInt(currentCon.acefont_size) || 13);
									editor.setReadOnly(fileReadOnly);
									editor.setShowPrintMargin(false);
									editor.container.style.lineHeight = currentCon.aceline_spacing || '1.2';
									this.aceEditors[id] = editor;

									const updateUIStatus = (ed, edId) => {
										const pos = ed.getCursorPosition();
										const content = ed.getValue();
										document.getElementById(`${edId}AceLine`).textContent = `Ln: ${pos.row + 1}; Col: ${pos.column + 1}; Max Col: ${ed.session.getLine(pos.row)?.length || 0}`;
										document.getElementById(`${edId}TextSize`).textContent = `Size: ${new Blob([content]).size} Bytes`;
									};
									fs.read(filePath).then(content => { editor.setValue(content || '', -1); updateUIStatus(editor, id); });
									editor.on('change', () => updateUIStatus(editor, id));
									editor.selection.on('changeCursor', () => updateUIStatus(editor, id));
								}, i * 100);
							}
						}).catch(() => fallbackToTextarea());
					} else if (code_cmenable) {
						return this.preloadCodeMirror().then(() => {
							const themesToLoad = new Set();
							const modesToLoad = new Set();

							for (let i = 1; i <= note_sum; i++) {
								const useCustom = currentCon[`enablenote${i}`] === 'true';
								const fileType = useCustom && currentCon[`model_note${i}`]
									? currentCon[`model_note${i}`]
									: note_suffix;
								const modeMap = note_type_array.find(t => t[0] === fileType);
								const mode = modeMap ? modeMap[3] : 'null';

								themesToLoad.add(currentCon.cmtheme || 'monokai');
								if (mode !== 'null') modesToLoad.add(mode);
							}

							const loadPromises = [];
							themesToLoad.forEach(theme => loadPromises.push(this.loadCMResource('theme', theme)));
							modesToLoad.forEach(mode => loadPromises.push(this.loadCMResource('mode', mode)));

							return Promise.all(loadPromises).then(() => {
								for (let i = 1; i <= note_sum; i++) {
									const useCustom = currentCon[`enablenote${i}`] === 'true';
									const fileType = useCustom && currentCon[`model_note${i}`]
										? currentCon[`model_note${i}`]
										: note_suffix;
									const fileReadOnly = useCustom
										? (currentCon[`only_note${i}`] === 'true')
										: (currentCon.only === 'true');
									const modeMap = note_type_array.find(t => t[0] === fileType);
									const mode = modeMap ? modeMap[3] : 'null';

									setTimeout(() => {
										const id = `editor-${i}`;
										const el = document.getElementById(id);
										if (!el) return;
										const parentNode = el.parentNode;
										const filePath = `${note_path}/note${String(i).padStart(2, '0')}.${fileType}`;
										const editorDiv = E('div', { id: id + '_cm' });
										const wrapperDiv = buildToolbar.call(this, i, () => this.cmEditors[id], filePath, () => this.cmEditors[id].refresh(), currentCon);
										wrapperDiv.appendChild(editorDiv);
										wrapperDiv.appendChild(E('div', { class: 'statusBar' }, [
											E('div', { class: 'status-left', id: `${id}CmLine` }, 'Ln: 1; Col: 1'),
											E('div', { class: 'status-right', id: `${id}TextSize` }, 'Size: 0 Bytes')
										]));

										parentNode.innerHTML = '';
										parentNode.appendChild(wrapperDiv);

										const btn = buildButton(i, filePath, fileReadOnly);
										if (btn) parentNode.appendChild(btn);

										const editor = CodeMirror(editorDiv, {
											lineNumbers: true, mode: mode === 'null' ? null : mode,
											theme: currentCon.cmtheme || 'monokai', readOnly: fileReadOnly,
											lineWrapping: true, indentUnit: 4, tabSize: 4
										});
										// editor.setSize(currentCon.width, currentCon.height);
										editor.getWrapperElement().style.fontSize = (currentCon.font_size || '13') + 'px';
										editor.getWrapperElement().style.fontFamily = "'Consolas', 'Monaco', 'Courier New', monospace";
										editor.getWrapperElement().style.lineHeight = currentCon.line_spacing || '1.2';
										editor.refresh();
										this.cmEditors[id] = editor;

										const updateUIStatus = (ed, edId) => {
											const cursor = ed.getCursor();
											const content = ed.getValue();
											document.getElementById(`${edId}CmLine`).textContent = `Ln: ${cursor.line + 1}; Col: ${cursor.ch + 1}`;
											document.getElementById(`${edId}TextSize`).textContent = `Size: ${new Blob([content]).size} Bytes`;
										};
										fs.read(filePath).then(content => { editor.setValue(content || ''); updateUIStatus(editor, id); }).catch(() => editor.setValue(''));
										editor.on('change', () => updateUIStatus(editor, id));
										editor.on('cursorActivity', () => updateUIStatus(editor, id));
									}, i * 200);
								}
							});
						}).catch(() => fallbackToTextarea());
					} else fallbackToTextarea();
				})
				.catch(() => {});
		};

		return m.render();
	},

	showNotification(message, timeout = 3000, type = 'info') {
		if (!this._notificationQueue) this._notificationQueue = [];
		if (document.querySelector('.file-notification')?.textContent === message) return;
		const colors = { success: '#4CAF50', error: '#f44336', warning: '#ff9800', info: '#2196F3' };
		const n = document.createElement('div');
		n.className = 'file-notification';
		n.textContent = message;
		n.onclick = () => remove(n);
		n.style.cssText = `position:fixed;top:${20 + this._notificationQueue.length * 70}px;right:20px;
		z-index:20000;padding:12px 24px;border-radius:4px;color:#fff;font-weight:500;cursor:pointer;
		background:${colors[type] || colors.info};box-shadow:0 4px 12px rgba(0,0,0,.15);
		opacity:0;transform:translateX(30px);transition:all .3s;max-width:400px;word-wrap:break-word;`;
		document.body.appendChild(n);
		this._notificationQueue.push(n);
		requestAnimationFrame(() => { n.style.opacity = '1'; n.style.transform = 'translateX(0)'; });
		setTimeout(() => remove(n), timeout > 0 ? timeout : 3000);

		const remove = (n) => {
			if (!n?.parentNode) return;
			n.style.opacity = '0';
			n.style.transform = 'translateX(30px)';
			n.addEventListener('transitionend', () => {
				n.remove();
				this._notificationQueue.splice(this._notificationQueue.indexOf(n), 1);
				this._notificationQueue.forEach((item, i) => item.style.top = `${20 + i * 70}px`);
			}, { once: true });
		};
	},

	handleSaveApply: function (ev, mode) {
		const oldCon = uci.get_first('luci', 'tinynote');
		const oldCfg = {
			path: oldCon.note_path || '/etc/tinynote',
			sum: parseInt(oldCon.note_sum) || 1,
			suffix: oldCon.note_suffix || 'txt',
			files: {}
		};

		for (let i = 1; i <= oldCfg.sum; i++) {
			oldCfg.files[i] = {
				enabled: oldCon[`enablenote${i}`] === 'true',
				type: oldCon[`model_note${i}`] || oldCfg.suffix,
				readonly: oldCon[`only_note${i}`] === 'true'
			};
		}

		return this.super('handleSaveApply', [ev, mode])
			.then(() => uci.load('luci'))
			.then(() => {
				const newCon = uci.get_first('luci', 'tinynote');
				const newCfg = {
					path: newCon.note_path || '/etc/tinynote',
					sum: parseInt(newCon.note_sum) || 1,
					suffix: newCon.note_suffix || 'txt',
					files: {}
				};

				for (let i = 1; i <= newCfg.sum; i++) {
					newCfg.files[i] = {
						enabled: newCon[`enablenote${i}`] === 'true',
						type: newCon[`model_note${i}`] || newCfg.suffix,
						readonly: newCon[`only_note${i}`] === 'true'
					};
				}

				// 情况1：全局路径改变 - 删除旧路径文件，新路径创建文件
				if (oldCfg.path !== newCfg.path) {
					return fs.list(oldCfg.path).then(files => {
						if (!files) return;
						return Promise.all(
							files.filter(f => f.name.match(/^note\d{2}\./))
								.map(f => fs.remove(`${oldCfg.path}/${f.name}`).catch(() => {}))
						);
					}).catch(() => {})
						.then(() => fs.stat(newCfg.path).catch(() => fs.exec('/bin/mkdir', ['-p', newCfg.path])))
						.then(() => {
							const ensurePromises = [];
							for (let i = 1; i <= newCfg.sum; i++) {
								const newFile = newCfg.files[i];
								const filePath = `${newCfg.path}/note${String(i).padStart(2, '0')}.${newFile.type}`;
								const perm = ['sh', 'lua', 'py'].includes(newFile.type) ? parseInt('755', 8) : parseInt('644', 8);
								ensurePromises.push(
									fs.stat(filePath).catch(() => fs.write(filePath, templates[newFile.type] || '', perm))
								);
							}
							return Promise.all(ensurePromises);
						});
				}
				const cleanupPromises = [];

				// 情况2：文件数量减少 - 删除多余文件
				for (let i = 1; i <= Math.max(oldCfg.sum, newCfg.sum); i++) {
					const oldFile = oldCfg.files[i];
					const newFile = newCfg.files[i];

					if (i > newCfg.sum && oldFile) {
						const oldPath = `${oldCfg.path}/note${String(i).padStart(2, '0')}.${oldFile.type}`;
						cleanupPromises.push(fs.remove(oldPath).catch(() => {}));
						continue;
					}

					// 情况3：文件类型改变 - 迁移内容
					if (oldFile && newFile && oldFile.type !== newFile.type && newFile.enabled) {
						const oldPath = `${newCfg.path}/note${String(i).padStart(2, '0')}.${oldFile.type}`;
						const newPath = `${newCfg.path}/note${String(i).padStart(2, '0')}.${newFile.type}`;
						cleanupPromises.push(
							fs.read(oldPath).then(content =>
								fs.write(newPath, content).then(() => fs.remove(oldPath).catch(() => {}))
							).catch(() => {})
						);
					}
				}

				// 情况4：全局后缀改变 - 只影响未启用单独设置的文件
				if (oldCfg.suffix !== newCfg.suffix) {
					for (let i = 1; i <= newCfg.sum; i++) {
						const newFile = newCfg.files[i];
						if (!newFile.enabled) {
							const oldPath = `${newCfg.path}/note${String(i).padStart(2, '0')}.${oldCfg.suffix}`;
							const newPath = `${newCfg.path}/note${String(i).padStart(2, '0')}.${newCfg.suffix}`;
							cleanupPromises.push(
								fs.read(oldPath).then(content =>
									fs.write(newPath, content).then(() => fs.remove(oldPath).catch(() => {}))
								).catch(() => {})
							);
						}
					}
				}

				return Promise.all(cleanupPromises).then(() => {
					const ensurePromises = [];
					for (let i = 1; i <= newCfg.sum; i++) {
						const newFile = newCfg.files[i];
						const filePath = `${newCfg.path}/note${String(i).padStart(2, '0')}.${newFile.type}`;
						const perm = ['sh', 'lua', 'py'].includes(newFile.type) ? parseInt('755', 8) : parseInt('644', 8);
						ensurePromises.push(
							fs.stat(filePath).catch(() => fs.write(filePath, templates[newFile.type] || '', perm))
						);
					}
					return Promise.all(ensurePromises);
				}).then(() =>
					ui.addNotification(null, E('p', _('Config saved, files updated')), 'info')
				);
			}).catch(err => {
				console.error('Save/Cleanup error:', err);
			});
	},
});
