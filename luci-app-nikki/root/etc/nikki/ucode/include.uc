import { readfile, popen } from 'fs';

export function uci_bool(obj) {
	return obj == null ? null : obj == '1' || obj == 'true' || obj == 'yes';
};

export function uci_int(obj) {
	return obj == null ? null : int(obj);
};

export function uci_array(obj) {
	if (obj == null) {
		return [];
	}
	if (type(obj) == 'array') {
		return uniq(obj);
	}
	return [obj];
};

export function trim_all(obj) {
	if (obj == null) {
		return null;
	}
	if (type(obj) == 'string') {
		if (length(obj) == 0) {
			return null;
		}
		return obj;
	}
	if (type(obj) == 'array') {
		if (length(obj) == 0) {
			return null;
		}
		return obj;
	}
	if (type(obj) == 'object') {
		const obj_keys = keys(obj);
		for (let key in obj_keys) {
			obj[key] = trim_all(obj[key]);
			if (obj[key] == null) {
				delete obj[key];
			}
		}
		if (length(keys(obj)) == 0) {
			return null;
		}
		return obj;
	}
	return obj;
};

export function get_cgroups_version() {
	return system('mount | grep -q -w "^cgroup"') == 0 ? 1 : 2;
};

export function get_users() {
	return map(split(readfile('/etc/passwd'), '\n'), (x) => split(x, ':')[0]);
};

export function get_groups() {
	return map(split(readfile('/etc/group'), '\n'), (x) => split(x, ':')[0]);
};

export function get_cgroups() {
	const result = [];
	if (get_cgroups_version() == 2) {
		const cgroup_path = '/sys/fs/cgroup/';
		const process = popen(`find ${cgroup_path} -type d -mindepth 2 -maxdepth 2`);
		if (process) {
			for (let line = process.read('line'); length(line); line = process.read('line')) {
				push(result, substr(trim(line), length(cgroup_path)));
			}
			process.close();
		}
	}
	return result;
};

export function load_profile() {
	let result = {};
	const process = popen('yq -Mpy -o json /etc/nikki/run/config.yaml');
	if (process) {
		result = json(process);
		process.close();
	}
	return result;
};

export function run(cmd) {
	const p = popen(cmd);
	if (!p) return null;
	const out = trim(p.read('all'));
	p.close();
	return out;
};

export function shellQuote(s) {
	return `'${replace(s, "'", "'\\''")}'`;
};

const PROXY_PREFIXES = [
	/^https?:\/\/gh-proxy\.com\/https?:\/\//,
	/^https?:\/\/gh-proxy\.com\//,
	/^https?:\/\/gh-proxy\.org\/https?:\/\//,
	/^https?:\/\/gh-proxy\.org\//,
	/^https?:\/\/ghproxy\.net\/https?:\/\//,
	/^https?:\/\/ghproxy\.net\//,

	/^https?:\/\/gh\.zwy\.one\/https?:\/\//,
	/^https?:\/\/gh\.zwy\.one\//,
	/^https?:\/\/gh\.xxooo\.cf\/https?:\/\//,
	/^https?:\/\/gh\.xxooo\.cf\//,
	/^https?:\/\/git\.yylx\.win\/https?:\/\//,
	/^https?:\/\/git\.yylx\.win\//,
	/^https?:\/\/gh\.monlor\.com\/https?:\/\//,
	/^https?:\/\/gh\.monlor\.com\//,
	/^https?:\/\/cdn\.akaere\.online\/https?:\/\//,
	/^https?:\/\/cdn\.akaere\.online\//,
	/^https?:\/\/gh\.jasonzeng\.dev\/https?:\/\//,
	/^https?:\/\/gh\.jasonzeng\.dev\//,
	/^https?:\/\/ghproxy\.monkeyray\.net\/https?:\/\//,
	/^https?:\/\/ghproxy\.monkeyray\.net\//,
	/^https?:\/\/down\.mxw\.xx\.kg\/https?:\/\//,
	/^https?:\/\/down\.mxw\.xx\.kg\//,
	/^https?:\/\/github\.tbap\.top\/https?:\/\//,
	/^https?:\/\/github\.tbap\.top\//,
	/^https?:\/\/ghm\.078465\.xyz\/https?:\/\//,
	/^https?:\/\/ghm\.078465\.xyz\//,
	/^https?:\/\/ghfile\.geekertao\.top\/https?:\/\//,
	/^https?:\/\/ghfile\.geekertao\.top\//,
	/^https?:\/\/ghproxy\.cxkpro\.top\/https?:\/\//,
	/^https?:\/\/ghproxy\.cxkpro\.top\//,
	/^https?:\/\/cdn\.crashmc\.com\/https?:\/\//,
	/^https?:\/\/cdn\.crashmc\.com\//,
	/^https?:\/\/cors\.isteed\.cc\/https?:\/\//,
	/^https?:\/\/cors\.isteed\.cc\//,
	/^https?:\/\/fastgit\.cc\/https?:\/\//,
	/^https?:\/\/fastgit\.cc\//,
	/^https?:\/\/gh\.con\.sh\/https?:\/\//,
	/^https?:\/\/gh\.con\.sh\//,
	/^https?:\/\/gh\.tryxd\.cn\/https?:\/\//,
	/^https?:\/\/gh\.tryxd\.cn\//,
];

