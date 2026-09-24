import { access } from 'fs';
import { cursor } from 'uci';
import { qs, uci_bool, uci_int, load_profile, mirrorGithubUrl, yqReadFile } from '/etc/nikki/ucode/include.uc';

const uci = cursor();
const gc = (o) => uci.get('nikki', 'config', o);
const gm = (o) => uci.get('nikki', 'mixin', o);
const bc = (o) => uci_bool(gc(o));
const im = (o) => uci_int(gm(o));

const file = getenv('profile_path');
if (!access(file)) exit(1);
const config = load_profile(file);
if (!config) exit(1);

const exprs = [];
const target = gm('github_mirror');

function addMirror(path, val) {
	if (val && type(val) == 'string')
		push(exprs, `${path} = "${mirrorGithubUrl(val, target)}"`);
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

push(exprs, `
	.dns |= (
		(select(.respect-rules == true and (has("proxy-server-nameserver") | not)) |
		.["proxy-server-nameserver"] = ["https://dns.alidns.com/dns-query", "https://doh.pub/dns-query"]
	) // .)
`);

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
				.collectdata = ${collectdata}    |
				.prefer-asn  = ${prefer_asn}     |
				.sample-rate = (${sample_rate} | tonumber) |
				((select(${qs(policy_priority)} != "") | .policy-priority = ${qs(policy_priority)}) // .)
			)
		)
	`);
} else {
	push(exprs, `
		(${gm('lazy')}     // "") as $l | (${gm('tolerance')}        // "") as $t |
		(${gm('timeout')}  // "") as $o | (${qs(gm('urltest_url'))}  // "") as $u |
		(${gm('interval')} // "") as $i | (${gm('max_failed_times')} // "") as $m |
		(.. | select(tag == "!!map")) |= (${pgs('$x')}) | .["proxy-groups"] |= map(${pgs('$y')})
	`);
};

if (target) {
	addMirror('.external-ui-url', config['external-ui-url']);
	let geox = config['geox-url'];
	for (let k in keys(geox))
		addMirror(`.geox-url["${k}"]`, geox[k]);

	let groups = config['proxy-groups'];
	for (let i = 0; i < length(groups); i++) {
		let g = groups[i];
		if (g) addMirror(`.proxy-groups[${i}].icon`, g.icon);
	}

	let providers = config['rule-providers'];
	for (let k in keys(providers)) {
		let p = providers[k];
		if (p) addMirror(`.rule-providers["${k}"].url`, p.url);
	}
};

if (bc('url_enabled')) {
	let idx = 0;
	const used = {};
	const hc_int = im('interval') || 600;
	const hc_url = gm('urltest_url') || 'https://cp.cloudflare.com/generate_204';
	const filter = '^(?!.*(群|邀请|返利|循环|官网|客服|网站|网址|获取|订阅|流量|到期|机场|下次|版本|官址|备用|过期|已用|联系|邮箱|工单|贩卖|通知|倒卖|防止|国内|地址|频道|无法|说明|使用|提示|特别|访问|支持|教程|关注|更新|作者|加入|剩余|套餐|重置|域名|USE|USED|TOTAL|EXPIRE|EMAIL|Panel|Channel|Author))';
	const providers = keys(config['proxy-providers'] || {});
	uci.foreach('nikki', 'subscription', (s) => {
		if (!uci_bool(s.enabled)) return;
		const k = providers[idx++];
		const name = s.name || split(split(s.url, '/')[2] ?? '', '.')[0] || `provider${idx}`;
		if (k) {
			used[k] = true;
			return push(exprs,
				`.proxy-providers[${qs(k)}].url  = ${qs(s.url)}`,
				`.proxy-providers[${qs(k)}].path = ${qs(`./proxies/${name}.yaml`)}`,
				`.proxy-providers[${qs(k)}].override.additional-prefix = ${qs(`[${name}] `)}`
			);
		};

		const np = `.proxy-providers[${qs(name)}]`;
		push(exprs, ...map([
			['type',                       '"http"'],
			['interval',                   86400],
			['url',                        qs(s.url)],
			['filter',                     qs(filter)],
			['health-check.enable',        true],
			['health-check.interval',      hc_int],
			['health-check.url',           qs(hc_url)],
			['path',                       qs(`./proxies/${name}.yaml`)],
			['override.additional-prefix', qs(`[${name}] `)]
		], (kv) => `${np}.${kv[0]} = ${kv[1]}`));
	});

	for (let j = 0; j < length(providers); j++) {
		const k = providers[j];
		if (!used[k])
			push(exprs, `del(.proxy-providers[${qs(k)}])`);
	}
};

let yqExpr = join(' | ', exprs);
yqReadFile('-i', yqExpr, file);
