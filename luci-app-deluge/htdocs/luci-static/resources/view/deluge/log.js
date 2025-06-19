'use strict';
'require view';
'require fs';
'require uci';

return view.extend({
	formatLog: function(logStr) {
		var months = {
			Jan: '01', Feb: '02', Mar: '03', Apr: '04', May: '05', Jun: '06',
			Jul: '07', Aug: '08', Sep: '09', Oct: '10', Nov: '11', Dec: '12'
		};

		return logStr.split('\n').filter(Boolean).map(line => {
			var match = line.match(this.log_regex);
			if (!match) return line;
			var [, month, day, time, year, rest] = match;
			return `${year}${_("year")}${months[month] || '??'}${_("month")}${day.padStart(2, '0')}${_("day")} ${time} ${rest}`;
		}).join('\n');
	},

	getLogs: function(p) {
		return Promise.all([
			fs.exec_direct('/sbin/logread', ['-e', 'deluge'])
				.then(r => this.formatLog(r.trim())).catch(() => ''),
			fs.read(p).then(r => r.trim()).catch(() => '')
		]);
	},

	load: async function () {
		await uci.load('deluge');
		var profile_dir = uci.get('deluge', 'main', 'profile_dir') || '/etc/deluge';
		var log_path = profile_dir + '/deluge.log';
		var [syslogRaw, delugeRaw] = await this.getLogs(log_path);

		return {
			syslogRaw: syslogRaw, delugeRaw: delugeRaw,
			profile_dir: profile_dir, log_path: log_path
		};
	},

	render: function (data) {
		var self = this, linesOptions = [10, 20, 50, 100], currentLines = 50,
			refreshInterval = 5000, refreshTimer = null, reverseOrder = true;

		function calculateRows(lines) {
			return lines > 0 ? Math.min(lines + 2, 20) : 3;
		};

		function parseLog(text, lines, reverse) {
			if (!text || text.trim() === '') {
				return {
					text: _('No log data available'), actualLines: 0
				};
			}

			var linesArray = text.split('\n').filter(line => line.trim() !== '');
			if (reverse) linesArray = linesArray.reverse();

			return {
				text: linesArray.slice(0, lines).join('\n'),
				actualLines: Math.min(linesArray.length, lines)
			};
		};

		function refreshLogs() {
			self.getLogs(data.log_path).then(function([newSyslog, newDeluge]) {
				data.syslogRaw = newSyslog;
				data.delugeRaw = newDeluge;
				updateLogsDisplay();
			});
		};

		function updateLogsDisplay() {
			var syslogResult = parseLog(data.syslogRaw, currentLines, reverseOrder);
			var delugeResult = parseLog(data.delugeRaw, currentLines, reverseOrder);
			var syslogTitle = document.getElementById('syslog-title');
			var delugeTitle = document.getElementById('deluge-title');

			syslogTitle.textContent = syslogResult.actualLines > 0
				? _('Last %s lines of syslog (%s):').format(
					syslogResult.actualLines,
					reverseOrder ? _('newest first') : _('oldest first')
				  )
				: _('System log: (no data available)');

			delugeTitle.textContent = delugeResult.actualLines > 0
				? _('Last %s lines of run log (%s):').format(
					delugeResult.actualLines,
					reverseOrder ? _('newest first') : _('oldest first')
				  )
				: _('Deluge run log: (no data available)');

			document.getElementById('syslog-textarea').value = syslogResult.text;
			document.getElementById('deluge-textarea').value = delugeResult.text;
			document.getElementById('syslog-textarea').rows = calculateRows(syslogResult.actualLines);
			document.getElementById('deluge-textarea').rows = calculateRows(delugeResult.actualLines);
		};

		function startAutoRefresh() {
			if (refreshTimer) clearInterval(refreshTimer);
			refreshTimer = setInterval(refreshLogs, refreshInterval);
		};

		var initialSyslog = parseLog(data.syslogRaw, currentLines, reverseOrder);
		var initialDeluge = parseLog(data.delugeRaw, currentLines, reverseOrder);

		startAutoRefresh();

		var view = E('div', { class: 'cbi-map' }, [
			E('h2', {}, _('Deluge - Logs')),

			E('div', { class: 'cbi-section' }, [
				E('div', {
					style: 'margin-bottom: 10px; display: flex; flex-wrap: wrap; gap: 10px; align-items: center'
				}, [
					E('div', { style: 'display: flex; align-items: center; gap: 5px' }, [
						_('Lines:'),
						E('select', {
							class: 'cbi-input-select',
							style: 'width: 100px; margin-left: 5px;',
							'change': function(ev) {
								currentLines = parseInt(ev.target.value);
								updateLogsDisplay();
							}
						}, linesOptions.map(function(opt) {
							return E('option', {
								value: opt, selected: opt === currentLines
							}, opt);
						}))
					]),
					E('button', {
						'class': 'cbi-button cbi-button-neutral',
						'click': function() {
							reverseOrder = !reverseOrder;
							updateLogsDisplay();
							this.textContent = reverseOrder ?
								_('▽ Show Oldest First') :
								_('△ Show Newest First');
						}
					}, reverseOrder ? _('▽ Show Oldest First') : _('△ Show Newest First')),
					E('button', {
						'class': 'cbi-button cbi-button-action', 'click': refreshLogs
					}, _('⟳ Refresh Now'))
				])
			]),

			E('div', { class: 'cbi-section', style: 'margin-top: 1em' }, [
				E('div', { id: 'syslog-title' }, initialSyslog.actualLines > 0
					? _('Last %s lines of syslog (%s):').format(
						initialSyslog.actualLines,
						reverseOrder ? _('newest first') : _('oldest first')
					  )
					: _('System log: (no data available)')
				),
				E('textarea', {
					id: 'syslog-textarea',
					style: 'width: 100%',
					readonly: true, wrap: 'off',
					rows: calculateRows(initialSyslog.actualLines)
				}, initialSyslog.text),
			]),

			E('div', { class: 'cbi-section', style: 'margin-top: 1em' }, [
				E('div', { id: 'deluge-title' }, initialDeluge.actualLines > 0
					? _('Last %s lines of run log (%s):').format(
						initialDeluge.actualLines,
						reverseOrder ? _('newest first') : _('oldest first')
					  )
					: _('Deluge run log: (no data available)')
				),
				E('textarea', {
					id: 'deluge-textarea',
					style: 'width: 100%',
					readonly: true, wrap: 'off',
					rows: calculateRows(initialDeluge.actualLines)
				}, initialDeluge.text)
			])
		]);

		view.addEventListener('destroy', function() {
			if (refreshTimer) clearInterval(refreshTimer);
		});

		return view;
	},

	handleSave: null,
	handleReset: null,
	handleSaveApply: null,
	log_regex: /^[A-Z][a-z]{2} ([A-Z][a-z]{2}) (\d{1,2}) (\d{2}:\d{2}:\d{2}) (\d{4}) (.+)$/
});
