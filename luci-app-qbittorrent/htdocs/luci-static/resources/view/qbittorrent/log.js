'use strict';
'require fs';
'require ui';
'require uci';
'require view';

const notify = L.bind(ui.addTimeLimitedNotification || ui.addNotification, ui);
const formatLog = (logStr) => {
	const months = {
		Jan: '01', Feb: '02', Mar: '03', Apr: '04', May: '05', Jun: '06',
		Jul: '07', Aug: '08', Sep: '09', Oct: '10', Nov: '11', Dec: '12'
	};

	return logStr.split('\n').filter(Boolean)
		.map(line => {
			const match = line.match(/^[A-Z][a-z]{2}\s+([A-Z][a-z]{2})\s+(\d{1,2})\s(\d{2}:\d{2}:\d{2})\s(\d{4})\s(.+)$/);
			if (!match) return line;

			const [, month, day, time, year, rest] = match;
			return `${year}${_("year")}${months[month] || '??'}${_("month")}${day.padStart(2, '0')}${_("day")} ${time} ${rest}`;
		})
		.reverse().join('\n');
};

return view.extend({
	load: function () {
		const syslog = L.resolveDefault(fs.exec_direct('/sbin/logread', ['-e', 'qbittorrent-nox']), {})
			.then(formatLog);
		const applog = uci.load('qbittorrent').then((r) => {
			const path = uci.get(r, 'main', 'Path') || '';
			const rpath = uci.get(r, 'main', 'RootProfilePath') || '';
			const logPath = `${path || `${rpath}/qBittorrent/data/logs`}/qbittorrent.log`;

			return L.resolveDefault(fs.trimmed(logPath), '')
				.then((content) => ({
					logPath,
					logContent: content ? content.split('\n').reverse().join('\n') : ''
				}));
		});

		return Promise.all([syslog, applog]);
	},

	render: function ([syslog, applog = {}]) {
		const { logPath, logContent: applogContent } = applog;
		let reversed = false;
		const view = E('div', {}, [
			E('h3', {}, _('qBittorrent - Logs')),
			E('div', { style: 'margin-bottom: 10px; display: flex; flex-wrap: wrap; gap: 10px; align-items: center' }, [
				applogContent
					? E('div', {
						class: 'btn cbi-button-negative', title: _('Clear Log'),
						click: ui.createHandlerFn(this, () => {
							fs.write(logPath, '')
								.then(() => {
									document.querySelector('#applog-textarea').value = '';
									notify(null, E('p', _('Log cleared')), 3000, 'info');
									location.reload()
								})
								.catch((e) => {
									ui.addNotification(null, E('p', _('Failed to clear log: %s').format(e.message)), 'error');
								});
						})
					}, _('Clear Log'))
					: [],
				E('div', {
					class: 'btn cbi-button-apply',
					click: ui.createHandlerFn(this, (ev) => {
						document.querySelectorAll('#applog-textarea, #qbittorrent-textarea').forEach(ta => {
							if (ta && ta.value) {
								ta.value = reversed
									? ta.value.split('\n').reverse().join('\n')
									: ta.value.split('\n').reverse().join('\n');
							}
						});

						ev.target.textContent = reversed
							? _('▽ Show Oldest First')
							: _('△ Show Newest First');
						reversed = !reversed;
					})
				}, _('▽ Show Oldest First')),
				E('div', { style: 'display: flex; align-items: center; gap: 5px' }, [
					E('input', {
						type: 'checkbox', id: 'wordwrap-toggle',
						change: ev => {
							document.querySelectorAll('#applog-textarea, #qbittorrent-textarea').forEach(ta => {
								ta.style.whiteSpace = ev.target.checked ? 'pre-wrap' : 'pre';
							});
						}
					}),
					E('label', { for: 'wordwrap-toggle', title: _('Enable automatic line wrapping') }, _('Wrap text'))
				])
			]),
		]);

		if (applogContent) {
			view.appendChild(
				E('div', { style: 'margin-top: 1em' }, [_('Application Log'),
				E('textarea', {
					readonly: '', id: 'applog-textarea', wrap: 'off',
					rows: Math.min(applogContent.split('\n').length + 1, 18),
					style: 'width:100%; background-color:#272626; color:#c5c5b2; border:1px solid #555; font-family:Consolas, monospace; font-size:14px;',
				}, applogContent)
				])
			);
		}

		if (syslog) {
			view.appendChild(
				E('div', { style: 'margin-top: 1em' }, [_('System Log'),
				E('textarea', {
					readonly: '', id: 'qbittorrent-textarea', wrap: 'off',
					rows: Math.min(syslog.split('\n').length + 2, 18),
					style: 'width:100%; background-color:#272626; color:#c5c5b2; border:1px solid #555; font-family:Consolas, monospace; font-size:14px;',
				}, syslog)
				])
			);
		}

		return view;
	},

	handleSave: null,
	handleReset: null,
	handleSaveApply: null
});
