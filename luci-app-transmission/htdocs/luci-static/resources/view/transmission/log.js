'use strict';
'require fs';
'require ui';
'require uci';
'require view';
'require poll';

return view.extend({
	getlog: function (log_path) {
		const formatLog = (content) => {
			const months = {
				Jan: '01', Feb: '02', Mar: '03', Apr: '04', May: '05', Jun: '06',
				Jul: '07', Aug: '08', Sep: '09', Oct: '10', Nov: '11', Dec: '12'
			};

			return content.split('\n').filter(Boolean).map(line => {
				const match = line.match(/^[A-Z][a-z]{2}\s+([A-Z][a-z]{2})\s+(\d{1,2})\s(\d{2}:\d{2}:\d{2})\s(\d{4})\s(.+)$/);
				if (!match) return line;

				const [, month, day, time, year, rest] = match;
				return `${year}${_("year")}${months[month] || '??'}${_("month")}${day.padStart(2, '0')}${_("day")} ${time} ${rest}`;
			}).join('\n');
		};

		return Promise.all([
			L.resolveDefault(fs.exec_direct('/sbin/logread', ['-e', 'transmission']), '')
				.then(content => formatLog(content)),
			L.resolveDefault(fs.read_direct(log_path), '')
				.then(content => content.trim())
		]);
	},

	load: function () {
		return uci.load('transmission').then((r) => {
			const log_path = `${uci.get(r, 'transmission', 'log_file') || '/var/log'}/transmission.log`.replace(/\/+/g, '/');
			return this.getlog(log_path)
				.then(([syslog, applog]) => [syslog, applog, log_path]);
		});
	},

	render: function ([syslog, applog, log_path]) {
		let ris = 5, Lines = 30, isreverse = true, refreshTask = null;
		const parseLog = (content, lines, reverse) => {
			const linesArray = content?.trim() ? content.split('\n').filter(line => line.trim()) : [];
			if (reverse) linesArray.reverse();
			return {
				content: linesArray.slice(0, lines).join('\n'),
				line: Math.min(linesArray.length, lines)
			};
		};
		const refreshLogs = () => this.getlog(log_path)
			.then(([syslog, applog]) => updateLogsDisplay(syslog, applog));

		const updateLogsDisplay = (syslog = null, applog = null) => {
			const syslogTitle = document.getElementById('syslog-title');
			const applogTitle = document.getElementById('applog-title');
			const syslogTextarea = document.getElementById('syslog-textarea');
			const applogTextarea = document.getElementById('applog-textarea');

			if (syslogTitle && syslogTextarea && syslog) {
				const { content, line } = parseLog(syslog, Lines, isreverse);
				syslogTitle.textContent = _('Last %s lines of syslog (%s):').format(
					line, isreverse ? _('newest first') : _('oldest first'));
				syslogTextarea.value = content;
				syslogTextarea.rows = Math.min(line + 2, 20);
			};

			if (applogTitle && applogTextarea && applog) {
				const { content, line } = parseLog(applog, Lines, isreverse);
				applogTitle.textContent = '%s %s'.format(
					log_path, _('Last %s lines of run log (%s):').format(
						line, isreverse ? _('newest first') : _('oldest first'))
				);
				applogTextarea.value = content;
				applogTextarea.rows = Math.min(line + 2, 20);
			};
		};

		const startRefresh = () => {
			if (refreshTask) poll.remove(refreshTask);
			refreshTask = () => refreshLogs().then(() => ris);
			poll.add(refreshTask, ris);
		};

		const view = E('div', {}, [
			E('h3', {}, _('Logs')),
			E('div', { style: 'display: flex; align-items: center; gap: 10px;' }, [
				E('div', _('Lines:')),
				E('select', {
					class: 'cbi-input-select', style: 'width: auto; min-width: 50px;',
					change: ui.createHandlerFn(this, (ev) => {
						Lines = parseInt(ev.target.value);
						updateLogsDisplay(syslog, applog);
					})
				}, [10, 20, 30, 50, 100].map((opt) =>
					E('option', { value: opt, selected: opt === Lines ? '' : null }, opt))),
				E('div', _('Refresh time:')),
				E('select', {
					class: 'cbi-input-select', style: 'width: auto; min-width: 50px;',
					change: ui.createHandlerFn(this, (ev) => {
						ris = parseInt(ev.target.value);
						startRefresh();
					})
				}, [3, 5, 7, 10].map((opt) =>
					E('option', { value: opt, selected: opt === ris ? '' : null }, opt))),
				E('div', {
					class: 'btn cbi-button-apply',
					click: ui.createHandlerFn(this, (ev) => {
						isreverse = !isreverse;
						updateLogsDisplay(syslog, applog);
						ev.target.textContent = isreverse
							? _('△ Show Newest First')
							: _('▽ Show Oldest First');
					})
				}, _('△ Show Newest First')),
				applog
					? E('div', {
						class: 'btn cbi-button-negative', id: 'clear-btn', title: _('Clear Log'),
						click: ui.createHandlerFn(this, () => {
							fs.write(log_path, '')
								.then(() => {
									view.removeChild(applogLE);
									document.getElementById('clear-btn').style.display = 'none';
								})
								.catch(e =>
									ui.addNotification(null, E('p', _('Failed to clear log: %s').format(e.message)), 'error'));
						})
					}, _('Clear Log'))
					: [],
				E('input', {
					type: 'checkbox', id: 'wordwrap-toggle',
					change: ev => {
						document.querySelectorAll('textarea').forEach(ta => {
							ta.style.whiteSpace = ev.target.checked ? 'pre-wrap' : 'pre';
						});
					}
				}),
				E('label', { for: 'wordwrap-toggle', title: _('Enable automatic line wrapping') }, _('Wrap text')),
			]),
		]);

		const { content: appText, line: appLine } = parseLog(applog, Lines, isreverse);
		const applogLE =
			E('div', {}, [
				E('div', { style: 'margin-top: 1em', id: 'applog-title' }),
				E('textarea', {
					readonly: '', wrap: 'off', id: 'applog-textarea', rows: Math.min(appLine + 2, 20),
					style: 'width:100%; background-color:#272626; color:#c5c5b2; border:1px solid #555; font-family:Consolas, monospace; font-size:14px;',
				}, appText),
			]);
		if (appText && appLine > 0) view.appendChild(applogLE);

		const { content: sysText, line: sysLine } = parseLog(syslog, Lines, isreverse);
		if (sysText) {
			view.appendChild(
				E('div', {}, [
					E('div', { style: 'margin-top: 1em', id: 'syslog-title' }),
					E('textarea', {
						readonly: '', wrap: 'off', id: 'syslog-textarea', rows: Math.min(sysLine + 2, 20),
						style: 'width:100%; background-color:#272626; color:#c5c5b2; border:1px solid #555; font-family:Consolas, monospace; font-size:14px;',
					}, sysText),
				])
			);
		};

		startRefresh();
		view.addEventListener('destroy', () => {
			if (refreshTask) {
				poll.remove(refreshTask);
				refreshTask = null;
			};
		});
		return view;
	},

	handleSave: null,
	handleReset: null,
	handleSaveApply: null
});
