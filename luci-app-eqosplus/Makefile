#
# Copyright (C) 2006-2017 OpenWrt.org
# Copyright (C) 2022-2023 sirpdboy <herboy2008@gmail.com>
# This is free software, licensed under the GNU General Public License v2.
# See /LICENSE for more information.
#

include $(TOPDIR)/rules.mk

PKG_NAME:=luci-app-eqosplus

PKG_LICENSE:=Apache-2.0

LUCI_TITLE:=LuCI support for eqosplus.
LUCI_DESCRIPTION:=LuCI support for Easy eqosplus(Support speed limit based on IP address).
LUCI_DEPENDS:=+bash +tc +kmod-sched-core +kmod-ifb +kmod-sched +iptables-mod-filter +iptables-mod-nat-extra
LUCI_PKGARCH:=all

PKG_VERSION:=1.2.5
PKG_RELEASE:=20231205
PKG_MAINTAINER:=sirpdboy <herboy2008@gmail.com>

include $(TOPDIR)/feeds/luci/luci.mk

# call BuildPackage - OpenWrt buildroot signature

