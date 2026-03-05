'use strict';
'require fs';
'require ui';
'require view';
'require poll';

var POLL_INTERVAL = 3;
var LOGFILE = '/tmp/easymesh.log';
var LOG_RE = /^(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}) \[\s*(\w+)\s*\] \[\s*(\w+)\s*\] (.*)$/;

var CATEGORIES = {
	'core':  { label: _('Core'),    icon: '⚙️',  color: '#58a6ff' },
	'roam':  { label: _('Roaming'), icon: '📶',  color: '#2ea44f' },
	'dfs':   { label: _('DFS/ACS'), icon: '📡',  color: '#e3b341' },
	'heal':  { label: _('Healing'), icon: '🔁',  color: '#f0883e' },
	'initd': { label: _('Init'),    icon: '🚀',  color: '#a371f7' }
};

var LEVEL_STYLE = {
	'ERROR': 'color:#f85149;font-weight:700',
	'WARN':  'color:#e3b341;font-weight:600',
	'INFO':  'color:#484f58'
};

var HIGHLIGHTS = [
	{ re: /\b(error|failed|fail|dead|crash)\b/gi,        style: 'color:#f85149;font-weight:600' },
	{ re: /\b(warn|warning)\b/gi,                        style: 'color:#e3b341' },
	{ re: /\b(master|approved|joined|ready|success)\b/gi,style: 'color:#2ea44f' },
	{ re: /\b(DFS|CSA|radar)\b/g,                        style: 'color:#e3b341;font-weight:600' },
	{ re: /\b(BSS-TM|steered|roam)\b/gi,                 style: 'color:#f0883e' },
	{ re: /([0-9a-f]{2}:){5}[0-9a-f]{2}/gi,              style: 'color:#d2a8ff;font-family:monospace' },
	{ re: /\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g,     style: 'color:#79c0ff;font-family:monospace' },
	{ re: /-\d{2,3}\s*dBm/gi,                            style: 'color:#ffa657' },
	{ re: /\bch(?:annel)?\s*[→:]\s*\d+/gi,               style: 'color:#56d364' },
	{ re: /OGM\s*\d+ms/gi,                               style: 'color:#56d364' }
];

function parseLog(raw) {
	if (!raw) return [];
	var entries = [];
	raw.split('\n').forEach(function(line) {
		if (!line.trim()) return;
		var m = LOG_RE.exec(line);
		if (!m) {
			entries.push({ ts: '', level: 'INFO', tag: 'core', msg: line, raw: line });
			return;
		}
		entries.push({ ts: m[1], level: m[2].trim(), tag: m[3].trim(), msg: m[4], raw: line });
	});
	return entries.reverse();
}

function badge(tag) {
	var c = CATEGORIES[tag] || { label: tag, icon: '·', color: '#7d8590' };
	return E('span', {
		style: 'display:inline-flex;align-items:center;gap:3px;white-space:nowrap;' +
		       'padding:1px 6px;border-radius:4px;font-size:10px;font-weight:700;' +
		       'letter-spacing:.3px;flex-shrink:0;' +
		       'background:' + c.color + '1a;color:' + c.color + ';' +
		       'border:1px solid ' + c.color + '44'
	}, c.icon + ' ' + c.label.toUpperCase());
}

function highlight(msg) {
	var regions = [];
	HIGHLIGHTS.forEach(function(h) {
		var re = new RegExp(h.re.source, h.re.flags.replace('g','') + 'g');
		var m;
		while ((m = re.exec(msg)) !== null)
			regions.push({ s: m.index, e: m.index + m[0].length, style: h.style, text: m[0] });
	});
	if (!regions.length) return [msg];

	regions.sort(function(a, b) { return a.s - b.s; });
	var out = [], cur = 0;
	regions.forEach(function(r) {
		if (r.s < cur) return;
		if (r.s > cur) out.push(msg.slice(cur, r.s));
		out.push(E('span', { style: r.style }, r.text));
		cur = r.e;
	});
	if (cur < msg.length) out.push(msg.slice(cur));
	return out;
}

