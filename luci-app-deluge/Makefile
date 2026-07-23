include $(TOPDIR)/rules.mk

PKG_NAME:=luci-app-deluge
PKG_VERSION:=1.2
PKG_RELEASE:=1

LUCI_TITLE:=LuCI support for Deluge BitTorrent
LUCI_DEPENDS:=@(arm||aarch64||x86_64) +deluge +deluge-ui-web

include $(TOPDIR)/feeds/luci/luci.mk

# call BuildPackage - OpenWrt buildroot signature
