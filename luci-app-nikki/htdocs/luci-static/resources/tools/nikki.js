'use strict';
'require baseclass';
'require fs';
'require rpc';

const callServiceStatus = rpc.declare({
    object: 'service',
    method: 'list',
    params: ['name'],
    filter: function (data) {
        for (var svcName in data) {
            var svc = data[svcName];
            if (!svc || !svc.instances) continue;
            for (var instName in svc.instances) {
                return !!svc.instances[instName].running;
            }
        }
        return false;
    }
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
    params: ['url', 'path', 'filename', 'task_id'],
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

const calluciCommit = rpc.declare({
    object: 'luci.nikki',
    method: 'set_commit',
    params: ['config', 'section', 'option', 'value'],
    expect: { '': {} }
});

const callCheckDownload = rpc.declare({
    object: 'luci.nikki',
    method: 'check_download',
    params: ['task_id', 'path'],
    expect: { '': {} }
});

const callversion = rpc.declare({
    object: 'luci.nikki',
    method: 'core_version',
    params: ['mode'],
    expect: { '': {} }
});

function waitForTask(task_id, path, onProgress, maxRetries) {
    maxRetries = maxRetries || 80;
    return new Promise(function (resolve, reject) {
        let n = 0;
        const check = function () {
            if (++n > maxRetries) {
                reject(new Error(_('Download timeout')));
                return;
            }
            callCheckDownload(task_id, path || '').then(function (r) {
                if (r.status === 'ok') {
                    if (onProgress) onProgress(100);
                    resolve(r);
                } else if (r.status === 'error') {
                    reject(new Error(r.message || _('Download failed')));
                } else {
                    if (onProgress && r.progress != null)
                        onProgress(r.progress);
                    setTimeout(check, 1500);
                }
            }).catch(reject);
        };
        check();
    });
};

return baseclass.extend({
    homeDir:           '/etc/nikki',
    profilesDir:       '/etc/nikki/profiles',
    mixinFilePath:     '/etc/nikki/mixin.yaml',
    subscriptionsDir:  '/etc/nikki/subscriptions',
    runDir:            '/etc/nikki/run',
    PROG:              '/etc/nikki/run/mihomo',
    runProfilePath:    '/etc/nikki/run/config.yaml',
    providersDir:      '/etc/nikki/run/providers',
    ruleProvidersDir:  '/etc/nikki/run/providers/rule',
    proxyProvidersDir: '/etc/nikki/run/providers/proxy',
    logDir:            '/var/log/nikki',
    appLogPath:        '/var/log/nikki/app.log',
    coreLogPath:       '/var/log/nikki/core.log',
    debugLogPath:      '/var/log/nikki/debug.log',
    nftDir:            '/etc/nikki/nftables',
    ui_array:          [
        ["https://github.com/Zephyruso/zashboard/archive/refs/heads/gh-pages-no-fonts.zip", "Zashboard"],
        ["https://github.com/MetaCubeX/metacubexd/archive/refs/heads/gh-pages.zip", "MetaCubeXD"],
        ["https://github.com/MetaCubeX/Yacd-meta/archive/refs/heads/gh-pages.zip", "YACD"],
        ["https://github.com/MetaCubeX/Razord-meta/archive/refs/heads/gh-pages.zip", "Razord"]
    ],

    get_core_version: function (mode) {
        return callversion(mode);
    },

    status: function (name) {
        return callServiceStatus(name);
    },

    mihomoAPI: function (method, path, query, body) {
        return callNikkiAPI(method, path, query || '', body || '');
    },

    service: function (name, command) {
        return callRCInit(name || 'nikki', command);
    },

    uciCommit: function (config, section, option, value) {
        return calluciCommit(config, section, option, value);
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

    cache_core: function (core_type, arch, onProgress) {
        return callCacheCore(core_type, arch).then(function (res) {
            if (res.status === 'ok') return;
            if (res.status === 'error')
                throw new Error(res.message || _('Update failed'));
            return waitForTask(core_type, null, onProgress, 120);
        });
    },

    switch_core: function (core_type, arch, onProgress) {
        const attempt = function () {
            return callSwitchCore(core_type, arch).then(function (res) {
                if (res.status === 'ok') return res;
                if (res.status === 'pending')
                    return waitForTask(core_type, null, onProgress, 120).then(attempt);
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

        const url         = opts.url         || '';
        const path        = opts.path        || '';
        const filename    = opts.filename    || '';
        const task_id     = opts.task_id     || ('file_' + Date.now());
        const onProgress  = opts.onProgress;

        const attempt = function () {
            return calldownload_file(url, path, filename, task_id)
                .then(function (res) {
                    if (res.status === 'ok') return res;
                    if (res.status === 'error')
                        throw new Error(res.message || _('Download failed'));
                    if (res.status === 'pending' && res.task_id)
                        return waitForTask(res.task_id, path, onProgress);
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

        const uiName = overrideUiName ?? profile['external-ui-name'] ?? '';
        const secret = profile['secret'] ?? '';
        const http   = profile['external-controller'];
        const https  = profile['external-controller-tls'];

        if (!http && !https)
            return Promise.reject('API has not been configured');

        const protocol =  https ? 'https' : 'http';
        const endpoint =  https ?? http;
        const port     =  endpoint.substring(endpoint.lastIndexOf(':') + 1);
        const host     =  window.location.hostname;
        const uiMap    =  {
            'Razord':     { hash: '#/',      hostKey: 'host' },
            'YACD':       { hash: '',        hostKey: 'hostname' },
            'Zashboard':  { hash: '#/setup', hostKey: 'hostname' },
            'MetaCubeXD': { hash: '#/setup', hostKey: 'hostname' },
        };
        const cfg      = uiMap[uiName] ?? { hash: '', hostKey: 'host' };
        const query    = new URLSearchParams({ [cfg.hostKey]: host, port, secret }).toString();
        const base     = `${protocol}://${host}:${port}/ui${uiName ? '/' + uiName : ''}/`;
        const finalUrl = cfg.hash ? `${base}${cfg.hash}?${query}` : `${base}?${query}`;

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

    update_ui: function (url, name, onProgress) {
        return callUpdateUI(url, name).then(res => {
            if (res.status === 'ok') return res;
            if (res.status === 'error')
                throw new Error(res.message || _('Update UI failed'));
            if (res.status === 'pending' && res.task_id)
                return waitForTask(res.task_id, res.path, onProgress);
            throw new Error(res.message || _('Update UI failed'));
        });
    },

    preloadAce: function () {
        if (window.ace?.edit) return Promise.resolve(true);
        if (window._acePromise) return window._acePromise;
        return window._acePromise = new Promise((resolve, reject) => {
            const script = E('script', { src: '/luci-static/resources/view/nikki/ace/ace.js' });
            script.onload = () => {
                ace.config.set('basePath', '/luci-static/resources/view/nikki/ace');
                resolve(true);
            };
            script.onerror = () => {
                window._acePromise = null;
                reject(new Error('Failed to load ace'));
            };
            document.head.appendChild(script);
        })
    }
});
