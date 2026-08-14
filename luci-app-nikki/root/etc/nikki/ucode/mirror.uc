import { access, popen, writefile, readfile, rename } from 'fs';
import { shellQuote, run, mirrorGithubUrl } from '/etc/nikki/ucode/include.uc';

let target = getenv('github_mirror');
let file   = getenv('profile_path');

if (!file || length(file) == 0) {
	print('Error: profile_path not set\n');
	exit(1);
};

let json_str = run(`yq -Mo json '${file}'`);
if (!json_str || length(json_str) == 0) {
	print('Error: failed to read ', file, '\n');
	exit(1);
};

let config = json(json_str);
if (!config) {
	print('Error: failed to parse JSON\n');
	exit(1);
};

let exprs = [];
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

if (length(exprs) > 0) {
	let yqExpr = join(' | ', exprs);
	let cmd = `yq -i '${yqExpr}' '${file}'`;
	let rc = run(cmd);
	if (rc == null) {
		print('Error: yq command failed\n');
		exit(1);
	}
};
