#
# Copyright (C) 2011-2021 Entware
#
# This is free software, licensed under the GNU General Public License v2.
# See /LICENSE for more information.
#

include $(TOPDIR)/rules.mk

PKG_NAME:=rencode
PKG_VERSION:=1.0.8
PKG_RELEASE:=3

PYPI_NAME:=$(PKG_NAME)
PKG_HASH:=cd28e05eb693cd5065ba1667dcad7f85bbfc7cb0f5cf5c113ee587d26cb3db74

include $(TOPDIR)/feeds/packages/lang/python/pypi.mk
include $(INCLUDE_DIR)/package.mk
include $(TOPDIR)/feeds/packages/lang/python/python3-package.mk

define Package/python3-rencode
	SECTION:=lang
	CATEGORY:=Languages
	SUBMENU:=Python
	DEPENDS:=+python3
	TITLE:=Web safe object pickling/unpickling
	URL:=https://github.com/aresch/rencode
endef

define Package/python3-rencode/description
 The rencode module is similar to bencode from the BitTorrent project.
endef

$(eval $(call Py3Package,python3-rencode))
$(eval $(call BuildPackage,python3-rencode))
