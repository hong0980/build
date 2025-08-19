'use strict';
'require fs';
'require uci';
'require view';

return view.extend({
	load: () => uci.load('deluge').then(() => {
		const dir = uci.get('deluge', 'main', 'profile_dir') || '/etc/deluge';
		return ['/etc/config/deluge', `${dir}/core.conf`, `${dir}/web.conf`, `${dir}/hostlist.conf`];
	}),

	render: (files) => {
		const view = E('div', {}, [
			E('h3', _('Deluge - Files')),
			E('div', {}, _('This page is the configuration file content of Deluge.'))
		]);

		Promise.all(files.map(path =>
			fs.stat(path)
				.then(stat => stat.size > 0 && fs.trimmed(path)
					.then(content => ({ path, content, stat })))
				.catch(() => ({ content: '' }))
		)).then(results => {
			results.forEach(res => {
				res.content && view.appendChild(
					E('div', {}, [
						E('div', { style: 'margin-top:1em' },
							_('This is the content of the configuration file under <code>%s</code>:').format(res.path)),
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

		return view;
	},

	handleSave: null,
	handleReset: null,
	handleSaveApply: null
});
