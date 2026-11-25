'use strict';
'require fs';
'require ui';
'require poll';
'require view';

const MIN_ROWS = 6, MAX_ROWS = 20;
const LOG_PATH = '/var/log/natmap.log';

function fetchLogs() {
	return Promise.all([
		fs.trimmed(LOG_PATH),
		L.resolveDefault(fs.exec_direct('/sbin/logread', ['-e', 'natmap']), '')
	]);
}

function fitRows(el, text) {
	const str = String(text || '').trim();
	const count = str ? str.split('\n').length : 0;
	el.rows = Math.min(Math.max(count, MIN_ROWS), MAX_ROWS);
}

return view.extend({
	load: function () { return fetchLogs(); },

	render: function ([applog, syslog]) {
		const textareaStyle = 'width:100%; background-color:#272626; color:#c5c5b2; border:1px solid #555; font-family:Consolas, monospace; font-size:14px;';
		const appTextarea = E('textarea', {
			'readonly': true, 'rows': MIN_ROWS, 'style': textareaStyle
		}, applog);
		const sysTextarea = E('textarea', {
			'readonly': true, 'rows': MIN_ROWS, 'style': textareaStyle
		}, syslog);

		fitRows(appTextarea, applog);
		fitRows(sysTextarea, syslog);

		poll.add(function () {
			return fetchLogs().then(function ([nextApp, nextSys]) {
				appTextarea.value = nextApp;
				sysTextarea.value = nextSys;
				fitRows(appTextarea, nextApp);
				fitRows(sysTextarea, nextSys);
			});
		}, 5);

		return E('div', { 'class': 'cbi-map' }, [
			E('button', {
				'class': 'btn cbi-button-negative',
				'click': ui.createHandlerFn(this, function () {
					return fs.write(LOG_PATH, '').then(function () {
						appTextarea.value = '';
						fitRows(appTextarea, '');
					}).catch(function () {});
				})
			}, _('Clear Log')),
			E('div', { style: 'margin-top: 1em' }, _('Run Log %s').format(LOG_PATH)),
			appTextarea,
			E('div', { style: 'margin-top: 1em' }, _('System Log')),
			sysTextarea
		]);
	},

	handleSave: null,
	handleReset: null,
	handleSaveApply: null
});
