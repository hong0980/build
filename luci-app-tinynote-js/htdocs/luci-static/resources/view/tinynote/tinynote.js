'use strict';
'require fs';
'require uci';
'require form';
'require view';
'require ui';

const note_type_array = [
	['lua', 'Lua', 'lua', 'lua'],
	['sh', 'Shell Script', 'sh', 'shell'],
	['py', 'Python', 'python', 'python'],
	['txt', 'Plain Text', 'text', 'null']
];

const ace_theme_array = [
	['monokai', 'Monokai (Dark)'],
	['tomorrow_night', 'Tomorrow Night (Dark)'],
	['dracula', 'Dracula (Dark)'],
	['twilight', 'Twilight (Dark)'],
	['cobalt', 'Cobalt (Dark)'],
	['vibrant_ink', 'Vibrant Ink (Dark)'],
	['terminal', 'Terminal (Dark)'],
	['chaos', 'Chaos (Dark)'],
	['chrome', 'Chrome (Light)'],
	['clouds', 'Clouds (Light)'],
	['crimson_editor', 'Crimson Editor (Light)'],
	['dawn', 'Dawn (Light)'],
	['dreamweaver', 'Dreamweaver (Light)'],
	['eclipse', 'Eclipse (Light)'],
	['github', 'GitHub (Light)'],
	['textmate', 'TextMate (Light)'],
	['xcode', 'Xcode (Light)'],
	['kuroir', 'Kuroir (Light)']
];

