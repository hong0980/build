include $(TOPDIR)/rules.mk

LUCI_TITLE:=LuCI support for EasyMesh (batman-adv + 802.11s)
LUCI_DEPENDS:=+kmod-batman-adv +batctl-full +wpad-mesh-openssl +dawn +uhttpd
LUCI_PKGARCH:=all
QRCODEJS_URL:=https://cdn.jsdelivr.net/npm/qrcodejs@1.0.0/qrcode.min.js

define Package/luci-app-easymesh/install
	# qrcode.min.js — used by LuCI overview to display mesh info as QR
	# Served by uhttpd at /easymesh-pair/qrcode.min.js
	wget -q "$(QRCODEJS_URL)" \
		-O "$(1)/www/easymesh-pair/qrcode.min.js" \
		|| { echo "ERROR: Failed to download qrcode.min.js from $(QRCODEJS_URL)"; exit 1; }
endef

include $(TOPDIR)/feeds/luci/luci.mk

# call BuildPackage - OpenWrt buildroot signature
