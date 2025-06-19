'use strict';
'require fs';
'require view';
'require uci';

return view.extend({
	load: function() {
		return uci.load('deluge').then(() => {
			const dir = uci.get('deluge', 'main', 'profile_dir') || '/etc/deluge';
			return Promise.all([
				'/etc/config/deluge',
				dir + '/core.conf',
				dir + '/web.conf'
			].map(f => fs.read(f).then(c => ({
				file: f,
				content: c.trim(),
				rows: Math.min(c.split('\n').length, 20)
			})).catch(() => '')));
		});
	},

	render: function(data) {
		const view = E('div', { class: 'cbi-map' }, [
			E('h2', _('Deluge - Files')),
			E('div', { class: 'cbi-section' }, _('This page is the configuration file content of Deluge.'))
		]);

		data.filter(f => f.content).forEach(f =>
			view.appendChild(E('div', { class: 'cbi-section', style: 'margin-top:1em' }, [
				E('div', _('This is the content of the configuration file under <code>%s</code>:').format(f.file)),
				E('textarea', {
					style: 'width:100%',
					readonly: true,
					wrap: 'off',
					rows: Math.min(f.rows + 1, 18)
				}, f.content)
			]))
		);

		return view;
	},

	handleSave: null,
	handleReset: null,
	handleSaveApply: null
});
