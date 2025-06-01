include $(TOPDIR)/rules.mk
PKG_NAME:=luci-app-ddnsto
PKG_VERSION:=3.0.4-r1
PKG_RELEASE:=3

LUCI_TITLE:=LuCI Support for ddnst
LUCI_PKGARCH:=all
LUCI_DEPENDS:=@(arm||aarch64||x86_64) +block-mount +ddnsto

include $(TOPDIR)/feeds/luci/luci.mk

# call BuildPackage - OpenWrt buildroot signature
