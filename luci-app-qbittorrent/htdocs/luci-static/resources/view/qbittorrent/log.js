'use strict';
'require dom';
'require fs';
'require uci';
'require view';

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
		.join('\n');
};

return view.extend({
	load: function () {
		const syslog = L.resolveDefault(
			fs.exec_direct('/sbin/logread', ['-e', 'qbittorrent-nox']),
			_('Failed to read log file')).then(formatLog);

		const appLog = uci.load('qbittorrent')
			.then((r) => {
				const path = uci.get(r, 'main', 'Path') || '';
				const rpath = uci.get(r, 'main', 'RootProfilePath') || '';
				const logPath = `${path || `${rpath}/qBittorrent/data/logs`}/qbittorrent.log`;

				return L.resolveDefault(fs.read(logPath), _('Failed to read log file'))
					.then((content) => content.split('\n').reverse().join('\n'));
			});

		return Promise.all([syslog, appLog]);
	},

	render: function ([syslog, appLog]) {
		const container = E('h2', {}, _('qBittorrent - Logs'));

		container.appendChild(
			E('div', { class: 'cbi-section-node' }, [
				E('label', { class: 'cbi-label' }, _('Application Log')),
				E('textarea', {
					readonly: 'off', rows: Math.min(appLog.split('\n').length + 1, 15),
					style: 'width:100%; background-color:#272626; color:#c5c5b2; border:1px solid #555; font-family:Consolas, monospace; font-size:14px;',
				}, appLog)
			])
		);

		container.appendChild(
			E('div', { class: 'cbi-section-node' }, [
				E('label', { class: 'cbi-label' }, _('System Log')),
				E('textarea', {
					readonly: 'off', rows: Math.min(syslog.split('\n').length + 2, 15),
					style: 'width:100%; background-color:#272626; color:#c5c5b2; border:1px solid #555; font-family:Consolas, monospace; font-size:14px;',
				}, syslog)
			])
		);

		return container;
	},

	handleSave: null,
	handleReset: null,
	handleSaveApply: null
});
