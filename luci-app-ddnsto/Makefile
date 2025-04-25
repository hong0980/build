include $(TOPDIR)/rules.mk
include $(INCLUDE_DIR)/package.mk

PKG_NAME:=luci-app-ddnsto
PKG_VERSION:=1.0.0

define Package/$(PKG_NAME)
	SECTION:=luci
	CATEGORY:=LuCI
	SUBMENU:=3. Applications
	DEPENDS:=@(aarch64||arm||x86_64||mipsel)
	TITLE:=LuCI Support for ddnst
	PKGARCH:=all
endef

define Build/Compile
endef

define Package/$(PKG_NAME)/install
	$(INSTALL_DIR) $(1)/usr/lib/lua/luci
	cp -pR ./luasrc/* $(1)/usr/lib/lua/luci

	$(INSTALL_DIR) $(1)/www
	cp -pR ./htdocs/* $(1)/www/

	$(INSTALL_DIR) $(1)/etc/init.d
	$(INSTALL_BIN) ./root/etc/init.d/* $(1)/etc/init.d/

	$(INSTALL_DIR) $(1)/etc/uci-defaults
	$(INSTALL_BIN) ./root/etc/uci-defaults/* $(1)/etc/uci-defaults/

	$(INSTALL_DIR) $(1)/usr/sbin
	$(INSTALL_BIN) ./files/ddnstod.$(ARCH) $(1)/usr/sbin/ddnstod
	$(INSTALL_BIN) ./files/ddwebdav.$(ARCH) $(1)/usr/sbin/ddwebdav
endef

$(eval $(call BuildPackage,$(PKG_NAME)))
