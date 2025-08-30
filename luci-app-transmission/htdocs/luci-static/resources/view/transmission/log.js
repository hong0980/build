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
				.then(content => formatLog(content.trim())),
			fs.stat(log_path)
				.then((stat) => fs.read_direct(log_path)
					.then(content => ({ content: content.trim(), stat }))
					.catch(() => ''))
				.catch(() => ({ content: '', stat: null }))
		]);
	},

	load: function () {
		return uci.load('transmission').then((r) => {
			const log_path = `${uci.get(r, 'transmission', 'log_file') || '/var/log'}/transmission.log`.replace(/\/+/g, '/');
			return this.getlog(log_path)
				.then(([syslog, data]) => [syslog, data.content, log_path, data.stat]);
		});
	},

	render: function ([syslog, applog, log_path, stat]) {
		let sysText, appText, sysLine, appLine, Lines = 30, isreverse = true;
		const parseLog = (content, lines, reverse) => {
			const linesArray = content?.trim() ? content.split('\n').filter(line => line.trim()) : [];
			if (reverse) linesArray.reverse();
			return {
				line: Math.min(linesArray.length, lines),
				content: linesArray.slice(0, lines).join('\n')
			};
		};

		const refreshLogs = () => this.getlog(log_path)
			.then(([syslog, data]) => updateLogsDisplay(syslog, data.content));

		const updateLogsDisplay = (syslog = null, applog = null) => {
			let content, line;
			const applogTitle = document.getElementById('applog-title');
			const syslogTitle = document.getElementById('syslog-title');

			if (syslogTitle && syslog) {
				const syslogTextarea = document.getElementById('syslog-textarea');
				({ content, line } = parseLog(syslog, Lines, isreverse));
				syslogTitle.textContent = _('Last %s lines of syslog (%s):').format(
					line, isreverse ? _('newest first') : _('oldest first'));
				syslogTextarea.value = content;
				syslogTextarea.rows = Math.min(line + 2, 20);
			};

			if (applogTitle && applog) {
				const applogTextarea = document.getElementById('applog-textarea');
				({ content, line } = parseLog(applog, Lines, isreverse));
				applogTitle.textContent = '%s %s'.format(
					log_path, _('Last %s lines of run log (%s):').format(
						line, isreverse ? _('newest first') : _('oldest first'))
				);
				applogTextarea.value = content;
				applogTextarea.rows = Math.min(line + 2, 20);
			};
		};

		({ content: appText, line: appLine } = parseLog(applog, Lines, isreverse));
		({ content: sysText, line: sysLine } = parseLog(syslog, Lines, isreverse));

		const body = E('div', [E('h3', _('Logs'))]);
		const applogLE = E('div', [
			E('div', { style: 'margin-top: 1em', id: 'applog-title' }),
			E('textarea', {
				readonly: '', wrap: 'off', id: 'applog-textarea', rows: Math.min(appLine + 2, 20),
				style: 'width:100%; background-color:#272626; color:#c5c5b2; border:1px solid #555; font-family:Consolas, monospace; font-size:14px;',
			}, appText),
			stat
				? E('div', { style: 'color:#888;font-size:90%;', }, _('Last modified: %s, Size: %s bytes').format(
					new Date(stat.mtime * 1000).toLocaleString(), stat.size))
				: []
		]);

		if (sysText || appText) body.appendChild(
			E('div', { style: 'display: flex; align-items: center; gap: 15px;' }, [
				E('div', _('Lines:')),
				E('select', {
					class: 'cbi-input-select', style: 'width: 50px;',
					change: ui.createHandlerFn(this, (ev) => {
						Lines = ev.target.value;
						updateLogsDisplay(syslog, applog);
					})
				}, [10, 20, 30, 50, 100].map((opt) =>
					E('option', { value: opt, selected: opt === Lines ? '' : null }, opt))),
				E('div', _('Refresh time:')),
				E('select', {
					class: 'cbi-input-select', style: 'width: 50px;',
					change: ui.createHandlerFn(this, (ev) => {
						poll.active() && poll.remove(refreshLogs);
						poll.add(refreshLogs, ev.target.value);
					})
				}, [3, 5, 7, 10].map((opt) =>
					E('option', { value: opt, selected: opt === L.env.pollinterval ? '' : null }, opt))),
				E('div', {
					class: 'btn cbi-button-apply',
					click: ui.createHandlerFn(this, (ev) => {
						isreverse = !isreverse;
						updateLogsDisplay(syslog, applog);
						ev.target.textContent = isreverse
							? _('▽ Show Oldest First')
							: _('△ Show Newest First');
					})
				}, _('▽ Show Oldest First')),
				applog
					? E('div', {
						class: 'btn cbi-button-negative', id: 'clear-btn', title: _('Clear Log'),
						click: ui.createHandlerFn(this, () => {
							fs.write(log_path, '')
								.then(() => {
									body.removeChild(applogLE);
									document.getElementById('clear-btn').style.display = 'none';
								})
								.catch(e =>
									ui.addNotification(null, E('p', _('Failed to clear log: %s').format(e.message)), 'error'));
						})
					}, _('Clear Log'))
					: [],
				E('input', {
					type: 'checkbox', id: 'wordwrap-toggle',
					change: ui.createHandlerFn(this, (ev) => document.querySelectorAll('textarea')
						.forEach(ta => ta.style.whiteSpace = ev.target.checked ? 'pre-wrap' : 'pre'))
				}),
				E('label', { for: 'wordwrap-toggle', title: _('Enable automatic line wrapping') }, _('Wrap text'))
			])
		);

		if (appText && appLine > 0) body.appendChild(applogLE);
		if (sysText) body.appendChild(
			E('div', [
				E('div', { style: 'margin-top: 1em', id: 'syslog-title' }),
				E('textarea', {
					readonly: '', wrap: 'off', id: 'syslog-textarea', rows: Math.min(sysLine + 2, 20),
					style: 'width:100%; background-color:#272626; color:#c5c5b2; border:1px solid #555; font-family:Consolas, monospace; font-size:14px;',
				}, sysText),
			])
		);
		if (!sysText && !appText) body.appendChild(
			E('pre', {
				style: 'margin: 0; white-space: pre-wrap; word-wrap: break-word; font-family: monospace;'
			}, _('No log data available'))
		);

		poll.add(refreshLogs);
		return body;
	},

	handleSave: null,
	handleReset: null,
	handleSaveApply: null
});
