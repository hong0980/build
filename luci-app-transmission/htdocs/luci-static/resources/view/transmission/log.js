'use strict';
'require fs';
'require uci';
'require view';
'require poll';

return view.extend({
	formatLog: function (logContent) {
		const monthMapping = {
			Jan: '01', Feb: '02', Mar: '03', Apr: '04', May: '05', Jun: '06',
			Jul: '07', Aug: '08', Sep: '09', Oct: '10', Nov: '11', Dec: '12'
		};

		return logContent.split('\n').filter(Boolean).map(line => {
			const pattern = /^[A-Z][a-z]{2}\s+([A-Z][a-z]{2})\s+(\d{1,2})\s(\d{2}:\d{2}:\d{2})\s(\d{4})\s(.+)$/;
			const match = line.match(pattern);
			if (!match) return line;

			const [, month, day, time, year, content] = match;
			return `${year}${_("year")}${monthMapping[month] || '??'}${_("month")}${day.padStart(2, '0')}${_("day")} ${time} ${content}`;
		}).join('\n');
	},

	fetchLogs: function (logFilePath) {
		return Promise.all([
			L.resolveDefault(fs.exec_direct('/sbin/logread', ['-e', 'transmission']), '')
				.then(result => this.formatLog(result.trim())),
			fs.trimmed(logFilePath)
		]);
	},

	load: function () {
		return uci.load('transmission').then(() => {
			const logFilePath = uci.get('transmission', 'transmission', 'log_file') || '/var/log/transmission.log';
			return this.fetchLogs(logFilePath)
				.then(([systemLog, transmissionLog]) => ({ systemLog, transmissionLog, logFilePath }));
		});
	},

	render: function ({ logFilePath, systemLog, transmissionLog }) {
		var currentLines = 50, shouldReverse = true, logRefreshInterval = 5, logRefreshTask = null;
		const calculateTextareaRows = (lineCount) =>
			lineCount > 0 ? Math.min(lineCount + 2, 20) : 3;

		const parseLogContent = (rawLog, lineLimit, reverseOrder) => {
			if (!rawLog || rawLog.trim() === '') return { content: '', lineCount: 0 };
			const lines = rawLog.split('\n').filter(line => line.trim() !== '');
			const processedLines = reverseOrder
				? [...lines].reverse().slice(0, lineLimit)
				: lines.slice(0, lineLimit);

			return {
				content: processedLines.join('\n'),
				lineCount: processedLines.length
			};
		};

		const refreshLogDisplay = (systemContent, transmissionContent) => {
			const updateArea = (id, titleId, content, titleText) => {
				const title = document.getElementById(titleId);
				const textarea = document.getElementById(id);
				if (title && textarea) {
					title.textContent = titleText;
					textarea.value = content;
					textarea.rows = calculateTextareaRows(content.split('\n').length);
				}
			};

			const parsedSystem = parseLogContent(systemContent, currentLines, shouldReverse);
			updateArea(
				'syslog-textarea', 'syslog-title', parsedSystem.content,
				_('Last %s lines of syslog (%s):').format(
					parsedSystem.lineCount, shouldReverse ? _('newest first') : _('oldest first'))
			);

			const parsedTrans = parseLogContent(transmissionContent, currentLines, shouldReverse);
			updateArea(
				'transmission-textarea', 'transmission-title', parsedTrans.content,
				`${logFilePath} ${_('Last %s lines of run log (%s):').format(
					parsedTrans.lineCount, shouldReverse ? _('newest first') : _('oldest first'))}`
			);
		};

		const setupPolling = () => {
			if (logRefreshTask) poll.remove(logRefreshTask);
			logRefreshTask = poll.add(() => {
				return this.fetchLogs(logFilePath).then(([sys, tr]) => {
					refreshLogDisplay(sys, tr);
					return logRefreshInterval;
				});
			}, logRefreshInterval);
		};

		const initialSystemLog = parseLogContent(systemLog, currentLines, shouldReverse);
		const initialTransmissionLog = parseLogContent(transmissionLog, currentLines, shouldReverse);
		const view = E('div', { class: 'cbi-map' }, [
			E('h3', {}, _('Transmission - Logs')),
			E('div', { style: 'margin-bottom: 10px; display: flex; flex-wrap: wrap; gap: 10px; align-items: center' }, [
				E('div', { style: 'display: flex; align-items: center; gap: 5px' }, [
					_('Lines:'),
					E('select', {
						class: 'cbi-input-select', style: 'width: 100px; margin-left: 5px;',
						change: ev => { currentLines = parseInt(ev.target.value); refreshLogDisplay(systemLog, transmissionLog); }
					}, [10, 20, 50, 100].map(opt =>
						E('option', { value: opt, selected: opt === currentLines }, opt)))
				]),

				E('div', {
					class: 'btn cbi-button-neutral',
					click: function () {
						shouldReverse = !shouldReverse;
						refreshLogDisplay(systemLog, transmissionLog);
						this.textContent = shouldReverse
							? _('▽ Show Oldest First')
							: _('△ Show Newest First');
					}
				}, shouldReverse ? _('▽ Show Oldest First') : _('△ Show Newest First')),

				E('div', {
					class: 'btn cbi-button-action',
					click: () => this.fetchLogs(logFilePath).then(([sys, tr]) => refreshLogDisplay(sys, tr))
				}, _('⟳ Refresh Now')),

				E('div', { style: 'display: flex; align-items: center; gap: 5px' }, [
					E('input', {
						type: 'checkbox', id: 'wordwrap-toggle',
						change: ev => {
							document.querySelectorAll('#syslog-textarea, #transmission-textarea').forEach(ta => {
								ta.style.whiteSpace = ev.target.checked ? 'pre-wrap' : 'pre';
							});
						}
					}),
					E('label', { for: 'wordwrap-toggle', title: _('Enable automatic line wrapping') }, _('Wrap text'))
				])
			]),

		]);

		if (initialSystemLog.content) {
			view.appendChild(
				E('div', { style: 'margin-top: 1em' }, [
					E('div', { id: 'syslog-title' },
						_('Last %s lines of syslog (%s):').format(
							initialSystemLog.lineCount,
							shouldReverse ? _('newest first') : _('oldest first'))
					),
					E('textarea', {
						id: 'syslog-textarea', readonly: true, wrap: 'off',
						rows: calculateTextareaRows(initialSystemLog.lineCount),
						style: 'width:100%; background-color:#272626; color:#c5c5b2; border:1px solid #555; font-family:Consolas, monospace; font-size:14px;'
					}, initialSystemLog.content)
				]))
		};

		if (initialTransmissionLog.content) {
			view.appendChild(
				E('div', { style: 'margin-top: 1em' }, [
					E('div', { id: 'transmission-title' },
						`${logFilePath} ${_('Last %s lines of run log (%s):').format(
							initialTransmissionLog.lineCount,
							shouldReverse ? _('newest first') : _('oldest first'))}`
					),
					E('textarea', {
						id: 'transmission-textarea', readonly: true, wrap: 'off',
						rows: calculateTextareaRows(initialTransmissionLog.lineCount),
						style: 'width:100%; background-color:#272626; color:#c5c5b2; border:1px solid #555; font-family:Consolas, monospace; font-size:14px;'
					}, initialTransmissionLog.content)
				]))
		};

		setupPolling();
		view.addEventListener('destroy', () => {
			if (logRefreshTask) {
				poll.remove(logRefreshTask);
			}
		});

		return view;
	},

	handleSave: null,
	handleReset: null,
	handleSaveApply: null
});
