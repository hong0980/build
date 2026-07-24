include $(TOPDIR)/rules.mk

PKG_NAME:=rencode
PKG_VERSION:=1.0.8
PKG_RELEASE:=1

PYPI_NAME:=$(PKG_NAME)
PKG_HASH:=83b2d9b6d84adc35615b7a09b74279211abaaf57a578af10ad012455a99a7722

PKG_BUILD_DEPENDS:=python-cython/host
HOST_BUILD_DEPENDS:=python3/host python-build/host python-cython/host

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
