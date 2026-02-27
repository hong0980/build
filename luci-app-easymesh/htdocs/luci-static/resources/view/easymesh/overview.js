'use strict';
'require view';
'require form';
'require uci';
'require ui';
'require rpc';
'require network';
'require tools.widgets as widgets';

/*
 * luci-app-easymesh - overview.js
 * 主配置页面：向导式 Mesh 配置
 */

var callGetWirelessDevices = rpc.declare({
	object: 'network.wireless',
	method: 'status',
	expect: { '': {} }
});

return view.extend({

	/*
	 * 声明本视图涉及的 UCI package。
	 * LuCI 会在 Apply 时把这些 package 的 pending changes 一起提交，
	 * 并触发 procd service_triggers → /etc/init.d/easymesh reload
	 */
	handleSave: function(ev) {
		return this.map.save(null, true);
	},

	load: function() {
		return Promise.all([
			uci.load('easymesh'),
			uci.load('wireless'),
			uci.load('network'),
			callGetWirelessDevices()
		]);
	},

	render: function(data) {
		var m, s, o;
		var wirelessStatus = data[3];

		m = new form.Map('easymesh', _('EasyMesh 配置'),
			_('基于 batman-adv + 802.11s 的无线 Mesh 网络。所有节点需使用相同的 Mesh ID 和密码。'));

		/* ======================================
		 * Section 1: 基本设置
		 * ====================================== */
		s = m.section(form.NamedSection, 'global', 'easymesh', _('基本设置'));
		s.addremove = false;
		s.anonymous = true;

		/* 启用开关 */
		o = s.option(form.Flag, 'enabled', _('启用 EasyMesh'));
		o.rmempty = false;
		o.default = '0';

		/* 节点角色 */
		o = s.option(form.ListValue, 'role', _('节点角色'),
			_('主节点负责拨号和 DHCP；从节点仅做扩展覆盖，关闭 DHCP'));
		o.value('master', _('主节点（连接光猫）'));
		o.value('slave',  _('从节点（扩展覆盖）'));
		o.default = 'master';
		o.depends('enabled', '1');

		/* 回程方式 */
		o = s.option(form.ListValue, 'backhaul', _('回程方式'),
			_('有线回程更稳定；无线回程建议使用独立 5GHz 频段'));
		o.value('wired',    _('有线回程（推荐）'));
		o.value('wireless', _('无线回程（5GHz）'));
		o.value('auto',     _('自动选择（有线优先）'));
		o.default = 'wireless';
		o.depends('enabled', '1');

		/* ======================================
		 * Section 2: Mesh 回程网络
		 * ====================================== */
		s = m.section(form.NamedSection, 'global', 'easymesh', _('Mesh 回程网络'),
			_('节点间互联的内部无线网络，对客户端不可见'));
		s.addremove = false;
		s.anonymous = true;
		s.tab('mesh_basic', _('Mesh 设置'));
		s.tab('mesh_advanced', _('高级'));

		/* Mesh ID */
		o = s.taboption('mesh_basic', form.Value, 'mesh_id', _('Mesh 网络 ID'),
			_('所有节点必须完全一致'));
		o.datatype = 'string';
		o.placeholder = 'OpenWrt-Mesh';
		o.depends('enabled', '1');

		/* Mesh 密码 */
		o = s.taboption('mesh_basic', form.Value, 'mesh_key', _('Mesh 密码（SAE 加密）'),
			_('所有节点必须完全一致，留空则不加密（不推荐）'));
		o.datatype = 'minlength(8)';
		o.password = true;
		o.placeholder = _('至少 8 位');
		o.depends('enabled', '1');

		/* Mesh 频段 */
		o = s.taboption('mesh_basic', form.ListValue, 'mesh_band', _('Mesh 回程频段'));
		o.value('2g', _('2.4 GHz（穿墙好，速度慢）'));
		o.value('5g', _('5 GHz（速度快，推荐）'));
		o.default = '5g';
		o.depends([
			{ enabled: '1', backhaul: 'wireless' },
			{ enabled: '1', backhaul: 'auto' }
		]);

		/* batman-adv 路由算法 */
		o = s.taboption('mesh_advanced', form.ListValue, 'routing_algo', _('batman-adv 路由算法'));
		o.value('BATMAN_IV',  'BATMAN IV（默认，兼容性好）');
		o.value('BATMAN_V',   'BATMAN V（更精准，需内核支持）');
		o.default = 'BATMAN_IV';
		o.depends('enabled', '1');

		/* mesh_fwding */
		o = s.taboption('mesh_advanced', form.Flag, 'mesh_fwding', _('802.11s 原生转发'),
			_('通常关闭，由 batman-adv 负责转发'));
		o.default = '0';
		o.depends('enabled', '1');

		/* ======================================
		 * Section 3: 客户端 WiFi (AP)
		 * ====================================== */
		s = m.section(form.NamedSection, 'global', 'easymesh', _('客户端 WiFi（AP）'),
			_('对手机、电脑等设备开放的 WiFi，所有节点使用相同 SSID 和密码实现无缝漫游'));
		s.addremove = false;
		s.anonymous = true;

		/* SSID */
		o = s.option(form.Value, 'ssid', _('WiFi 名称（SSID）'),
			_('所有节点必须一致'));
		o.datatype = 'maxlength(32)';
		o.placeholder = 'OpenWrt';
		o.depends('enabled', '1');

		/* WiFi 密码 */
		o = s.option(form.Value, 'key', _('WiFi 密码'),
			_('WPA2/WPA3 加密，留空为开放网络'));
		o.datatype = 'minlength(8)';
		o.password = true;
		o.depends('enabled', '1');

		/* ======================================
		 * Section 4: 漫游设置
		 * ====================================== */
		s = m.section(form.NamedSection, 'global', 'easymesh', _('漫游设置（802.11r/k/v）'),
			_('帮助手机在节点间快速切换，需要驱动支持开源 mac80211'));
		s.addremove = false;
		s.anonymous = true;
		s.tab('roam_basic', _('快速漫游'));
		s.tab('roam_advanced', _('高级'));

		/* 802.11r */
		o = s.taboption('roam_basic', form.Flag, 'ieee80211r', _('802.11r 快速 BSS 切换'),
			_('大幅减少切换节点时的断线时间，推荐开启'));
		o.default = '1';
		o.depends('enabled', '1');

		/* Mobility Domain */
		o = s.taboption('roam_basic', form.Value, 'mobility_domain', _('漫游域 ID（Mobility Domain）'),
			_('4 位十六进制，所有节点必须一致'));
		o.datatype = 'and(hexstring,rangelength(4,4))';
		o.placeholder = 'aabb';
		o.depends({ enabled: '1', ieee80211r: '1' });

		/* 802.11k */
		o = s.taboption('roam_basic', form.Flag, 'ieee80211k', _('802.11k 邻居报告'),
			_('告知设备附近的节点信息，辅助主动漫游'));
		o.default = '1';
		o.depends('enabled', '1');

		/* 802.11v */
		o = s.taboption('roam_basic', form.Flag, 'ieee80211v', _('802.11v BSS 过渡管理'),
			_('主动引导信号弱的设备切换到更好的节点'));
		o.default = '1';
		o.depends('enabled', '1');

		/* FT over DS */
		o = s.taboption('roam_advanced', form.Flag, 'ft_over_ds', _('FT over DS（Fast Transition over Distribution System）'),
			_('通过有线骨干网预协商密钥，速度更快；如有问题可关闭'));
		o.default = '1';
		o.depends({ enabled: '1', ieee80211r: '1' });

		/* reassociation deadline */
		o = s.taboption('roam_advanced', form.Value, 'reassociation_deadline', _('重连超时（毫秒）'));
		o.datatype = 'range(1000, 65535)';
		o.placeholder = '1000';
		o.depends({ enabled: '1', ieee80211r: '1' });

		return m.render();
	},

	handleSaveApply: function(ev) {
		return this.handleSave(ev).then(function() {
			/*
			 * ui.changes.apply() 会调用 ubus network.interface apply，
			 * 同时因为 service_triggers 监听了 easymesh UCI，
			 * procd 会自动触发 /etc/init.d/easymesh reload。
			 *
			 * 如果需要强制立即执行，也可以走 rpc 直接调 init.d：
			 *   rpc.declare({ object:'rc', method:'init', params:['name','action'] })
			 *   → callInitd({ name:'easymesh', action:'reload' })
			 */
			return ui.changes.apply(true);
		});
	},

	/*
	 * 告诉 LuCI 本视图修改了哪些 UCI package，
	 * 这样顶部的"未保存更改"提示和 Apply 按钮才能正确联动
	 */
	handleReset: function(ev) {
		return uci.revertAll().then(L.bind(this.render, this));
	}
});
