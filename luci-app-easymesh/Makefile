#
#-- Copyright (C) 2021 dz <dingzhong110@gmail.com>
#

include $(TOPDIR)/rules.mk

LUCI_TITLE:=LuCI Support for easymesh
LUCI_DEPENDS:=+kmod-cfg80211 +batctl-default +kmod-batman-adv +dawn +wpad-mesh-wolfssl
LUCI_PKGARCH:=all

PKG_CONFLICTS:=wpad-basic wpad-basic-wolfssl wpad-mesh-openssl
PKG_NAME:=luci-app-easymesh
PKG_VERSION:=2.0
PKG_RELEASE:=1

include $(TOPDIR)/feeds/luci/luci.mk

# call BuildPackage - OpenWrt buildroot signature