const codemirror_theme_array = [
	['monokai', 'Monokai (Dark)'],
	['dracula', 'Dracula (Dark)'],
	['material', 'Material (Dark)'],
	['midnight', 'Midnight (Dark)'],
	['default', 'Default (Light)'],
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
.column {
  display: block;
  flex-basis: 0;
  flex-grow: 1;
  flex-shrink: 1;
  padding: 0.75rem;
}

@media screen and (min-width: 769px), print {
  .field.is-horizontal {
    display: flex;
  }
}
.m-0 {
  margin: 0;
}
.pl-0 {
  padding-left: 0;
}
.p-0 {
  padding: 0;
}
.aceEditorMenu {
    width: 100%;
    height: 35px;
    margin: 0;
    -moz-box-sizing: border-box;
    -webkit-box-sizing: border-box;
    box-sizing: border-box;
    color: #fff;
    background-color: #727272;
    border-bottom: 1px solid #727272
}

.aceEditorMenu a {
    margin: 0 4px;
    padding-top: 7px;
    color: #f5f5f5;
    cursor: pointer;
}

.aceEditorBorder {
    border: 1px solid #4a4a4a
}

.editortoolbar {
    position: relative;
    display: inline-block;
    white-space: nowrap;
    vertical-align: middle;
    font-size: 14px;
    float: right;
}

.twoEditor {
    height: 60vh;
    width: 100%
}

.aceEditorBorder .aceEditorMenu {
    background-color: #363636;
    border-bottom: 1px solid #363636;
    /* padding: 6px; */
}

.aceEditorBorder .aceStatusBar {
    background-color: #363636;
    border-bottom: 1px solid #363636;
    color: #f5f5f5;
    padding: 5px;
    display: flex;
    align-items: center;
}

.aceEditorBorder .aceStatusBar .status-left {
    flex-grow: 1;
    padding-left: 10px;
}

.aceEditorBorder .aceStatusBar .status-right {
    padding-right: 10px;
}

.fullScreen {
    position: fixed;
    z-index: 9999;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    width: 100%;
}`

const ICONS = {
	Upload: '<svg viewBox="0 0 24 24" width="22" height="22" style="vertical-align:middle;"><path fill="currentColor" d="M5,4V6H19V4H5M5,14H9V20H15V14H19L12,7L5,14Z"/></svg>',
	save: '<svg viewBox="0 0 24 24" width="22" height="22" style="vertical-align:middle;"><path fill="currentColor" d="M15,9H5V5H15M12,19A3,3 0 0,1 9,16A3,3 0 0,1 12,13A3,3 0 0,1 15,16A3,3 0 0,1 12,19M17,3H5C3.89,3 3,3.9 3,5V19A2,2 0 0,0 5,21H19A2,2 0 0,0 21,19V7L17,3Z"/></svg>',
	download: '<svg viewBox="0 0 24 24" width="22" height="22" style="vertical-align:middle;"><path fill="currentColor" d="M17,13L12,18L7,13H10V9H14V13M19.35,10.04C18.67,6.59 15.64,4 12,4C9.11,4 6.6,5.64 5.35,8.04C2.34,8.36 0,10.91 0,14A6,6 0 0,0 6,20H19A5,5 0 0,0 24,15C24,12.36 21.95,10.22 19.35,10.04Z"/></svg>',
	delete: '<svg viewBox="0 0 24 24" width="22" height="22" style="vertical-align:middle;"><path fill="currentColor" d="M19,4H15.5L14.5,3H9.5L8.5,4H5V6H19M6,19A2,2 0 0,0 8,21H16A2,2 0 0,0 18,19V7H6V19Z"/></svg>',
	copy: '<svg viewBox="0 0 24 24" width="22" height="22" style="vertical-align:middle;"><path fill="currentColor" d="M19,21H8V7H19M19,5H8A2,2 0 0,0 6,7V21A2,2 0 0,0 8,23H19A2,2 0 0,0 21,21V7A2,2 0 0,0 19,5M16,1H4A2,2 0 0,0 2,3V17H4V3H16V1Z"/></svg>',
	open_in_full: '<svg viewBox="0 0 24 24" width="22" height="22" style="vertical-align:middle;"><path fill="currentColor" d="M21,11V3H13L16.29,6.29L6.29,16.29L3,13V21H11L7.71,17.71L17.71,7.71L21,11Z"/></svg>',
	close_fullscreen: '<svg viewBox="0 0 24 24" width="22" height="22" style="vertical-align:middle;"><path fill="currentColor" d="M22,3.41L16.71,8.7L20,12H12V4L15.29,7.29L20.59,2L22,3.41M3.41,22L8.7,16.71L12,20V12H4L7.29,15.29L2,20.59L3.41,22Z"/></svg>'
};

return view.extend({
	aceEditors: {},
	cmEditors: {},

	loadJS: function (cdns, checkFn, onLoad) {
		const urls = Array.isArray(cdns) ? cdns : [cdns];

		return new Promise(resolve => {
			// 检查是否已加载
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
		});
	},

	preloadCodeMirror: function () {
		if (window._cmReady) return Promise.resolve(true);
		if (window._cmPromise) return window._cmPromise;

		const version = '6.65.7';
		const cdns = [
			{
				css: `https://lib.baomitu.com/codemirror/${version}/codemirror.min.css`,
				js: `https://lib.baomitu.com/codemirror/${version}/codemirror.min.js`,
				base: `https://lib.baomitu.com/codemirror/${version}`
			},
			{
				css: `https://cdn.staticfile.net/codemirror/${version}/codemirror.min.css`,
				js: `https://cdn.staticfile.net/codemirror/${version}/codemirror.min.js`,
				base: `https://cdn.staticfile.net/codemirror/${version}`
			},
			{
				css: `https://cdn.bootcdn.net/ajax/libs/codemirror/${version}/codemirror.min.css`,
				js: `https://cdn.bootcdn.net/ajax/libs/codemirror/${version}/codemirror.min.js`,
				base: `https://cdn.bootcdn.net/ajax/libs/codemirror/${version}`
			},
			{
				css: `https://cdn.jsdelivr.net/npm/codemirror@${version}/lib/codemirror.min.css`,
				js: `https://cdn.jsdelivr.net/npm/codemirror@${version}/lib/codemirror.min.js`,
				base: `https://cdn.jsdelivr.net/npm/codemirror@${version}`
			}
		];

		return window._cmPromise = new Promise(resolve => {
			if (window.CodeMirror) {
				window._cmReady = true;
				return resolve(true);
			}

			let i = 0;
			const load = () => {
				if (i >= cdns.length) {
					window._cmPromise = null;
					return resolve(false);
				}

				const cdn = cdns[i++];

				// 加载 CSS
				const css = document.createElement('link');
				css.rel = 'stylesheet';
				css.href = cdn.css;
				css.onerror = () => { css.remove(); load(); };
				document.head.appendChild(css);

				// 加载 JS
				const script = document.createElement('script');
				script.src = cdn.js;
				script.onload = () => {
					if (window.CodeMirror) {
						window._cmReady = true;
						window._cmBase = cdn.base;
						resolve(true);
					} else {
						script.remove();
						css.remove();
						load();
					}
				};
				script.onerror = () => {
					script.remove();
					css.remove();
					load();
				};
				document.head.appendChild(script);
			};

			load();
		});
	},

	loadCMResource: function (type, name) {
		if (!window.CodeMirror) return Promise.resolve(true);
		if (type === 'mode' && name === 'null') return Promise.resolve(true);
		if (type === 'theme' && name === 'default') return Promise.resolve(true);

		return new Promise(resolve => {
			const base = window._cmBase || 'https://cdn.jsdelivr.net/npm/codemirror@6.65.7';
			const isUnpkg = base.includes('unpkg');

			let url;
			if (type === 'theme') {
				url = isUnpkg ? `${base}/theme/${name}.css` : `${base}/theme/${name}.min.css`;
			} else {
				url = isUnpkg ? `${base}/mode/${name}/${name}.js` : `${base}/mode/${name}/${name}.min.js`;
			}

			if (type === 'theme') {
				const link = document.createElement('link');
				link.rel = 'stylesheet';
				link.href = url;
				link.onload = () => resolve(true);
				link.onerror = () => {
					resolve(false);
				};
				document.head.appendChild(link);
			} else {
				const script = document.createElement('script');
				script.src = url;
				script.onload = () => resolve(true);
				script.onerror = () => {
					resolve(false);
				};
				document.head.appendChild(script);
			}
		});
	},

	// 新增：加载其他常用库
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
			screenfull: {
				urls: [
					'https://cdn.staticfile.net/screenfull.js/5.2.0/screenfull.min.js',
					'https://lib.baomitu.com/screenfull.js/5.2.0/screenfull.min.js',
					'https://cdn.bootcdn.net/ajax/libs/screenfull.js/5.2.0/screenfull.min.js',
					'https://cdn.jsdelivr.net/npm/screenfull@5.2.0/dist/screenfull.min.js'
				],
				check: () => window.screenfull
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
			},
			marked: {
				urls: [
					'https://cdn.staticfile.net/marked/11.1.1/lib/marked.esm.min.js',
					'https://lib.baomitu.com/marked/11.1.1/marked.min.js',
					'https://cdn.bootcdn.net/ajax/libs/marked/11.1.1/marked.min.js',
					'https://cdn.jsdelivr.net/npm/marked@11.1.1/marked.min.js'
				],
				check: () => window.marked
			}
		};

		const lib = libs[name.toLowerCase()];
		if (!lib) return Promise.reject(new Error(`Unknown library: ${name}`));

		return this.loadJS(lib.urls, lib.check);
	},

	// 新增：加载 CSS 库
	loadCSSLibrary: function (name) {
		const libs = {
			bulma: [
				'/luci-static/tinynote/bulma.css',
				'https://cdn.staticfile.net/bulma/1.0.4/css/bulma.css',
				'https://lib.baomitu.com/bulma/1.0.4/css/bulma.min.css',
				'https://cdn.bootcdn.net/ajax/libs/bulma/1.0.4/css/bulma.min.css',
				'https://cdn.jsdelivr.net/npm/bulma@1.0.4/css/bulma.min.css'
			],
			icons:
				['https://cdn.jsdelivr.net/npm/@mdi/font@7.4.47/css/materialdesignicons.min.css'],
			fontawesome: [
				'https://cdn.staticfile.net/font-awesome/6.5.1/css/all.min.css',
				'https://lib.baomitu.com/font-awesome/6.5.1/css/all.min.css',
				'https://cdn.bootcdn.net/ajax/libs/font-awesome/6.5.1/css/all.min.css',
				'https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.5.1/css/all.min.css'
			],
			bootstrap: [
				'https://cdn.staticfile.net/bootstrap/5.3.3/css/bootstrap.min.css',
				'https://lib.baomitu.com/bootstrap/5.3.8/css/bootstrap.min.css',
				'https://cdn.bootcdn.net/ajax/libs/bootstrap/5.3.8/css/bootstrap.min.css',
				'https://cdn.jsdelivr.net/npm/bootstrap@5.3.8/dist/css/bootstrap.min.css'
			]
		};

		const urls = libs[name.toLowerCase()];
		if (!urls) return Promise.reject(new Error(`Unknown CSS library: ${name}`));

		return this.loadCSS(urls);
	},

	load: function () {
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
		if (!this.styleInjected) {
			document.head.appendChild(E('style', { id: 'fb-css' }, CSS));
			this.styleInjected = true;
		}
		// this.loadLibrary('jquery').then(success => {
		// 	if (success) {
		// 		console.log('jQuery version:', $.fn.jquery);
		// 	}
		// });
		// this.loadLibrary('screenfull').then((t) => {
		// 	console.log(screenfull.isEnabled)
		// });
		let m, s, o;
		const con = uci.get_first('luci', 'tinynote');
		const note_sum = parseInt(con.note_sum) || 1;
		const note_suffix = con.note_suffix || "txt";
		const note_path = con.note_path || "/etc/tinynote";
		const code_cmenable = uci.get_bool('luci', 'tinynote', 'enable');
		const code_aceenable = uci.get_bool('luci', 'tinynote', 'aceenable');

		m = new form.Map('luci', '');
		s = m.section(form.NamedSection, 'tinynote', 'tinynote', '');

		s.tab("note", _('Basic Settings'));
		s.tab("ace", _("Ace Support"));
		s.tab("codemirror", _("CodeMirror Support"));

		// Basic Settings
		o = s.taboption("note", form.Value, 'note_path', _('Save Path'));
		o.default = "/etc/tinynote";

		o = s.taboption("note", form.Value, 'note_sum', _('Number of Texts'));
		o.default = 1;
		o.rmempty = false;
		o.datatype = "range(1,20)";

		o = s.taboption("note", form.ListValue, 'note_suffix', _('Text Type'));
		o.default = 'txt';
		note_type_array.forEach(([val, text]) => o.value(val, text));

		let aceenable = s.taboption("note", form.Flag, 'aceenable', _('Enable Ace Support'));
		aceenable.depends('enable', '0');
		aceenable.depends('enable', null);

		let enable = s.taboption("note", form.Flag, 'enable', _('Enable CodeMirror Support'));
		enable.depends('aceenable', '0');
		enable.depends('aceenable', null);

		// Ace Settings
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

		// CodeMirror Settings
		o = s.taboption("codemirror", form.Flag, 'only', _('Read-Only Mode'));
		o.depends('enable', '1');
		o.enabled = 'true';
		o.disabled = 'false';

		o = s.taboption("codemirror", form.ListValue, 'cmtheme', _('Theme'));
		o.depends('enable', '1');
		o.default = 'monokai';
		codemirror_theme_array.forEach(([val, text]) => o.value(val, text));

		o = s.taboption("codemirror", form.ListValue, 'font_size', _('Font Size'));
		o.depends('enable', '1');
		o.default = '13';
		['10', '12', '13', '14', '15', '16'].forEach(size => o.value(size, size + 'px'));

		o = s.taboption("codemirror", form.ListValue, 'line_spacing', _('Line Spacing'));
		o.depends('enable', '1');
		o.default = '1.2';
		['1.0', '1.2', '1.3', '1.5'].forEach(v => o.value(v, v));

		o = s.taboption("codemirror", form.Value, 'height', _('Display Height'));
		o.depends('enable', '1');
		o.default = '300';
		o.datatype = 'range(100,1000)';

		o = s.taboption("codemirror", form.Value, 'width', _('Display Width'));
		o.depends('enable', '1');
		o.default = '940';
		o.datatype = 'range(100,2000)';

		// File Editor Section
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

			if (code_aceenable || code_cmenable) {
				o = s.taboption(tabId, form.DummyValue, `_editor${i}`);
				o.rawhtml = true;
				o.render = L.bind(function () {
					const currentCon = uci.get_first('luci', 'tinynote');
					const useCustomSettings = currentCon[`enablenote${i}`] === 'true';
					const fileType = useCustomSettings && currentCon[`model_note${i}`]
						? currentCon[`model_note${i}`]
						: note_suffix;
					let fileReadOnly;
					if (useCustomSettings) {
						fileReadOnly = currentCon[`only_note${i}`] === 'true';
					} else {
						fileReadOnly = code_aceenable
							? (currentCon.aceonly === 'true')
							: (currentCon.only === 'true');
					}
					const id = `editor-${i}`;
					const height = code_aceenable ? (currentCon.aceheight || '500') : (currentCon.height || '500');
					const button = E('div', [
						E('div', { style: 'margin-top: 10px;padding:0 0 8px;' }, [
							E('button', {
								class: 'btn cbi-button-save',
								style: fileReadOnly ? 'opacity: 0.5; cursor: not-allowed; pointer-events: none;' : '',
								click: ui.createHandlerFn(this, ev => {
									ev.preventDefault();
									const editor = (code_aceenable ? this.aceEditors : this.cmEditors)[id];
									if (!editor) return ui.addNotification(null, E('p', _('Editor not ready')), 'error');
									fs.write(actualFilePath, editor.getValue())
										.then(() => ui.addNotification(null, E('p', _('Saved')), 'success'))
										.catch(err => ui.addNotification(null, E('p', _('Failed: ') + err), 'error'));
								})
							}, _('Save') + ' ' + _('Note %s').format(String(i).padStart(2, '0'))),
							E('button', {
								class: 'btn cbi-button-reset',
								style: 'margin-left: 5px;',
								click: ui.createHandlerFn(this, ev => {
									ev.preventDefault();
									const editor = (code_aceenable ? this.aceEditors : this.cmEditors)[id];
									if (!editor) return ui.addNotification(null, E('p', _('Editor not ready')), 'error');
									fs.read(actualFilePath).then(content => {
										if (code_aceenable) {
											editor.setValue(content || '', -1);
											editor.clearSelection();
										} else {
											editor.setValue(content || '');
										}
										ui.addNotification(null, E('p', _('Reloaded')), 'success');
									}).catch(err => ui.addNotification(null, E('p', _('Failed: ') + err), 'error'));
								})
							}, _('Reload') + ' ' + _('Note %s').format(String(i).padStart(2, '0'))),
						])
					]);
					return E('div', {}, [
						code_aceenable
							? E('div', { id: id, style: `height:${height}px;border:1px solid #ccc;border-radius:4px;` })
							: E('textarea', { id: id, style: `width:100%;height:${height}px;` }),

					]);
				}, this);
			} else {
				o = s.taboption(tabId, form.TextValue, `content${i}`);
				o.rows = 25;
				o.monospace = true;
				o.load = () => {
					const currentCon = uci.get_first('luci', 'tinynote');
					const useCustom = currentCon[`enablenote${i}`] === 'true';
					const fileType = useCustom && currentCon[`model_note${i}`]
						? currentCon[`model_note${i}`]
						: note_suffix;
					const actualPath = `${note_path}/note${String(i).padStart(2, '0')}.${fileType}`;
					return fs.read(actualPath).catch(() => '');
				};
				o.write = (sid, val) => {
					const currentCon = uci.get_first('luci', 'tinynote');
					const useCustom = currentCon[`enablenote${i}`] === 'true';
					const fileType = useCustom && currentCon[`model_note${i}`]
						? currentCon[`model_note${i}`]
						: note_suffix;
					const actualPath = `${note_path}/note${String(i).padStart(2, '0')}.${fileType}`;
					return fs.write(actualPath, val || '');
				};
			}
		}

		note_path && fs.stat(note_path)
			.catch(() => fs.exec('/bin/mkdir', ['-p', note_path]))
			.then(() => {
				const currentCon = uci.get_first('luci', 'tinynote');

				return Promise.all(
					Array.from({ length: note_sum }, (_, i) => {
						const idx = i + 1;
						const useCustom = currentCon[`enablenote${idx}`] === 'true';
						const fileType = useCustom && currentCon[`model_note${idx}`]
							? currentCon[`model_note${idx}`]
							: note_suffix;

						const fileName = `${note_path}/note${String(idx).padStart(2, '0')}.${fileType}`;

						return fs.stat(fileName).catch(() => {
							return fs.write(fileName, templates[fileType] || '');
						});
					})
				);
			})
			.then(() => {
				const currentCon = uci.get_first('luci', 'tinynote');
				const buildButton = (i, id, filePath, fileReadOnly) => {
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
					span.innerHTML = ICONS[name] || '';
					return span.firstChild;
				};

				function buildToolbar(getEditor, filePath, id, resizeFn, currentCon) {
					return E('div', { class: 'aceEditorBorder', id: `${id}-wrapper` }, [
						E('div', { class: 'aceEditorMenu' }, [
							E('div', { class: 'editortoolbar btn-group-sm', style: 'padding-top:7px;' }, [
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
										this.loadLibrary('filesaver').then(() => {
											saveAs(new Blob([content], { type: 'text/plain; charset=utf-8' }), 'data.txt');
										});
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
									click: ui.createHandlerFn(this, (ev) => {
										const wrapper = document.getElementById(`${id}-wrapper`);
										const isFull = wrapper.classList.toggle('fullScreen');
										ev.currentTarget.innerHTML = ICONS[isFull ? 'close_fullscreen' : 'open_in_full'];
										if (isFull) {
											requestAnimationFrame(() => {
												const menuH = wrapper.querySelector('.aceEditorMenu').offsetHeight;
												const statusH = wrapper.querySelector('.aceStatusBar').offsetHeight;
												const editorH = wrapper.offsetHeight - menuH - statusH;
												const editorEl = wrapper.querySelector('.ace_editor') || wrapper.querySelector('.CodeMirror');
												editorEl.style.height = editorH + 'px';
												editorEl.style.width = '100%';
												resizeFn();
											});
										} else {
											wrapper.classList.remove('fullScreen');
											const h = currentCon.aceheight || currentCon.height || '300';
											const w = currentCon.width || '100%';
											const editorEl = wrapper.querySelector('.ace_editor') || wrapper.querySelector('.CodeMirror');
											editorEl.style.height = h + 'px';
											editorEl.style.width = w + 'px';
											resizeFn();
											setTimeout(() => wrapper.scrollIntoView({ block: 'center' }), 0);
										}
									})
								}, [svgIcon('open_in_full')])
							])
						]),
					]);
				}
				if (code_aceenable) {
					return this.preloadAceEditor().then(() => {
						if (!window._aceReady) return;

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
								const wrapperDiv = buildToolbar.call(this, () => this.aceEditors[id], filePath, id, () => this.aceEditors[id].resize(), currentCon);
								wrapperDiv.appendChild(editorDiv);
								wrapperDiv.appendChild(E('div', { class: 'column m-0 aceStatusBar' }, [
									E('div', { class: 'column is-two-thirds p-0 pl-0 status-left', id: `${id}AceLineColumn` }, 'Ln: 1; Col: 1; Max Col: 1'),
									E('div', { class: 'column is-one-thirds p-0 has-text-centered status-right', id: `${id}TextSize` }, 'Size: 0 Bytes')
								]));

								parentNode.innerHTML = '';
								parentNode.appendChild(wrapperDiv);
								const btn = buildButton(i, id, filePath, fileReadOnly);
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
									document.getElementById(`${edId}AceLineColumn`).textContent = `Ln: ${pos.row + 1}; Col: ${pos.column + 1}; Max Col: ${ed.session.getLine(pos.row)?.length || 0}`;
									document.getElementById(`${edId}TextSize`).textContent = `Size: ${new Blob([content]).size} Bytes`;
								};
								fs.read(filePath).then(content => { editor.setValue(content || '', -1); updateUIStatus(editor, id); });
								editor.on('change', () => updateUIStatus(editor, id));
								editor.selection.on('changeCursor', () => updateUIStatus(editor, id));
							}, i * 100);
						}
					});
				} else if (code_cmenable) {
					return this.preloadCodeMirror().then(() => {
						if (!window._cmReady) return;

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
									const wrapperDiv = buildToolbar.call(this, () => this.cmEditors[id], filePath, id, () => this.cmEditors[id].refresh(), currentCon);
									wrapperDiv.appendChild(editorDiv);
									wrapperDiv.appendChild(E('div', { class: 'column m-0 aceStatusBar' }, [
										E('div', { class: 'column is-two-thirds p-0 pl-0 status-left', id: `${id}CmLineColumn` }, 'Ln: 1; Col: 1'),
										E('div', { class: 'column is-one-thirds p-0 has-text-centered status-right', id: `${id}TextSize` }, 'Size: 0 Bytes')
									]));

									parentNode.innerHTML = '';
									parentNode.appendChild(wrapperDiv);

									const btn = buildButton(i, id, filePath, fileReadOnly);
									if (btn) parentNode.appendChild(btn);

									const editor = CodeMirror(editorDiv, {
										lineNumbers: true, mode: mode === 'null' ? null : mode,
										theme: currentCon.cmtheme || 'monokai', readOnly: fileReadOnly,
										lineWrapping: true, indentUnit: 4, tabSize: 4
									});
									editor.setSize(currentCon.width, currentCon.height);
									editor.getWrapperElement().style.fontSize = (currentCon.font_size || '13') + 'px';
									editor.getWrapperElement().style.fontFamily = "'Consolas', 'Monaco', 'Courier New', monospace";
									editor.getWrapperElement().style.lineHeight = currentCon.line_spacing || '1.2';
									editor.refresh();
									this.cmEditors[id] = editor;

									const updateUIStatus = (ed, edId) => {
										const cursor = ed.getCursor();
										const content = ed.getValue();
										document.getElementById(`${edId}CmLineColumn`).textContent = `Ln: ${cursor.line + 1}; Col: ${cursor.ch + 1}`;
										document.getElementById(`${edId}TextSize`).textContent = `Size: ${new Blob([content]).size} Bytes`;
									};
									fs.read(filePath).then(content => { editor.setValue(content || ''); updateUIStatus(editor, id); }).catch(() => editor.setValue(''));
									editor.on('change', () => updateUIStatus(editor, id));
									editor.on('cursorActivity', () => updateUIStatus(editor, id));
								}, i * 200);
							}
						});
					});
				}
			})
			.catch(() => {});

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

		// 记录每个文件的旧配置
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

				// 记录每个文件的新配置
				for (let i = 1; i <= newCfg.sum; i++) {
					newCfg.files[i] = {
						enabled: newCon[`enablenote${i}`] === 'true',
						type: newCon[`model_note${i}`] || newCfg.suffix,
						readonly: newCon[`only_note${i}`] === 'true'
					};
				}

				const cleanupPromises = [];

				// 情况1：全局路径改变 - 删除旧路径的所有文件
				if (oldCfg.path !== newCfg.path) {
					return fs.list(oldCfg.path).then(files => {
						if (!files) return;
						const deletes = files.filter(f => f.name.match(/^note\d{2}\./))
							.map(f => fs.remove(`${oldCfg.path}/${f.name}`).catch(() => {}));
						return Promise.all(deletes);
					}).catch(() => {});
				}

				// 情况2：处理每个文件
				for (let i = 1; i <= Math.max(oldCfg.sum, newCfg.sum); i++) {
					const oldFile = oldCfg.files[i];
					const newFile = newCfg.files[i];

					// 2.1 文件数量减少 - 删除多余文件
					if (i > newCfg.sum && oldFile) {
						const oldPath = `${oldCfg.path}/note${String(i).padStart(2, '0')}.${oldFile.type}`;
						cleanupPromises.push(fs.remove(oldPath).catch(() => {}));
						continue;
					}

					// 2.2 文件类型改变 - 重命名或复制内容
					if (oldFile && newFile && oldFile.type !== newFile.type) {
						const oldPath = `${newCfg.path}/note${String(i).padStart(2, '0')}.${oldFile.type}`;
						const newPath = `${newCfg.path}/note${String(i).padStart(2, '0')}.${newFile.type}`;

						// 读取旧文件内容，写入新文件，删除旧文件
						cleanupPromises.push(
							// fs.read(oldPath).then(content => {
							fs.write(newPath, templates[newFile.type]).then(() => {
								// 只有当文件类型真的改变时才删除旧文件
								if (oldPath !== newPath) {
									return fs.remove(oldPath).catch(() => {});
								}
							})
							// }).catch(() => {})
						);
					}
				}

				// 情况3：全局后缀改变 - 只影响未启用单独设置的文件
				if (oldCfg.suffix !== newCfg.suffix) {
					for (let i = 1; i <= newCfg.sum; i++) {
						const oldFile = oldCfg.files[i];
						const newFile = newCfg.files[i];

						// 只处理未启用单独设置的文件
						if (!newFile.enabled) {
							const oldPath = `${newCfg.path}/note${String(i).padStart(2, '0')}.${oldCfg.suffix}`;
							const newPath = `${newCfg.path}/note${String(i).padStart(2, '0')}.${newCfg.suffix}`;

							cleanupPromises.push(
								fs.read(oldPath).then(content => {
									return fs.write(newPath, content).then(() => {
										if (oldPath !== newPath) {
											return fs.remove(oldPath).catch(() => {});
										}
									});
								}).catch(() => {})
							);
						}
					}
				}

				if (cleanupPromises.length > 0) {
					return Promise.all(cleanupPromises).then(() =>
						ui.addNotification(null, E('p', _('Config saved, files updated')), 'info')
					);
				}
			}).catch(err => {
				console.error('Save/Cleanup error:', err);
			});
	},

	// handleSaveApply: function (ev, mode) {
	// 	const oldCon = uci.get_first('luci', 'tinynote');
	// 	const oldCfg = {
	// 		path: oldCon.note_path || '/etc/tinynote',
	// 		sum: parseInt(oldCon.note_sum) || 1,
	// 		suffix: oldCon.note_suffix || 'txt'
	// 	};

	// 	return this.super('handleSaveApply', [ev, mode]).then(() => uci.load('luci')).then(() => {
	// 		const newCon = uci.get_first('luci', 'tinynote');
	// 		const newCfg = {
	// 			path: newCon.note_path || '/etc/tinynote',
	// 			sum: parseInt(newCon.note_sum) || 1,
	// 			suffix: newCon.note_suffix || 'txt'
	// 		};

	// 		if (oldCfg.path !== newCfg.path || oldCfg.sum !== newCfg.sum || oldCfg.suffix !== newCfg.suffix) {
	// 			const cleanPath = oldCfg.path !== newCfg.path ? oldCfg.path : newCfg.path;
	// 			return fs.list(cleanPath).then(files => {
	// 				if (!files) return;
	// 				const deletes = files.filter(f => {
	// 					const match = f.name.match(/^note(\d{2})\.(.+)$/);
	// 					if (!match) return false;
	// 					const num = parseInt(match[1]);
	// 					const ext = match[2];
	// 					return oldCfg.path !== newCfg.path || num > newCfg.sum || ext !== newCfg.suffix;
	// 				}).map(f => fs.remove(`${cleanPath}/${f.name}`).catch(() => {}));

	// 				return Promise.all(deletes).then(() =>
	// 					ui.addNotification(null, E('p', _('Config saved, old files cleaned')), 'info')
	// 				);
	// 			}).catch(() => {});
	// 		}
	// 	});
	// }
});
