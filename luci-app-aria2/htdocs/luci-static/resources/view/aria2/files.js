'use strict';
'require fs';
'require uci';
'require view';

return view.extend({
	load: () => Promise.all([uci.load('aria2')]),

	render: function (data) {
		const files = [
			'/etc/config/aria2',
			(uci.get('aria2', 'main', 'pro_file') || '/var/etc/aria2') + '/aria2.conf.main'
		];

		const container = E('div', {}, [
			E('h3', { name: 'content' }, '%s - %s'.format(_('Aria2'), _('Configuration'))),
			E('div', {}, _('Here shows the files used by aria2.'))
		]);

		Promise.all(files.map(path =>
			fs.stat(path)
				.then(stat => stat.size > 0 && fs.trimmed(path)
					.then(content => ({ path, content, stat }))
				)
				.catch(() => ({ content: '' }))
		)).then(results => {
			results.forEach(res => {
				res.content && container.appendChild(E('div', { class: 'cbi-section' }, [
					E('div', { style: 'margin-top:1em' }, _('This is the content of the configuration file under <code>%s</code>:').format(res.path)),
					E('textarea', {
						readonly: '', wrap: 'soft',
						rows: Math.min(res.content.split('\n').length + 1, 18),
						style: 'width:100%; font-size:13px; color: #c5c5b2; background-color: #272626; font-family: Consolas, monospace;'
					}, res.content),
					E('div', { style: 'color:#888;font-size:90%;margin-top:0.5em;' },
						_('Last modified: %s, Size: %s bytes').format(
							new Date(res.stat.mtime * 1000).toLocaleString(), res.stat.size
						)
					)
				]));
			});
		});

		return container;
	},

	handleSave: null,
	handleReset: null,
	handleSaveApply: null
});
