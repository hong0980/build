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
				.then(logPath => L.resolveDefault(fs.read(logPath), _('Failed to read log file')))
		]);
	},

	render: function ([syslog, aria2log]) {
		function textareaOpts(content) {
			return E('div', {},
				E('textarea', {
					readonly: 'readonly', wrap: 'off',
					rows: Math.min(Math.max(content.trim().split('\n').length, 1) + 1, 16),
					style: 'width:100%; height:250px; font-size:13px; color:#c5c5b2; background-color:#272626; font-family:Consolas, monospace;'
				}, content.trim().split(/\n/).reverse().slice(0, 50).join('\n')),
			)
		};

		return E('div', { class: 'cbi-section' }, [
			E('h2', { name: 'content' }, '%s - %s'.format(_('Aria2'), _('Log Data'))),
			E('br'),
			E('div', { class: 'description' }, _('Last 50 lines of log file:')),
			textareaOpts(aria2log),
			E('br'),
			E('div', { class: 'description' }, _('Last 50 lines of syslog:')),
			textareaOpts(syslog)
		]);
	},

	handleSave: null,
	handleReset: null,
	handleSaveApply: null
});
