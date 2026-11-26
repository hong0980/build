'use strict';
'require form';
'require fs';
'require ui';
'require uci';
'require rpc';
'require view';
'require network';
'require tools.widgets as widgets';

const fw = 'firewall';
const conf = 'natmap';
const etc_path = '/etc/natmap';
const tcp_list_file = etc_path + '/tcp.list';
const udp_list_file = etc_path + '/udp.list';
const nattest_fw_rulename = 'natmap-natest';
const nattest_result_path = '/tmp/natmap-natBehavior';

const callServiceList = rpc.declare({
	object: 'service',
	method: 'list',
	params: ['name'],
	expect: { '': {} }
});

const callHostHints = rpc.declare({
	object: 'luci-rpc',
	method: 'getHostHints',
	expect: { '': {} }
});

const callGetCongestions = rpc.declare({
	object: 'luci.natmap',
	method: 'get_congestions',
	expect: { '': {} }
});

function getStatus() {
	const status = {};
	return L.resolveDefault(callServiceList(conf), {})
		.then(res => res[conf]?.instances ?? {})
		.then(instances => Promise.all(
			Object.entries(instances)
				.filter(([, i]) => i.running && i.pid)
				.map(([k, i]) =>
					fs.read(`/var/run/natmap/${i.pid}.json`)
						.then(r => {
							status[k] = Object.assign(
								JSON.parse(r), { running: i.running }
							);
						})
						.catch(() => {})
				)
		))
		.then(() => status);
}

function transformHostHints(family, hosts, html) {
	let choice_values = [];
	let choice_labels = {};
	let ip6addrs = {};
	let ipaddrs = {};

	for (let mac in hosts) {
		L.toArray(hosts[mac].ipaddrs || hosts[mac].ipv4).forEach((ip) => {
			ipaddrs[ip] = hosts[mac].name || mac;
		});

		L.toArray(hosts[mac].ip6addrs || hosts[mac].ipv6).forEach((ip) => {
			ip6addrs[ip] = hosts[mac].name || mac;
		});
	}

	if (!family || family == 'ipv4') {
		L.sortedKeys(ipaddrs, null, 'addr').forEach((ip) => {
			let val = ip;
			let txt = ipaddrs[ip];

			choice_values.push(val);
			choice_labels[val] = html ? E([], [ val, ' (', E('strong', {}, [txt]), ')' ]) : '%s (%s)'.format(val, txt);
		});
	}

	if (!family || family == 'ipv6') {
		L.sortedKeys(ip6addrs, null, 'addr').forEach((ip) => {
			let val = ip;
			let txt = ip6addrs[ip];

			choice_values.push(val);
			choice_labels[val] = html ? E([], [ val, ' (', E('strong', {}, [txt]), ')' ]) : '%s (%s)'.format(val, txt);
		});
	}

	return [choice_values, choice_labels];
}

function parseList(text) {
	let out = [];
	(text || '').split('\n').forEach((line) => {
		line = line.trim();
		if (line) out.push(line);
	});
	return out;
}

const StunListValue = form.ListValue.extend({
	downloadUrl: '', listPath: '',
	renderWidget(section_id, option_index, cfgvalue) {
		if (cfgvalue != null && cfgvalue !== '' &&
			(this.keylist || []).indexOf(cfgvalue) < 0) {
			this.value(cfgvalue, cfgvalue);
		}

		const node = this.super('renderWidget', arguments);
		const customInput = E('input', {
			'class': 'cbi-input-text',
			'placeholder': _('Custom server')
		});
		const addCustomBtn = E('button', {
			'class': 'btn cbi-button-add',
			'click': ui.createHandlerFn(this, function () {
				const val = (customInput.value || '').trim();
				if (!val) return;

				if ((this.keylist || []).indexOf(val) < 0) this.value(val, val);

				const selectEl = node.querySelector('select');
				if (selectEl) {
					let opt = Array.from(selectEl.options).find(item => item.value === val);
					if (!opt) {
						opt = E('option', { 'value': val }, val);
						selectEl.appendChild(opt);
					}
					selectEl.value = val;
					selectEl.dispatchEvent(new Event('change', { bubbles: true }));
				}
				customInput.value = '';
			})
		}, _('Add'));

		const downloadBtn = E('button', {
			'class': 'btn cbi-button-action',
			'click': ui.createHandlerFn(this, async function () {
				if (!this.downloadUrl || !this.listPath) return;

				try {
					const text = await fs.exec_direct('/bin/sh', [ '-c',
						"curl -fsSL --connect-timeout 10 --retry 3 --retry-delay 1 '%s' 2>/dev/null || wget -qO- --timeout=10 --tries=3 '%s' 2>/dev/null".format(this.downloadUrl, this.downloadUrl)
					]);
					if (!text || !text.trim()) throw new Error(_('empty response'));
					await fs.write(this.listPath, text);

					const selectEl = node.querySelector('select');
					let added = 1;
					parseList(text).forEach((line) => {
						if ((this.keylist || []).indexOf(line) < 0) {
							this.value(line, line);
							if (selectEl) selectEl.appendChild(E('option', { 'value': line }, line));
							added++;
						}
					});

					ui.addTimeLimitedNotification(null, E('p', _('Downloaded %d servers to %s').format(added, this.listPath)), 2000, 'info');
				} catch (e) {
					ui.addNotification(null, E('p', _('Download failed: %s').format(e.message)), 'error');
				}
			})
		}, _('Download Server List'));

		node.classList.add('control-group');
		node.appendChild(downloadBtn);

		const extraBar = E('div', {
			'style': 'display: flex; gap: 6px; margin-top: 6px;'
		}, [ customInput, addCustomBtn ]);

		requestAnimationFrame(() => {
			if (node.parentNode && extraBar.parentNode !== node.parentNode) {
				node.insertAdjacentElement('afterend', extraBar);
			}
		});

		return node;
	}
});

