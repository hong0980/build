# luci-app-easymesh

OpenWrt LuCI 图形界面插件，简化基于 **batman-adv + 802.11s** 的 Mesh 网络配置。

## 目录结构

```
luci-app-easymesh/
├── Makefile                                        # 编译打包定义
├── htdocs/luci-static/resources/view/easymesh/
│   ├── overview.js                                 # 主配置页（LuCI JS client-side view）
│   └── nodes.js                                    # 节点状态页（实时轮询）
├── root/
│   ├── etc/
│   │   ├── config/easymesh                         # UCI 默认配置
│   │   └── uci-defaults/80_easymesh               # 首次安装初始化脚本
│   └── usr/share/
│       ├── luci/menu.d/luci-app-easymesh.json      # LuCI 菜单注册
│       └── rpcd/acl.d/luci-app-easymesh.json       # rpcd ACL 权限声明
└── po/zh_Hans/easymesh.po                          # 中文翻译
```

## 依赖

```
kmod-batman-adv
batctl-full
wpad-mesh-openssl   # 必须替换 wpad-basic，支持 mesh SAE 加密
dawn                # 辅助 802.11k/v 漫游
kmod-cfg80211
```

## 使用流程

### 第一步：配置主节点
在主节点 LuCI → Services → EasyMesh：
1. 节点角色选「主节点」，填写 WiFi 名称、密码、Mesh ID、Mesh 密码
2. 保存并应用

### 第二步：新从节点上电
全新刷完 OpenWrt 的路由器，安装本插件后：
- LAN IP 自动临时改为 `192.168.2.1`（避免与主节点冲突）
- 自动广播 WiFi `EasyMesh-Setup`（无密码）
- 启动配对 Web 服务

### 第三步：手机操作（唯一需要手动的步骤）
1. 手机连接 `EasyMesh-Setup` WiFi
2. 浏览器自动弹出配对页（或手动访问 `192.168.2.1`）
3. 点击「扫描主节点二维码」，对准主节点 LuCI 屏幕
4. 扫描成功，等待约 10 秒自动完成

### 第四步：全自动完成
- 从节点 CGI 连接主节点，用一次性 token 换取完整配置
- 写入 UCI，LAN IP 恢复正常网段
- 重启服务，正式加入 Mesh 网络 ✓

## UCI 配置说明

所有配置存储在 `/etc/config/easymesh`：

| 选项 | 说明 | 默认值 |
|------|------|--------|
| `enabled` | 是否启用 | 0 |
| `role` | 节点角色 master/slave | master |
| `backhaul` | 回程方式 wired/wireless/auto | wireless |
| `mesh_id` | Mesh 网络标识符 | OpenWrt-Mesh |
| `mesh_key` | Mesh 密码 (SAE) | meshpassword |
| `mesh_band` | 回程频段 2g/5g | 5g |
| `ssid` | 对外 WiFi 名称 | OpenWrt |
| `key` | 对外 WiFi 密码 | - |
| `ieee80211r` | 快速漫游开关 | 1 |
| `mobility_domain` | 漫游域 ID (4位hex) | aabb |
| `ieee80211k` | 邻居报告 | 1 |
| `ieee80211v` | BSS 过渡管理 | 1 |