function stripProxyPrefix(url) {
	for (let i = 0; i < length(PROXY_PREFIXES); i++) {
		let newUrl = replace(url, PROXY_PREFIXES[i], 'https://');
		if (newUrl != url) {
			url = newUrl;
		}
	}
	return url;
}

function restoreFromJsdelivr(url) {
	let m = match(url, /^https:\/\/(cdn|fastly|testingcf|gcore)\.jsdelivr\.net\/gh\/([^\/]+)\/([^\/]+)@([^\/]+)\/(.+)$/);
	if (m) {
		return 'https://raw.githubusercontent.com/' + m[2] + '/' + m[3] + '/' + m[4] + '/' + m[5];
	}
	return url;
}

const GITHUB_PATTERNS = [
	/^https:\/\/raw\.githubusercontent\.com\/([^\/]+)\/([^\/]+)\/refs\/heads\/([^\/]+)\/(.+)$/,
	/^https:\/\/raw\.githubusercontent\.com\/([^\/]+)\/([^\/]+)\/refs\/tags\/([^\/]+)\/(.+)$/,
	/^https:\/\/raw\.githubusercontent\.com\/([^\/]+)\/([^\/]+)\/([^\/]+)\/(.+)$/,
	/^https:\/\/github\.com\/([^\/]+)\/([^\/]+)\/raw\/refs\/heads\/([^\/]+)\/(.+)$/,
	/^https:\/\/github\.com\/([^\/]+)\/([^\/]+)\/raw\/refs\/tags\/([^\/]+)\/(.+)$/,
	/^https:\/\/github\.com\/([^\/]+)\/([^\/]+)\/raw\/([^\/]+)\/(.+)$/,
	/^https:\/\/github\.com\/([^\/]+)\/([^\/]+)\/blob\/([^\/]+)\/(.+)$/,
];

function toJsdelivr(m, domain) {
	domain = domain || 'cdn.jsdelivr.net';
	return 'https://' + domain + '/gh/' + m[1] + '/' + m[2] + '@' + m[3] + '/' + m[4];
}

function convertToJsdelivr(url, domain) {
	for (let i = 0; i < length(GITHUB_PATTERNS); i++) {
		let m = match(url, GITHUB_PATTERNS[i]);
		if (m) return toJsdelivr(m, domain);
	}
	return url;
}

export function mirrorGithubUrl(url, target) {
	if (!url) return url;

	url = stripProxyPrefix(url);
	url = restoreFromJsdelivr(url);

	if (!target || target === 'raw' || target === 'github') {
		return url;
	}
	if (target === 'jsdelivr' || target === 'cdn') {
		return convertToJsdelivr(url);
	}
	if (target === 'fastly') {
		return convertToJsdelivr(url, 'fastly.jsdelivr.net');
	}
	if (target === 'testingcf') {
		return convertToJsdelivr(url, 'testingcf.jsdelivr.net');
	}
	if (target === 'gcore') {
		return convertToJsdelivr(url, 'gcore.jsdelivr.net');
	}

	if (target === 'gh_proxy_org')      return 'https://gh-proxy.org/' + url;
	if (target === 'ghproxy_net')       return 'https://ghproxy.net/' + url;
	if (target === 'gh_zwy')            return 'https://gh.zwy.one/' + url;
	if (target === 'gh_xxooo')          return 'https://gh.xxooo.cf/' + url;
	if (target === 'git_yylx')          return 'https://git.yylx.win/' + url;
	if (target === 'gh_monlor')         return 'https://gh.monlor.com/' + url;
	if (target === 'cdn_akaere')        return 'https://cdn.akaere.online/' + url;
	if (target === 'gh_jasonzeng')      return 'https://gh.jasonzeng.dev/' + url;
	if (target === 'ghproxy_monkeyray') return 'https://ghproxy.monkeyray.net/' + url;
	if (target === 'down_mxw')          return 'https://down.mxw.xx.kg/' + url;
	if (target === 'github_tbap')       return 'https://github.tbap.top/' + url;
	if (target === 'ghm_078465')        return 'https://ghm.078465.xyz/' + url;
	if (target === 'ghfile_geekertao')  return 'https://ghfile.geekertao.top/' + url;
	if (target === 'ghproxy_cxkpro')    return 'https://ghproxy.cxkpro.top/' + url;
	if (target === 'cdn_crashmc')       return 'https://cdn.crashmc.com/' + url;
	if (target === 'cors_isteed')       return 'https://cors.isteed.cc/' + url;
	if (target === 'fastgit')           return 'https://fastgit.cc/' + url;
	if (target === 'gh_con_sh')         return 'https://gh.con.sh/' + url;
	if (target === 'gh_tryxd')          return 'https://gh.tryxd.cn/' + url;

	return url;
}
