'use strict';
'require fs';
'require view';
'require uci';

return view.extend({
	load: function () {
		return uci.load('deluge').then(() => {
			var profileDir = uci.get('deluge', 'main', 'profile_dir') || '/etc/deluge';
			var files = ['core.conf', 'web.conf'];
			var actions = files.map(file => {
				var path = profileDir.replace(/\/+$/, '') + '/' + file;

				return fs.read(path).then(content => {
					return {
						file: path,
						content: content.trim(),
						rows: content.split('\n', 20).length
					};
				}).catch(() => {
					return {
						file: path,
						content: _('File does not exist.'),
						rows: 1
					};
				});
			});

			actions.push(
				fs.read('/etc/config/deluge').then(content => {
					return {
						file: '/etc/config/deluge',
						content: content.trim(),
						rows: content.split('\n', 20).length
					};
				}).catch(() => {
					return {
						file: '/etc/config/deluge',
						content: _('File does not exist.'),
						rows: 1
					};
				})
			);

			return Promise.all(actions);
		});
	},

	render: function (data) {
		var textareaEl = function (data) {
			return E('div', {}, [
				E('br'),
				E('div', {},
					_('This is the content of the configuration file under <code>%s</code>:').format(data.file)),
				E('div', {},
					E('textarea', {
						'style': 'width: 100%',
						'readonly': true, 'wrap': 'off',
						'rows': Math.min(20, data.rows + 1)
					}, data.content)
				)
			]);
		};

		return E('div', {}, [
			E('h2', {}, _('Deluge - Files')),
			E('div', {}, _('This page is the configuration file content of Deluge.')),
			textareaEl(data[0]), textareaEl(data[1]), textareaEl(data[2])
		]);
	},

	handleSave: null,
	handleSaveApply: null,
	handleReset: null
});
