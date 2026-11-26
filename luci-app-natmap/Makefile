# SPDX-License-Identifier: Apache-2.0
#
# Copyright (C) 2023-2026 muink <https://github.com/muink>

include $(TOPDIR)/rules.mk

LUCI_NAME:=luci-app-natmap

LUCI_TITLE:=LuCI Support for natmap
LUCI_PKGARCH:=all
LUCI_DEPENDS:=+natmap +coreutils-timeout +stuntman-client +curl +jsonfilter +bash

LUCI_DESCRIPTION:=TCP/UDP port mapping for full cone NAT

PKG_LICENSE:=Apache-2.0
PKG_MAINTAINER:=Anya Lin <hukk1996@gmail.com>, Richard Yu <yurichard3839@gmail.com>

define Build/Prepare/luci-app-natmap
	chmod 0755 $(PKG_BUILD_DIR)/root/etc/init.d/natmap
	[ -d $(PKG_BUILD_DIR)/root/etc/natmap ] && \
		chmod -R +X $(PKG_BUILD_DIR)/root/etc/natmap || true
endef

include $(TOPDIR)/feeds/luci/luci.mk

# call BuildPackage - OpenWrt buildroot signature
