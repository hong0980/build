# SPDX-License-Identifier: GPL-2.0-or-later

include $(TOPDIR)/rules.mk

LUCI_TITLE:=LuCI support for EasyMesh (batman-adv + 802.11s)
# kmod-cfg80211 is omitted — it is a mandatory kernel dependency pulled
# in automatically by kmod-batman-adv and wpad-mesh-openssl.
LUCI_DEPENDS:=+kmod-batman-adv +batctl-full +wpad-mesh-openssl +dawn +uhttpd

LUCI_PKGARCH:=all

QRCODEJS_URL:=https://cdn.jsdelivr.net/npm/qrcodejs@1.0.0/qrcode.min.js

define Package/luci-app-easymesh/install
	# LuCI view JS files
	$(INSTALL_DIR) $(1)/www/luci-static/resources/view/easymesh
	$(INSTALL_DATA) ./htdocs/luci-static/resources/view/easymesh/overview.js \
		$(1)/www/luci-static/resources/view/easymesh/overview.js
	$(INSTALL_DATA) ./htdocs/luci-static/resources/view/easymesh/nodes.js \
		$(1)/www/luci-static/resources/view/easymesh/nodes.js

	# Menu and ACL
	$(INSTALL_DIR) $(1)/usr/share/luci/menu.d
	$(INSTALL_DATA) ./root/usr/share/luci/menu.d/luci-app-easymesh.json \
		$(1)/usr/share/luci/menu.d/luci-app-easymesh.json
	$(INSTALL_DIR) $(1)/usr/share/rpcd/acl.d
	$(INSTALL_DATA) ./root/usr/share/rpcd/acl.d/luci-app-easymesh.json \
		$(1)/usr/share/rpcd/acl.d/luci-app-easymesh.json

	# UCI config and defaults
	$(INSTALL_DIR) $(1)/etc/config
	$(INSTALL_CONF) ./root/etc/config/easymesh $(1)/etc/config/easymesh
	$(INSTALL_DIR) $(1)/etc/uci-defaults
	$(INSTALL_BIN)  ./root/etc/uci-defaults/80_easymesh $(1)/etc/uci-defaults/80_easymesh

	# init.d service
	$(INSTALL_DIR) $(1)/etc/init.d
	$(INSTALL_BIN)  ./root/etc/init.d/easymesh $(1)/etc/init.d/easymesh

	# Daemon scripts:
	#   easymesh-master  runs on master node (elected via WAN detection)
	#   easymesh-agent   runs on slave nodes (auto-discovers master on LAN)
	# init.d starts the correct binary based on the configured role.
	$(INSTALL_DIR) $(1)/usr/sbin
	$(INSTALL_BIN) ./root/usr/sbin/easymesh-master $(1)/usr/sbin/easymesh-master
	$(INSTALL_BIN) ./root/usr/sbin/easymesh-agent  $(1)/usr/sbin/easymesh-agent

	# Node status page — served by uhttpd before mesh is configured
	$(INSTALL_DIR) $(1)/www/easymesh-pair
	$(INSTALL_DATA) ./root/www/easymesh-pair/index.html \
		$(1)/www/easymesh-pair/index.html

	# qrcode.min.js — used by LuCI overview to display mesh info as QR
	# Served by uhttpd at /easymesh-pair/qrcode.min.js
	wget -q "$(QRCODEJS_URL)" \
		-O "$(1)/www/easymesh-pair/qrcode.min.js" \
		|| { echo "ERROR: Failed to download qrcode.min.js from $(QRCODEJS_URL)"; exit 1; }
endef

include $(TOPDIR)/feeds/luci/luci.mk

$(eval $(call BuildPackage,luci-app-easymesh))
