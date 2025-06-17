'use strict';
'require view';
'require fs';
'require uci';

return view.extend({
	load: async function () {
		await uci.load('deluge');
		var profile_dir = uci.get('deluge', 'main', 'profile_dir') || '/etc/deluge';
		var log_path = profile_dir + '/deluged.log';

		var [syslogRaw, delugeRaw] = await Promise.all([
			fs.exec_direct('/sbin/logread', ['-e', 'deluge']).catch(() => ''),
			fs.read(log_path).catch(() => '')
		]);

		var lines = 50;
		var parseLog = (text) => text.trim().split('\n').reverse().slice(0, lines).join('\n');

		return [parseLog(syslogRaw), parseLog(delugeRaw)];
	},

	render: function ([syslog, delugeLog]) {
		return E('div', { class: 'cbi-map' }, [
			E('h2', {}, _('Deluge - Logs')),

			E('div', { class: 'cbi-section' }, [
				E('div', {}, _('Last 50 lines of syslog:')),
				E('textarea', {
					style: 'width: 100%',
					readonly: true,
					wrap: 'off', rows: 20
				}, syslog || _('No log data.'))
			]),

			E('div', { class: 'cbi-section' }, [
				E('div', {}, _('Last 50 lines of file:')),
				E('textarea', {
					style: 'width: 100%',
					readonly: true,
					wrap: 'off', rows: 20
				}, delugeLog || _('No log data.'))
			])
		]);
	},

	handleSave: null,
	handleSaveApply: null,
	handleReset: null
});
