# SPDX-License-Identifier: GPL-2.0-or-later

include $(TOPDIR)/rules.mk

LUCI_TITLE:=LuCI support for EasyMesh (batman-adv + 802.11s)
LUCI_DEPENDS:=+kmod-batman-adv +batctl-full +wpad-mesh-openssl +dawn +uhttpd
LUCI_PKGARCH:=all

PKG_VERSION:=1.0.0
PKG_RELEASE:=1

include $(TOPDIR)/feeds/luci/luci.mk

# call BuildPackage - OpenWrt buildroot signature
$(eval $(call BuildPackage,luci-app-easymesh))
