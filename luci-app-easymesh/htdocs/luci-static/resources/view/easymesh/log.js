'use strict';
'require fs';
'require ui';
'require view';
'require poll';

var LOGFILE = '/tmp/easymesh.log';
var LOG_RE  = /^(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}) \[\s*(\w+)\s*\] \[\s*(\w+)\s*\] (.*)$/;

var CATS = {
	core:  { label: _('Core'),    icon: '⚙️',  color: '#58a6ff' },
	roam:  { label: _('Roaming'), icon: '📶',  color: '#2ea44f' },
	dfs:   { label: _('DFS'),     icon: '📡',  color: '#e3b341' },
	heal:  { label: _('Healing'), icon: '🔁',  color: '#f0883e' },
	initd: { label: _('Init'),    icon: '🚀',  color: '#a371f7' }
};
var LVL_STYLE = {
	ERROR: 'color:#f85149;font-weight:700',
	WARN:  'color:#e3b341;font-weight:600',
	INFO:  'color:#484f58'
};
var HI = [
	[/\b(error|failed|fail|dead)\b/gi,               'color:#f85149;font-weight:600'],
	[/\b(master|approved|joined|success)\b/gi,        'color:#2ea44f'],
	[/([0-9a-f]{2}:){5}[0-9a-f]{2}/gi,               'color:#d2a8ff;font-family:monospace'],
	[/\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g,      'color:#79c0ff;font-family:monospace'],
	[/-\d{2,3}\s*dBm/gi,                              'color:#ffa657'],
	[/\bch(?:annel)?\s*[→:]\s*\d+/gi,                'color:#56d364']
];

function parseLog(raw) {
	return (raw || '').split('\n').reverse().reduce(function(a, line) {
		if (!line.trim()) return a;
		var m = LOG_RE.exec(line);
		a.push(m ? { ts: m[1], level: m[2].trim(), tag: m[3].trim(), msg: m[4], raw: line }
		          : { ts: '', level: 'INFO', tag: 'core', msg: line, raw: line });
		return a;
	}, []);
}

