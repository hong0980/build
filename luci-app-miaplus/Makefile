
# Copyright (C) 2016 Openwrt.org
#
# This is free software, licensed under the Apache License, Version 2.0 .
#

include $(TOPDIR)/rules.mk

LUCI_TITLE:=LuCI Access Control Configuration
LUCI_DEPENDS:=+snmpd +tc +kmod-sched-core +kmod-ifb +kmod-sched +iptables-mod-filter +iptables-mod-nat-extra
LUCI_PKGARCH:=all

PKG_NAME:=luci-app-miaplus
PKG_VERSION:=1
PKG_RELEASE:=9

include $(TOPDIR)/feeds/luci/luci.mk
# call BuildPackage - OpenWrt buildroot signature
