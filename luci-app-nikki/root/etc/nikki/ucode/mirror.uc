import { access, popen, writefile, readfile, rename } from 'fs';
import { shellQuote, run, load_profile, trim_all, mirrorGithubUrl } from '/etc/nikki/ucode/include.uc';

let target = getenv('github_mirror');
let file   = getenv('profile_path');

if (!file || length(file) == 0) {
	print('Error: profile_path not set\n');
	exit(1);
};

let config = load_profile(file);
if (!config) {
	print('Error: failed to parse JSON\n');
	exit(1);
};

let exprs = [];
function pgs(k) {
    return `(.type | test("^(select|fallback|load-balance|url-test)$")) as ${k} |
			((select($u != "" and ${k}) | .url  = $u)                   // .) |
			((select($l != "" and ${k}) | .lazy = ($l | (. == "true"))) // .) |
			((select($o != "" and ${k}) | .timeout   = ($o | tonumber)) // .) |
			((select($i != "" and ${k}) | .interval  = ($i | tonumber)) // .) |
			((select($t != "" and ${k}) | .tolerance = ($t | tonumber)) // .) |
			((select($m != "" and ${k}) | .["max-failed-times"] = ($m | tonumber)) // .)`;
};

push(exprs, `
	.dns |= (
		select(.["respect-rules"] == true and ((.["proxy-server-nameserver"] // []) | length == 0)) |
		.["proxy-server-nameserver"] = ["https://dns.alidns.com/dns-query", "https://doh.pub/dns-query"]
	) |
    (..  | select(tag == "!!str")) style="double" |
	(strenv(mft)     // "") as $m | (strenv(interval)    // "") as $i |
    (strenv(lazy)    // "") as $l | (strenv(tolerance)   // "") as $t |
    (strenv(timeout) // "") as $o | (strenv(urltest_url) // "") as $u |
    (.. | select(tag == "!!map")) |= (${pgs('$x')}) | .["proxy-groups"] |= map(${pgs('$y')})
`);

if (target) {
	if (config['geox-url']) {
		for (let k in keys(config['geox-url'])) {
			let v = config['geox-url'][k];
			if (v && type(v) == 'string') {
				let newUrl = mirrorGithubUrl(v, target);
				push(exprs, `.geox-url["${k}"] = "${shellQuote(newUrl)}"`);
			}
		}
	};

	if (config['external-ui-url'] && type(config['external-ui-url']) == 'string') {
		let newUrl = mirrorGithubUrl(config['external-ui-url'], target);
		push(exprs, `.external-ui-url = "${shellQuote(newUrl)}"`);
	};

	if (config['proxy-groups'] && type(config['proxy-groups']) == 'array') {
		for (let i = 0; i < length(config['proxy-groups']); i++) {
			let g = config['proxy-groups'][i];
			if (g && g.icon && type(g.icon) == 'string') {
				let newUrl = mirrorGithubUrl(g.icon, target);
				push(exprs, `.proxy-groups[${i}].icon = "${shellQuote(newUrl)}"`);
			}
		}
	};

	if (config['rule-providers']) {
		for (let k in keys(config['rule-providers'])) {
			let p = config['rule-providers'][k];
			if (p && p.url && type(p.url) == 'string') {
				let newUrl = mirrorGithubUrl(p.url, target);
				push(exprs, `.rule-providers["${k}"].url = "${shellQuote(newUrl)}"`);
			}
		}
	};
};

if (length(trim_all(exprs)) > 0) {
	let yqExpr = join(' | ', exprs);
	let rc = run(`yq -Mi '${yqExpr}' '${file}'`);
};
