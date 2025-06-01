include $(TOPDIR)/rules.mk
include $(INCLUDE_DIR)/package.mk

PKG_NAME:=luci-app-ddnsto
PKG_VERSION:=3.0.4-r1
PKG_RELEASE:=3

define Package/$(PKG_NAME)
	SECTION:=luci
	CATEGORY:=LuCI
	SUBMENU:=3. Applications
	DEPENDS:=@(aarch64||arm||x86_64||mipsel) +block-mount +ddnsto
	TITLE:=LuCI Support for ddnst
	PKGARCH:=all
endef


include $(TOPDIR)/feeds/luci/luci.mk

# call BuildPackage - OpenWrt buildroot signature
