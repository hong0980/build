'use strict';
'require fs';
'require ui';
'require poll';
'require view';

return view.extend({
    render: function () {
        const ipCache = {}, ipFailCount = {};
        const months = {
            Jan: '01', Feb: '02', Mar: '03', Apr: '04', May: '05', Jun: '06',
            Jul: '07', Aug: '08', Sep: '09', Oct: '10', Nov: '11', Dec: '12'
        };

        const getIPLocation = (ip) => {
            if (ipCache[ip]) return Promise.resolve(ipCache[ip]);
            if ((ipFailCount[ip] ?? 0) >= 3) {
                return Promise.resolve(ipCache[ip] = { ip, isp: _('Unknown ISP') });
            };

            return L.Request.get(`http://ip-api.com/json/${ip}`, { timeout: 5000 })
                .then((res) => res.json())
                .then((data) => {
                    if (data?.status === 'success') {
                        return ipCache[ip] = { ip: data.query, isp: data.isp };
                    };
                    throw new Error('Invalid response');
                })
                .catch(() => {
                    ipFailCount[ip] = (ipFailCount[ip] ?? 0) + 1;
                    if (ipFailCount[ip] >= 3) {
                        return ipCache[ip] = { ip, isp: _('Unknown ISP') };
                    };
                    return { ip, isp: _('Unknown ISP') };
                });
        };

        const extractIP = (line) => {
            const ipMatch = line.match(/from\s+<?(\d{1,3}(?:\.\d{1,3}){3})(?::\d+)?/);
            if (!ipMatch) return Promise.resolve({ ip: null, tag: '' });

            const ip = ipMatch[1];
            const isLan = /^(10|192\.168|172\.(1[6-9]|2\d|3[01])|127)\./.test(ip);
            if (isLan) return Promise.resolve({ ip, tag: _('(LAN)') });

            return getIPLocation(ip).then(info => ({ ip, tag: _('(External) %s').format(info.isp) }));
        };

        const formatLogTime = (line) => {
            const parts = line.trim().split(/\s+/).slice(0, 5);
            if (parts.length < 5) return null;
            const [, month, day, time, year] = parts;
            return `${year}-${months[month] || '??'}-${day.padStart(2, '0')} ${time}`;
        };

        const patterns = [
            {
                regex: /Password auth succeeded for/i, type: 'ssh_success',
                text: (ip, tag, t, line) => {
                    const user = line.match(/Password auth succeeded for '([^']+)'/)?.[1] || '?';
                    return _("%s - User %s %s (%s) logged in via SSH successfully").format(t, ip, tag, user);
                }
            },
            {
                regex: /Exit\s+\(.+?\)\s+from/i, type: 'ssh_exit',
                text: (ip, tag, t, line) => {
                    const user = line.match(/Exit\s+\(([^)]+)\)\s+from/)?.[1] || '?';
                    return _("%s - SSH session for user %s %s (%s) exited").format(t, ip, tag, user);
                }
            },
            {
                regex: /Bad password attempt/i, type: 'ssh_fail',
                text: (ip, tag, t, line) => {
                    const user = line.match(/for '([^']+)'/)?.[1] || '?';
                    return _("%s - User %s %s attempted to log in via SSH with account %s failed").format(t, ip, user, tag);
                }
            },
            {
                regex: /Login attempt for nonexistent user/i, type: 'ssh_fail',
                text: (ip, tag, t, line) => {
                    const user = line.match(/user '([^']+)'/)?.[1] || '?';
                    return _("%s - SSH login attempt from %s %s failed (user %s does not exist)").format(t, ip, user, tag);
                }
            },
            {
                regex: /Child connection from/i, type: 'ssh_connect',
                text: (ip, tag, t) =>
                    _("%s - User %s %s established SSH connection").format(t, ip, tag)
            },
            {
                regex: /accepted login on/i, type: 'web_success',
                text: (ip, tag, t, line) => {
                    const path = line.match(/accepted login on (\S+)/i)?.[1] || '/';
                    const pathDisplay = path === '/' ? _('Homepage') : path;
                    return _("%s - User %s logged in via Web (%s) successfully %s").format(t, ip, pathDisplay, tag);
                }
            },
            {
                regex: /failed login on/i, type: 'web_fail',
                text: (ip, tag, t) =>
                    _("%s - User %s %s attempted Web login failed").format(t, ip, tag)
            },
        ];

        const processLogs = (content) => {
            const limit = body.querySelector('select').value || 2;
            return Promise.all(content.trim().split('\n').reverse().map((line) => {
                const formattedTime = formatLogTime(line);
                if (!formattedTime) return null;

                return extractIP(line).then(({ ip, tag }) => {
                    const ipDisplay = ip || _('Unknown IP');
                    for (const { regex, type, text } of patterns) {
                        if (regex.test(line)) {
                            return { ip, type, time: formattedTime, text: text(ipDisplay, tag, formattedTime, line) };
                        };
                    };
                    return null;
                });
            })).then((parsed) => {
                const filtered = [], countByKey = new Map();

                parsed.filter(Boolean).forEach((entry) => {
                    if (!entry.ip) return;
                    const key = `${entry.ip}_${entry.type}`;
                    const count = countByKey.get(key) || 0;
                    if (count < limit) {
                        filtered.push(entry);
                        countByKey.set(key, count + 1);
                    };
                });

                return filtered
                    .sort((a, b) => new Date(b.time) - new Date(a.time))
                    .map(e => e.text)
                    .join('\n') || _('No log data available');
            });
        };

        const refreshLogs = () => {
            fs.exec_direct('/sbin/logread', ['-e', 'dropbear\\|uhttpd', '-l', '200']).then((res) => {
                if (!res || !res.trim()) return;
                processLogs(res).then((result) => {
                    logDisplay.firstChild.textContent = result;
                    logDisplay.firstChild.scrollTop = logDisplay.firstChild.scrollHeight;
                });
            });
        };

        const logDisplay = E('div', { style: 'max-height: 60vh; overflow-y: auto; border: 1px solid #eee; padding: 8px;' },
            E('pre', { style: 'margin: 0; white-space: pre-wrap; word-wrap: break-word; font-family: monospace;' }, _('Log is empty'))
        );

        const body = E('div', {}, [
            E('p', { style: 'display: flex; align-items: center; gap: 10px;' }, [
                E('div', _("Maximum entries per type")),
                E('select', {
                    style: 'width: 60px;', class: 'cbi-input-select', id: 'script_select',
                }, [1, 2, 3, 4, 5, 10].map(c =>
                    E('option', { value: c, selected: c == 2 ? '' : null }, c))
                ),
                E('div', _('Refresh time:')),
                E('select', {
                    style: 'width: 60px;', class: 'cbi-input-select',
                    change: ui.createHandlerFn(this, (ev) => {
                        const val = +ev.target.value;
                        poll.active() && poll.remove(refreshLogs);
                        val > 0 && poll.add(refreshLogs, val);
                        body.querySelector('small').textContent = _('Refresh every %s seconds.').format(ev.target.value);
                    })
                }, [0, 5, 10, 20, 30, 60].map(opt =>
                    E('option', { value: opt, selected: opt === 10 ? '' : null }, opt !== 0 ? opt : _('Paused')))
                ),
                E('small', { style: 'margin-left: auto' }, _('Refresh every %s seconds.').format(10))
            ]),
            logDisplay,
        ]);
        poll.add(refreshLogs, 10);
        return body;
    },

    handleSave: null,
    handleReset: null,
    handleSaveApply: null
});
