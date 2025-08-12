'use strict';
'require fs';
'require uci';
'require view';

return view.extend({
	load: function () {
		return Promise.all([
			L.resolveDefault(fs.exec_direct('/sbin/logread', ['-e', 'aria2']), '')
				.then(res => res.trim().split(/\n/).reverse().slice(0, 50).join('\n')),

			uci.load('aria2')
				.then(() => uci.get('aria2', 'main', 'log') || '/var/log/aria2.log')
				.then(logPath => L.resolveDefault(fs.read(logPath), _('Failed to read log file')))
		]);
	},

	render: function ([syslog, aria2log]) {
		const textareaOpts = {
			readonly: 'readonly', wrap: 'off',
			style: 'width:100%; height:250px; font-size:13px; color:#c5c5b2; background-color:#272626; font-family:Consolas, monospace;'
		};

		return E('div', { class: 'cbi-section' }, [
			E('h2', { name: 'content' }, '%s - %s'.format(_('Aria2'), _('Log Data'))),
			E('br'),
			E('div', { class: 'description' }, _('Last 50 lines of log file:')),
			E('div', {}, E('textarea', textareaOpts, aria2log)),
			E('br'),
			E('div', { class: 'description' }, _('Last 50 lines of log file:')),
			E('div', {}, E('textarea', textareaOpts, syslog))
		]);
	},

	handleSave: null,
	handleReset: null,
	handleSaveApply: null
});
