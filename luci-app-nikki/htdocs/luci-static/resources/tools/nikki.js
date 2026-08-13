'use strict';
'require baseclass';
'require uci';
'require fs';
'require rpc';
'require request';

const callServiceList = rpc.declare({
    object: 'service',
    method: 'list',
    params: ['name'],
    expect: { '': {} },
    filter: (data, { name }, extra) =>
        extra.reduce((res, key) =>
            (res && typeof res === 'object' ? res[key] : null),
            data[name] || null
        )
});

const callRCInit = rpc.declare({
    object: 'rc',
    method: 'init',
    params: ['name', 'action'],
    expect: { '': {} }
});

const callFileWrite = rpc.declare({
    object: 'file',
    method: 'write',
    params: ['path', 'data', 'append', 'mode']
});

const callNikkiVersion = rpc.declare({
    object: 'luci.nikki',
    method: 'version',
    expect: { '': {} }
});

const callNikkiProfile = rpc.declare({
    object: 'luci.nikki',
    method: 'profile',
    params: ['defaults'],
    expect: { '': {} }
});

const callNikkiUpdateSubscription = rpc.declare({
    object: 'luci.nikki',
    method: 'update_subscription',
    params: ['section_id'],
    expect: { '': {} }
});

const callNikkiAPI = rpc.declare({
    object: 'luci.nikki',
    method: 'api',
    params: ['method', 'path', 'query', 'body'],
    expect: { '': {} }
});

const callNikkiGetIdentifiers = rpc.declare({
    object: 'luci.nikki',
    method: 'get_identifiers',
    expect: { '': {} }
});

const callNikkiDebug = rpc.declare({
    object: 'luci.nikki',
    method: 'debug',
    expect: { '': {} }
});

const callUpdateUI = rpc.declare({
    object: 'luci.nikki',
    method: 'update_ui',
    params: ['url', 'name'],
    expect: { '': {} }
});

const callConnStat = rpc.declare({
    object: 'luci.nikki',
    method: 'connection_check',
    params: ['url'],
    expect: { '': {} }
});

const calldownload_file = rpc.declare({
    object: 'luci.nikki',
    method: 'download_file',
    params: ['url', 'path', 'filename', 'chmod', 'ua', 'secret', 'headers', 'task_id'],
    expect: { '': {} }
});

const callGetCoreUrl = rpc.declare({
    object: 'luci.nikki',
    method: 'get_core_url',
    params: ['core_type', 'arch'],
    expect: { '': {} }
});

const callCacheCore = rpc.declare({
    object: 'luci.nikki',
    method: 'cache_core',
    params: ['core_type', 'arch'],
    expect: { '': {} }
});

const callSwitchCore = rpc.declare({
    object: 'luci.nikki',
    method: 'switch_core',
    params: ['core_type', 'arch'],
    expect: { '': {} }
});

const callUciSetCommit = rpc.declare({
    object: 'luci.nikki',
    method: 'set_commit',
    params: ['config', 'section', 'option', 'value'],
    expect: { '': {} }
});

const callCheckDownload = rpc.declare({
    object: 'luci.nikki',
    method: 'check_download',
    params: ['core_type', 'path'],
    expect: { '': {} }
});

const homeDir           = '/etc/nikki';
const profilesDir       = `${homeDir}/profiles`;
const subscriptionsDir  = `${homeDir}/subscriptions`;
const mixinFilePath     = `${homeDir}/mixin.yaml`;
const runDir            = `${homeDir}/run`;
const PROG              = `${runDir}/mihomo`
const runProfilePath    = `${runDir}/config.yaml`;
const providersDir      = `${runDir}/providers`;
const ruleProvidersDir  = `${providersDir}/rule`;
const proxyProvidersDir = `${providersDir}/proxy`;
const logDir            = '/var/log/nikki';
const appLogPath        = `${logDir}/app.log`;
const coreLogPath       = `${logDir}/core.log`;
const debugLogPath      = `${logDir}/debug.log`;
const nftDir            = `${homeDir}/nftables`;
const ui_array          = [
    ["https://github.com/Zephyruso/zashboard/archive/refs/heads/gh-pages-no-fonts.zip", "Zashboard"],
    ["https://github.com/MetaCubeX/metacubexd/archive/refs/heads/gh-pages.zip", "MetaCubeXD"],
    ["https://github.com/MetaCubeX/Yacd-meta/archive/refs/heads/gh-pages.zip", "YACD"],
    ["https://github.com/MetaCubeX/Razord-meta/archive/refs/heads/gh-pages.zip", "Razord"]
];

