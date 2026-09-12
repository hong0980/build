import { readfile, popen, mkstemp } from 'fs';

export function uci_bool(obj) {
	if (obj == '1' || obj == 'true')  return true;
	if (obj == '0' || obj == 'false') return false;
	return obj;
};

export function uci_int(obj) {
	return obj == null ? null : int(obj);
};

export function uci_array(obj) {
	if (obj == null) return [];
	if (type(obj) == 'array') return uniq(obj);
	return [obj];
};

export function trim_all(obj) {
	if (obj == null) return null;
	let t = type(obj);
	if (t == 'string' || t == 'array')
		return length(obj) == 0 ? null : obj;
	if (t != 'object') return obj;
	for (let key in obj) {
		obj[key] = trim_all(obj[key]);
		if (obj[key] == null) delete obj[key];
	}
	return length(keys(obj)) == 0 ? null : obj;
};

export function isBinary(str) {
	for (let off = 0, byte = ord(str); off < length(str); byte = ord(str, ++off))
		if (byte <= 8 || (byte >= 14 && byte <= 31))
			return true;

	return false;
};

export function shellQuote(s) {
	return `'${replace(s, "'", "'\\''")}'`;
};

export function executeCommand(infd, ...args) {
	let outfd = mkstemp();
	let errfd = mkstemp();

	if (infd)
		push(args, `<&${infd.fileno()}`);

	const exitcode = system(`${join(' ', args)} >&${outfd.fileno()} 2>&${errfd.fileno()}`);

	outfd.seek();
	errfd.seek();

	const stdout = outfd.read(1024 * 1024) ?? '';
	const stderr = errfd.read(1024 * 1024) ?? '';

	outfd.close();
	errfd.close();

	const binary = isBinary(stdout);

	return {
		command: join(' ', args),
		stdout: binary ? null : stdout,
		stderr,
		exitcode,
		binary
	};
};

export function yqRead(flags, command, content) {
	let infd = mkstemp();

	if (content) {
		content = trim(content);
		content = replace(content, /\r\n?/g, '\n');
		if (!match(content, /\n$/))
			content += '\n';
	}
	infd.write(content);

	infd.seek();
	const out = executeCommand(infd, 'yq', flags, shellQuote(command));
	infd.close();

	return out.stdout;
};

export function yqReadFile(flags, command, filepath) {
	const out = executeCommand(null, 'yq', flags, shellQuote(command), shellQuote(filepath));

	return out.stdout;
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

export function run(cmd) {
	const p = popen(cmd);
	if (!p) return null;
	const out = trim(p.read('all'));
	p.close();
	return out;
};

export function get_cgroups() {
	const result = [];
	if (get_cgroups_version() == 2) {
		const cgroup_path = '/sys/fs/cgroup/';
		const out = run(`find ${cgroup_path} -type d -mindepth 2 -maxdepth 2`);

		if (out) {
			const lines = split(out, '\n');
			for (let i = 0; i < length(lines); i++) {
				const line = trim(lines[i]);
				if (length(line))
					push(result, substr(line, length(cgroup_path)));
			}
		}
	}
	return result;
};

export function load_profile(o) {
	let out = yqReadFile('-o json', '.', o || '/etc/nikki/run/config.yaml');
	return out ? json(out) : {};
};

export function qs(v) {
	return v ? '"' + replace(replace(v, /\\/g, '\\\\'), /"/g, '\\"') + '"' : '""';
};

function stripProxyPrefix(url) {
	let m = match(url, /^https?:\/\/[^\/]+(\/[^\/]+)?\/(https?:\/\/.+)$/);
	while (m) {
		url = m[2];
		m = match(url, /^https?:\/\/[^\/]+(\/[^\/]+)?\/(https?:\/\/.+)$/);
	}
	return url;
};

function restoreFromJsdelivr(url) {
	let m = match(url, /^https:\/\/(cdn|fastly|testingcf|gcore)\.jsdelivr\.net\/gh\/([^\/]+)\/([^\/]+)@([^\/]+)\/(.+)$/);
	if (m) return `https://raw.githubusercontent.com/${m[2]}/${m[3]}/${m[4]}/${m[5]}`;
	return url;
};

const GITHUB_PATTERNS = [
	/^https:\/\/github\.com\/([^\/]+)\/([^\/]+)\/raw\/([^\/]+)\/(.+)$/,
	/^https:\/\/github\.com\/([^\/]+)\/([^\/]+)\/blob\/([^\/]+)\/(.+)$/,
	/^https:\/\/github\.com\/([^\/]+)\/([^\/]+)\/raw\/refs\/tags\/([^\/]+)\/(.+)$/,
	/^https:\/\/github\.com\/([^\/]+)\/([^\/]+)\/raw\/refs\/heads\/([^\/]+)\/(.+)$/,
	/^https:\/\/raw\.githubusercontent\.com\/([^\/]+)\/([^\/]+)\/([^\/]+)\/(.+)$/,
	/^https:\/\/raw\.githubusercontent\.com\/([^\/]+)\/([^\/]+)\/refs\/tags\/([^\/]+)\/(.+)$/,
	/^https:\/\/raw\.githubusercontent\.com\/([^\/]+)\/([^\/]+)\/refs\/heads\/([^\/]+)\/(.+)$/,
];

function toJsdelivr(m, domain) {
	domain = domain || 'cdn.jsdelivr.net';
	return `https://${domain}/gh/${m[1]}/${m[2]}@${m[3]}/${m[4]}`;
};

function convertToJsdelivr(url, domain) {
	for (let i = 0; i < length(GITHUB_PATTERNS); i++) {
		let m = match(url, GITHUB_PATTERNS[i]);
		if (m) return toJsdelivr(m, domain);
	}
	return url;
};

export function mirrorGithubUrl(url, target) {
	if (!url)    return url;
	if (!target) return url;

	url = stripProxyPrefix(url);
	url = restoreFromJsdelivr(url);

	if (target && match(target, /^https?:\/\//)) {
		if (!match(target, /\/$/)) target = target + '/';
		return target + url;
	};
	if (target === 'raw' || target === 'github')   return url;
	if (target === 'jsdelivr' || target === 'cdn') return convertToJsdelivr(url);
	if (target === 'fastly')    return convertToJsdelivr(url, 'fastly.jsdelivr.net');
	if (target === 'testingcf') return convertToJsdelivr(url, 'testingcf.jsdelivr.net');
	if (target === 'gcore')     return convertToJsdelivr(url, 'gcore.jsdelivr.net');

	return url;
};
