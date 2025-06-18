'use strict';
'require view';
'require fs';
'require uci';
'require rpc';
'require ui';

return view.extend({
	load: async function () {
		await uci.load('deluge');
		var profile_dir = uci.get('deluge', 'main', 'profile_dir') || '/etc/deluge';
		var log_path = profile_dir + '/deluged.log';

		var [syslogRaw, delugeRaw] = await Promise.all([
			fs.exec_direct('/sbin/logread', ['-e', 'deluge']).catch(() => ''),
			fs.read(log_path).catch(() => '')
		]);

		return {
			syslogRaw: syslogRaw.trim(),
			delugeRaw: delugeRaw.trim(),
			profile_dir: profile_dir,
			log_path: log_path
		};
	},

	render: function (data) {
		var self = this;
		var linesOptions = [10, 20, 50, 100];
		var currentLines = 50;
		var refreshInterval = 5000;
		var refreshTimer = null;
		var reverseOrder = true;

		function calculateRows(lines) {
			return lines > 0 ? Math.min(lines + 2, 20) : 3;
		}

		function parseLog(text, lines, reverse) {
			if (!text || text.trim() === '') {
				return {
					text: _('No log data available'),
					actualLines: 0
				};
			}

			var linesArray = text.split('\n').filter(line => line.trim() !== '');
			if (reverse) linesArray = linesArray.reverse();

			return {
				text: linesArray.slice(0, lines).join('\n'),
				actualLines: Math.min(linesArray.length, lines)
			};
		}

		function refreshLogs() {
			Promise.all([
				fs.exec_direct('/sbin/logread', ['-e', 'deluge']).catch(() => ''),
				fs.read(data.log_path).catch(() => '')
			]).then(function([newSyslog, newDeluge]) {
				data.syslogRaw = newSyslog.trim();
				data.delugeRaw = newDeluge.trim();
				updateLogsDisplay();
			});
		}

		function updateLogsDisplay() {
			var syslogResult = parseLog(data.syslogRaw, currentLines, reverseOrder);
			var delugeResult = parseLog(data.delugeRaw, currentLines, reverseOrder);

			var syslogTitle = document.getElementById('syslog-title');
			var delugeTitle = document.getElementById('deluge-title');

			if (syslogResult.actualLines > 0) {
				syslogTitle.textContent = _('Last %s lines of syslog (%s):').format(
					syslogResult.actualLines,
					reverseOrder ? _('newest first') : _('oldest first')
				);
			} else {
				syslogTitle.textContent = _('System log: (no data available)');
			}

			if (delugeResult.actualLines > 0) {
				delugeTitle.textContent = _('Last %s lines of run log (%s):').format(
					delugeResult.actualLines,
					reverseOrder ? _('newest first') : _('oldest first')
				);
			} else {
				delugeTitle.textContent = _('Deluge run log: (no data available)');
			}

			var syslogTextarea = document.getElementById('syslog-textarea');
			var delugeTextarea = document.getElementById('deluge-textarea');

			syslogTextarea.value = syslogResult.text;
			delugeTextarea.value = delugeResult.text;

			syslogTextarea.rows = calculateRows(syslogResult.actualLines);
			delugeTextarea.rows = calculateRows(delugeResult.actualLines);
		}

		function startAutoRefresh() {
			if (refreshTimer) clearInterval(refreshTimer);
			refreshTimer = setInterval(refreshLogs, refreshInterval);
		}

		var initialSyslog = parseLog(data.syslogRaw, currentLines, reverseOrder);
		var initialDeluge = parseLog(data.delugeRaw, currentLines, reverseOrder);

		startAutoRefresh();

		var view = E('div', { class: 'cbi-map' }, [
			E('h2', {}, _('Deluge - Logs')),

			E('div', { class: 'cbi-section' }, [
				E('div', { style: 'margin-bottom: 10px; display: flex; flex-wrap: wrap; gap: 10px; align-items: center' }, [
					E('div', { style: 'display: flex; align-items: center; gap: 5px' }, [
						_('Lines:'),
						E('select', {
							'class': 'cbi-input-select',
							'change': function(ev) {
								currentLines = parseInt(ev.target.value);
								updateLogsDisplay();
							}
						}, linesOptions.map(function(opt) {
							return E('option', {
								value: opt,
								selected: opt === currentLines
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
						'class': 'cbi-button cbi-button-action',
						'click': refreshLogs
					}, _('⟳ Refresh Now'))
				]),

				E('div', { id: 'syslog-title' },
					initialSyslog.actualLines > 0
						? _('Last %s lines of syslog (%s):').format(
							initialSyslog.actualLines,
							reverseOrder ? _('newest first') : _('oldest first')
						  )
						: _('System log: (no data available)')
				),
				E('textarea', {
					id: 'syslog-textarea',
					style: 'width: 100%',
					readonly: true,
					wrap: 'off',
					rows: calculateRows(initialSyslog.actualLines)
				}, initialSyslog.text)
			]),

			E('div', { class: 'cbi-section' }, [
				E('div', { id: 'deluge-title' },
					initialDeluge.actualLines > 0
						? _('Last %s lines of run log (%s):').format(
							initialDeluge.actualLines,
							reverseOrder ? _('newest first') : _('oldest first')
						  )
						: _('Deluge run log: (no data available)')
				),
				E('textarea', {
					id: 'deluge-textarea',
					style: 'width: 100%',
					readonly: true,
					wrap: 'off',
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
	handleSaveApply: null,
	handleReset: null
});
