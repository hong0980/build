'use strict';
'require fs';
'require uci';
'require view';
'require poll';

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
			L.resolveDefault(fs.exec_direct('/sbin/logread', ['-e', 'deluge']), '')
				.then(r => this.formatLog(r.trim())),
			fs.trimmed(log_path)
		]);
	},

	load: function () {
		return uci.load('deluge').then(() => {
			const log_path = (uci.get('deluge', 'main', 'profile_dir') || '/etc/deluge') + '/deluge.log';
			return this.getLogs(log_path).then(([syslogRaw, delugeRaw]) => ({ delugeRaw, log_path, syslogRaw }))
		});
	},

	render: function ({ delugeRaw, log_path, syslogRaw }) {
		var currentLines = 50, refreshTimer = null, reverseOrder = true;
		const calculateRows = (lines) => lines > 0 ? Math.min(lines + 2, 20) : 3;
		const parseLog = function (text, lines, reverse) {
			if (!text || text.trim() === '') return { text: '', lineCount: 0 };
			let linesArray = text.split('\n').filter(line => line.trim() !== '');
			if (reverse) linesArray = linesArray.reverse();

			return {
				text: linesArray.slice(0, lines).join('\n'),
				lineCount: Math.min(linesArray.length, lines)
			};
		};

		const refreshLogs = () => {
			return this.getLogs(log_path)
				.then(([syslogRaw, delugeRaw]) => updateLogsDisplay(syslogRaw, delugeRaw));
		};

		const updateLogsDisplay = function (syslogRaw = null, delugeRaw = null) {
			const syslogTitle = document.getElementById('syslog-title');
			const delugeTitle = document.getElementById('deluge-title');
			if (syslogTitle) {
				const syslogResult = parseLog(syslogRaw, currentLines, reverseOrder);
				const syslog_textarea = document.getElementById('syslog-textarea');
				syslogTitle.textContent = _('Last %s lines of syslog (%s):').format(
					syslogResult.lineCount, reverseOrder ? _('newest first') : _('oldest first'));
				syslog_textarea.value = syslogResult.text;
				syslog_textarea.rows = calculateRows(syslogResult.lineCount);
			};
			if (delugeTitle) {
				const delugeResult = parseLog(delugeRaw, currentLines, reverseOrder);
				const deluge_textarea = document.getElementById('deluge-textarea');
				delugeTitle.textContent = _('Last %s lines of run log (%s):').format(
					delugeResult.lineCount, reverseOrder ? _('newest first') : _('oldest first'));
				deluge_textarea.value = delugeResult.text;
				deluge_textarea.rows = calculateRows(delugeResult.lineCount);
			};
		};

		const setupPolling = () => {
			if (refreshTimer) poll.remove(refreshTimer);
			refreshTimer = poll.add(() => refreshLogs().then(() => 5), 5);
		};

		const view = E('div', {}, [
			E('h3', {}, _('Deluge - Logs')),
			E('div', { class: 'cbi-section' }, [
				E('div', { style: 'margin-bottom: 10px; display: flex; flex-wrap: wrap; gap: 10px; align-items: center' }, [
					E('div', { style: 'display: flex; align-items: center; gap: 5px' }, [
						E('select', {
							class: 'cbi-input-select', style: 'width: 100px; margin-left: 5px;',
							change: (ev) => {
								currentLines = parseInt(ev.target.value);
								updateLogsDisplay(syslogRaw, delugeRaw);
							}
						}, [10, 20, 50, 100].map((opt) => E('option', { value: opt, selected: opt === currentLines }, opt)))
					], _('Lines:')),
					E('button', {
						class: 'cbi-button cbi-button-neutral',
						click: function (ev) {
							reverseOrder = !reverseOrder;
							updateLogsDisplay(syslogRaw, delugeRaw);
							this.textContent = reverseOrder
								? _('▽ Show Oldest First')
								: _('△ Show Newest First');
						}
					}, reverseOrder ? _('▽ Show Oldest First') : _('△ Show Newest First')),
					E('button', {
						class: 'cbi-button cbi-button-action', click: refreshLogs
					}, _('⟳ Refresh Now')),
					E('div', { style: 'display: flex; align-items: center; gap: 5px' }, [
						E('input', {
							type: 'checkbox', id: 'wordwrap-toggle',
							change: (ev) => {
								document.querySelectorAll('textarea').forEach(ta => {
									ta.style.whiteSpace = ev.target.checked ? 'pre-wrap' : 'pre';
								});
							}
						}),
						E('label', { for: 'wordwrap-toggle', title: _('Enable automatic line wrapping') }, _('Wrap text'))
					])
				])
			]),
		]);

		const initialSyslog = parseLog(syslogRaw, currentLines, reverseOrder);
		if (initialSyslog.text) {
			view.appendChild(
				E('div', { class: 'cbi-section', style: 'margin-top: 1em' }, [
					E('div', { id: 'syslog-title' }, _('Last %s lines of syslog (%s):').format(
						initialSyslog.lineCount, reverseOrder ? _('newest first') : _('oldest first')
					)),
					E('textarea', {
						id: 'syslog-textarea', wrap: 'off',
						style: 'width:100%; background-color:#272626; color:#c5c5b2; border:1px solid #555; font-family:Consolas, monospace; font-size:14px;',
						rows: calculateRows(initialSyslog.lineCount)
					}, initialSyslog.text),
				]))
		};

		const initialDeluge = parseLog(delugeRaw, currentLines, reverseOrder);
		if (initialDeluge.text) {
			view.appendChild(
				E('div', { class: 'cbi-section', style: 'margin-top: 1em' }, [
					E('div', { id: 'deluge-title' }, _('Last %s lines of run log (%s):').format(
						initialDeluge.lineCount, reverseOrder ? _('newest first') : _('oldest first')
					)),
					E('textarea', {
						id: 'deluge-textarea', wrap: 'off',
						style: 'width:100%; background-color:#272626; color:#c5c5b2; border:1px solid #555; font-family:Consolas, monospace; font-size:14px;',
						rows: calculateRows(initialDeluge.lineCount)
					}, initialDeluge.text)
				]))
		};

		setupPolling();
		view.addEventListener('destroy', () => {
			if (refreshTimer) poll.remove(refreshTimer);
		});
		return view;
	},

	handleSave: null,
	handleReset: null,
	handleSaveApply: null
});
