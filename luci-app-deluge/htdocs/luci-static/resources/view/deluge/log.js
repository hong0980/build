'use strict';
'require view';
'require fs';
'require uci';

return view.extend({
	formatLog: function(logStr) {
		const months = {
			Jan: '01', Feb: '02', Mar: '03', Apr: '04', May: '05', Jun: '06',
			Jul: '07', Aug: '08', Sep: '09', Oct: '10', Nov: '11', Dec: '12'
		};

		return logStr.split('\n').filter(Boolean).map(line => {
			const match = line.match(/^[A-Z][a-z]{2}\s+([A-Z][a-z]{2})\s+(\d{1,2})\s(\d{2}:\d{2}:\d{2})\s(\d{4})\s(.+)$/);
			if (!match) return line;

			const [, month, day, time, year, rest] = match;
			return `${year}${_("year")}${months[month] || '??'}${_("month")}${day.padStart(2, '0')}${_("day")} ${time} ${rest}`;
		}).join('\n');
	},

	getLogs: function(p) {
		return Promise.all([
			fs.exec_direct('/sbin/logread', ['-e', 'deluge'])
				.then(r => this.formatLog(r.trim()))
				.catch(() => ''),
			fs.trimmed(p)
		]);
	},

	load: async function () {
		await uci.load('deluge');
		const profile_dir = uci.get('deluge', 'main', 'profile_dir') || '/etc/deluge';
		const log_path = profile_dir + '/deluge.log';
		const [syslogRaw, delugeRaw] = await this.getLogs(log_path);

		return {
			syslogRaw: syslogRaw, delugeRaw: delugeRaw, log_path: log_path
		};
	},

	render: function (data) {
		let self = this, currentLines = 50, reverseOrder = true, refreshTimer = null;

		const calculateRows = (lines) => {
			return lines > 0 ? Math.min(lines + 2, 20) : 3;
		};

		const parseLog = (text, lines, reverse) => {
			if (!text || text.trim() === '') {
				return {
					text: _('No log data available'),
					actualLines: 0
				};
			};

			let linesArray = text.split('\n').filter(line => line.trim() !== '');
			if (reverse) linesArray = linesArray.reverse();

			return {
				text: linesArray.slice(0, lines).join('\n'),
				actualLines: Math.min(linesArray.length, lines)
			};
		};

		const refreshLogs = () => {
			self.getLogs(data.log_path)
				.then(([newSyslog, newDeluge]) => {
					data.syslogRaw = newSyslog;
					data.delugeRaw = newDeluge;
					updateLogsDisplay();
				});
		};

		const updateLogsDisplay = () => {
			const syslogResult = parseLog(data.syslogRaw, currentLines, reverseOrder);
			const delugeResult = parseLog(data.delugeRaw, currentLines, reverseOrder);
			const syslogTitle = document.getElementById('syslog-title');
			const delugeTitle = document.getElementById('deluge-title');

			syslogTitle.textContent = syslogResult.actualLines > 0
				? _('Last %s lines of syslog (%s):').format(
					syslogResult.actualLines,
					reverseOrder ? _('newest first') : _('oldest first')
				  )
				: _('System log: (no data available)');

			delugeTitle.textContent = delugeResult.actualLines > 0
				? _('Last %s lines of run log (%s):').format(
					delugeResult.actualLines,
					reverseOrder ? _('newest first') : _('oldest first')
				  )
				: _('Deluge run log: (no data available)');

			document.getElementById('syslog-textarea').value = syslogResult.text;
			document.getElementById('deluge-textarea').value = delugeResult.text;
			document.getElementById('syslog-textarea').rows = calculateRows(syslogResult.actualLines);
			document.getElementById('deluge-textarea').rows = calculateRows(delugeResult.actualLines);
		};

		function startAutoRefresh() {
			if (refreshTimer) clearInterval(refreshTimer);
			refreshTimer = setInterval(refreshLogs, 5000);
		};

		const initialSyslog = parseLog(data.syslogRaw, currentLines, reverseOrder);
		const initialDeluge = parseLog(data.delugeRaw, currentLines, reverseOrder);

		startAutoRefresh();

		const view = E('div', {}, [
			E('h3', {}, _('Deluge - Logs')),

			E('div', { class: 'cbi-section' }, [
				E('div', { style: 'margin-bottom: 10px; display: flex; flex-wrap: wrap; gap: 10px; align-items: center' }, [
					E('div', { style: 'display: flex; align-items: center; gap: 5px' }, [ _('Lines:'),
						E('select', {
							class: 'cbi-input-select',
							style: 'width: 100px; margin-left: 5px;',
							'change': (ev) => {
								currentLines = parseInt(ev.target.value);
								updateLogsDisplay();
							}
						},
						[10, 20, 50, 100].map((opt) => {
							return E('option', {
								value: opt, selected: opt === currentLines
							}, opt);
						}))
					]),
					E('button', {
						class: 'cbi-button cbi-button-neutral',
						click: function(ev) {
							reverseOrder = !reverseOrder;
							updateLogsDisplay();
							this.textContent = reverseOrder
								? _('▽ Show Oldest First')
								: _('△ Show Newest First');
						}
					}, reverseOrder ? _('▽ Show Oldest First') : _('△ Show Newest First')),
					E('button', {
						class: 'cbi-button cbi-button-action', 'click': refreshLogs
					}, _('⟳ Refresh Now')),
					E('div', { style: 'display: flex; align-items: center; gap: 5px' }, [
						E('input', {
							type: 'checkbox', id: 'wordwrap-toggle',
							change: (ev) => {
								document.querySelectorAll('#syslog-textarea, #deluge-textarea').forEach(ta => {
									ta.style.whiteSpace = ev.target.checked ? 'pre-wrap' : 'pre';
								});
							}
						}),
						E('label', { for: 'wordwrap-toggle', title: _('Enable automatic line wrapping') }, _('Wrap text'))
					])
				])
			]),

			E('div', { class: 'cbi-section', style: 'margin-top: 1em' }, [
				E('div', { id: 'syslog-title' }, initialSyslog.actualLines > 0
					? _('Last %s lines of syslog (%s):').format(
						initialSyslog.actualLines,
						reverseOrder ? _('newest first') : _('oldest first')
					  )
					: _('System log: (no data available)')
				),
				E('textarea', {
					id: 'syslog-textarea', wrap: 'off',
					style: 'width:100%; background-color:#272626; color:#c5c5b2; border:1px solid #555; font-family:Consolas, monospace; font-size:14px;',
					rows: calculateRows(initialSyslog.actualLines)
				}, initialSyslog.text),
			]),

			E('div', { class: 'cbi-section', style: 'margin-top: 1em' }, [
				E('div', { id: 'deluge-title' }, initialDeluge.actualLines > 0
					? _('Last %s lines of run log (%s):').format(
						initialDeluge.actualLines,
						reverseOrder ? _('newest first') : _('oldest first')
					  )
					: _('Deluge run log: (no data available)')
				),
				E('textarea', {
					id: 'deluge-textarea', wrap: 'off',
					style: 'width:100%; background-color:#272626; color:#c5c5b2; border:1px solid #555; font-family:Consolas, monospace; font-size:14px;',
					rows: calculateRows(initialDeluge.actualLines)
				}, initialDeluge.text)
			])
		]);

		view.addEventListener('destroy', function() {
			if (refreshTimer) clearInterval(refreshTimer);
		});

		return view;
	},

	handleSave: null,
	handleReset: null,
	handleSaveApply: null
});
