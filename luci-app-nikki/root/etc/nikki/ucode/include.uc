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
    /^https?:\/\/ghproxy\.com\/https?:\/\//,
    /^https?:\/\/ghproxy\.com\//,
    /^https?:\/\/mirror\.ghproxy\.com\/https?:\/\//,
    /^https?:\/\/mirror\.ghproxy\.com\//,
    /^https?:\/\/ghps\.cc\/https?:\/\//,
    /^https?:\/\/ghps\.cc\//,
    /^https?:\/\/ghfast\.top\/https?:\/\//,
    /^https?:\/\/ghfast\.top\//,
    /^https?:\/\/gh\.api\.99988866\.xyz\/https?:\/\//,
    /^https?:\/\/gh\.api\.99988866\.xyz\//,
    /^https?:\/\/gh\.con\.sh\/https?:\/\//,
    /^https?:\/\/gh\.con\.sh\//,
    /^https?:\/\/gh\.liuzhijin\.cn\/https?:\/\//,
    /^https?:\/\/gh\.liuzhijin\.cn\//,
    /^https?:\/\/gh\.moeyy\.cn\/https?:\/\//,
    /^https?:\/\/gh\.moeyy\.cn\//,
    /^https?:\/\/gh\.proxy\.liulian\.cn\/https?:\/\//,
    /^https?:\/\/gh\.proxy\.liulian\.cn\//,
    /^https?:\/\/gh\.skactor\.top\/https?:\/\//,
    /^https?:\/\/gh\.skactor\.top\//,
    /^https?:\/\/gh\.tryxd\.cn\/https?:\/\//,
    /^https?:\/\/gh\.tryxd\.cn\//,
    /^https?:\/\/ghproxy\.net\/https?:\/\//,
    /^https?:\/\/ghproxy\.net\//,
    /^https?:\/\/github\.moeyy\.xyz\/https?:\/\//,
    /^https?:\/\/github\.moeyy\.xyz\//,
    /^https?:\/\/hub\.gitmirror\.com\/https?:\/\//,
    /^https?:\/\/hub\.gitmirror\.com\//,
    /^https?:\/\/kkgithub\.com\/https?:\/\//,
    /^https?:\/\/kkgithub\.com\//,
    /^https?:\/\/raw\.ghproxy\.cc\/https?:\/\//,
    /^https?:\/\/raw\.ghproxy\.cc\//,
];

function stripProxyPrefix(url) {
    for (let i = 0; i < length(PROXY_PREFIXES); i++) {
        url = replace(url, PROXY_PREFIXES[i], 'https://');
    }
    return url;
}

const GITHUB_PATTERNS = [
    // raw.githubusercontent.com with refs/heads/branch/path
    /^https:\/\/raw\.githubusercontent\.com\/([^\/]+)\/([^\/]+)\/refs\/heads\/([^\/]+)\/(.+)$/,
    // raw.githubusercontent.com with refs/tags/tag/path
    /^https:\/\/raw\.githubusercontent\.com\/([^\/]+)\/([^\/]+)\/refs\/tags\/([^\/]+)\/(.+)$/,
    // raw.githubusercontent.com /branch_or_tag_or_commit/path
    /^https:\/\/raw\.githubusercontent\.com\/([^\/]+)\/([^\/]+)\/([^\/]+)\/(.+)$/,
    // github.com/.../raw/refs/heads/branch/path
    /^https:\/\/github\.com\/([^\/]+)\/([^\/]+)\/raw\/refs\/heads\/([^\/]+)\/(.+)$/,
    // github.com/.../raw/refs/tags/tag/path
    /^https:\/\/github\.com\/([^\/]+)\/([^\/]+)\/raw\/refs\/tags\/([^\/]+)\/(.+)$/,
    // github.com/.../raw/branch_or_tag/path
    /^https:\/\/github\.com\/([^\/]+)\/([^\/]+)\/raw\/([^\/]+)\/(.+)$/,
    // github.com/.../blob/branch_or_tag/path → 转 raw 路径
    /^https:\/\/github\.com\/([^\/]+)\/([^\/]+)\/blob\/([^\/]+)\/(.+)$/,
    // github.com/.../releases/download/tag/file
    /^https:\/\/github\.com\/([^\/]+)\/([^\/]+)\/releases\/download\/([^\/]+)\/(.+)$/,
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

    if (target === 'ghproxy') {
        return 'https://ghproxy.com/' + url;
    }
    if (target === 'ghfast') {
        return 'https://ghfast.top/' + url;
    }
    if (target === 'gitmirror') {
        return 'https://hub.gitmirror.com/' + url;
    }
    if (target === 'moeyy') {
        return 'https://github.moeyy.xyz/' + url;
    }
    if (target === 'kkgithub') {
        return 'https://kkgithub.com/' + url;
    }
    if (target === 'ghps') {
        return 'https://ghps.cc/' + url;
    }
    if (target === 'ghproxy_net') {
        return 'https://ghproxy.net/' + url;
    }
    if (target === 'ghproxy_cc') {
        return 'https://raw.ghproxy.cc/' + url;
    }
    if (target === 'gh_con_sh') {
        return 'https://gh.con.sh/' + url;
    }
    if (target === 'gh_liuzhijin') {
        return 'https://gh.liuzhijin.cn/' + url;
    }
    if (target === 'gh_moeyy_cn') {
        return 'https://gh.moeyy.cn/' + url;
    }
    if (target === 'gh_skactor') {
        return 'https://gh.skactor.top/' + url;
    }
    if (target === 'gh_tryxd') {
        return 'https://gh.tryxd.cn/' + url;
    }
    if (target === 'gh_api_99988866') {
        return 'https://gh.api.99988866.xyz/' + url;
    }

    return url;
};

/**
print(mirrorGithubUrl(
    'https://gh-proxy.com/https://github.com/hong0980/OpenWrt-Cache/releases/download/Cache/openwrt.tzst',
    'jsdelivr'
), '\n');
→ https://cdn.jsdelivr.net/gh/hong0980/OpenWrt-Cache@Cache/openwrt.tzst

print(mirrorGithubUrl(
    'https://github.com/MetaCubeX/meta-rules-dat/releases/download/latest/country.mmdb',
    'testingcf'
), '\n');
→ https://testingcf.jsdelivr.net/gh/MetaCubeX/meta-rules-dat@latest/country.mmdb

print(mirrorGithubUrl(
    'https://ghfast.top/https://raw.githubusercontent.com/vernesong/OpenClash/refs/heads/master/README.md',
    'fastly'
), '\n');
→ https://fastly.jsdelivr.net/gh/vernesong/OpenClash@master/README.md

print(mirrorGithubUrl(
    'https://github.com/user/repo/blob/main/config.yaml',
    'ghfast'
), '\n');
→ https://ghfast.top/https://github.com/user/repo/blob/main/config.yaml

print(mirrorGithubUrl(
    'https://ghproxy.com/https://github.com/user/repo/raw/main/file.txt',
    'raw'
), '\n');
→ https://github.com/user/repo/raw/main/file.txt
**/
