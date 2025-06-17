include $(TOPDIR)/rules.mk

PKG_NAME:=luci-app-deluge
PKG_VERSION:=1.1
PKG_RELEASE:=20250618

LUCI_TITLE:=LuCI support for deluge
LUCI_PKGARCH:=all
LUCI_DEPENDS:=@(arm||aarch64||x86_64) +deluge +deluge-ui-web

include $(TOPDIR)/feeds/luci/luci.mk

# call BuildPackage - OpenWrt buildroot signature
