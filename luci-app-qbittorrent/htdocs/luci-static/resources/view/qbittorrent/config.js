'use strict';
'require fs';
'require ui';
'require uci';
'require form';
'require view';

const callServiceStatus = L.rpc.declare({
	object: 'service',
	method: 'list',
	params: ['name'],
	filter: function (data) {
		for (const svcName in data) {
			const svc = data[svcName];
			if (!svc || !svc.instances) continue;
			for (const instName in svc.instances) {
				return !!svc.instances[instName].running;
			}
		}
		return false;
	}
});

return view.extend({
	load: function () {
		return Promise.all([
			fs.exec_direct('/bin/df', ['-h']),
			uci.load('qbittorrent')
				.then(() => uci.get('qbittorrent', 'main', 'BinaryFiles'))
				.then(c =>
					fs.exec_direct('/usr/bin/env', ['HOME=/var/run/qbittorrent', c || '/usr/bin/qbittorrent-nox', '-v'])
						.then(r => {
							const match = r.trim().match(/v[0-9]+(\.[0-9]+)+/);
							return match ? match[0] : _('Unknown');
						}),
				),
			callServiceStatus('qbittorrent'),
		]);
	},

	render([diskList, version, running]) {
		let m, s, o;
		const port = uci.get('qbittorrent', 'main', 'port') || '8080';
		const statusEl = E('b', { style: `color:${running ? 'green' : 'red'}` }, [
			'qBittorrent ' + (running ? _('RUNNING') : _('NOT RUNNING')),
		]);

		const btnEl = E('div', [
			E('div', {
				class: 'btn cbi-button-apply', style: running ? '' : 'display:none',
				click: ui.createHandlerFn(this, () => window.open(`http://${window.location.hostname}:${port}`, '_blank'))
			}, _('Open Web Interface'))
		]);

		m = new form.Map('qbittorrent', _('qBittorrent'),
			'%s  %s'.format(
				_('A cross-platform open source BitTorrent client based on QT.'),
				_("Current version: <b style='color:red'>%s</b>").format(version)
			));

		s = m.section(form.TypedSection);
		s.render = () =>
			E('p', { style: 'display: flex; align-items: center; gap: 10px;' }, [
				statusEl, btnEl,
			]);

		s = m.section(form.NamedSection, 'main');

		s.tab("basic", _("Basic Settings"));
		s.tab("advanced", _("Advanced Settings"));

		o = s.taboption("basic", form.Flag, "EnableService", _("Enabled"));

		o = s.taboption("basic", form.Value, "RootProfilePath", _("Root Path of the Profile"),
			_("Specify the root path of all profiles"))
		o.default = '/etc';
		o.rmempty = false;

		o = s.taboption("basic", form.Value, "DefaultSavePath", _("Save Path"),
			_("The files are stored in the download directory automatically created under the selected mounted disk"))
		var devMap = {};
		diskList.trim().split('\n').slice(1).forEach(line => {
			var [dev, size, used, , usedPct, mount] = line.trim().split(/\s+/);
			const isExternalDev = dev && (dev.startsWith('/dev/sd') || dev.startsWith('/dev/nvme') || dev.startsWith('/dev/mmcblk'));
			if (!isExternalDev || !mount?.startsWith('/mnt') || devMap[dev]) return;
			devMap[dev] = true;
			o.value(mount + '/download',
				_('%s/download (size: %s) (used: %s/%s)').format(mount, size, used, usedPct));
		});
		o.rmempty = false;

		o = s.taboption("basic", form.Value, "Locale", _("Locale Language"),
			_("The supported language codes can be used to customize the setting."));
		o.value("zh_CN", _("Simplified Chinese"));
		o.value("en", _("English"));
		o.default = "zh_CN";
		o.rmempty = false;

		o = s.taboption("basic", form.Value, "port", _("Listening Port"),
			_("The listening port for WebUI."));
		o.datatype = "port";
		o.default = '8080';
		o.rmempty = false;

		o = s.taboption("basic", form.Value, "webuser", _("WebUI Username"),
			_("If you have changed this value in the WebUI and it is inconsistent, it cannot be modified here."));
		o.default = "admin";
		o.rmempty = false;

		o = s.taboption("basic", form.Value, "webpass", _("WebUI Password"),
			_("If you have changed this value in the WebUI and it is inconsistent, it cannot be modified here."));
		o.default = "adminadmin";
		o.rmempty = false;

		o = s.taboption('basic', form.Value, 'api_key', _('API 密钥'),
			_('留空则由 qBittorrent 服务端自动生成（需 ≥ 5.2.0）并自动回填；自定义密钥在保存并重启服务后生效。'));
		o.password = true;

		o.validate = function(section_id, value) {
			if (value && !/^qbt_[A-Za-z0-9]{28}$/.test(value))
				return _('格式错误：必须以 qbt_ 开头，后面为 28 位字母或数字，总长 32 位');
			return true;
		};

		o.renderWidget = function(section_id, option_index, cfgvalue) {
			const node = form.Value.prototype.renderWidget.apply(this, arguments);
			const input = node.querySelector('input');

			node.classList.add('control-group');
			node.appendChild(E('button', {
				'class': 'btn cbi-button cbi-button-action',
				'click': ui.createHandlerFn(this, function(ev) {
					if (!window.crypto || !window.crypto.getRandomValues) {
						ui.addNotification(null, E('p', _('浏览器不支持安全随机数生成')), 'error');
						return;
					}

					const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
					const bytes = new Uint8Array(28);
					window.crypto.getRandomValues(bytes);

					input.value = 'qbt_' + Array.from(bytes, b => chars[b % chars.length]).join('');
					input.dispatchEvent(new Event('change', { bubbles: true }));
				})
			}, _('生成密钥')));
			return node;
		};

		o = s.taboption("advanced", form.Flag, "ASWEnabled", _("Subnet Whitelist"),
			_("Bypass authentication for clients in Whitelisted IP Subnets."));
		o.enabled = "true";
		o.disabled = "false";
		o.default = o.disabled;
		o.rmempty = false;

		o = s.taboption("advanced", form.DynamicList, "ASWlist", _("Whitelisted Subnets"))
		o.placeholder = _('Example: 172.17.32.0/24, fdff:ffff:c8::/40');
		o.datatype = "ipaddr";
		o.depends("ASWEnabled", "true");

		o = s.taboption("advanced", form.Flag, "PFEnabled", _("Use UPnP for WebUI"),
			_("Using the UPnP / NAT-PMP port of the router for connecting to WebUI."));
		o.enabled = "true";
		o.disabled = "false";
		o.default = o.enabled;
		o.rmempty = false;

		o = s.taboption("advanced", form.Value, "listen_port", _("用于传入连接的端口"),
			_('留空自动获取'));
		o.datatype = "port";
		o.depends("PFEnabled", "true");

		o = s.taboption("advanced", form.Flag, "CSRFProtection", _("CSRF Protection"),
			_("Disable Cross-Site Request Forgery (CSRF) protection"));
		o.enabled = "false";
		o.disabled = "true";
		o.default = o.enabled;
		o.rmempty = false;

		o = s.taboption('advanced', form.Flag, 'logEnabled', _('Enable Log'),
			_('Enable logger to log file.'));
		o.enabled = 'true';
		o.disabled = 'false';
		o.default = o.enabled;
		o.rmempty = false;

		o = s.taboption('advanced', form.Value, 'Path', _('Log Path'),
			_("Modify the path to save log files"));
		o.depends('logEnabled', 'true');

		o = s.taboption("advanced", form.FileUpload, "BinaryFiles", _("Custom Binary File"),
			_("Upload and select the static binary. <a href='https://github.com/userdocs/qbittorrent-nox-static/releases' target='_blank'> userdocs GitHub</a>"));
		o.root_directory = '/usr/libexec';
		o.enable_remove = false;
		o.enable_upload = true;

		L.Poll.add(L.bind(() => callServiceStatus('qbittorrent').then(running => {
			statusEl.style.color = running ? 'green' : 'red';
			statusEl.textContent = 'qBittorrent ' + (running ? _('RUNNING') : _('NOT RUNNING'));
			btnEl.style.display = running ? '' : 'none';
		}), this));

		return m.render();
	}
});
