'use strict';
'require fs';
'require uci';
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

return view.extend({
	load: function () {
		return Promise.all([
			L.resolveDefault(fs.exec_direct('/sbin/logread', ['-e', 'aria2']), '')
				.then(res => formatLog(res)),

			uci.load('aria2')
				.then(() => uci.get('aria2', 'main', 'log') || '/var/log/aria2.log')
				.then(logPath => L.resolveDefault(fs.trimmed(logPath)))
		]);
	},

	render: function ([syslog, aria2log]) {
		const container = E('div', { class: 'cbi-section' }, [
			E('h3', { name: 'content' }, '%s - %s'.format(_('Aria2'), _('Log Data')))
		]);

		const addLogSection = (log, title) => {
			if (!log) return;
			container.appendChild(E('div', { style: 'margin-bottom: 1em;' }, [
				E('div', {}, title),
				E('textarea', {
					wrap: 'soft', readonly: '', rows: Math.min(log.split('\n').length + 2, 16),
					style: 'width:100%; font-size:13px; color: #c5c5b2; background-color: #272626; font-family: Consolas, monospace;'
				}, log.split('\n').reverse().join('\n'))
			]));
		};
		addLogSection(aria2log, _('Last 50 lines of log file:'));
		addLogSection(syslog, _('Last 50 lines of syslog:'));

		return container;
	},

	handleSave: null,
	handleReset: null,
	handleSaveApply: null
});
