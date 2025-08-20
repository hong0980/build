'use strict';
'require fs';
'require uci';
'require view';

return view.extend({
	load: () => uci.load('transmission').then((r) => {
		const conffile = `${uci.get(r, 'transmission', 'config_dir') || '/etc/transmission'}/settings.json`
		return ['/etc/config/transmission', `${conffile}`];
	}),

	render: (files) => {
		const view = E('div', {}, [
			E('h3', 'Transmission - %s'.format(_('Files'))),
			E('div', _('This page is the configuration file content of %s.').format('Transmission'))
		]);
		Promise.all(files.map(path =>
			fs.stat(path)
				.then(stat => stat.size > 0
					? fs.trimmed(path).then(content => ({ content, stat, path }))
					: { content: '' }
				)
				.catch(() => ({ content: '' }))
		)).then(results => {
			results.forEach(({ content, stat, path }) => {
				if (!content) return;
				view.appendChild(E('div', {}, [
					E('div', { style: 'margin-top:1em' },
						_('This is the content of the configuration file under <code>%s</code>:').format(path)),
					E('textarea', {
						readonly: '', wrap: 'soft',
						rows: Math.min(content.split('\n').length + 1, 18),
						style: 'width:100%; font-size:14px; color: #c5c5b2; background-color: #272626; font-family: Consolas, monospace;'
					}, content),
					E('div', { style: 'color:#888;font-size:90%;margin-top:0.5em;' },
						_('Last modified: %s, Size: %s bytes').format(
							new Date(stat.mtime * 1000).toLocaleString(), stat.size
						)
					)
				]));
			});
		});

		return view;
	},

	handleSave: null,
	handleReset: null,
	handleSaveApply: null
});