function logRow(entry) {
	return E('div', {
		style: 'display:grid;' +
		       'grid-template-columns:150px 36px 90px 1fr;' +
		       'gap:0 10px;padding:4px 12px;' +
		       'border-bottom:1px solid #21262d;' +
		       'align-items:baseline;font-size:12px;line-height:1.7;' +
		       (entry.level === 'ERROR' ? 'background:#f8514908;' :
		        entry.level === 'WARN'  ? 'background:#e3b34106;' : ''),
		onmouseenter: function() { this.style.background = '#161b22'; },
		onmouseleave: function() {
			this.style.background =
				entry.level === 'ERROR' ? '#f8514908' :
				entry.level === 'WARN'  ? '#e3b34106' : '';
		}
	}, [
		E('span', { style: 'color:#484f58;font-family:monospace;font-size:11px' }, entry.ts),
		E('span', {
		style: (LEVEL_STYLE[entry.level] || LEVEL_STYLE['INFO']) +
		       ';font-size:10px;font-weight:700;font-family:monospace;' +
		        'flex-shrink:0;width:36px;text-align:center'
		}, entry.level),
		badge(entry.tag),
		E('span', { style: 'color:#c9d1d9;font-family:monospace;word-break:break-word' }, highlight(entry.msg))
	]);
}

