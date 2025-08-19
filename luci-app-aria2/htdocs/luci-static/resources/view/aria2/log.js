'use strict';
'require fs';
'require ui';
'require uci';
'require poll';
'require view';

var formatLog = function (logStr) {
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
};

const getLogs = function (log_path) {
	return Promise.all([
		L.resolveDefault(fs.exec_direct('/sbin/logread', ['-e', 'aria2']), '')
			.then(r => formatLog(r)),
		fs.trimmed(log_path)
	]);
};

return view.extend({
	load: function () {
		return uci.load('aria2').then(function (r) {
			const log_path = `${uci.get(r, 'main', 'log') || '/var/log'}/aria2.log`.replace(/\/+/g, '/');
			return getLogs(log_path).then(([syslog, applog]) => ({ applog, syslog, log_path }))
		});
	},

	render: function ({ applog, log_path, syslog }) {
		var currentLines = 30, refreshTimer = null, reverseOrder = true;
		const parseLog = function (text, lines, reverse) {
			if (!text || text.trim() === '') return { text: '', line: 0 };
			let linesArray = text.split('\n').filter(line => line.trim() !== '');
			if (reverse) linesArray = linesArray.reverse();

			return {
				text: linesArray.slice(0, lines).join('\n'),
				line: Math.min(linesArray.length, lines)
			};
		};

		const refreshLogs = () => getLogs(log_path)
			.then(([syslog, applog]) => updateLogsDisplay(syslog, applog));

		const updateLogsDisplay = function (syslog = null, applog = null) {
			const syslogTitle = document.getElementById('syslog-title');
			const applogTitle = document.getElementById('applog-title');

			if (syslogTitle && syslog) {
				let text, line;
				({ text, line } = parseLog(syslog, currentLines, reverseOrder));
				const syslog_textarea = document.getElementById('syslog-textarea');
				syslogTitle.textContent = _('Last %s lines of syslog (%s):').format(
					line, reverseOrder ? _('newest first') : _('oldest first'));
				syslog_textarea.value = text;
				syslog_textarea.rows = Math.min(line + 2, 20);
			}

			if (applogTitle && applog) {
				let text, line;
				({ text, line } = parseLog(applog, currentLines, reverseOrder));
				const applog_textarea = document.getElementById('applog-textarea');
				applogTitle.textContent = _('Last %s lines of run log (%s):').format(
					line, reverseOrder ? _('newest first') : _('oldest first'));
				applog_textarea.value = text;
				applog_textarea.rows = Math.min(line + 2, 20);
			}
		};

		const setupPolling = () => {
			if (refreshTimer) poll.remove(refreshTimer);
			refreshTimer = poll.add(() => refreshLogs().then(() => 5), 5);
		};

		const view = E('div', {}, [
			E('h3', {}, '%s - %s'.format(_('Aria2'), _('Log Data'))),
			E('div', { style: 'display: flex; align-items: center; gap: 15px;' }, [
				E('div', _('Lines:')),
				E('select', {
					class: 'cbi-input-select', style: 'width: 100px;',
					change: (ev) => {
						currentLines = parseInt(ev.target.value);
						updateLogsDisplay(syslog, applog);
					}
				}, [10, 20, 30, 50, 100].map((opt) =>
					E('option', { value: opt, selected: opt === currentLines ? '' : null }, opt))),
				E('div', {
					class: 'btn cbi-button-apply',
					click: ui.createHandlerFn(this, (ev) => {
						reverseOrder = !reverseOrder;
						ev.target.textContent = reverseOrder
							? _('△ Show Newest First')
							: _('▽ Show Oldest First');
						updateLogsDisplay(syslog, applog);
					})
				}, _('△ Show Newest First')),
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
						change: ev => {
							document.querySelectorAll('textarea').forEach(ta => {
								ta.style.whiteSpace = ev.target.checked ? 'pre-wrap' : 'pre';
							});
						}
					}),
					E('label', { for: 'wordwrap-toggle', title: _('Enable automatic line wrapping') }, _('Wrap text'))
				])
			]),
		]);
		const { text: appText, line: appLine } = parseLog(applog, currentLines, reverseOrder);
		const applogLE =
			E('div', {}, [
				E('div', { style: 'margin-top: 1em', id: 'applog-title' },
					_('Last %s lines of run log (%s):').format(
						appLine, reverseOrder ? _('newest first') : _('oldest first'))),
				E('textarea', {
					readonly: '', id: 'applog-textarea', wrap: 'off', rows: Math.min(appLine + 2, 20),
					style: 'width:100%; background-color:#272626; color:#c5c5b2; border:1px solid #555; font-family:Consolas, monospace; font-size:14px;',
				}, appText),
			]);
		if (appText) view.appendChild(applogLE);

		const { text: sysText, line: sysLine } = parseLog(syslog, currentLines, reverseOrder);
		if (sysText) {
			view.appendChild(
				E('div', {}, [
					E('div', { style: 'margin-top: 1em', id: 'syslog-title' },
						_('Last %s lines of run log (%s):').format(
							sysLine, reverseOrder ? _('newest first') : _('oldest first'))),
					E('textarea', {
						readonly: '', id: 'syslog-textarea', wrap: 'off', rows: Math.min(sysLine + 2, 20),
						style: 'width:100%; background-color:#272626; color:#c5c5b2; border:1px solid #555; font-family:Consolas, monospace; font-size:14px;',
					}, sysText),
				])
			);
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
