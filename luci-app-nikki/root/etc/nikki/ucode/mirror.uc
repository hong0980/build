import { access } from 'fs';
import { cursor } from 'uci';
import { qs, uci_bool, uci_int, uci_array, load_profile, mirrorGithubUrl, yqReadFile } from '/etc/nikki/ucode/include.uc';

const uci = cursor();
const gc = o => uci.get('nikki', 'config', o);
const gm = o => uci.get('nikki', 'mixin', o);
const bc = o => uci_bool(gc(o));
const im = o => uci_int(gm(o));

const file = getenv('profile_path');
if (!access(file)) exit(1);

const exprs  = [];
const config = load_profile(file);
const target = gm('github_mirror');

function addMirror(path, val) {
	if (val && type(val) == 'string') push(exprs, `${path} = "${mirrorGithubUrl(val, target)}"`);
};

function pgs(k) {
	return `(.type | test("^(select|fallback|load-balance|url-test)$")) as ${k} |
			((select($u != "" and ${k}) | .url  = $u)                   // .) |
			((select($l != "" and ${k}) | .lazy =    ($l | (. == "1"))) // .) |
			((select($o != "" and ${k}) | .timeout   = ($o | tonumber)) // .) |
			((select($i != "" and ${k}) | .interval  = ($i | tonumber)) // .) |
			((select($t != "" and ${k}) | .tolerance = ($t | tonumber)) // .) |
			((select($m != "" and ${k}) | .["max-failed-times"] = ($m | tonumber)) // .)`;
};

