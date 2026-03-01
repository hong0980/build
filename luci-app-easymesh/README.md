# luci-app-easymesh

OpenWrt LuCI 插件，基于 **batman-adv + 802.11s** 构建自组织 Mesh 网络。

支持有线和无线两种方式添加新节点，无需手动配置，插网线即可自动加入。

---

## 功能

- **自动主节点选举**：有 WAN 的节点自动成为主节点；无 WAN 时 MAC 最小的节点胜出，防止双主
- **自愈路由**：batman-adv OGM 间隔调优（500ms），节点离线后自动绕行；有线断开时热备切换无线
- **有线回程**：batman-adv 运行在物理以太网上，比无线回程更稳定、延迟更低
- **专用回程（三频）**：三频路由器可将第二个 5GHz 频段完全隔离给节点间回程，客户端带宽不打折
- **插线即加入**：从节点插入主节点 LAN 口后自动发现主节点、请求配置，无需任何手动操作
- **无线辅助添加**：主节点可广播临时开放 SSID，新节点通过 WiFi 接入后同样自动申请配置
- **安全确认机制**：所有新节点（有线/无线）必须在主节点 LuCI 节点页手动批准后才推送配置
- **配置自动同步**：主节点保存配置后自动推送到所有已批准从节点
- **DFS/ACS 信道协调**：每 2 分钟扫描最空闲信道，支持 DFS 高频段；检测到雷达时全网同步跳信道
- **无缝漫游**：802.11r（FT）+ 802.11k（邻居报告）+ 802.11v（BSS-TM 主动触发），实时 RSSI 探测秒切
- **智能负载均衡**：信号弱或节点过载时自动触发 BSS-TM 引导客户端漫游；负载自适应调整漫游阈值
- **图形化拓扑**：节点页 Canvas 实时绘制 Mesh 拓扑，连线颜色/粗细代表信号质量，鼠标悬停显示详情
- **结构化日志**：所有事件写入 `/tmp/easymesh.log`，LuCI 日志页实时展示，支持分类过滤/搜索/导出

---

## 目录结构

```
luci-app-easymesh/
├── Makefile
├── README.md
├── htdocs/
│   ├── easymesh-pair/
│   │   └── index.html           # 从节点配网状态页
│   └── luci-static/resources/view/easymesh/
│       ├── overview.js          # 主配置页
│       ├── nodes.js             # 节点状态页（拓扑图、待审批卡片）
│       └── log.js               # 运行日志页（只负责渲染）
├── po/zh_Hans/easymesh.po       # 中文翻译
└── root/
    ├── etc/
    │   ├── config/easymesh          # UCI 默认配置
    │   ├── hotplug.d/iface/
    │   │   └── 95-easymesh-healer   # 有线链路热插拔自愈
    │   ├── init.d/easymesh          # procd 服务
    │   └── uci-defaults/80_easymesh # 首次安装初始化
    └── usr/
        ├── sbin/
        │   ├── easymesh-master      # 主节点守护进程
        │   └── easymesh-agent       # 从节点守护进程
        └── share/
            ├── luci/menu.d/luci-app-easymesh.json
            └── rpcd/acl.d/luci-app-easymesh.json
```

> `luci.mk` 自动将 `htdocs/` 安装到 `/www/`，`root/` 叠加到根文件系统，`po/` 安装翻译文件，无需手写安装规则。

---

## 依赖

| 包 | 说明 |
|----|------|
| `kmod-batman-adv` | batman-adv 内核模块 |
| `batctl-full` | batman-adv 控制工具（含 `batctl meshif`） |
| `wpad-mesh-openssl` | 必须替换 `wpad-basic`，支持 802.11s SAE 加密 |
| `dawn` | 辅助 802.11k/v 漫游决策，负载自适应阈值调整 |
| `uhttpd` | 从节点配网状态页 HTTP 服务 |

> `kmod-cfg80211` 无需显式声明，由 `kmod-batman-adv` 和 `wpad-mesh-openssl` 自动拉取。

---

## 添加新节点

### 方式一：有线（推荐）

```
1. 新节点刷好 OpenWrt，安装本插件，上电
2. 网线连接：新节点任意 LAN 口 → 主节点任意 LAN 口
3. 等待约 30 秒，新节点自动：
   - 通过 DHCP 获取 IP
   - 扫描子网发现主节点（:4304/ping）
   - 发送加入申请
4. 主节点 LuCI → Services → EasyMesh → Nodes
   → 出现 🔌 待审批卡片，点「允许加入」
5. 新节点收到配置，重启服务，加入 Mesh ✓
```

