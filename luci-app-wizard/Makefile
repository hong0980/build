include $(TOPDIR)/rules.mk

PKG_NAME:=luci-app-wizard
PKG_VERSION:=1.0.1
PKG_RELEASE:=1

PKG_LICENSE:=GPLv3
PKG_LICENSE_FILES:=LICENSE

PKG_BUILD_DIR:=$(BUILD_DIR)/$(PKG_NAME)

include $(INCLUDE_DIR)/package.mk

define Package/luci-app-wizard
	CATEGORY:=X
	SUBMENU:=Configuration Wizard Support
	TITLE:=LuCI Support for wizard
	PKGARCH:=all
	DEPENDS:=+luci-base +rpcd-mod-iwinfo
endef

define Package/luci-app-wizard/description
	LuCI Support for wizard.
endef

include $(TOPDIR)/feeds/luci/luci.mk

# call BuildPackage - OpenWrt buildroot signature
