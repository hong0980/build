# luci-app-easymesh

OpenWrt LuCI 插件，基于 **batman-adv + 802.11s** 构建自组织 Mesh 网络。

支持有线和无线两种方式添加新节点，无需手动配置，插网线即可自动加入。

---

## 功能

- **自动主节点选举**：有 WAN 的节点自动成为主节点；无 WAN 时 MAC 最小的节点胜出，防止双主
- **有线回程**：batman-adv 运行在物理以太网上，比无线回程更稳定、延迟更低
- **插线即加入**：从节点插入主节点 LAN 口后自动发现主节点、请求配置，无需任何手动操作
- **无线辅助添加**：可在配置页开启，主节点广播临时 SSID，新节点通过 WiFi 接入后同样自动申请配置
- **安全确认机制**：两种方式都需要在主节点 LuCI「节点」页点击批准，防止陌生设备自动加入
- **配置自动同步**：主节点保存配置后自动推送到所有已知从节点
- **信道协调**：主节点每 2 分钟扫描空口，选择最空闲信道并同步给所有节点
- **802.11k/v**：自动开启邻居报告和 BSS 过渡，辅助客户端快速漫游
- **负载均衡**：信号低于 -70 dBm 的客户端自动触发 BSS-TM 引导漫游
- **拓扑可视化**：节点页实时显示 Mesh 拓扑 JSON，包含 TQ 值和客户端数

---

## 目录结构

```
luci-app-easymesh/
├── Makefile
├── README.md
├── htdocs/luci-static/resources/view/easymesh/
│   ├── overview.js          # 主配置页（LuCI JS view）
│   └── nodes.js             # 节点状态页（实时轮询，含待审批卡片）
├── po/zh_Hans/easymesh.po   # 中文翻译
└── root/
    ├── etc/
    │   ├── config/easymesh          # UCI 默认配置
    │   ├── init.d/easymesh          # procd 服务（启动 master/agent）
    │   └── uci-defaults/80_easymesh # 首次安装初始化
    ├── usr/sbin/
    │   ├── easymesh-master  # 主节点守护进程
    │   └── easymesh-agent   # 从节点守护进程（exec → master 同一脚本）
    ├── usr/share/
    │   ├── luci/menu.d/luci-app-easymesh.json
    │   └── rpcd/acl.d/luci-app-easymesh.json
    └── www/easymesh-pair/
        └── index.html       # 从节点配网状态页
```

---

## 依赖

| 包 | 说明 |
|----|------|
| `kmod-batman-adv` | batman-adv 内核模块 |
| `batctl-full` | batman-adv 控制工具（含 `batctl meshif`） |
| `wpad-mesh-openssl` | 必须替换 `wpad-basic`，支持 802.11s SAE 加密 |
| `dawn` | 辅助 802.11k/v 漫游决策 |
| `uhttpd` | 从节点状态页 HTTP 服务 |

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
4. 主节点 LuCI → Services → EasyMesh → 节点
   → 出现 🔌 待审批卡片，点「允许加入」
5. 新节点收到配置，重启服务，加入 Mesh ✓
```

### 方式二：无线（辅助）

```
1. 主节点 LuCI → Services → EasyMesh → 配置
   → 开启「无线添加新节点」
2. 主节点广播临时 SSID（如 EasyMesh-Setup-A1B2C3，无密码）
3. 新节点连接该 SSID，自动发送加入申请
4. 主节点节点页出现 📶 待审批卡片，点「允许加入」
5. 新节点收到配置，加入 Mesh ✓
```

---

## 初始配置（主节点）

安装后在 LuCI → Services → EasyMesh：

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
| `backhaul` | 回程方式 `wired`/`wireless`/`auto` | `wired` |
| `mesh_id` | Mesh 网络标识符 | `OpenWrt-Mesh` |
| `mesh_key` | Mesh 密码（SAE） | — |
| `mesh_band` | 无线回程频段 `2g`/`5g` | `5g` |
| `ssid` | 对外 WiFi 名称 | `OpenWrt` |
| `key` | 对外 WiFi 密码 | — |
| `ieee80211r` | 快速漫游（FT） | `1` |
| `mobility_domain` | 漫游域 ID（4位十六进制） | `aabb` |
| `ieee80211k` | 邻居报告 | `1` |
| `ieee80211v` | BSS 过渡管理 | `1` |
| `wireless_onboard` | 无线添加新节点开关 | `0` |
| `wireless_onboard_ssid` | 自定义配网 SSID（留空自动生成） | — |

---

## 守护进程说明

`init.d` 根据 UCI 中的 `role` 字段启动对应进程：

| 角色 | 启动进程 | 职责 |
|------|----------|------|
| `master` | `easymesh-master` | 选举、提供 `/profile`、管理审批队列、信道协调、负载均衡、拓扑输出 |
| `slave` | `easymesh-agent` | 扫描子网发现主节点、注册、轮询审批状态、接收并应用配置 |

两个守护进程监听同一端口 **4304**，提供 HTTP API：

| 端点 | 方法 | 说明 |
|------|------|------|
| `/ping` | GET | 返回节点角色和 MAC/IP |
| `/wan` | GET | 返回 WAN 是否在线（用于选举） |
| `/profile` | GET | 返回 Mesh 配置（仅审批通过的节点可获取） |
| `/register` | POST | 新节点注册加入申请 |
| `/nodes/pending` | GET | 待审批节点列表（LuCI 轮询） |
| `/nodes/approved` | GET | 已批准节点列表 |
| `/nodes/approve` | POST | 批准节点 |
| `/nodes/reject` | POST | 拒绝节点 |
| `/topology` | GET | 拓扑 JSON（含 batman-adv TQ 值） |
| `/wireless-onboard/status` | GET | 无线配网 SSID 状态 |

