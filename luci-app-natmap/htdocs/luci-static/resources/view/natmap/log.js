'use strict';
'require fs';
'require ui';
'require poll';
'require view';

const MIN_ROWS = 2, MAX_ROWS = 20;
const LOG_PATH = '/var/log/natmap.log';

function fetchLogs() {
	return Promise.all([
		fs.trimmed(LOG_PATH),
		L.resolveDefault(fs.exec_direct('/sbin/logread', ['-e', 'natmap']), '')
	]);
}

function syncBlock(el, text) {
	const str = String(text || '').trim();
	const lines = str ? str.split('\n').reverse() : [];
	const hasContent = lines.length > 0;
	el.value = hasContent ? lines.join('\n') : _('no data');
	el.rows = Math.min(Math.max(hasContent ? lines.length : 1, MIN_ROWS), MAX_ROWS);
}

return view.extend({
	load: function () { return fetchLogs(); },

	render: function ([applog, syslog]) {
		const textareaStyle = 'width:100%; background-color:#272626; color:#c5c5b2; border:1px solid #555; font-family:Consolas, monospace; font-size:14px;';
		const appTextarea = E('textarea', {
			'readonly': true, 'rows': MIN_ROWS, 'style': textareaStyle
		});
		const sysTextarea = E('textarea', {
			'readonly': true, 'rows': MIN_ROWS, 'style': textareaStyle
		});
		const clearBtn = E('button', {
			'class': 'btn cbi-button-negative',
			'style': applog ? '' : 'display:none;',
			'click': ui.createHandlerFn(this, function () {
				return fs.write(LOG_PATH, '').then(function () {
					syncBlock(appTextarea, '');
					clearBtn.style.display = 'none';
				}).catch(function () {});
			})
		}, _('Clear Log'));
		const appHeading = E('div', { style: 'margin-top: 1em' }, _('Run Log %s').format(LOG_PATH));
		const sysHeading = E('div', { style: 'margin-top: 1em' }, _('System Log'));
		const EL = E('div', { 'class': 'cbi-map' }, [
			clearBtn, appHeading, appTextarea, sysHeading, sysTextarea
		]);

		syncBlock(appTextarea, applog);
		syncBlock(sysTextarea, syslog);

		poll.add(function () {
			return fetchLogs().then(function ([nextApp, nextSys]) {
				syncBlock(appTextarea, nextApp);
				syncBlock(sysTextarea, nextSys);
				clearBtn.style.display = String(nextApp || '').trim() ? '' : 'none';
			});
		}, 5);
		return EL;
	},

	handleSave: null,
	handleReset: null,
	handleSaveApply: null
});
