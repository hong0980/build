'use strict';
'require fs';
'require ui';
'require uci';
'require poll';
'require view';

const logpath = '/etc/taskplan/taskplan.log';
const notify = L.bind(ui.addTimeLimitedNotification || ui.addNotification, ui);

return view.extend({
	load: () => Promise.all([
		L.resolveDefault(fs.trimmed(logpath), ''),
		uci.load('taskplan').then(() => uci.get('taskplan', 'globals', 'log_length') || '200')
	]),

	render: ([content, log_length]) => {
		let reversed = false;
		const textarea = content ? E('textarea', {
			readonly: true, rows: Math.min(content.split('\n').length + 2, 20),
			style: 'width:100%; background:#272626; color:#c5c5b2; border:1px solid #555; font-family:Consolas,monospace; font-size:14px;'
		}, content.split('\n').reverse().join('\n')) : [];

		const refreshLogs = () =>
			fs.trimmed(logpath).then(newContent => {
				if (newContent && textarea) {
					if (textarea.rows < 18)
						textarea.rows = Math.min(newContent.split('\n').length + 2, 20);
					textarea.value = reversed
						? newContent
						: newContent.split('\n').reverse().join('\n');
				}
			});

		const logLengthSelect = E('select', { class: 'cbi-input-select', style: 'width:80px;' },
			[50, 100, 200, 250, 300, 350].map(v =>
				E('option', { value: v, selected: String(log_length) == v ? '' : null }, v))
		);

		const body = E('div', [
			E('h3', _('Logs')),
			content
				? E('div', [
					E('p', { style: 'display:flex;align-items:center;gap:15px;margin-bottom:.5em;' }, [
						E('label', _('Number of logs retained')),
						logLengthSelect,
						E('div', {
							class: 'btn cbi-button-apply',
							click: ui.createHandlerFn(this, () => {
								const val = +logLengthSelect.value;
								if (val != log_length) {
									uci.set('taskplan', 'globals', 'log_length', val);
									uci.save();
									uci.apply()
										.then(() => notify(null, E('p', _('Save successfully')), 3000))
										.catch(e => notify(null, E('p', e.message), 3000));
								}
							})
						}, _('Save')),
						E('label', _('Refresh time:')),
						E('select', {
							class: 'cbi-input-select', style: 'width:80px;',
							change: ui.createHandlerFn(this, ev => {
								const val = +ev.target.value;
								poll.active() && poll.remove(refreshLogs);
								val > 0 && poll.add(refreshLogs, val);
							})
						}, [0, 5, 10, 30, 60].map((opt) =>
							E('option', { value: opt, selected: opt === 30 ? '' : null }, opt === 0 ? _('Paused') : opt))),
						E('div', {
							class: 'btn cbi-button-apply',
							click: ui.createHandlerFn(this, ev => {
								reversed = !reversed;
								refreshLogs();
								ev.target.textContent = reversed
									? _('△ Show Newest First')
									: _('▽ Show Oldest First');
							})
						}, _('▽ Show Oldest First')),
						E('div', {
							class: 'btn cbi-button-negative',
							click: ui.createHandlerFn(this, () => {
								Promise.all([
									fs.write(logpath, ''),
									fs.write('/var/run/taskplan_counter.dat', '0')
								]).then(() => {
									if (textarea) textarea.style.display = 'none';
									notify(null, E('p', _('Log cleared')), 3000, 'info');
								}).catch(e => {
									ui.addNotification(null, E('p', _('Failed to clear the log: %s').format(e.message)), 'error');
								});
							})
						}, _('Clear Log'))
					]),
					textarea])
				: E('pre', { style: 'margin:0;white-space:pre-wrap;font-family:monospace;' }, _('No log data available'))
		]);

		content && poll.add(refreshLogs, 30);

		return body;
	},

	handleSave: null,
	handleReset: null,
	handleSaveApply: null
});
