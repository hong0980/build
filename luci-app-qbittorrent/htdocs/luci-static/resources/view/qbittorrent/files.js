'use strict';
'require fs';
'require uci';
'require view';

return view.extend({
	load: () => uci.load('qbittorrent').then(() => {
		const dir = uci.get('qbittorrent', 'main', 'RootProfilePath') || '/tmp';
		return Promise.all(['/etc/config/qbittorrent', `${dir}/qBittorrent/config/qBittorrent.conf`]);
	}),

	render: (files) => {
		const view = E('div', { class: 'cbi-map' }, [
			E('h2', _('qBittorrent - Files')),
			E('div', { class: 'cbi-section' }, _('This page is the configuration file content of qBittorrent.'))
		]);

		files.forEach(file => {
			const fileContainer = E('div', { class: 'cbi-section' }, [
				E('div', { style: 'margin-top:1em' },
					_('This is the content of the configuration file under <code>%s</code>:').format(file)),
				E('textarea', {
					readonly: true, rows: 3,
					style: `font-size: 14px; color: #c5c5b2; border: 1px solid #555;
					background-color: #272626; font-family: Consolas, monospace; width: 100%;`
				}, _('Loading...'))
			]);

			view.appendChild(fileContainer);
			const textarea = fileContainer.querySelector('textarea');

			fs.stat(file)
				.then(stat => {
					if (stat && stat.size > 0) return fs.read(file).then(content => ({ content, stat }));
				})
				.then(({ content, stat }) => {
					textarea.textContent = content.trim();
					textarea.rows = Math.min(content.split('\n').length, 18);
					fileContainer.appendChild(
						E('div', { style: 'color:#888;font-size:90%;margin-top:0.5em;' },
							_('Last modified: %s, Size: %s bytes').format(
								new Date(stat.mtime * 1000).toLocaleString(), stat.size
							)
						)
					);
				})
				.catch(e => {
					textarea.textContent = _('File not found %s').format(file);
				});
		});

		return view;
	},

	handleSave: null,
	handleReset: null,
	handleSaveApply: null
});
