'use strict';
'require fs';
'require ui';
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
			return this.getLogs(log_path).then(([syslog, applog]) => ({ applog, log_path, syslog }))
		});
	},

	render: function ({ applog, log_path, syslog }) {
		var currentLines = 50, refreshTimer = null, reverseOrder = true;
		const calculateRows = (lines) => lines > 0 ? Math.min(lines + 2, 20) : 3;
		const parseLog = function (text, lines, reverse) {
			if (!text || text.trim() === '') return { text: '', line: 0 };
			let linesArray = text.split('\n').filter(line => line.trim() !== '');
			if (reverse) linesArray = linesArray.reverse();

			return {
				text: linesArray.slice(0, lines).join('\n'),
				line: Math.min(linesArray.length, lines)
			};
		};

		const refreshLogs = () => {
			return this.getLogs(log_path)
				.then(([syslog, applog]) => updateLogsDisplay(syslog, applog));
		};

		const updateLogsDisplay = function (syslog = null, applog = null) {
			const syslogTitle = document.getElementById('syslog-title');
			const delugeTitle = document.getElementById('applog-title');
			if (syslogTitle && syslog) {
				let text, line;
				({ text, line } = parseLog(syslog, currentLines, reverseOrder));
				const syslog_textarea = document.getElementById('syslog-textarea');
				syslogTitle.textContent = _('Last %s lines of syslog (%s):').format(
					line, reverseOrder ? _('newest first') : _('oldest first'));
				syslog_textarea.value = text;
				syslog_textarea.rows = calculateRows(line);
			};
			if (delugeTitle && applog) {
				let text, line;
				({ text, line } = parseLog(applog, currentLines, reverseOrder));
				const applog_textarea = document.getElementById('applog-textarea');
				delugeTitle.textContent = _('Last %s lines of run log (%s):').format(
					line, reverseOrder ? _('newest first') : _('oldest first'));
				applog_textarea.value = text;
				applog_textarea.rows = calculateRows(line);
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
						_('Lines:'),
						E('select', {
							class: 'cbi-input-select', style: 'width: 100px; margin-left: 5px;',
							change: (ev) => {
								currentLines = parseInt(ev.target.value);
								updateLogsDisplay(syslog, applog);
							}
						}, [10, 20, 50, 100].map((opt) =>
							E('option', { value: opt, selected: opt === currentLines ? '' : null }, opt)))
					]),
					E('button', {
						class: 'btn cbi-button-apply',
						click: function (ev) {
							reverseOrder = !reverseOrder;
							updateLogsDisplay(syslog, applog);
							this.textContent = reverseOrder
								? _('▽ Show Oldest First')
								: _('△ Show Newest First');
						}
					}, reverseOrder ? _('▽ Show Oldest First') : _('△ Show Newest First')),
					applog
						? E('div', {
							class: 'btn cbi-button-negative', title: _('Clear Log'),
							click: ui.createHandlerFn(this, () => {
								fs.write(log_path, '')
									.then(() => {
										document.querySelector('#applog-textarea').value = '';
										L.bind(ui.addTimeLimitedNotification || ui.addNotification, ui)
											(null, E('p', _('Log cleared')), 3000, 'info');
										view.removeChild(applogLE);
									})
									.catch((e) => {
										ui.addNotification(null, E('p', _('Failed to clear log: %s').format(e.message)), 'error');
									});
							})
						}, _('Clear Log'))
						: [],
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

		const { text: appText, line: appLine } = parseLog(applog, currentLines, reverseOrder);
		const applogLE =
			E('div', { class: 'cbi-section', style: 'margin-top: 1em' }, [
				E('div', { id: 'applog-title' }, _('Last %s lines of run log (%s):').format(
					appLine, reverseOrder ? _('newest first') : _('oldest first')
				)),
				E('textarea', {
					id: 'applog-textarea', wrap: 'off',
					style: 'width:100%; background-color:#272626; color:#c5c5b2; border:1px solid #555; font-family:Consolas, monospace; font-size:14px;',
					rows: calculateRows(appLine)
				}, appText)
			]);
		if (appText) view.appendChild(applogLE);

		const { text: sysText, line: sysLine } = parseLog(syslog, currentLines, reverseOrder);
		if (sysText) {
			view.appendChild(
				E('div', { class: 'cbi-section', style: 'margin-top: 1em' }, [
					E('div', { id: 'syslog-title' }, _('Last %s lines of syslog (%s):').format(
						sysLine, reverseOrder ? _('newest first') : _('oldest first')
					)),
					E('textarea', {
						id: 'syslog-textarea', wrap: 'off',
						style: 'width:100%; background-color:#272626; color:#c5c5b2; border:1px solid #555; font-family:Consolas, monospace; font-size:14px;',
						rows: calculateRows(sysLine)
					}, sysText),
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
