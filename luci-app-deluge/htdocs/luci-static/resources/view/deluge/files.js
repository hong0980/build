'use strict';
'require fs';
'require uci';
'require view';

return view.extend({
	load: () => uci.load('deluge').then(() => {
		const dir = uci.get('deluge', 'main', 'profile_dir') || '/etc/deluge';
		const paths = ['/etc/config/deluge', `${dir}/core.conf`, `${dir}/web.conf`, `${dir}/hostlist.conf`];
		return Promise.all(paths.map(path =>
			fs.stat(path)
				.then(stat => fs.trimmed(path).then(content => ({ content, stat, path })))
				.catch(() => ({ content: '' }))
		));
	}),

	render: (results) => {
		const body = E('div', [
			E('h3', _('Files')),
			E('div', _('This page is the configuration file content of %s.').format('Deluge'))
		]);

		results.forEach(({ content, path, stat }) =>
			content && body.appendChild(
				E('div', [
					E('div', { style: 'margin-top:1em' },
						_('This is the content of the configuration file under <code>%s</code>:').format(path)),
					E('textarea', {
						readonly: '', wrap: 'soft',
						rows: Math.min(content.split('\n').length + 1, 18),
						style: 'width:100%; font-size:14px; color: #c5c5b2; background-color: #272626; font-family: Consolas, monospace;'
					}, content),
					E('div', { class: 'right' }, [
						E('small', _('Last modified: %s, Size: %s bytes').format(
							new Date(stat.mtime * 1000).toLocaleString(), stat.size)
						)
					]),
				])
			)
		);

		return body;
	},

	handleSave: null,
	handleReset: null,
	handleSaveApply: null
});