return view.extend({
	_search: '', _paused: false, _lastCount: 0,
	_entries: [], _filter: 'all', _levelFilter: 'all',

	load: function() {
		return L.resolveDefault(fs.read(LOGFILE), '');
	},

	render: function(rawData) {
		var self = this;
		self._entries   = parseLog(rawData);
		self._lastCount = self._entries.length;

		var catButtons = [{ key: 'all', label: _('All'), icon: '📋', color: '#7d8590' }]
			.concat(Object.keys(CATEGORIES).map(function(k) {
				return { key: k, label: CATEGORIES[k].label,
						 icon: CATEGORIES[k].icon, color: CATEGORIES[k].color };
			}))
			.map(function(def) {
				return E('button', {
					'data-filter': def.key,
					style: 'padding:4px 11px;border-radius:5px;font-size:12px;cursor:pointer;' +
					       'border:1px solid ' + def.color + '55;' +
					       'background:' + (def.key === 'all' ? def.color + '22' : def.color + '0d') + ';' +
					       'color:' + def.color + ';transition:opacity .1s;' +
					       'font-weight:' + (def.key === 'all' ? '700' : '400') + ';' +
					       'opacity:' + (def.key === 'all' ? '1' : '0.65'),
					click: ui.createHandlerFn(this, function() {
						self._filter = def.key;
						filterBar.querySelectorAll('[data-filter]').forEach(function(b) {
							b.style.fontWeight = b.dataset.filter === def.key ? '700' : '400';
							b.style.opacity    = b.dataset.filter === def.key ? '1' : '0.65';
							b.style.background = b.dataset.filter === def.key
								? (CATEGORIES[b.dataset.filter] || {color:'#7d8590'}).color + '22'
								: (CATEGORIES[b.dataset.filter] || {color:'#7d8590'}).color + '0d';
						});
						self._doRender();
					})
				}, def.icon + ' ' + def.label);
			});

		var levelSelect = E('select', {
			style: 'background:#0d1117;border:1px solid #30363d;border-radius:5px;' +
			       'color:#e6edf3;padding:4px 8px;font-size:12px;cursor:pointer',
			onchange: function(ev) {
				self._levelFilter = (ev || window.event).target.value;
				self._doRender();
			}
		}, [
			E('option', { value: 'all',   selected: self._levelFilter === 'all'   }, _('All levels')),
			E('option', { value: 'ERROR', selected: self._levelFilter === 'ERROR' }, '🔴 ' + _('ERROR only')),
			E('option', { value: 'WARN',  selected: self._levelFilter === 'WARN'  }, '🟡 ' + _('WARN + ERROR')),
			E('option', { value: 'INFO',  selected: self._levelFilter === 'INFO'  }, '🔵 ' + _('INFO only'))
		]);

		var searchBox = E('input', {
			type: 'text', placeholder: _('Search…'),
			style: 'flex:1;min-width:140px;background:#0d1117;' +
			       'border:1px solid #30363d;border-radius:5px;' +
			       'color:#e6edf3;padding:4px 10px;font-size:12px;font-family:monospace;outline:none',
			oninput: function(ev) { self._search = (ev || window.event).target.value.toLowerCase(); self._doRender(); }
		});

		var pauseBtn = E('button', {
			style: 'padding:4px 11px;border-radius:5px;font-size:12px;cursor:pointer;' +
			       'border:1px solid #30363d;background:#161b22;color:#e6edf3',
			click: ui.createHandlerFn(this, function() {
				self._paused = !self._paused;
				this.textContent = self._paused ? '▶ ' + _('Resume') : '⏸ ' + _('Pause');
				this.style.borderColor = self._paused ? '#e3b341' : '#30363d';
				this.style.color       = self._paused ? '#e3b341' : '#e6edf3';
			})
		}, '⏸ ' + _('Pause'));

		var exportBtn = E('button', {
			style: 'padding:4px 11px;border-radius:5px;font-size:12px;cursor:pointer;' +
			       'border:1px solid #30363d;background:#161b22;color:#7d8590',
			click: ui.createHandlerFn(this, function() {
				var txt = self._entries.map(function(e) { return e.raw; }).join('\n');
				var a   = document.createElement('a');
				a.href  = 'data:text/plain;charset=utf-8,' + encodeURIComponent(txt);
				a.download = 'easymesh-' +
					new Date().toISOString().slice(0, 19).replace(/:/g, '-') + '.log';
				a.click();
			})
		}, '⬇ ' + _('Export'));

		var clearBtn = E('button', {
			style: 'padding:4px 11px;border-radius:5px;font-size:12px;cursor:pointer;' +
			       'border:1px solid #f8514933;background:#f8514908;color:#f85149',
			click: ui.createHandlerFn(this, function() {
				if (!window.confirm(_('Clear the log file on disk?'))) return;
				fs.write(LOGFILE, '').then(function () {
					self._entries = [];
					self._lastCount = 0;
					self._doRender();
					ui.addTimeLimitedNotification(null, E('p', {}, _('Log file cleared.')), 3000, 'info');
				}).catch(function() {});
			})
		}, '🗑 ' + _('Clear'));

		var countEl = E('span', {
			id: 'em-log-count',
			style: 'font-size:11px;color:#484f58;margin-left:auto;white-space:nowrap'
		}, '');

		var filterBar = E('div', {
			style: 'display:flex;flex-wrap:wrap;gap:6px;align-items:center;' +
			       'padding:10px 14px;border-bottom:1px solid #21262d;background:#0d1117'
		}, catButtons.concat([levelSelect, searchBox, pauseBtn, exportBtn, clearBtn, countEl]));

		var header = E('div', {
			style: 'display:grid;grid-template-columns:150px 36px 90px 1fr;' +
			       'gap:0 10px;padding:4px 12px;border-bottom:1px solid #30363d;' +
			       'font-size:10px;font-weight:700;color:#484f58;letter-spacing:.5px;' +
			       'text-transform:uppercase;background:#0d1117'
		}, [_('Timestamp'), _('Lvl'), _('Category'), _('Message')].map(function(h) {
			return E('span', {}, h);
		}));

		var logList = E('div', {
			id: 'em-log-list',
			style: 'overflow-y:auto;max-height:calc(100vh - 300px);min-height:280px'
		});

		var statusBar = E('div', {
			id: 'em-log-status',
			style: 'display:flex;gap:16px;flex-wrap:wrap;padding:6px 14px;' +
			       'border-top:1px solid #21262d;background:#0d1117;' +
			       'font-size:11px;color:#484f58;align-items:center'
		});

		self._doRender = function() {
			var f  = self._filter;
			var lf = self._levelFilter;
			var s  = self._search;
			var visible = self._entries.filter(function(e) {
				if (f !== 'all' && e.tag !== f) return false;
				if (lf === 'ERROR' && e.level !== 'ERROR') return false;
				if (lf === 'WARN'  && e.level === 'INFO')  return false;
				if (lf === 'INFO'  && e.level !== 'INFO')  return false;
				if (s && e.raw.toLowerCase().indexOf(s) === -1) return false;
				return true;
			});

			while (logList.firstChild) logList.removeChild(logList.firstChild);
			if (!visible.length) {
				var emptyMsg;
				if (f === 'all' && lf === 'all' && !s) {
					emptyMsg = '📭 ' + _('No log entries yet. Start the EasyMesh service to see logs here.');
				} else if (f !== 'all' && !s && lf === 'all') {
					emptyMsg = '📂 ' + _('No entries for this category.');
				} else {
					emptyMsg = '🔍 ' + _('No entries match the current filter.');
				}
				logList.appendChild(E('div', {
					style: 'padding:48px 20px;text-align:center;color:#484f58;font-size:13px'
				}, emptyMsg));
			} else {
				var frag = document.createDocumentFragment();
				visible.forEach(function(e) { frag.appendChild(logRow(e)); });
				logList.appendChild(frag);
			}

			var cel = document.getElementById('em-log-count');
			if (cel) cel.textContent = visible.length + ' / ' + self._entries.length + ' ' + _('lines');

			while (statusBar.firstChild) statusBar.removeChild(statusBar.firstChild);
			var counts = {};
			Object.keys(CATEGORIES).forEach(function(k) { counts[k] = 0; });
			counts['_error'] = 0; counts['_warn'] = 0;
			self._entries.forEach(function(e) {
				if (counts[e.tag] !== undefined) counts[e.tag]++;
				if (e.level === 'ERROR') counts['_error']++;
				else if (e.level === 'WARN') counts['_warn']++;
			});
			Object.keys(CATEGORIES).forEach(function(k) {
				if (!counts[k]) return;
				var c = CATEGORIES[k];
				statusBar.appendChild(E('span', {},
					[E('span', { style: 'color:' + c.color }, c.icon + ' ' + c.label + ': '), String(counts[k])]));
			});
			if (counts['_error'])
				statusBar.appendChild(E('span', { style: 'color:#f85149' },
					'🔴 ' + _('Errors') + ': ' + counts['_error']));
			if (counts['_warn'])
				statusBar.appendChild(E('span', { style: 'color:#e3b341' },
					'⚠️ ' + _('Warnings') + ': ' + counts['_warn']));
			statusBar.appendChild(E('span', { style: 'margin-left:auto' },
				_('Updated: %s').format(new Date().toLocaleTimeString())));
		};

		self._doRender();

		poll.add(function() {
			if (self._paused) return;
			return fs.read(LOGFILE).then(function (raw) {
				var fresh = parseLog(raw || '');
				var freshSig = fresh.length + (fresh[0] ? fresh[0].raw : '');
				var prevSig  = self._lastCount + (self._entries[0] ? self._entries[0].raw : '');
				if (freshSig !== prevSig) {
					self._entries   = fresh;
					self._lastCount = fresh.length;
					self._doRender();
				}
			}).catch(function () {});
		}, POLL_INTERVAL);

		return E('div', {}, [
			E('h3', {}, _('EasyMesh Log')),
			E('div', {
				style: 'background:#0d1117;border:1px solid #30363d;' +
				       'border-radius:12px;overflow:hidden'
			}, [filterBar, header, logList, statusBar])
		]);
	},

	handleSaveApply: null,
	handleSave:      null,
	handleReset:     null
});
