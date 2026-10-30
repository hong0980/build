include $(TOPDIR)/rules.mk

PKG_NAME:=rencode
PKG_VERSION:=1.0.9
PKG_RELEASE:=1

PYPI_NAME:=$(PKG_NAME)
PKG_HASH:=ca3afe8d09d26fb48ac0ad6773e35ec0ae1b92d038d217685c54c5a86577e2f2
PKG_BUILD_DEPENDS:=python-cython/host

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
