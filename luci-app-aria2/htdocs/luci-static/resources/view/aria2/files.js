'use strict';
'require fs';
'require uci';
'require view';

return view.extend({
	load: function () {
		return Promise.all([uci.load('aria2')])
	},
	render: function (data) {
		const files = [
			{
				path: '/etc/config/aria2',
				desc: _('Content of config file: <code>%s</code>'),
				id: 'con_area'
			},
			{
				path: (uci.get('aria2', 'main', 'pro_file') || '/var/etc/aria2') + '/aria2.conf.main',
				desc: _('Content of config file: <code>%s</code>'),
				id: 'config_area'
			},
			{
				path: uci.get('aria2', 'main', 'log') || '/var/log/aria2.log',
				desc: _('Content of session file: <code>%s</code>'),
				id: 'log_area'
			}
		];

		const container = E('div', { class: 'cbi-map' }, [
			E('h2', { name: 'content' }, '%s - %s'.format(_('Aria2'), _('Configuration'))),
			E('div', { class: 'cbi-map-descr' }, _('Here shows the files used by aria2.'))
		]);

		Promise.all(files.map(file =>
			fs.read(file.path)
				.then(content => ({
					...file, content: content,
					rows: Math.min(content.split('\n').length + 1, 16)
				}))
				.catch(err => ({
					...file, content: _('Failed to read: %s').format(err.message),
					rows: 3
				}))
		)).then(results => {
			results.forEach(res => {
				container.appendChild(E('div', { class: 'cbi-section' }, [
					E('div', { class: 'cbi-section-descr' }, res.desc.format(res.path)),
					E('div', { id: res.id },
						E('textarea', {
							id: 'widget.' + res.id, readonly: true, wrap: 'soft', rows: res.rows,
							style: 'width:100%; font-size:13px; color: #c5c5b2; background-color: #272626; font-family: Consolas, monospace;'
						}, res.content)
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
