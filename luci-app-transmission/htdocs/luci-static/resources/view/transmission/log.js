'use strict';
'require view';
'require fs';
'require uci';

return view.extend({
	formatLog: function (logStr) {
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

	getLogs: function (log_path) {
		return Promise.all([
			L.resolveDefault(fs.exec_direct('/sbin/logread', ['-e', 'transmission']), '')
				.then(r => this.formatLog(r.trim())),
			fs.trimmed(log_path)
		]);
	},

	load: function () {
		return uci.load('transmission').then(() => {
			const log_path = uci.get('transmission', 'transmission', 'log_file');
			return this.getLogs(log_path).then(([syslog, trlog]) => ({ syslog, trlog, log_path }));
		});
	},

	render: function (data) {
		let currentLines = 50, reverseOrder = true, refreshTimer = null;
		const calculateRows = lines => lines > 0 ? Math.min(lines + 2, 20) : 3;
		const parseLog = (text, lines, reverse) => {
			if (!text || text.trim() === '') return { text: '', actualLines: 0 };
			let linesArray = text.split('\n').filter(line => line.trim() !== '');
			if (reverse) linesArray = linesArray.reverse();
			return {
				text: linesArray.slice(0, lines).join('\n'),
				actualLines: Math.min(linesArray.length, lines)
			};
		};

		const updateLogsDisplay = () => {
			const syslogResult = parseLog(data.syslog, currentLines, reverseOrder);
			const delugeResult = parseLog(data.trlog, currentLines, reverseOrder);
			const syslogTitle = document.getElementById('syslog-title');
			const delugeTitle = document.getElementById('tr-title');
			const syslogTextarea = document.getElementById('syslog-textarea');
			const delugeTextarea = document.getElementById('tr-textarea');

			syslogTitle.textContent = syslogResult.actualLines > 0
				? _('Last %s lines of syslog (%s):').format(syslogResult.actualLines, reverseOrder ? _('newest first') : _('oldest first'))
				: _('System log: (no data available)');
			delugeTitle.textContent = delugeResult.actualLines > 0
				? _('Last %s lines of run log (%s):').format(delugeResult.actualLines, reverseOrder ? _('newest first') : _('oldest first'))
				: _('Deluge run log: (no data available)');

			syslogTextarea.value = syslogResult.text;
			delugeTextarea.value = delugeResult.text;
			syslogTextarea.rows = calculateRows(syslogResult.actualLines);
			delugeTextarea.rows = calculateRows(delugeResult.actualLines);
		};

		const refreshLogs = () => {
			this.getLogs(data.log_path)
				.then(([newSyslog, newtr]) => { data.trlog = newtr; data.syslog = newSyslog; updateLogsDisplay(); });
		};

		const startAutoRefresh = () => {
			if (refreshTimer) clearInterval(refreshTimer);
			refreshTimer = setInterval(refreshLogs, 5000);
		};

		const initialSyslog = parseLog(data.syslog, currentLines, reverseOrder);
		const initialDeluge = parseLog(data.trlog, currentLines, reverseOrder);

		startAutoRefresh();

		const view = E('div', {}, [
			E('h3', {}, '%s - %s'.format(_('Transmission'), _('Logs'))),
			E('div', { style: 'margin-bottom: 10px; display: flex; flex-wrap: wrap; gap: 10px; align-items: center' }, [
				E('div', { style: 'display: flex; align-items: center; gap: 5px' }, [
					_('Lines:'),
					E('select', {
						class: 'cbi-input-select',
						style: 'width: 100px; margin-left: 5px;',
						change: ev => {
							currentLines = parseInt(ev.target.value);
							updateLogsDisplay();
						}
					}, [10, 20, 50, 100].map(opt => E('option', { value: opt, selected: opt === currentLines }, opt)))
				]),
				E('div', {
					class: 'btn cbi-button-neutral',
					click: function () {
						reverseOrder = !reverseOrder;
						updateLogsDisplay();
						this.textContent = reverseOrder
							? _('▽ Show Oldest First')
							: _('△ Show Newest First');
					}
				}, reverseOrder ? _('▽ Show Oldest First') : _('△ Show Newest First')),
				E('div', {
					class: 'btn cbi-button-action', click: refreshLogs
				}, _('⟳ Refresh Now')),
				E('div', { style: 'display: flex; align-items: center; gap: 5px' }, [
					E('input', {
						type: 'checkbox', id: 'wordwrap-toggle',
						change: ev => {
							document.querySelectorAll('#syslog-textarea, #tr-textarea').forEach(ta => {
								ta.style.whiteSpace = ev.target.checked ? 'pre-wrap' : 'pre';
							});
						}
					}),
					E('label', { for: 'wordwrap-toggle', title: _('Enable automatic line wrapping') }, _('Wrap text'))
				])
			]),
		]);

		if (initialSyslog.text) {
			view.appendChild(
				E('div', { style: 'margin-top: 1em' }, [
					E('div', { id: 'syslog-title' },
						initialSyslog.actualLines > 0
							? _('Last %s lines of syslog (%s):').format(initialSyslog.actualLines, reverseOrder ? _('newest first') : _('oldest first'))
							: _('System log: (no data available)')
					),
					E('textarea', {
						id: 'syslog-textarea', wrap: 'off',
						style: 'width:100%; background-color:#272626; color:#c5c5b2; border:1px solid #555; font-family:Consolas, monospace; font-size:14px;',
						rows: calculateRows(initialSyslog.actualLines)
					}, initialSyslog.text)
				])
			);
		};

		if (initialDeluge.text) {
			view.appendChild(
				E('div', { style: 'margin-top: 1em' }, [
					E('div', { id: 'tr-title' },
						initialDeluge.actualLines > 0
							? _('Last %s lines of run log (%s):').format(initialDeluge.actualLines, reverseOrder ? _('newest first') : _('oldest first'))
							: _('Deluge run log: (no data available)')
					),
					E('textarea', {
						id: 'tr-textarea', wrap: 'off',
						style: 'width:100%; background-color:#272626; color:#c5c5b2; border:1px solid #555; font-family:Consolas, monospace; font-size:14px;',
						rows: calculateRows(initialDeluge.actualLines)
					}, initialDeluge.text)
				])
			);
		};

		view.addEventListener('destroy', () => {
			if (refreshTimer) clearInterval(refreshTimer);
		});

		return view;
	},

	handleSave: null,
	handleReset: null,
	handleSaveApply: null
});
