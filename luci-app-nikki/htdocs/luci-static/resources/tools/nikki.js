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

const callListGithub = rpc.declare({
    object: 'luci.nikki',
    method: 'list_github',
    params: ['repo', 'path', 'branch', 'refresh'],
    expect: { '': {} }
});

const callTestMirror = rpc.declare({
    object: 'luci.nikki',
    method: 'test_mirror',
    params: ['url', 'target'],
    expect: { '': {} }
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

const callNikkiAPI = rpc.declare({
    object: 'luci.nikki',
    method: 'api',
    params: ['method', 'path', 'query', 'body'],
    expect: { '': {} }
});

const getIdentifiers = rpc.declare({
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

function callConnStat(url) {
    const callConnStat = rpc.declare({
        object: 'luci.nikki',
        method: 'connection_check',
        params: ['url'],
        expect: { '': {} }
    });
    return callConnStat(url);
};

function updateSubscription(section_id) {
    const callNikkiUpdateSubscription = rpc.declare({
        object: 'luci.nikki',
        method: 'update_subscription',
        params: ['section_id'],
        expect: { '': {} }
    });
    return callNikkiUpdateSubscription(section_id);
};

function writefile(path, data, mode) {
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
};

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
    TEMP_DIR:          '/var/run/nikki',
    profilesDir:       '/etc/nikki/profiles',
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

    cache_core: function (core_type, arch, onProgress) {
        return callCacheCore(core_type, arch).then(function (res) {
            if (res.status === 'ok') return;
            if (res.status === 'error')
                throw new Error(res.message || _('Update failed'));
            return waitForTask(core_type, null, onProgress, 200);
        });
    },

    switch_core: function (core_type, arch, onProgress) {
        const attempt = function () {
            return callSwitchCore(core_type, arch).then(function (res) {
                if (res.status === 'ok') return res;
                if (res.status === 'pending')
                    return waitForTask(core_type, null, onProgress, 200).then(attempt);
                throw new Error(res.message || _('Switch failed'));
            });
        };
        return attempt();
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
                        return waitForTask(res.task_id, path, onProgress, 200);
                    throw new Error(res.message || _('Download failed'));
                });
        };
        return attempt();
    },

    openDashboard: function (overrideUiName) {
        return callNikkiProfile({
            'secret':                  null,
            'external-ui-name':        null,
            'external-controller':     null,
            'external-controller-tls': null
        }).then(profile => {
            const uiName = overrideUiName ?? profile['external-ui-name'] ?? '';
            const secret = profile['secret'] ?? '';
            const https    = profile['external-controller-tls'];
            const endpoint = https ?? profile['external-controller'];
            if (!endpoint && !uiName)
                throw new Error('API has not been configured');

            const port = endpoint.slice(endpoint.lastIndexOf(':') + 1);
            const host = window.location.hostname;
            const { hash = '', hostKey = 'host' } = ({
                'Razord':     { hash: '#/',      hostKey: 'host' },
                'YACD':       { hash: '',        hostKey: 'hostname' },
                'Zashboard':  { hash: '#/setup', hostKey: 'hostname' },
                'MetaCubeXD': { hash: '#/setup', hostKey: 'hostname' },
            })[uiName] ?? {};

            const query = new URLSearchParams({ [hostKey]: host, port, secret });
            const url = `${https ? 'https' : 'http'}://${host}:${port}/ui${uiName ? `/${uiName}` : ''}/${hash}?${query}`;

            window.open(url, '_blank');
        });
    },

    listfiles: function (dir) {
        return L.resolveDefault(fs.list(dir), []).then(files => {
            return files.map(f => Object.assign({}, f, {
                path: `${dir}/${f.name}`
            }));
        });
    },

    update_ui: function (url, name, onProgress) {
        return callUpdateUI(url, name).then(res => {
            if (res.status === 'ok') return res;
            if (res.status === 'error')
                throw new Error(res.message || _('Update UI failed'));
            if (res.status === 'pending' && res.task_id)
                return waitForTask(res.task_id, res.path, onProgress, 120);
            throw new Error(res.message || _('Update UI failed'));
        });
    },

    preloadAce: function () {
        if (window.ace?.edit) return Promise.resolve(true);
        if (window._acePromise) return window._acePromise;
        return window._acePromise = new Promise((resolve, reject) => {
            const script = E('script', { src: '/luci-static/resources/view/ace/ace.js' });
            script.onload = () => {
                ace.config.set('basePath', '/luci-static/resources/ace');
                resolve(true);
            };
            script.onerror = () => {
                window._acePromise = null;
                reject(new Error('Failed to load ace'));
            };
            document.head.appendChild(script);
        })
    },

    initAceEditor: function (container, content, mode, options) {
        const aceMode = mode ? `ace/mode/${mode}` : 'ace/mode/text';
        return this.preloadAce().then(() => {
            const editor = ace.edit(container);
            container._aceEditor = editor;
            editor.setOptions({
                wrap: true,
                fontSize: '14px',
                printMarginColumn: -1,
                mode: aceMode,
                fontFamily: 'Consolas',
                theme: 'ace/theme/monokai',
                ...options
            });
            editor.setValue(content || '', -1);
            return editor;
        });
    },

    modalnotify: function(title, children, timeout, ...classes) {
        // info/success/warning/danger/error
        if (typeof timeout !== 'number') {
            if (timeout != null)
                classes.unshift(timeout);
            timeout = null;
        };

        function fadeOut(element) {
            element?.classList.replace('fade-in', 'fade-out');
            setTimeout(() => element?.remove());
        };

        const modalContainer = document.querySelector('#modal_overlay .modal');
        if (!modalContainer) return;
        const msg = E('div', {
            'class': 'alert-message fade-in',
            'style': 'display:flex; margin: 10px 0;',
            transitionend: function (ev) {
                const node = ev.currentTarget;
                if (node.parentNode && node.classList.contains('fade-out')) {
                    node.parentNode.removeChild(node);
                };
            }
        }, [
            E('div', { 'style': 'flex:10' }),
            E('div', { 'style': 'flex:1 1 auto; display:flex' }, [
                E('button', {
                    'class': 'btn', 'style': 'margin-left:auto; margin-top:auto',
                    'click': () => fadeOut(msg)
                }, _('Dismiss'))
            ])
        ]);

        if (title != null)
            L.dom.append(msg.firstElementChild, E('h4', {}, title));

        L.dom.append(msg.firstElementChild, children);
        msg.classList.add(...classes);
        modalContainer.insertBefore(msg, modalContainer.firstChild);
        if (typeof timeout === 'number' && timeout > 0) {
            setTimeout(() => fadeOut(msg), timeout);
        };
        return msg;
    },

    showNotification: function (message, timeout = 3000, type = 'info') {
        if (!this._queue) this._queue = [];
        const queue = this._queue;

        const existing = document.querySelector('.alert-message[data-corner-notify]');
        if (existing && existing.textContent === message) {
            clearTimeout(existing._timer);
            existing._timer = setTimeout(() => existing.remove(), timeout);
            return;
        }

        const n = E('div', {
            'class': 'alert-message %s'.format(type),
            'data-corner-notify': '',
            'style': 'position:fixed;top:%dpx;right:20px;z-index:20000;border:none;box-shadow:0 4px 12px rgba(0,0,0,.25);'
                .format(20 + queue.length * 70)
        }, message);

        const remove = () => {
            if (!n.parentNode) return;
            clearTimeout(n._timer);
            n.remove();
            const i = queue.indexOf(n);
            if (i > -1) queue.splice(i, 1);
            queue.forEach((el, j) => {
                el.style.top = '%dpx'.format(20 + j * 70);
            });
        };

        n.addEventListener('click', remove);
        document.body.appendChild(n);
        queue.push(n);

        const duration = (typeof timeout === 'number' && timeout > 0) ? timeout : 3000;
        n._timer = setTimeout(remove, duration);
    },

    debug: () => callNikkiDebug(),
    clearLog: (path) => writefile(path, ''),
    status: (name) => callServiceStatus(name),
    get_core_version: (mode) => callversion(mode),
    service: (name, command) => callRCInit(name || 'nikki', command),
    mihomoAPI: (method, path, query, body) =>callNikkiAPI(method, path, query || '', body || ''),
    uciCommit: (config, section, option, value) => calluciCommit(config, section, option, value),
    get_core_url: (core_type, arch) => callGetCoreUrl(core_type, arch),
    profile: (defaults) => callNikkiProfile(defaults),
    version: () => callNikkiVersion(),

    callConnStat,
    getIdentifiers,
    callListGithub,
    callTestMirror,
    updateSubscription,
    writefile,

});