function waitForDownload(core_type, path, maxRetries) {
    maxRetries = maxRetries || 40;
    return new Promise(function (resolve, reject) {
        let n = 0;
        const check = function () {
            if (++n > maxRetries) {
                reject(new Error(_('Download timeout')));
                return;
            }
            callCheckDownload(core_type, path || '').then(function (r) {
                if (r.status === 'ok') resolve(r);
                else if (r.status === 'error')
                    reject(new Error(r.message || _('Download failed')));
                else
                    setTimeout(check, 3000);
            }).catch(reject);
        };
        check();
    });
}

return baseclass.extend({
    PROG:              PROG,
    runDir:            runDir,
    homeDir:           homeDir,
    ui_array:          ui_array,
    appLogPath:        appLogPath,
    profilesDir:       profilesDir,
    coreLogPath:       coreLogPath,
    debugLogPath:      debugLogPath,
    mixinFilePath:     mixinFilePath,
    runProfilePath:    runProfilePath,
    subscriptionsDir:  subscriptionsDir,
    ruleProvidersDir:  ruleProvidersDir,
    proxyProvidersDir: proxyProvidersDir,

    status: function () {
        return callServiceList('nikki', ['instances', 'nikki', 'running']).then(Boolean);
    },

    mihomoAPI: function (method, path, query, body) {
        return callNikkiAPI(method, path, query || '', body || '');
    },

    service: function (name, command) {
        return callRCInit(name || 'nikki', command);
    },

    uciSetAndCommit(config, section, option, value) {
        return callUciSetCommit(config, section, option, value);
    },

    writefile: function (path, data, mode) {
        data = (data != null) ? String(data) : '';
        mode = (mode != null) ? mode : 0o644;
        const encoder   = new TextEncoder();
        const decoder   = new TextDecoder();
        const chunkSize = 8 * 1024;
        const bytes     = encoder.encode(data);
        if (bytes.length <= chunkSize) {
            return callFileWrite(path, data, false, mode);
        }
        let promise = Promise.resolve();
        for (let offset = 0; offset < bytes.length; offset += chunkSize) {
            const end        = Math.min(offset + chunkSize, bytes.length);
            const chunkBytes = bytes.slice(offset, end);
            const isLast     = end >= bytes.length;
            const chunk      = decoder.decode(chunkBytes, { stream: !isLast });
            const append     = offset > 0;
            promise          = promise.then(() => callFileWrite(path, chunk, append, mode));
        }
        return promise;
    },

    cache_core: function (core_type, arch) {
        return callCacheCore(core_type, arch).then(function (res) {
            if (res.status === 'ok') return;
            if (res.status === 'error')
                throw new Error(res.message || _('Update failed'));
            return waitForDownload(core_type);
        });
    },

    switch_core: function (core_type, arch) {
        const attempt = function () {
            return callSwitchCore(core_type, arch).then(function (res) {
                if (res.status === 'ok') return res;
                if (res.status === 'pending')
                    return waitForDownload(core_type).then(attempt);
                throw new Error(res.message || _('Switch failed'));
            });
        };
        return attempt();
    },

    pollDownload: function (core_type) {
        return this.cache_core(core_type);
    },

    get_core_url: function (core_type, arch) {
        return callGetCoreUrl(core_type, arch);
    },

    download_file: function (opts) {
        if (typeof opts !== 'object') {
            throw new Error('download_file expects an options object');
        }

        const ua       = opts.ua       || '';
        const url      = opts.url      || '';
        const path     = opts.path     || '';
        const secret   = opts.secret   || '';
        const headers  = opts.headers  || '';
        const filename = opts.filename || '';
        let chmod = opts.chmod;
        chmod = (chmod == null || chmod === false || chmod === 0 || chmod === '')
            ? ''
            : (typeof chmod === 'string' ? chmod : '1');

        const task_id = opts.task_id || ('file_' + Date.now());

        const attempt = function () {
            return calldownload_file(url, path, filename, chmod, ua, secret, headers, task_id)
                .then(function (res) {
                    if (res.status === 'ok') return res;
                    if (res.status === 'error')
                        throw new Error(res.message || _('Download failed'));
                    if (res.status === 'pending' && res.task_id)
                        return waitForDownload(res.task_id, path).then(attempt);
                    throw new Error(res.message || _('Download failed'));
                });
        };
        return attempt();
    },

    version: function () {
        return callNikkiVersion();
    },

    profile: function (defaults) {
        return callNikkiProfile(defaults);
    },

    updateSubscription: function (section_id) {
        return callNikkiUpdateSubscription(section_id);
    },

    openDashboard: async function (overrideUiName) {
        const profile = await callNikkiProfile({
            'secret':                  null,
            'external-ui-name':        null,
            'external-controller':     null,
            'external-controller-tls': null
        });

        let uiName         = (overrideUiName ?? profile['external-ui-name'] ?? '').trim();
        const apiSecret    = profile['secret'] ?? '';
        const apiListen    = profile['external-controller'];
        const apiTLSListen = profile['external-controller-tls'];

        if (!apiListen && !apiTLSListen) {
            return Promise.reject('API has not been configured');
        }

        let protocol = 'http', port = '', hash = '';
        const host = window.location.hostname;
        const uiLower = uiName.toLowerCase();

        if (apiTLSListen) {
            protocol = 'https';
            port = apiTLSListen.substring(apiTLSListen.lastIndexOf(':') + 1);
        } else {
            port = apiListen.substring(apiListen.lastIndexOf(':') + 1);
        }

        if (uiLower.includes('metacubexd') || uiLower === 'metacube') {
            hash = '#/setup';
        } else if (uiLower.includes('zashboard')) {
            hash = '#/setup';
        } else if (uiLower.includes('yacd')) {
            hash = '';
        } else if (uiLower.includes('dashboard') || uiLower.includes('razord')) {
            hash = '#/';
        }

        const params  = { hostname: host, host: host, port: port, secret: apiSecret };
        const query   = new URLSearchParams(params).toString();
        const baseUrl = uiName
            ? `${protocol}://${host}:${port}/ui/${uiName}`
            : `${protocol}://${host}:${port}/ui`;

        const finalUrl = hash
            ? `${baseUrl}/${hash}?${query}`
            : `${baseUrl}/?${query}`;

        setTimeout(() => window.open(finalUrl, '_blank'), 0);
        return Promise.resolve();
    },

    getIdentifiers: function () {
        return callNikkiGetIdentifiers();
    },

    listfiles: function (dir) {
        return L.resolveDefault(fs.list(dir), []);
    },

    clearLog: function (path) {
        return this.writefile(path, '');
    },

    debug: function () {
        return callNikkiDebug();
    },

    callConnStat: function (url) {
        return callConnStat(url);
    },

    update_ui: function (url, name) {
        return callUpdateUI(url, name).then(res => {
            if (res.status === 'ok') return res;
            if (res.status === 'error')
                throw new Error(res.message || _('Update UI failed'));
            if (res.status === 'pending' && res.task_id)
                return waitForDownload(res.task_id, res.path);
            throw new Error(res.message || _('Update UI failed'));
        });
    },
});
