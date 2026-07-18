import { readfile, popen } from 'fs';

export function uci_bool(obj) {
	return obj == null ? null : obj == '1';
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

const GITHUB_URL_PATTERNS = [
    /^https:\/\/raw\.githubusercontent\.com\/([^\/]+)\/([^\/]+)\/refs\/heads\/([^\/]+)\/(.+)$/,
    /^https:\/\/raw\.githubusercontent\.com\/([^\/]+)\/([^\/]+)\/([^\/]+)\/(.+)$/,
    /^https:\/\/github\.com\/([^\/]+)\/([^\/]+)\/raw\/refs\/heads\/([^\/]+)\/(.+)$/,
    /^https:\/\/github\.com\/([^\/]+)\/([^\/]+)\/raw\/([^\/]+)\/(.+)$/,
];

export function mirrorGithubUrl(url) {
    if (!url) return url;

    url = replace(url, /^https:\/\/gh-proxy\.com\//, '');

    for (let i = 0; i < length(GITHUB_URL_PATTERNS); i++) {
        let m = match(url, GITHUB_URL_PATTERNS[i]);
        if (m) return `https://testingcf.jsdelivr.net/gh/${m[1]}/${m[2]}@${m[3]}/${m[4]}`;
    }

    return url;
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
		const process = popen(`find ${cgroup_path} -type d -mindepth 1`);
		if (process) {
			for (let line = process.read('line'); length(line); line = process.read('line')) {
				push(result, substr(trim(line), length(cgroup_path)));
			}
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