const core = gc('core');
const ugbm = bc('uselightgbm');
if (match(core, /smart/) && ugbm) {
	const prefer_asn      = bc('prefer_asn');
	const collectdata     = bc('collectdata');
	const policy_priority = gc('policy_priority');
	const sample_rate     = gc('sample_rate') || 1.0;
	const lgbm            = gc('lgbm') || 'Model-large.bin';
	const collector_size  = gc('smart_collector_size') || 50;
	const smart_strategy  = gc('smart_strategy') || 'sticky-sessions';

	push(exprs, `
		.lgbm-auto-update = true    |
		.lgbm-update-interval = 120 |
		.lgbm-url = ${qs(`https://github.com/vernesong/mihomo/releases/download/LightGBM-Model/${lgbm}`)} |
		.profile  = (.profile // {}) | .profile.smart-collector-size = (${collector_size} | tonumber) |
		(.proxy-groups // []) |= map(
			select(.type == "url-test" or .type == "load-balance") |= (
				.type        = "smart"               |
				.uselightgbm = ${ugbm}               |
				.strategy    = ${qs(smart_strategy)} |
				.collectdata = ${collectdata}  |
				.prefer-asn  = ${prefer_asn}   |
				.sample-rate = (${sample_rate} | tonumber) |
				((select(${qs(policy_priority)} != "") | .policy-priority = ${qs(policy_priority)}) // .)
			)
		)
	`);
};

if (target) {
	addMirror('.external-ui-url', config['external-ui-url']);
	const geox = config['geox-url'];
	for (let k in keys(geox)) addMirror(`.geox-url["${k}"]`, geox[k]);

	const groups = config['proxy-groups'];
	for (let i = 0; i < length(groups); i++) {
		let g = groups[i];
		if (g) addMirror(`.proxy-groups[${i}].icon`, g.icon);
	};

	const providers = config['rule-providers'];
	for (let k in keys(providers)) {
		let p = providers[k];
		if (p) addMirror(`.rule-providers["${k}"].url`, p.url);
	};
};

if (config.dns['fake-ip-filter-mode'] == 'rule') {
	const filter = config.dns['fake-ip-filter'];
	if (filter) {
		let hasMatch;
		for (let i = 0; i < length(filter); i++) {
			const g = filter[i];
			hasMatch = match(g, /^MATCH/i);
			if (match(g, /,(fake-ip|real-ip)$/i)) continue;
			const action = hasMatch ? 'fake-ip' : 'real-ip';
			push(exprs, `.dns.fake-ip-filter[${i}] = ${qs(`${g},${action}`)}`);
		};
		if (!hasMatch) push(exprs, `.dns.fake-ip-filter[${length(filter)}] = ${qs('MATCH,fake-ip')}`);
	} else push(exprs, `.dns.fake-ip-filter-mode = ${qs('blacklist')}`);
};

if (bc('url_enabled')) {
	const hc_int = im('interval') || 600;
	const hc_url = gm('urltest_url') || 'https://cp.cloudflare.com/generate_204';
	const filter = '^(?!.*(群|邀请|返利|循环|官网|客服|网站|网址|获取|订阅|流量|到期|机场|下次|版本|官址|备用|过期|已用|联系|邮箱|工单|贩卖|通知|倒卖|防止|国内|地址|频道|无法|说明|使用|提示|特别|访问|支持|教程|关注|更新|作者|加入|剩余|套餐|重置|域名|USE|USED|TOTAL|EXPIRE|EMAIL|Panel|Channel|Author))';

	const pp = config['proxy-providers'] || {};
	const ppq = n => `.proxy-providers[${qs(n)}]`;
	let idx = 0, sp = 0;
	const subs = [], in_subs = {}, spare = [];

	uci.foreach('nikki', 'subscription', s => {
		if (!uci_bool(s.enabled)) return;
		const name = s.name || split(split(s.url, '/')[2] ?? '', '.')[0] || `provider${++idx}`;
		push(subs, [name, s.url]);
	});

	for (let i = 0; i < length(subs); i++) in_subs[subs[i][0]] = true;
	for (let k in keys(pp)) if (!in_subs[k]) push(spare, k);
	for (let i = 0; i < length(subs); i++) {
		const name = subs[i][0];
		const url_q = qs(subs[i][1]);
		const path_q = qs(`./proxies/${name}.yaml`);
		const prefix_q = qs(`[${name}] `);

		let init = null, old = null;
		if (!pp[name]) {
			if (sp < length(spare)) {
				old = spare[sp++];
				init = ppq(old);
			} else {
				init = `{"type":"http","proxy":"DIRECT","interval":43200,"url":${url_q},"filter":${qs(filter)},"health-check":{"enable":true,"interval":${hc_int},"expected-status": 204,"url":${qs(hc_url)}},"path":${path_q},"override":{"additional-prefix":${prefix_q}}}`;
			}
		}

		if (init) push(exprs, `${ppq(name)} = ${init}`);
		push(exprs, `${ppq(name)} |= (
					.url = ${url_q} | .interval = 43200 | .path = ${path_q} | .override.additional-prefix = ${prefix_q} | .health-check.expected-status = 204
				)`);
		if (old) push(exprs, `del(${ppq(old)})`);
	}

	for (let j = sp; j < length(spare); j++) push(exprs, `del(${ppq(spare[j])})`);
};

if (uci_bool(uci.get('nikki', 'proxy', 'natmap'))) {
	const fw_list = uci_array(uci.get('nikki', 'proxy', 'bypass_fwmark'));
	const mk = v => (v = trim(`${v ?? ''}`)) ? (match(v, /^0x/i) ? hex(v) : uci_int(v)) : null;
	const seen = {}, marks = [];
	for (let x in fw_list) seen[mk(split(`${x}`, '/')[0])] = true;

	let def_fw = null;
	uci.foreach('natmap', 'global', g => {
		if (uci_bool(g.enable) && g.def_fwmark_value) push(marks, def_fw = g.def_fwmark_value);
	});
	uci.foreach('natmap', 'natmap', n => {
		if (uci_bool(n.enable)) push(marks, n.fwmark_value || def_fw);
	});

	let changed = false;
	for (let v in marks) {
		const n = mk(v);
		if (n && !seen[n]) {
			seen[n] = true;
			push(fw_list, sprintf('0x%x', n));
			changed = true;
		}
	}
	if (changed) {
		uci.set('nikki', 'proxy', 'bypass_fwmark', fw_list);
		uci.save('nikki');
		uci.commit('nikki');
	}

	push(exprs, `(.tun | select(. != null)) |= (.["auto-route"] = false | .["auto-redirect"] = false)`);

	if (config.dns && config.dns['enhanced-mode'] == 'fake-ip') {
		const domains = ['qq.com'];
		const addDom = raw => {
			let h = replace(trim(`${raw ?? ''}`), /^https?:\/\//i, '');
			h = split(h, '/')[0] ?? '';
			if (!h || match(h, /^\[/)) return;
			h = trim(split(h, ':')[0] ?? '');
			if (h && !match(h, /^[0-9.]+$/)) push(domains, h);
		};

		uci.foreach('natmap', 'global', g => {
			if (!uci_bool(g.enable)) return;
			addDom(g.def_tcp_stun); addDom(g.def_udp_stun); addDom(g.def_http_server);
		});
		uci.foreach('natmap', 'natmap', n => {
			if (!uci_bool(n.enable)) return;
			addDom(n.stun_server); addDom(n.http_server);
		});

		const raw_mode = lc(config.dns['fake-ip-filter-mode'] ?? 'blacklist');
		const mode = (raw_mode == 'rule' && !length(config.dns['fake-ip-filter'])) ? 'blacklist' : raw_mode;
		const items = mode == 'rule' ? ['DOMAIN-REGEX,^stun[0-9]*\\.,real-ip'] : ['stun.*', 'stun.*.*', 'stun.*.*.*'];

		for (let d in uniq(domains)) {
			if (mode == 'rule') {
				if (!match(d, /^stun[0-9]*\./i)) push(items, `DOMAIN-SUFFIX,${d},real-ip`);
			} else if (mode == 'whitelist') {
				push(items, d, `*.${d}`, `+.${d}`);
			} else if (!match(d, /^stun\./i)) {
				push(items, `+.${d}`);
			}
		}

		const cond = join(' and ', map(items, x => `. != ${qs(x)}`));
		push(exprs, mode == 'whitelist'
			? `(.dns["fake-ip-filter"] | select(. != null)) |= map(select(${cond}))`
			: `(.dns["fake-ip-filter"] // []) as $cur | .dns["fake-ip-filter"] = (${sprintf('%J', items)} + ($cur | map(select(${cond}))))`
		);
	}
};

push(exprs, `
	(${gm('lazy')}     // "") as $l | (${gm('tolerance')}        // "") as $t |
	(${gm('timeout')}  // "") as $o | (${qs(gm('urltest_url'))}  // "") as $u |
	(${gm('interval')} // "") as $i | (${gm('max_failed_times')} // "") as $m |
	.rule-providers |= (. // {} | sort_keys(.) | map_values(
		(.url | capture("(?P<ext>\\.[^.]+)$").ext // "") as $q |
		(.path // "./rule_provider/" + key + $q) as $p |
		((select($p != "") | .path = $p) // .)
	) // .) |
	.dns |= ((select(.respect-rules == true and (has("proxy-server-nameserver") | not)) |
		.proxy-server-nameserver = ["https://doh.pub/dns-query", "https://dns.alidns.com/dns-query"]
	) // .) |
	.proxy-providers |= (. // {} | (select($u != "") | map_values(.["health-check"].url = $u)) // .) |
	(.. | select(tag == "!!map")) |= (${pgs('$x')}) | .["proxy-groups"] |= map(${pgs('$y')}) |
	(.. | select(tag == "!!str")) style="double" |
	 .. |= map_values(key |= (select(tag == "!!str" and test("[.,:]")) | . style="double") // .)
`);

const yqExpr = join(' | ', exprs);
yqReadFile('-i', yqExpr, file);
