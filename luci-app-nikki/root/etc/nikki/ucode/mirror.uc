import { access } from 'fs';
import { cursor } from 'uci';
import { uci_bool as ub, uci_int as ui, uci_array as ua, load_profile, trim_all, mirrorGithubUrl, qs, yqReadFile } from '/etc/nikki/ucode/include.uc';
const uci  = cursor();
function g(o) { return uci.get('nikki', 'mixin', o); };
function i(o) { return ui(g(o)); };
function b(o) { return ub(g(o)); };
function a(o) { return ua(g(o)); };

let exprs = [], target = g('github_mirror');
function addMirror(path, val) {
	if (val && type(val) == 'string')
		push(exprs, `${path} = "${mirrorGithubUrl(val, target)}"`);
};

let file = getenv('profile_path');
if (!access(file)) exit(1);
let config = load_profile(file);
if (!config) exit(1);

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
	) // .) |
	(${g('lazy')}     // "") as $l | (${g('tolerance')}        // "") as $t |
	(${g('timeout')}  // "") as $o | (${qs(g('urltest_url'))}  // "") as $u |
	(${g('interval')} // "") as $i | (${g('max_failed_times')} // "") as $m |
	(.. | select(tag == "!!map")) |= (${pgs('$x')}) | .["proxy-groups"] |= map(${pgs('$y')})
`);

if (ub(uci.get('nikki', 'config', 'url_enabled'))) {
	let idx = 0;
	const used = {};
	const hc_int = i('interval') || 600;
	const hc_url = g('urltest_url') || 'https://cp.cloudflare.com/generate_204';
	const filter = '^(?!.*(群|邀请|返利|循环|官网|客服|网站|网址|获取|订阅|流量|到期|机场|下次|版本|官址|备用|过期|已用|联系|邮箱|工单|贩卖|通知|倒卖|防止|国内|地址|频道|无法|说明|使用|提示|特别|访问|支持|教程|关注|更新|作者|加入|剩余|套餐|重置|域名|USE|USED|TOTAL|EXPIRE|EMAIL|Panel|Channel|Author))';
	const providers = keys(config['proxy-providers'] || {});
	uci.foreach('nikki', 'subscription', (s) => {
		if (!ub(s.enabled)) return;
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
			['health-check.enable',        'true'],
			['health-check.interval',      hc_int],
			['path',                       qs(`./proxies/${name}.yaml`)],
			['health-check.url',           qs(hc_url)],
			['override.additional-prefix', qs(`[${name}] `)]
		], (kv) => `${np}.${kv[0]} = ${kv[1]}`));
	});

	for (let j = 0; j < length(providers); j++) {
		const k = providers[j];
		if (!used[k])
			push(exprs, `del(.proxy-providers[${qs(k)}])`);
	}
};

const core = uci.get('nikki', 'config', 'core');
if (match(core, /smart/)) {
	const uselightgbm = ub(uci.get('nikki', 'config', 'uselightgbm'));
	if (!uselightgbm) return;

	const lgbm            = uci.get('nikki', 'config', 'lgbm');
	const prefer_asn      = uci.get('nikki', 'config', 'prefer_asn');
	const smart_strategy  = uci.get('nikki', 'config', 'smart_strategy');
	const policy_priority = uci.get('nikki', 'config', 'policy_priority');
	const collectdata     = uci.get('nikki', 'config', 'collectdata') || 0;
	const sample_rate     = uci.get('nikki', 'config', 'sample_rate') || 1.0;
	const collector_size  = uci.get('nikki', 'config', 'smart_collector_size') || 100;
	if (lgbm) {
		const set = (k, v) => push(exprs, `.${k} = ${v}`);
		set('lgbm-auto-update', 'true');
		set('lgbm-update-interval', 72);
		set('lgbm-url', qs(`https://github.com/vernesong/mihomo/releases/download/LightGBM-Model/${lgbm}`));
		set('profile.smart-collector-size', ui(collector_size));
	};

	let groups = config['proxy-groups'];
	for (let i = 0; i < length(groups); i++) {
		let g = groups[i];
		if (g && (g.type == 'url-test' || g.type == 'load-balance')) {
			const set = (k, v) => push(exprs, `.proxy-groups[${i}].${k} = ${v}`);
			set('type', '"smart"');
			set('uselightgbm', uselightgbm);
			set('sample-rate', sample_rate);
			set('prefer-asn',  ub(prefer_asn)  || false);
			set('collectdata', ub(collectdata) || false);
			set('strategy',    qs(smart_strategy));
			if (policy_priority) set('policy-priority', qs(policy_priority));
		}
	}
};

if (length(trim_all(exprs)) > 0) {
	let yqExpr = join(' | ', exprs);
	yqReadFile('-i', yqExpr, file);
};
