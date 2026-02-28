# SPDX-License-Identifier: GPL-2.0-or-later

include $(TOPDIR)/rules.mk

LUCI_TITLE:=LuCI support for EasyMesh (batman-adv + 802.11s)
LUCI_DEPENDS:=+kmod-batman-adv +batctl-full +wpad-mesh-openssl +dawn +uhttpd +jsonfilter

LUCI_PKGARCH:=all

QRCODEJS_URL:=https://cdn.jsdelivr.net/npm/qrcodejs@1.0.0/qrcode.min.js
JSQR_URL:=https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.min.js

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

	# Daemon scripts
	$(INSTALL_DIR) $(1)/usr/sbin
	$(INSTALL_BIN)  ./root/usr/sbin/easymesh-agent  $(1)/usr/sbin/easymesh-agent
	$(INSTALL_BIN)  ./root/usr/sbin/easymesh-master $(1)/usr/sbin/easymesh-master
	$(INSTALL_BIN)  ./root/usr/sbin/easymesh-qr     $(1)/usr/sbin/easymesh-qr

	# Slave node pairing web page
	$(INSTALL_DIR) $(1)/www/easymesh-pair/cgi-bin
	$(INSTALL_DATA) ./root/www/easymesh-pair/index.html \
		$(1)/www/easymesh-pair/index.html
	$(INSTALL_BIN)  ./root/www/easymesh-pair/cgi-bin/pair \
		$(1)/www/easymesh-pair/cgi-bin/pair

	# Download JS libraries at build time — both go to /www/easymesh-pair/
	# LuCI uhttpd serves /www/ as root, so they are accessible at:
	#   /easymesh-pair/qrcode.min.js  (used by LuCI overview.js)
	#   /easymesh-pair/jsqr.min.js    (used by pairing page index.html)
	wget -q "$(QRCODEJS_URL)" \
		-O "$(1)/www/easymesh-pair/qrcode.min.js" \
		|| { echo "ERROR: Failed to download qrcode.min.js from $(QRCODEJS_URL)"; exit 1; }
	wget -q "$(JSQR_URL)" \
		-O "$(1)/www/easymesh-pair/jsqr.min.js" \
		|| { echo "ERROR: Failed to download jsqr.min.js from $(JSQR_URL)"; exit 1; }
endef

include $(TOPDIR)/feeds/luci/luci.mk

$(eval $(call BuildPackage,luci-app-easymesh))
