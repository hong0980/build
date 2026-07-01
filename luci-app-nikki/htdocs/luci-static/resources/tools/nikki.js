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

const update_ui = rpc.declare({
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

const homeDir = '/etc/nikki';
const profilesDir = `${homeDir}/profiles`;
const subscriptionsDir = `${homeDir}/subscriptions`;
const mixinFilePath = `${homeDir}/mixin.yaml`;
const runDir = `${homeDir}/run`;
const runProfilePath = `${runDir}/config.yaml`;
const providersDir = `${runDir}/providers`;
const ruleProvidersDir = `${providersDir}/rule`;
const proxyProvidersDir = `${providersDir}/proxy`;
const logDir = `/var/log/nikki`;
const appLogPath = `${logDir}/app.log`;
const coreLogPath = `${logDir}/core.log`;
const debugLogPath = `${logDir}/debug.log`;
const nftDir = `${homeDir}/nftables`;
const ui_array = [
    ["https://github.com/Zephyruso/zashboard/releases/latest/download/dist-cdn-fonts.zip", "Zashboard"],
    ["https://github.com/MetaCubeX/metacubexd/archive/refs/heads/gh-pages.zip", "MetaCubeXD"],
    ["https://github.com/MetaCubeX/Yacd-meta/archive/refs/heads/gh-pages.zip", "YACD"],
    ["https://github.com/MetaCubeX/Razord-meta/archive/refs/heads/gh-pages.zip", "Razord"]
];

return baseclass.extend({
    homeDir: homeDir,
    profilesDir: profilesDir,
    subscriptionsDir: subscriptionsDir,
    mixinFilePath: mixinFilePath,
    runDir: runDir,
    runProfilePath: runProfilePath,
    ruleProvidersDir: ruleProvidersDir,
    proxyProvidersDir: proxyProvidersDir,
    appLogPath: appLogPath,
    coreLogPath: coreLogPath,
    debugLogPath: debugLogPath,
    ui_array: ui_array,

    status: function () {
        return callServiceList('nikki', ['instances', 'nikki', 'running']).then(Boolean);
    },

    service: function (command) {
        return callRCInit('nikki', command);
    },

    writefile: function (path, data, mode) {
        data = (data != null) ? String(data) : '';
        mode = (mode != null) ? mode : 0o644;

        const encoder = new TextEncoder();
        const decoder = new TextDecoder();
        const chunkSize = 8 * 1024;

        const bytes = encoder.encode(data);

        if (bytes.length <= chunkSize) {
            return callFileWrite(path, data, false, mode);
        }

        let promise = Promise.resolve();
        for (let offset = 0; offset < bytes.length; offset += chunkSize) {
            const chunkBytes = bytes.slice(offset, Math.min(offset + chunkSize, bytes.length));
            const chunk = decoder.decode(chunkBytes);
            const append = offset > 0;
            promise = promise.then(() => callFileWrite(path, chunk, append, mode));
        }

        return promise;
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

    updateDashboard: function () {
        return callNikkiAPI('POST', '/upgrade/ui');
    },

    openDashboard: async function (overrideUiName) {
        const profile = await callNikkiProfile({
            'external-ui-name': null,
            'external-controller': null,
            'external-controller-tls': null,
            'secret': null
        });

        let uiName = (overrideUiName ?? profile['external-ui-name'] ?? '').trim();
        const apiListen = profile['external-controller'];
        const apiTLSListen = profile['external-controller-tls'];
        const apiSecret = profile['secret'] ?? '';

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

        const params = { hostname: host, host: host, port: port, secret: apiSecret };
        const query = new URLSearchParams(params).toString();
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
        return update_ui(url, name);
    },
})
