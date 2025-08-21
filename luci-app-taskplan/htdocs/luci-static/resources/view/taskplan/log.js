'use strict';
'require fs';
'require ui';
'require uci';
'require view';

const logPath = '/etc/taskplan/taskplan.log';
const notify = L.bind(ui.addTimeLimitedNotification || ui.addNotification, ui);

return view.extend({
	load: () => Promise.all([
		fs.trimmed(logPath),
		uci.load('taskplan')
			.then(() => uci.get('taskplan', 'globals', 'log_length') || '200')
	]),

	render: function ([content, log_length]) {
		var reversed = false, dom = { textarea: null, logLengthSelect: null };
		var view = E([
			E('p', {}, [
				E('div', {
					class: 'btn cbi-button-negative', title: _('Clear Log'), style: 'margin-left: 10px;',
					click: ui.createHandlerFn(this, () => {
						Promise.all([
							fs.write(logPath, ''),
							fs.write('/var/run/taskplan_counter.dat', '0')
						]).then(() => {
							dom.textarea.value = '';
							notify(null, E('p', _('Log cleared')), 3000, 'info');
						}).catch((e) => {
							ui.addNotification(null, E('p',
								_('Failed to clear the log: %s').format(e.message)), 'error');
						});
					})
				}, _('Clear Log')),
				E('div', {
					class: 'btn cbi-button-apply', style: 'margin-left:10px',
					click: ui.createHandlerFn(this, (ev) => {
						let newValue = reversed
							? dom.textarea.value.split('\n').reverse().join('\n')
							: content;

						dom.textarea.value = newValue;
						ev.target.textContent = reversed
							? _('▽ Show Oldest First')
							: _('△ Show Newest First');
						reversed = !reversed;
					})
				}, _('▽ Show Oldest First')),
				E('span', { style: 'margin-left: 20px;' }, [
					_('Number of logs retained'),
					E('select', {
						id: 'log_length', class: 'cbi-input-select',
						style: 'width: 80px; margin-left:10px'
					}, [50, 100, 200, 250, 300, 350].map((v) =>
						E('option', { value: v, selected: log_length == String(v) ? '' : null }, v)
					)),
					E('div', {
						style: 'margin-left: 10px;', class: 'btn cbi-button-apply',
						click: ui.createHandlerFn(this, () => {
							const val = dom.logLengthSelect.value;
							if (val != log_length) {
								uci.set('taskplan', 'globals', 'log_length', val);
								uci.save();
								uci.apply()
									.then(() => notify(null, E('p', _('Save successfully')), 3000))
									.catch((e) => notify(null, E('p', e.message), 3000));
							};
						})
					}, _('Save')),
				]),
			]),
			E('textarea', {
				id: 'textarea', readonly: '', rows: Math.min(content.split('\n').length + 2, 20),
				style: 'width:100%; background-color:#272626; color:#c5c5b2; border:1px solid #555; font-family:Consolas, monospace; font-size:14px;',
			}, content.split('\n').reverse().join('\n') || _('No log data available'))
		]);

		setTimeout(() => {
			dom.textarea = document.getElementById('textarea');
			dom.logLengthSelect = document.getElementById('log_length');
		}, 0);

		return view;
	},
	handleSave: null,
	handleReset: null,
	handleSaveApply: null
});
