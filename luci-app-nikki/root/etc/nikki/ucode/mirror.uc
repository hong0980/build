import { access } from 'fs';
import { cursor } from 'uci';
import { load_profile, trim_all, mirrorGithubUrl, qs } from '/etc/nikki/ucode/include.uc';
function ug(o) { return cursor().get('nikki', 'mixin', o); };

let exprs = [], target = ug('github_mirror');
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
	(${ug('lazy')}     // "") as $l | (${ug('tolerance')}        // "") as $t |
	(${ug('timeout')}  // "") as $o | (${qs(ug('urltest_url'))}  // "") as $u |
	(${ug('interval')} // "") as $i | (${ug('max_failed_times')} // "") as $m |
	(.. | select(tag == "!!str")) style="double" |
	(.. | select(tag == "!!map")) |= (${pgs('$x')}) | .["proxy-groups"] |= map(${pgs('$y')}) |
	 .. |= map_values(key |= (select(tag == "!!str" and test("[.,:]")) | . style="double") // .)
`);

if (length(trim_all(exprs)) > 0) {
	let yqExpr = join(' | ', exprs);
	system(['yq', '-Mi', yqExpr, file]);
};