function highlight(msg) {
	var regions = [];
	HI.forEach(function(h) {
		var re = new RegExp(h[0].source, h[0].flags.replace('g','') + 'g'), m;
		while ((m = re.exec(msg)) !== null)
			regions.push({ s: m.index, e: m.index + m[0].length, style: h[1], text: m[0] });
	});
	if (!regions.length) return [msg];
	regions.sort(function(a,b){ return a.s - b.s; });
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

function badge(tag) {
	var c = CATS[tag] || { label: tag, icon: '·', color: '#7d8590' };
	return E('span', {
		style: 'padding:1px 6px;border-radius:4px;font-size:10px;font-weight:700;flex-shrink:0;' +
		       'background:' + c.color + '1a;color:' + c.color + ';border:1px solid ' + c.color + '44'
	}, c.icon + ' ' + c.label.toUpperCase());
}

function logRow(e) {
	var bg = e.level === 'ERROR' ? '#f8514908' : e.level === 'WARN' ? '#e3b34106' : '';
	return E('div', {
		style: 'display:grid;grid-template-columns:150px 36px 90px 1fr;gap:0 10px;' +
		       'padding:4px 12px;border-bottom:1px solid #21262d;align-items:baseline;font-size:12px;background:' + bg,
		onmouseenter: function() { this.style.background = '#161b22'; },
		onmouseleave: function() { this.style.background = bg; }
	}, [
		E('span', { style: 'color:#484f58;font-size:11px' }, e.ts),
		E('span', { style: (LVL_STYLE[e.level]||LVL_STYLE.INFO) + ';font-size:10px;text-align:center' }, e.level),
		badge(e.tag),
		E('span', { style: 'color:#c9d1d9;word-break:break-word' }, highlight(e.msg))
	]);
}

return view.extend({
	_entries: [], _cat: 'all', _lvl: 'all', _search: '', _paused: false,

	load: function() { return L.resolveDefault(fs.read(LOGFILE), ''); },

	render: function(raw) {
		var self = this;
		self._entries = parseLog(raw);

		/* ── Filter bar ── */
		var catBtns = [{ key:'all', label:_('All'), icon:'📋', color:'#7d8590' }]
			.concat(Object.keys(CATS).map(function(k){ return Object.assign({key:k}, CATS[k]); }))
			.map(function(d) {
				return E('button', {
					'data-cat': d.key,
					style: 'padding:4px 11px;border-radius:5px;font-size:12px;cursor:pointer;' +
					       'border:1px solid ' + d.color + '55;color:' + d.color + ';' +
					       'background:' + (d.key==='all' ? d.color+'22' : d.color+'0d') + ';' +
					       'font-weight:' + (d.key==='all'?'700':'400') + ';opacity:' + (d.key==='all'?'1':'0.65'),
					click: function() {
						self._cat = d.key;
						bar.querySelectorAll('[data-cat]').forEach(function(b) {
							var active = b.dataset.cat === d.key;
							b.style.fontWeight = active ? '700' : '400';
							b.style.opacity    = active ? '1' : '0.65';
							var cc = (CATS[b.dataset.cat]||{color:'#7d8590'}).color;
							b.style.background = active ? cc+'22' : cc+'0d';
						});
						self._render();
					}
				}, d.icon + ' ' + d.label);
			});

		var lvlSel = E('select', {
			style: 'background:#0d1117;border:1px solid #30363d;border-radius:5px;color:#e6edf3;padding:4px 8px;font-size:12px',
			change: function() { self._lvl = this.value; self._render(); }
		}, [
			E('option',{value:'all'},   _('All levels')),
			E('option',{value:'ERROR'}, '🔴 ERROR'),
			E('option',{value:'WARN'},  '🟡 WARN+'),
			E('option',{value:'INFO'},  '🔵 INFO')
		]);

		var searchBox = E('input', {
			type:'text', placeholder: _('Search…'),
			style: 'flex:1;min-width:120px;background:#0d1117;border:1px solid #30363d;border-radius:5px;color:#e6edf3;padding:4px 10px;font-size:12px',
			input: function() { self._search = this.value.toLowerCase(); self._render(); }
		});

		var pauseBtn = E('button', {
			style: 'padding:4px 11px;border-radius:5px;font-size:12px;cursor:pointer;border:1px solid #30363d;background:#161b22;color:#e6edf3',
			click: function() {
				self._paused = !self._paused;
				this.textContent = self._paused ? '▶ ' + _('Resume') : '⏸ ' + _('Pause');
				this.style.color = self._paused ? '#e3b341' : '#e6edf3';
				this.style.borderColor = self._paused ? '#e3b341' : '#30363d';
			}
		}, '⏸ ' + _('Pause'));

		var exportBtn = E('button', {
			style: 'padding:4px 11px;border-radius:5px;font-size:12px;cursor:pointer;border:1px solid #30363d;background:#161b22;color:#7d8590',
			click: function() {
				var a = document.createElement('a');
				a.href = 'data:text/plain;charset=utf-8,' + encodeURIComponent(self._entries.map(function(e){return e.raw;}).join('\n'));
				a.download = 'easymesh-' + new Date().toISOString().slice(0,19).replace(/:/g,'-') + '.log';
				a.click();
			}
		}, '⬇ ' + _('Export'));

		var clearBtn = E('button', {
			style: 'padding:4px 11px;border-radius:5px;font-size:12px;cursor:pointer;border:1px solid #f8514933;background:#f8514908;color:#f85149',
			click: function() {
				if (!window.confirm(_('Clear the log file on disk?'))) return;
				fs.write(LOGFILE,'').then(function(){ self._entries=[]; self._render(); });
			}
		}, '🗑 ' + _('Clear'));

		var countEl = E('span', { id:'em-log-count', style:'font-size:11px;color:#484f58;margin-left:auto' });
		var bar = E('div', {
			style:'display:flex;flex-wrap:wrap;gap:6px;align-items:center;padding:10px 14px;border-bottom:1px solid #21262d;background:#0d1117'
		}, catBtns.concat([lvlSel, searchBox, pauseBtn, exportBtn, clearBtn, countEl]));

		var header = E('div', {
			style:'display:grid;grid-template-columns:150px 36px 90px 1fr;gap:0 10px;padding:4px 12px;' +
			      'border-bottom:1px solid #30363d;font-size:10px;font-weight:700;color:#484f58;text-transform:uppercase;background:#0d1117'
		}, [_('Timestamp'),_('Lvl'),_('Category'),_('Message')].map(function(h){ return E('span',{},h); }));

		var logList  = E('div', { id:'em-log-list',   style:'overflow-y:auto;max-height:calc(100vh - 280px);min-height:260px' });
		var statusBar= E('div', { id:'em-log-status', style:'display:flex;gap:16px;flex-wrap:wrap;padding:6px 14px;background:#0d1117;border-top:1px solid #21262d;font-size:11px;color:#484f58;align-items:center' });

		self._render = function() {
			var f = self._cat, lf = self._lvl, s = self._search;
			var vis = self._entries.filter(function(e) {
				if (f !== 'all' && e.tag !== f) return false;
				if (lf === 'ERROR' && e.level !== 'ERROR') return false;
				if (lf === 'WARN'  && e.level === 'INFO')  return false;
				if (lf === 'INFO'  && e.level !== 'INFO')  return false;
				return !s || e.raw.toLowerCase().indexOf(s) !== -1;
			});
			while (logList.firstChild) logList.removeChild(logList.firstChild);
			if (!vis.length) {
				logList.appendChild(E('div',{style:'padding:48px 20px;text-align:center;color:#484f58;font-size:13px'},
					f==='all'&&lf==='all'&&!s ? '📭 '+_('No log entries yet. Start the EasyMesh service to see logs here.')
					: f!=='all'&&!s ? '📂 '+_('No entries for this category.')
					: '🔍 '+_('No entries match the filter.')));
			} else {
				var frag = document.createDocumentFragment();
				vis.forEach(function(e){ frag.appendChild(logRow(e)); });
				logList.appendChild(frag);
			}
			var cel = document.getElementById('em-log-count');
			if (cel) cel.textContent = vis.length + '/' + self._entries.length + ' ' + _('lines');
			while (statusBar.firstChild) statusBar.removeChild(statusBar.firstChild);
			var ec=0, wc=0, tc={};
			self._entries.forEach(function(e){
				tc[e.tag] = (tc[e.tag]||0)+1;
				if (e.level==='ERROR') ec++; else if (e.level==='WARN') wc++;
			});
			Object.keys(CATS).forEach(function(k){
				if (!tc[k]) return;
				statusBar.appendChild(E('span',{},[E('span',{style:'color:'+CATS[k].color},CATS[k].icon+' '+CATS[k].label+': '),String(tc[k])]));
			});
			if (ec) statusBar.appendChild(E('span',{style:'color:#f85149'},'🔴 '+_('Errors')+': '+ec));
			if (wc) statusBar.appendChild(E('span',{style:'color:#e3b341'},'⚠️ '+_('Warnings')+': '+wc));
			statusBar.appendChild(E('span',{style:'margin-left:auto'},_('Updated: %s').format(new Date().toLocaleTimeString())));
		};

		self._render();

		poll.add(function() {
			if (self._paused) return;
			return fs.read(LOGFILE).then(function(raw) {
				var fresh = parseLog(raw||'');
				var sig = fresh.length+'|'+(fresh[0]?fresh[0].raw:'');
				var old = self._entries.length+'|'+(self._entries[0]?self._entries[0].raw:'');
				if (sig !== old) { self._entries = fresh; self._render(); }
			}).catch(function(){});
		}, 3);

		return E('div', {}, [
			E('h3', {}, _('EasyMesh Log')),
			E('div', { style:'background:#0d1117;border:1px solid #30363d;border-radius:12px;overflow:hidden' },
				[bar, header, logList, statusBar])
		]);
	},

	handleSaveApply: null, handleSave: null, handleReset: null
});
