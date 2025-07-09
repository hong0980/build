'use strict';
'require ui';
'require fs';
'require uci';
'require view';
'require form';

const CSS = `
@media (min-width: 768px) {
	.cbi-section-table .cbi-input-text {
		max-width: 50px;
	}

	[data-name="remarks"] .cbi-input-text {
		min-width: 140px !important;
	}

	.cbi-section-table select,
	.table.cbi-section-table .cbi-dropdown {
		min-width: 72px;
		max-width: 72px;
	}

	td:has(.cbi-button) {
		width: 22px !important;
	}
}`;

const validateCrontabField = (type, value, monthValue) => {
	const types = {
		'day': {min: 1, max: 31, label: _('Days'), msg: _('1-31, "*", "*/N", ranges, or lists. E.g.: 1,5,10 or 5-10,*/2'),
			getMaxDays: function(monthValue) {
				if (!monthValue || monthValue === '*') return 31;
				const monthValidation = validateCrontabField('month', monthValue);
				if (monthValidation !== true) return 31;

				const firstMonthPart = monthValue.split(',')[0].replace(/\/\d+$/, '');
				const month = parseInt(firstMonthPart.match(/\d+/)?.[0] || 1);
				if (month === 2) {
					const year = new Date().getFullYear();
					return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0 ? 29 : 28;
				};
				return [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1];
		}},
		'hour': {min: 0, max: 23, label: _('hours'), msg: _('0-23, "*", "*/N", ranges, or lists. E.g.: 0,12,18 or 8-17')},
		'month': {min: 1, max: 12, label: _('months'), msg: _('1-12, "*", "*/N", ranges, or lists. E.g.: 1,6,12 or 3-8,*/2')},
		'minute': {min: 0, max: 59, label: _('minutes'), msg: _('0-59, "*", "*/N", ranges, or lists. E.g.: 0,15,30,45 or 10-50,*/5')},
		'week': {min: 0, max: 6, label: _('weeks'), msg: _('0-6 (0/6=Sunday), "*", "*/N", ranges, or lists. E.g.: 0,1,5 or 1-5,*/2')}
	};

	value = (value || '').replace(/\s/g, '');
	if (value === '') return true;

	const parts = value.split(',').filter(Boolean);
	const isIncomplete = parts.some(part => {
		if (part.startsWith('-') || part.endsWith('-')) return true;
		if (part.endsWith('/')) return true;
		return false;
	});
	if (isIncomplete) return true;

	const field = types[type];
	// const basePattern = /^(?!.*(?:,,|--|\/\/|\*\*|,\/|-\/|\*\/\/))(?:\*(\/\d+)?|\d+(?:-\d+)?(?:\/\d+)?)(?:,(?:\*(\/\d+)?|\d+(?:-\d+)?(?:\/\d+)?))*$/;
	const basePattern = /^(\*(\/\d+)?|\d+(-\d+)?(\/\d+)?)(,(\*(\/\d+)?|\d+(-\d+)?(\/\d+)?))*$/;
	if (!basePattern.test(value)) {
		return _('Invalid format for %s. Example: (%s)').format(field.label, field.msg);
	};

	if (type === 'day') {
		field.max = types.day.getMaxDays(monthValue);
		if (monthValue && !/^\d+$/.test(monthValue)) {
			field.msg += _(' (Note: Actual days may be limited by specific months)');
		}
	};

	for (const part of parts) {
		if (part.startsWith('*/')) {
			const step = parseInt(part.substring(2), 10);
			if (isNaN(step) || step < 1 || step > field.max) {
				return _('Step value in %s must be between 1 and %d').format(field.label, field.max);
			};
			continue;
		};

		if (/^\d+$/.test(part)) {
			const val = parseInt(part, 10);
			if (val < field.min || val > field.max) {
				return _('%s value %s out of range (%d-%d)').format(field.label, val, field.min, field.max);
			};
			continue;
		};

		const rangeMatch = part.match(/^(\d+)-(\d+)(?:\/(\d+))?$/);
		if (rangeMatch) {
			const start = parseInt(rangeMatch[1], 10);
			const end = parseInt(rangeMatch[2], 10);
			const step = rangeMatch[3] ? parseInt(rangeMatch[3], 10) : 1;

			if (isNaN(start) || isNaN(end) || isNaN(step)) {
				return _('Invalid range or step value in %s (%s)').format(field.label, part);
			};

			const actualEnd = Math.max(start, end);
			const actualStart = Math.min(start, end);

			if (actualStart < field.min || actualEnd > field.max) {
				return _('Range %d-%d out of bounds (%d-%d) in %s').format(start, end, field.min, field.max, field.label);
			};

			if (step < 1 || step > (actualEnd - actualStart + 1)) {
				return _('Step value %d out of range (1-%d) in %s').format(step, actualEnd - actualStart + 1, field.label);
			};
			continue;
		};

		if (part === '*') continue;

		if (/^\d+\/\d+$/.test(part)) {
			return _('Invalid syntax: %s in (%s). Step must be used with * or ranges').format(field.label, part);
		};

		return _('Invalid part: %s in (%s)').format(field.label, part);
	};

	return true;
};