### 方式二：无线（辅助）

```
1. 主节点 LuCI → Services → EasyMesh → Overview & Config
   → 开启「无线添加新节点」
2. 主节点广播临时 SSID（如 EasyMesh-Setup-A1B2C3，无密码）
3. 新节点连接该 SSID，自动发送加入申请
4. 主节点节点页出现 📶 待审批卡片，点「允许加入」
5. 新节点收到配置，加入 Mesh ✓
```

---

## 初始配置（主节点）

安装后在 LuCI → Services → EasyMesh → Overview & Config：

| 字段 | 建议值 |
|------|--------|
| 启用 | ✓ |
| 节点角色 | 主节点 |
| 回程方式 | 有线（推荐） |
| WiFi 名称 | 你的 SSID |
| WiFi 密码 | 你的密码 |
| Mesh ID | 自定义标识符 |
| Mesh 密码 | 建议设置（SAE 加密） |

从节点无需手动配置，批准后自动从主节点同步所有设置。

---

## UCI 配置参考

配置文件：`/etc/config/easymesh`

| 选项 | 说明 | 默认值 |
|------|------|--------|
| `enabled` | 是否启用 | `0` |
| `role` | 节点角色 `master`/`slave` | `slave` |
| `backhaul` | 回程方式 `wired`/`wireless` | `wired` |
| `mesh_id` | Mesh 网络标识符 | `OpenWrt-Mesh` |
| `mesh_key` | Mesh 密码（SAE） | — |
| `mesh_band` | 无线回程频段 `2g`/`5g` | `5g` |
| `ssid` | 对外 WiFi 名称 | `OpenWrt` |
| `key` | 对外 WiFi 密码 | — |
| `ieee80211r` | 快速漫游（FT） | `1` |
| `mobility_domain` | 漫游域 ID（4位十六进制） | `aabb` |
| `ieee80211k` | 邻居报告 | `1` |
| `ieee80211v` | BSS 过渡管理 | `1` |
| `wireless_onboard` | 无线添加新节点 | `0` |
| `wireless_onboard_ssid` | 配网 SSID（留空自动生成） | — |
| `dedicated_backhaul` | 三频专用回程 | `0` |
| `backhaul_channel` | 专用回程信道 | `149` |
| `dfs_enable` | 启用 DFS 信道参与 ACS | `1` |

---

## 守护进程与 HTTP API

`init.d` 根据 UCI `role` 字段启动对应进程：

| 角色 | 进程 | 职责 |
|------|------|------|
| `master` | `easymesh-master` | 选举、审批队列、配置下发、信道协调、漫游管理、拓扑输出 |
| `slave` | `easymesh-agent` | 发现主节点、注册、轮询审批、接收并应用配置 |

两个进程共用端口 **4304**，HTTP API：

| 端点 | 说明 |
|------|------|
| `GET  /ping` | 节点角色、MAC、IP |
| `GET  /wan` | WAN 在线状态（选举用） |
| `GET  /profile?mac=` | 获取 Mesh 配置（仅已批准节点） |
| `POST /register` | 新节点注册申请 |
| `GET  /nodes/pending` | 待审批节点列表 |
| `GET  /nodes/approved` | 已批准节点列表 |
| `POST /nodes/approve` | 批准节点 |
| `POST /nodes/reject` | 拒绝节点 |
| `GET  /topology` | 拓扑 JSON（batman-adv TQ 值） |
| `GET  /log?lines=N` | 最近 N 行日志（log.js 使用） |
| `POST /log/clear` | 清空日志文件 |
| `GET  /wireless-onboard/status` | 配网 SSID 状态 |
| `POST /channel/apply` | 接收主节点信道同步指令 |
| `GET  /roam/signal?mac=` | 查询客户端在本节点的信号强度 |
| `POST /roam/neighbors` | 接收主节点推送的邻居列表 |

---

## 日志系统

所有事件写入 `/tmp/easymesh.log`，格式：

```
2025-01-15 12:34:56 [INFO ] [core    ] Election: WAN up → master
2025-01-15 12:34:57 [WARN ] [heal    ] LAN link down → OGM 300ms
```

| 来源 | Tag | 内容 |
|------|-----|------|
| `easymesh-master` | `core` `roam` `dfs` `heal` | 守护进程所有事件 |
| `init.d/easymesh` | `initd` | 服务启动/停止/配置应用 |
| `hotplug 95-easymesh-healer` | `heal` | 有线链路插拔 |

超过 500 行自动轮转，保留最新 400 行。LuCI 日志页支持按 Tag 过滤、关键字搜索、导出。