return view.extend({
	load() {
		return Promise.all([
			getStatus(),
			callHostHints(),
			fs.trimmed(tcp_list_file),
			fs.trimmed(udp_list_file),
			fs.trimmed(nattest_result_path),
			L.resolveDefault(fs.stat('/usr/bin/stunclient'), null),
			L.resolveDefault(fs.list(etc_path + '/notify'), []),
			L.resolveDefault(fs.list(etc_path + '/ddns'), []),
			callGetCongestions().then((res) => { return res.algorithm; }),
			uci.load(fw),
			uci.load(conf)
		]);
	},

	render([status, hosts, tcp_list, udp_list, nattest_result, has_stunclient, scripts_notify, scripts_ddns, congestions]) {
		let m, s, o;
		m = new form.Map(conf, _('NATMap'));

		s = m.section(form.TypedSection, 'global');
		s.anonymous = true;

		o = s.option(form.Flag, 'enable', _('Enable'));
		o.default = o.disabled;
		o.rmempty = false;

		o = s.option(form.Button, '_reload', _('Reload'));
		o.inputtitle = _('Reload');
		o.inputstyle = 'apply';
		o.onclick = function() {
			return fs.exec('/etc/init.d/natmap', ['reload', ''])
				.then(() => { window.location = window.location.href.split('#')[0]; })
				.catch((e) => { ui.addNotification(null, E('p', e.message), 'error'); });
		};

		o = s.option(form.Value, 'boot_delay', _('Boot delay'),
			_('Delay in seconds before starting the service.'));
		o.datatype = 'uinteger';

		o = s.option(StunListValue, 'def_tcp_stun', _('Default TCP STUN server'),
			_('Available server <a href="%s" target="_blank">references</a>')
				.format('https://github.com/muink/rfc5780-stun-server/blob/master/valid_hosts_rfc5780_tcp.txt'));
		o.rmempty = false;
		o.downloadUrl = 'https://raw.githubusercontent.com/muink/rfc5780-stun-server/master/valid_hosts_rfc5780_tcp.txt';
		o.listPath = tcp_list_file;
		parseList(tcp_list).forEach((srv) => srv && o.value(srv));

		o = s.option(StunListValue, 'def_udp_stun', _('Default UDP STUN server'),
			_('Available server <a href="%s" target="_blank">references</a>')
				.format('https://github.com/muink/rfc5780-stun-server/blob/master/valid_hosts_rfc5780.txt'));
		o.rmempty = false;
		o.downloadUrl = 'https://raw.githubusercontent.com/muink/rfc5780-stun-server/master/valid_hosts_rfc5780.txt';
		o.listPath = udp_list_file;
		parseList(udp_list).forEach((srv) => srv && o.value(srv));

		o = s.option(form.Value, 'def_http_server', _('Default HTTP keep-alive server'));
		o.datatype = 'or(hostname, hostport)';
		o.value('qq.com');
		o.value('163.com');
		o.value('baidu.com');
		o.rmempty = false;

		o = s.option(form.Value, 'def_fwmark_value', _('Default fwmark value'));

		o = s.option(form.Value, 'def_tcp_interval', _('Default TCP keep-alive interval (seconds)'));
		o.datatype = "and(uinteger, min(1))";
		o.default = 30;
		o.rmempty = false;

		o = s.option(form.Value, 'def_udp_interval', _('Default UDP keep-alive interval (seconds)'));
		o.datatype = "and(uinteger, min(1))";
		o.default = 15;
		o.rmempty = false;

		o = s.option(form.Value, 'def_udp_stun_cycle', _('Default UDP STUN check cycle (once every n intervals)'));
		o.datatype = 'uinteger';
		o.default = 5;
		o.rmempty = false;

		function portHits(port, spec) {
			let p = Number(port);
			if (!Number.isInteger(p) || p < 1 || p > 65535) return false;
			return String(spec || '').trim().split(/\s+/).some(function(part) {
				let m = part.match(/^(\d+)(?:-(\d+))?$/);
				if (!m) return false;
				let a = +m[1], b = +(m[2] || m[1]);
				return p >= Math.min(a, b) && p <= Math.max(a, b);
			});
		}

		function ruleConflicts(sid, portField, port) {
			if (uci.get(fw, sid, 'enabled') === '0') return false;
			let proto = String(uci.get(fw, sid, 'proto') || 'all').toLowerCase();
			if (proto !== 'all' && proto !== 'any' &&
			    !proto.split(/\s+/).some(function(t) { return t === 'tcp' || t === 'udp'; }))
				return false;
			let src = uci.get(fw, sid, 'src') || '';
			if (src !== 'wan' && src !== '*') return false;
			return portHits(port, uci.get(fw, sid, portField));
		}

		function upsertNatTestRule(port) {
			let fields = {
				name: nattest_fw_rulename,
				src: 'wan', proto: 'tcp udp',
				dest_port: port, target: 'ACCEPT'
			};

			let target = null;
			uci.sections(fw, 'rule', function(sec, sid) {
				if (uci.get(fw, sid, 'name') !== nattest_fw_rulename) return;
				if (target === null) {
					target = sid;
					for (let k in fields) uci.set(fw, sid, k, fields[k]);
				} else {
					uci.remove(fw, sid);
				}
			});

			if (target === null && (target = uci.add(fw, 'rule')))
				for (let k in fields) uci.set(fw, target, k, fields[k]);
			return target;
		}

		o = s.option(form.Value, 'test_port', _('NATBehavior-Test port open on'),
			_('Please check <a href="%s"><b>Firewall Rules</b></a> to avoid port conflicts.<br />')
				.format(L.url('admin', 'network', 'firewall'))
			+ _('LuCI check may not detect all conflicts.'));
		o.datatype = 'and(port, min(1))';
		o.placeholder = 6777;
		o.rmempty = false;
		o.validate = function(section_id, value) {
			let conflict = false;
			uci.sections(fw, 'redirect', function(sec, sid) {
				if (ruleConflicts(sid, 'src_dport', value)) conflict = true;
			});
			if (conflict) return _('This port is already used');

			uci.sections(fw, 'rule', function(sec, sid) {
				if (uci.get(fw, sid, 'name') === nattest_fw_rulename) return;
				if ((uci.get(fw, sid, 'dest') || '') !== '') return;
				if (ruleConflicts(sid, 'dest_port', value)) conflict = true;
			});
			if (conflict) return _('This port is already used');
			return true;
		};

		o.write = function(section_id, value) {
			if (uci.get(conf, section_id, 'test_port') !== value)
				uci.set(conf, section_id, 'test_port', value);
			upsertNatTestRule(value);
		};

		// o = s.option(form.Flag, 'log_enable', _('Enable logging'));
		// o.default = o.disabled;
		// o.rmempty = false;
		// o.description = _('Redirect service standard output and standard error to system log');
		// o.cfgvalue = function (section_id) {
		// 	const so = uci.get(conf, section_id, 'log_stdout');
		// 	const se = uci.get(conf, section_id, 'log_stderr');
		// 	return (so === '1' || se === '1') ? '1' : '0';
		// };
		// o.write = function (section_id, value) {
		// 	const v = (value === '1' || value === true) ? '1' : '0';
		// 	uci.set(conf, section_id, 'log_stdout', v);
		// 	uci.set(conf, section_id, 'log_stderr', v);
		// };

		o = s.option(form.Button, '_nattest', _('Check NAT Behavior'));
		o.inputtitle = _('Check');
		o.inputstyle = 'apply';
		if (!has_stunclient) {
			o.readonly = true;
			o.description = _('To check NAT Behavior you need to install <a href="%s"><b>stuntman-client</b></a> first')
				.format('https://github.com/muink/openwrt-stuntman');
		}
		o.onclick = function() {
			let test_port     = uci.get_first(conf, 'global', 'test_port')    || '';
			let udp_stun_host = uci.get_first(conf, 'global', 'def_udp_stun') || '';
			let tcp_stun_host = uci.get_first(conf, 'global', 'def_tcp_stun') || '';

			if (!test_port || !udp_stun_host || !tcp_stun_host) {
				ui.addNotification(null, E('p', _('Please save settings first.')), 'warning');
				return;
			}

			return fs.exec('/etc/natmap/scripts/natcheck.sh', [
				udp_stun_host + (udp_stun_host.match(/:\d+$/) ? '' : ':3478'),
				tcp_stun_host + (tcp_stun_host.match(/:\d+$/) ? '' : ':3478'),
				test_port, nattest_result_path])
				.then(() => { window.location = window.location.href.split('#')[0]; })
				.catch((e) => { ui.addNotification(null, E('p', e.message), 'error'); });
		};

		if (nattest_result.length) {
			o = s.option(form.DummyValue, '_nattest_result', ' ');
			o.rawhtml = true;
			o.cfgvalue = function() {
				return '<details><summary>' + _('Expand/Collapse result') + '</summary>' + nattest_result + '</details>';
			};
		};

		s = m.section(form.GridSection, conf);
		s.sortable  = true;
		s.addremove = true;
		s.anonymous = true;
		s.nodescriptions = true;

		s.tab('general', _('General Settings'));
		s.tab('forward', _('Forward Settings'));
		s.tab('notify', _('Notify Scripts'));
		s.tab('ddns', _('DDNS Scripts'));
		s.tab('custom', _('Custom Script'));

		o = s.taboption('general', form.Flag, 'enable', _('Enable'));
		o.default = o.disabled;
		o.rmempty = false;
		o.editable = true;
		// o.modalonly = false;

		o = s.taboption('general', form.Value, 'comment', _('Comment'));
		o.width = '12%';
		o.rmempty = false;

		o = s.taboption('general', form.ListValue, 'udp_mode', _('Protocol'));
		o.modalonly = true;
		o.default = '0';
		o.value('0', 'TCP');
		o.value('1', 'UDP');
		// o.textvalue = function(section_id) {
		// 	let cval = this.cfgvalue(section_id);
		// 	let i = this.keylist.indexOf(cval);
		// 	return this.vallist[i];
		// };

		o = s.taboption('general', form.ListValue, 'family', _('Restrict to address family'));
		o.modalonly = true;
		o.default = 'ipv4';
		o.value('ipv4', _('IPv4'));
		o.value('ipv6', _('IPv6'));
		o.onchange = function (ev, section_id, value) {
			const lEl = this.section.getUIElement(section_id, 'forward_mode');
			if (lEl) lEl.setValue('via');
		};
		// o.textvalue = function(section_id) {
		// 	let cval = this.cfgvalue(section_id);
		// 	let i = this.keylist.indexOf(cval);
		// 	return this.vallist[i];
		// };
		o.validate = function(section_id, value) {
			let opt = this.section.getOption('forward_target').getUIElement(section_id),
				choices = transformHostHints(value, hosts, true);
			opt.clearChoices();
			opt.addChoices([
				'127.0.0.1',
				'0.0.0.0'
			],
			{
				'127.0.0.1': '127.0.0.1/::1 (<strong>%s</strong>)'.format(_('This device default Lan')),
				'0.0.0.0': '0.0.0.0/:: (<strong>%s</strong>)'.format(_('This device default Wan'))
			});
			opt.addChoices(choices[0], choices[1]);
			return true;
		};

		o = s.taboption('general', widgets.DeviceSelect, 'bind_ifname', _('Interface'));
		o.modalonly = true;
		o.multiple = false;
		o.noaliases = true;
		o.nobridges = true;
		o.nocreate = false;

		o = s.taboption('general', form.Value, 'port', _('Bind port'),
			_('Note: After using <code>portrange</code>, the public ports will be opened in rotation<br />') +
			_('If you enable <b>Notify Scripts</b>, you will be bombarded with messages'));
		o.datatype = "or(port, portrange)";
		o.rmempty = false;
		o.validate = function(section_id, value) {
			let regexp = new RegExp(/^([1-9]\d*)(-([1-9]\d*))?$/);
			if (!regexp.test(value))
				return _('Expecting: %s').format(_('Non-0 port'));
			return true;
		};

		o = s.taboption('general', form.Flag, 'port_pointer', _('Randomly allocation ports'),
			_('Allocation ports randomly instead of sequentially.'));
		o.default = o.disabled;
		o.depends({ port: /^[1-9]\d*-[1-9]\d*$/ });
		o.modalonly = true;

		o = s.taboption('general', form.Value, 'interval', _('Keep-alive interval'));
		o.datatype = "and(uinteger, min(1))";
		o.modalonly = true;

		o = s.taboption('general', form.Value, 'stun_cycle', _('STUN check cycle (once every n intervals)'),
			_('For UDP mode'));
		o.datatype = 'uinteger';
		o.modalonly = true;

		o = s.taboption('general', form.Value, 'stun_server', _('STUN server'));
		o.datatype = 'or(hostname, hostport)';
		o.modalonly = true;

		o = s.taboption('general', form.Value, 'http_server', _('HTTP server'), _('For TCP mode'));
		o.datatype = 'or(hostname, hostport)';
		o.modalonly = true;

		o = s.taboption('general', form.Value, 'fwmark_value', _('Fwmark value'),
			_('Mark fwmark for STUN/HTTP outbound traffic'));
		o.modalonly = true;

		o = s.taboption('forward', form.Flag, 'forward', _('Forward mode'));
		o.default = o.disabled;
		o.rmempty = false;
		o.modalonly = true;
		// o.textvalue = function(section_id) {
		// 	let cval = this.cfgvalue(section_id) || this.default;
		// 	let mode = function() {
		// 		let v = this.cfgvalue(section_id) || this.default;
		// 		let i = this.keylist.indexOf(v);
		// 		return [this.vallist[i], v];
		// 	}.call(this.section.getOption('forward_mode'));
		// 	let loopback = function() {
		// 		let v = this.cfgvalue(section_id) || this.default;
		// 		return (v == this.enabled) ? ' L' : '';
		// 	}.call(this.section.getOption('natloopback'));
		// 	return (cval == this.enabled) ? mode[0] + (mode[1] === 'dnat' ? loopback : '') : _('No');
		// };

		o = s.taboption('forward', form.ListValue, 'forward_mode', _('Forward method'),
			_('The DNAT method not support under IPv6'));
		o.value('dnat', _('Firewall DNAT'));
		o.value('via', _('Via natmap'));
		o.default = 'via';
		o.rmempty = false;
		o.retain = true;
		o.width = '20%';
		o.depends('forward', '1');
		o.modalonly = true;
		o.validate = function(section_id, value) {
			const family = this.section.getUIElement(section_id, 'family').getValue();
			if (family == 'ipv6' && value == 'dnat')
				return _('The DNAT method not support under IPv6');
			return true;
		};

		o = s.taboption('forward', form.Flag, 'natloopback', _('NAT loopback'));
		o.default = o.enabled;
		o.retain = true;
		o.modalonly = true;
		o.depends('forward_mode', 'dnat');

		o = s.taboption('forward', form.ListValue, 'forward_congestion', _('TCP Congestion control'),
			_('For TCP mode'));
		o.value('', _('Default'));
		congestions.forEach((res) => {
			o.value.apply(o, [res]);
		});
		o.depends('forward_mode', 'via');
		o.modalonly = true;

		o = s.taboption('forward', form.Value, 'forward_timeout', _('Forward timeout'),
			_('Port forwarding session idle timeout in seconds'));
		o.datatype = "and(uinteger, min(1))";
		o.placeholder = '300000';
		o.depends('forward_mode', 'via');
		o.modalonly = true;

		o = s.taboption('forward', form.Value, 'forward_target', _('Forward target'));
		o.datatype = 'or(hostname,ipaddr(1))';
		o.value('127.0.0.1', '127.0.0.1/::1 (%s)'.format(_('This device default Lan')));
		o.value('0.0.0.0', '0.0.0.0/:: (%s)'.format(_('This device default Wan')));
		o.default = '127.0.0.1';
		o.validate = function(section_id, value) {
			const forward_mode = this.section.getUIElement(section_id, 'forward_mode').getValue();
			if (new RegExp(/^[a-zA-Z0-9][-a-zA-Z0-9]{0,62}(\.[a-zA-Z0-9][-a-zA-Z0-9]{0,62})*\.?$/).test(value) &&
				!new RegExp(/^[0-9]+(\.[0-9]+){3}$/).test(value) &&
				forward_mode === 'dnat')
				return _('Expecting: %s').format(_('The hostname not support under DNAT mode'));

			return true;
		};
		o.rmempty = false;
		o.retain = true;
		o.depends('forward', '1');

		((labels) => {
			for (let val in labels)
				o.value(val, labels[val]);
		})(transformHostHints(null, hosts, false)[1]);

		// o.textvalue = function(section_id) {
		// 	let cval = this.cfgvalue(section_id);
		// 	let i = this.keylist.indexOf(cval);
		// 	let enforward = function() {
		// 		let v = this.cfgvalue(section_id) || this.default;
		// 		return (v == this.enabled);
		// 	}.call(this.section.getOption('forward'));
		// 	return enforward ? (this.vallist[i] ?? cval) : _('No');
		// };

		o = s.taboption('forward', form.Value, 'forward_port', _('Forward target port'),
			_('Set 0 will follow Public port'));
		o.datatype = 'port';
		o.rmempty = false;
		o.retain = true;
		o.depends('forward', '1');
		o.textvalue = function(section_id) {
			let cval = this.cfgvalue(section_id) || this.default;
			let enforward = function() {
				let v = this.cfgvalue(section_id) || this.default;
				return (v == this.enabled);
			}.call(this.section.getOption('forward'));
			let refresh = function() {
				let v = this.cfgvalue(section_id) || this.default;
				return (v == this.enabled);
			}.call(this.section.getOption('refresh'));
			let cltname = function() {
				let v = this.cfgvalue(section_id) || this.default;
				let i = this.keylist.indexOf(v);
				return i >= 0 ? this.vallist[i] : v;
			}.call(this.section.getOption('clt_type'));
			return enforward ? ((cval == '0' && refresh) ? cltname : cval) : _('No');
		};

		o = s.taboption('forward', form.Flag, 'refresh', _('Refresh client'),
			_('%s set 0 will rewrite client listen port').format(_('Forward target port')));
		o.default = o.disabled;
		o.rmempty = false;
		o.retain = true;
		o.depends('forward', '1');
		o.modalonly = true;

		o = s.taboption('forward', form.ListValue, 'clt_type', _('Refresh Scripts'));
		o.rmempty = false;
		o.retain = true;
		o.modalonly = true;
		o.depends('refresh', '1');
		o.value('qBittorrent', 'qBittorrent');
		o.value('Transmission', 'Transmission');
		o.value('Deluge', 'Deluge');

		o = s.taboption('forward', form.ListValue, 'clt_scheme', _('URI Scheme'));
		o.value('http', 'HTTP');
		o.value('https', 'HTTPS');
		o.default = 'http';
		o.rmempty = false;
		o.retain = true;
		o.modalonly = true;
		o.depends('refresh', '1');

		o = s.taboption('forward', form.Value, 'clt_web_port', _('Web UI Port'));
		o.datatype = "and(port, min(1))";
		o.default = '8080';
		o.rmempty = false;
		o.retain = true;
		o.depends('refresh', '1');
		o.modalonly = true;

		o = s.taboption('forward', form.Value, 'clt_username', _('Username'));
		o.retain = true;
		o.rmempty = false;
		o.depends({ 'refresh': '1', 'clt_type': /Tr|qB/ });
		o.modalonly = true;

		o = s.taboption('forward', form.Value, 'clt_password', _('Password'));
		// o.password = true;
		o.depends('refresh', '1');
		o.modalonly = true;
		o.rmempty = false;

		o = s.option(form.DummyValue, '_external_ip', _('External IP'));
		o.modalonly = false;
		o.textvalue = function(section_id) {
			let st = status[section_id];
			if (st) return st.ip;
		};

		o = s.option(form.DummyValue, '_external_port', _('External Port'));
		o.modalonly = false;
		o.textvalue = function(section_id) {
			let st = status[section_id];
			if (st) return st.port;
		};

		o = s.taboption('notify', form.Flag, 'notify_enable', _('EnNotify'));
		o.default = o.disabled;
		o.editable = true;

		o = s.taboption('notify', form.ListValue, 'notify_script', _('Notify Scripts'));
		o.datatype = 'file';
		o.rmempty = false;
		o.modalonly = true;
		o.depends('notify_enable', '1');
		if (scripts_notify.length) {
			scripts_notify.forEach((script) => {
				o.value(etc_path + '/notify/' + script.name, script.name);
			});
		};

		o = s.taboption('notify', form.DynamicList, 'notify_tokens', _('Tokens'),
			_('The KEY required by the script above. ' +
				'See <a href="%s" target="_blank">%s</a> for the format of KEY required by each script. ' +
				'Add multiple entries here in KEY=VAL shell variable format to supply multiple KEY variables.')
			.format('https://github.com/muink/openwrt-natmapt/tree/master/files/notify/', _('<code># All external tokens required</code> Field')));
		o.datatype = 'list(string)';
		o.placeholder = 'KEY=VAL';
		o.modalonly = true;
		o.depends('notify_enable', '1');

		o = s.taboption('notify', form.Value, 'notify_custom_domain', _('Private API Domain'));
		o.datatype = 'hostname';
		o.placeholder = 'api.example.com';
		o.modalonly = true;
		o.depends('notify_enable', '1');

		o = s.taboption('notify', form.Value, 'notify_text', _('Text content'));
		o.placeholder = 'NATMap: <comment>: [<protocol>] <inner_ip>:<inner_port> -> <ip>:<port>';
		o.modalonly = true;
		o.depends('notify_enable', '1');

		o = s.taboption('ddns', form.Flag, 'ddns_enable', _('EnDDNS'));
		o.default = o.disabled;
		o.editable = true;

		o = s.taboption('ddns', form.ListValue, 'ddns_script', _('DDNS Scripts'));
		o.datatype = 'file';
		o.rmempty = false;
		o.modalonly = true;
		o.depends({ ddns_enable: '1' });
		if (scripts_ddns.length){
			scripts_ddns.forEach((script) => {
				o.value(etc_path + '/ddns/' + script.name, script.name);
			});
		};

		o = s.taboption('ddns', form.DynamicList, 'ddns_tokens', _('Tokens'),
			_('The KEY required by the script above. ' +
				'See <a href="%s" target="_blank">%s</a> for the format of KEY required by each script. ' +
				'Add multiple entries here in KEY=VAL shell variable format to supply multiple KEY variables.')
			.format('https://github.com/muink/openwrt-natmapt/tree/master/files/ddns/', _('<code># All external tokens required</code> Field')));
		o.datatype = 'list(string)';
		o.placeholder = 'KEY=VAL';
		o.modalonly = true;
		o.depends({ ddns_enable: '1' });

		o = s.taboption('ddns', form.Value, 'ddns_a', _('A Record FQDN'));
		o.datatype = 'hostname';
		o.placeholder = 'www.example.com';
		o.depends({ ddns_enable: '1', family: 'ipv4' });
		o.modalonly = true;

		o = s.taboption('ddns', form.Value, 'ddns_aaaa', _('AAAA Record FQDN'));
		o.datatype = 'hostname';
		o.placeholder = 'ipv6.example.com';
		o.depends({ ddns_enable: '1', family: 'ipv6' });
		o.modalonly = true;

		o = s.taboption('ddns', form.DummyValue, '_ddns_txt_dump', _('TXT Record'));
		o.rawhtml = false;
		o.cfgvalue = function(section_id) {
			let fqdn = uci.get(conf, section_id, 'ddns_txt');
			let cont = uci.get(conf, section_id, 'ddns_txt_content');
			if (fqdn && cont)
				return fqdn + '. <TTL> IN TXT ' + cont;
			return [];
		};
		o.modalonly = true;
		o.depends({ ddns_enable: '1', ddns_txt: /.+/, ddns_txt_content: /.+/ });

		o = s.taboption('ddns', form.Value, 'ddns_txt', _('FQDN'));
		o.datatype = 'hostname';
		o.placeholder = 'txt.example.com';
		o.modalonly = true;
		o.depends({ ddns_enable: '1' });

		o = s.taboption('ddns', form.Value, 'ddns_txt_content', _('Content'));
		o.placeholder = '"port={{port}}; target={{ip}}"';
		o.default = '"port={{port}}; target={{ip}}"';
		o.rmempty = false;
		o.depends({ ddns_txt: /.+/, ddns_enable: '1' });
		o.modalonly = true;

		o = s.taboption('ddns', form.DummyValue, '_ddns_srv_dump', _('SRV Record'));
		o.rawhtml = false;
		o.cfgvalue = function(section_id) {
			let fqdn = uci.get(conf, section_id, 'ddns_srv');
			let serv = uci.get(conf, section_id, 'ddns_srv_serv');
			let prot = uci.get(conf, section_id, 'ddns_srv_proto');
			let targ = uci.get(conf, section_id, 'ddns_srv_target') || fqdn;
			let prio = uci.get(conf, section_id, 'ddns_srv_priority');
			let weig = uci.get(conf, section_id, 'ddns_srv_weight');

			if (fqdn && serv && prot && targ && prio && weig)
				return '_' + serv + '._' + prot + '.' + fqdn + '. <TTL> IN SRV ' + prio + ' ' + weig + ' <port> ' + targ + '.';
			return [];
		};
		o.modalonly = true;
		o.depends({
			ddns_enable: '1', ddns_srv: /.+/, ddns_srv_serv: /.+/, ddns_srv_proto: /.+/,
			ddns_srv_target: /.+/, ddns_srv_priority: /.+/, ddns_srv_weight: /.+/
		});

		o = s.taboption('ddns', form.Value, 'ddns_srv', _('FQDN'));
		o.datatype = 'hostname';
		o.placeholder = 'mc.example.com';
		o.modalonly = true;
		o.depends({ ddns_enable: '1' });

		o = s.taboption('ddns', form.Value, 'ddns_srv_serv', _('Service'), _('Can refer to RFC8552'));
		o.value('http');
		o.value('minecraft');
		o.value('factorio');
		o.value('easytier');
		o.default = 'minecraft';
		o.rmempty = false;
		o.modalonly = true;
		o.depends({ ddns_srv: /.+/, ddns_enable: '1' });

		o = s.taboption('ddns', form.Value, 'ddns_srv_proto', _('Protocol'), _('Can refer to RFC8552'));
		o.value('tcp', _('TCP'));
		o.value('udp', _('UDP'));
		o.value('tls', _('TLS'));
		o.value('wg', _('WireGuard'));
		o.default = 'tcp';
		o.rmempty = false;
		o.modalonly = true;
		o.depends({ ddns_srv: /.+/, ddns_enable: '1' });

		o = s.taboption('ddns', form.Value, 'ddns_srv_target', _('Target'));
		o.datatype = 'hostname';
		o.placeholder = 'cdn.example.com';
		o.modalonly = true;
		o.depends({ ddns_srv: /.+/, ddns_enable: '1' });

		o = s.taboption('ddns', form.Value, 'ddns_srv_priority', _('Priority'));
		o.datatype = 'range(0, 65535)';
		o.default = 0;
		o.rmempty = false;
		o.modalonly = true;
		o.depends({ ddns_srv: /.+/, ddns_enable: '1' });

		o = s.taboption('ddns', form.Value, 'ddns_srv_weight', _('Weight'));
		o.datatype = 'range(0, 65535)';
		o.default = 65535;
		o.rmempty = false;
		o.modalonly = true;
		o.depends({ ddns_srv: /.+/, ddns_enable: '1' });

		o = s.taboption('ddns', form.DummyValue, '_ddns_https_dump', _('HTTPS Record'));
		o.rawhtml = false;
		o.cfgvalue = function(section_id) {
			let fqdn = uci.get(conf, section_id, 'ddns_https');
			let targ = uci.get(conf, section_id, 'ddns_https_target');
			let svcp = uci.get(conf, section_id, 'ddns_https_svcparams');
			let prio = uci.get(conf, section_id, 'ddns_https_priority');

			if (fqdn && targ && svcp && prio)
				return fqdn + '. <TTL> IN HTTPS ' + prio + ' ' + targ + ' ' + svcp;
			return [];
		};
		o.modalonly = true;
		o.depends({
			ddns_enable: '1', ddns_https: /.+/, ddns_https_target: /.+/,
			ddns_https_svcparams: /.+/, ddns_https_priority: /.+/
		});

		o = s.taboption('ddns', form.Value, 'ddns_https', _('FQDN'));
		o.datatype = 'hostname';
		o.placeholder = 'www.example.com';
		o.modalonly = true;
		o.depends({ ddns_enable: '1' });

		o = s.taboption('ddns', form.Value, 'ddns_https_target', _('Target'));
		o.datatype = "or('.', hostname)";
		o.placeholder = '. or web.example.com';
		o.default = '.';
		o.rmempty = false;
		o.modalonly = true;
		o.depends({ ddns_https: /.+/, ddns_enable: '1' });

		o = s.taboption('ddns', form.Value, 'ddns_https_svcparams', _('SvcParams'));
		o.placeholder = 'alpn="h3,h3-29,h2,http/1.1" ipv4hint= ipv6hint= port=';
		o.default = 'alpn="h2,http/1.1"';
		o.rmempty = false;
		o.modalonly = true;
		o.depends({ ddns_https: /.+/, ddns_enable: '1' });

		o = s.taboption('ddns', form.Value, 'ddns_https_priority', _('Priority'));
		o.datatype = 'range(1, 65535)';
		o.default = 1;
		o.rmempty = false;
		o.modalonly = true;
		o.depends({ ddns_https: /.+/, ddns_enable: '1' });

		o = s.taboption('custom', form.FileUpload, 'custom_script', _('Custom Script'));
		o.root_directory = '/etc/natmap/client';
		o.enable_remove  = false;
		o.enable_upload  = true;
		o.modalonly = true;

		o = s.option(form.Button, '_reload');
		o.inputtitle = _('⭮');
		o.inputstyle = 'apply';
		o.onclick = function(ev, section_id) {
			return fs.exec('/etc/init.d/natmap', ['reload', section_id])
				.catch((e) => { ui.addNotification(null, E('p', e.message), 'error'); });
		};
		o.editable = true;
		o.modalonly = false;

		return m.render();
	}
});