return view.extend({
	load: function() {
		return uci.load('taskplan');
	},

	render: function() {
		let m, s, e;
		m = new form.Map('taskplan', '', [
			E('style', { 'type': 'text/css' }, [ CSS ]),
			E('div', {}, [
				_('Timed task execution and startup task execution. More than 10 preset functions, including restart, shutdown, network restart, freeing memory, system cleaning, network sharing, shutting down the network, automatic detection of network disconnection and reconnection, MWAN3 load balancing reconnection detection, custom scripts, etc.'),
				E('a', { 'target': '_blank', 'style': 'margin-left: 10px;',
					'href': 'https://github.com/sirpdboy/luci-app-taskplan'
				}, _('GitHub @sirpdboy/luci-app-taskplan'))
			])
		]);
		s = m.section(form.GridSection, 'stime', _('Scheduled task'), [
			E('div', { 'style': 'color:#666; margin-top:0.6em;' }, [
				_('Minute (0-59), Hour (0-23), Day of Month (1-31), Month (1-12), Day of Week (0-6, 0 and 6 = Sunday)'), E('br'),
				_('"*" any value, "," value list separator, "-" range of values, "/" step values'), E('br'),
				_('Examples: Range 2-5 (means 2 to 5), List 1,3,5 (means 1 and 3 and 5), Step */5 (means every 5 units)')
			])
		]);
		s.sortable = true;
		s.addremove = true;
		s.anonymous = true;

		e = s.option(form.Flag, 'enable', _('Enable'));
		e.rmempty = false;
		e.editable = true;
		e.default = '0';

		e = s.option(form.Value, 'minute', _('minutes'));
		e.rmempty = false;
		e.editable = true;
		e.default = '0';
		e.validate = function(section_id, value) {
			return validateCrontabField('minute', value);
		};

		e = s.option(form.Value, 'hour', _('hours'));
		e.rmempty = false;
		e.editable = true;
		e.default = '*';
		e.validate = function(section_id, value) {
			return validateCrontabField('hour', value);
		};

		e = s.option(form.Value, 'day', _('Days'));
		e.rmempty = false;
		e.editable = true;
		e.default = '*';
		e.validate = function(section_id, value) {
			return validateCrontabField('day', value,
				this.section.formvalue(section_id, 'month'));
		};

		e = s.option(form.Value, 'month', _('months'));
		e.rmempty = false;
		e.editable = true;
		e.default = '*';
		e.validate = function(section_id, value) {
			return validateCrontabField('month', value);
		};

		e = s.option(form.Value, 'week', _('weeks'));
		e.rmempty = false;
		e.editable = true;
		e.default = '*';
		e.value('*', _('Everyday'));
		e.value('0,6', _('Weekend'));
		e.value('1-5', _('Workdays'));
		e.value('0', _('Sunday'));
		e.value('1', _('Monday'));
		e.value('2', _('Tuesday'));
		e.value('3', _('Wednesday'));
		e.value('4', _('Thursday'));
		e.value('5', _('Friday'));
		e.value('6', _('Saturday'));
		e.validate = function(section_id, value) {
			return validateCrontabField('week', value);
		};

		this.defineStypeOptions(s);

		e = s.option(form.Value, 'remarks', _('Remarks'));
		e.editable = true;

		e = s.option(form.Button, 'button', _('verify'));
		e.inputstyle = 'apply';
		e.editable = true;
		e.onclick = function(ev, section_id) {
			const crontab = ['minute', 'hour', 'day', 'month', 'week'].map(f => {
				const opt = m.lookupOption(`taskplan.${section_id}.${f}`);
				return opt ? opt[0].formvalue(section_id) : '';
			}).filter(Boolean).join(' ').trim();

			if (/^\S+(?:\s\S+){4}$/.test(crontab)) {
				window.open(`https://crontab.guru/#${crontab.replace(/\s/g, '_')}`);
			} else {
				ui.addTimeLimitedNotification(null, E('p',
					_('Invalid format for %s').format(crontab)), 10000, 'error');
			};
		};

		s = m.section(form.GridSection, 'ltime', _('Startup task'),
			_('The task to be executed upon startup, with a startup delay time unit of seconds.'));
		s.sortable = true;
		s.addremove = true;
		s.anonymous = true;

		e = s.option(form.Flag, 'enable', _('Enable'));
		e.rmempty = false;
		e.editable = true;
		e.default = '0';

		this.defineStypeOptions(s);

		e = s.option(form.Value, 'delay', _('Delayed Start(seconds)'));
		e.rmempty = false;
		e.editable = true;
		e.default = '10';
		e.datatype = 'uinteger';

		e = s.option(form.Value, 'remarks', _('Remarks'));
		e.editable = true;

		return m.render().then((el) => {
			requestAnimationFrame(() => this.updateTitles(m));
			return el;
		});
	},

	updateTitles: function(m) {
		// console.time('updateTitles');
		const tasks = m.data.state.values?.taskplan;
		if (!tasks) return;

		for (const task of Object.values(tasks)) {
			if (task?.[".type"] !== "stime") continue;

			const id = task[".name"];
			const cron = ['minute', 'hour', 'day', 'month', 'week'].map(f => task[f] || "*").join(" ");

			for (const f of ['minute', 'hour', 'day', 'month', 'week']) {
				document.getElementById(`cbid.taskplan.${id}.${f}`)?.setAttribute('title', cron);
			};

			for (const f of ["stype", "remarks"]) {
				const el = document.getElementById(`widget.cbid.taskplan.${id}.${f}`);
				if (!el) continue;

				el.title = f === "remarks"
					? task?.[f] || ""
					: el.options[el.selectedIndex]?.text || "";
			};

			const btn = document.querySelector(`#cbi-taskplan-${id}-button .cbi-button-apply`);
			btn?.setAttribute('title', _("verify"));
		};
		// console.timeEnd('updateTitles');
	},

	defineStypeOptions: function(s) {
		let e = s.option(form.ListValue, 'stype', _('Scheduled Type'));
		e.default = '10';
		e.value('01', _('Scheduled Reboot'));
		e.value('02', _('Scheduled Poweroff'));
		e.value('03', _('Scheduled ReNetwork'));
		e.value('04', _('Scheduled RestartSamba'));
		e.value('05', _('Scheduled Restartlan'));
		e.value('06', _('Scheduled Restartwan'));
		e.value('07', _('Scheduled Closewan'));
		e.value('08', _('Scheduled Clearmem'));
		e.value('09', _('Scheduled Sysfree'));
		e.value('10', _('Scheduled DisReconn'));
		e.value('11', _('Scheduled DisRereboot'));
		e.value('12', _('Scheduled Restartmwan3'));
		e.value('13', _('Scheduled Wifiup'));
		e.value('14', _('Scheduled Wifidown'));
		e.value('15', _('Custom Script 1'));
		e.value('16', _('Custom Script 2'));
		e.onchange = (ev, section_id, value) => {
			if (['15', '16'].includes(value)) this.showScriptEditModal(value);
		};
		e.editable = true;
		return e;
	},

	showScriptEditModal: function(v) {
		const label = v === '16' ? _('Custom Script 2') : _('Custom Script 1');
		const path = v === '16' ? '/etc/taskplan/customscript2' : '/etc/taskplan/customscript1';
		fs.stat(path)
			.catch(() => fs.write(path, '#!/bin/sh\n'))
			.then(() => fs.read_direct(path))
			.then(content => {
				const textarea = new ui.Textarea(content, { rows: 12, wrap: true });
				ui.showModal(_('Edit %s').format(label), [
					E('b', { 'style': 'color:red;' },
						_('Note: Please use valid sh syntax. The script runs as root. Avoid destructive commands (e.g., "rm -rf /"). The script should not require user interaction.')),
					textarea.render(),
					E('div', { 'class': 'button-row' }, [
						E('div', { 'class': 'btn cbi-button-neutral',
							'click': ui.hideModal, 'title': _('Cancel')
						}, _('Cancel')),
						E('div', { 'class': 'btn cbi-button-action',
							'title': _('Click to upload the script to %s').format(path),
							'click': () => ui.uploadFile(path)
								.then(() => ui.addTimeLimitedNotification(null, E('p',
									_('File saved to %s').format(path)), 3000, 'info'))
								.catch((e) => ui.addTimeLimitedNotification(null, E('p', e.message), 3000))
						}, _('Upload')),
						E('div', { 'class': 'btn cbi-button-positive', 'title': _('Save'),
							'click': () => {
								const value = textarea.getValue().trim().replace(/\r\n/g, '\n') + '\n';
								fs.write(path, value)
									.then(() => ui.addTimeLimitedNotification(null, E('p',
										_('Contents of %s have been saved.').format(label)), 3000, 'info'))
									.catch(err => ui.addTimeLimitedNotification(null, E('p',
										_('Unable to save contents: %s').format(err.message)), 8000, 'error'));
									ui.hideModal();
							}
						}, _('Save')),
					])
				]);
			})
			.catch(err => ui.addTimeLimitedNotification(null, E('p', {},
				_('Unable to read %s: %s').format(label, err.message)), 8000, 'error'));
	}

});
