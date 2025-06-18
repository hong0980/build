include $(TOPDIR)/rules.mk

PKG_NAME:=deluge
PKG_VERSION:=2.2.0
PKG_RELEASE:=1

PYPI_NAME:=$(PKG_NAME)
PKG_HASH:=f0fc64e052334ef294ca3951975dd926f129d62813f6c909bb523d914abe6537

include $(TOPDIR)/feeds/packages/lang/python/pypi.mk
include $(INCLUDE_DIR)/package.mk
include $(TOPDIR)/feeds/packages/lang/python/python3-package.mk

define Package/$(PKG_NAME)/Default
	SUBMENU:=BitTorrent
	SECTION:=net
	CATEGORY:=Network
	TITLE:=a lightweight BitTorrent client
	URL:=https://deluge-torrent.org
endef

define Package/$(PKG_NAME)
	$(call Package/deluge/Default)
	TITLE+= (console UI & daemon)
	DEPENDS:= \
	    +python3-chardet \
	    +python3-libtorrent \
	    +python3-mako \
	    +python3-markupsafe \
	    +python3-pillow \
	    +python3-pyopenssl \
	    +python3-pyxdg \
	    +python3-rencode \
	    +python3-service-identity \
	    +python3-setproctitle \
	    +python3-setuptools \
	    +python3-twisted
endef

define Package/$(PKG_NAME)-ui-web
	$(call Package/deluge/Default)
	TITLE+= (Web UI)
	DEPENDS:=deluge
endef

define Package/$(PKG_NAME)/description
	BitTorrent client with a client/server model.
endef

define Package/$(PKG_NAME)/install
	$(INSTALL_DIR) $(1)/usr/bin $(1)$(PYTHON3_PKG_DIR)
	$(CP) $(PKG_INSTALL_DIR)/usr/bin/* $(1)/usr/bin/
	$(CP) $(PKG_INSTALL_DIR)$(PYTHON3_PKG_DIR)/* $(1)$(PYTHON3_PKG_DIR)/

	rm -rf \
		$(1)/usr/bin/deluge-gtk \
		$(1)/usr/bin/deluge-web \
		$(1)$(PYTHON3_PKG_DIR)/deluge/ui/web \
		$(1)$(PYTHON3_PKG_DIR)/deluge/ui/gtk3
	$(call Python3/FixShebang,$(1)/usr/bin/* \
	$(1)$(PYTHON3_PKG_DIR)/deluge/path_*.py)
endef

define Package/$(PKG_NAME)-ui-web/install
	$(INSTALL_DIR) $(1)/usr/bin $(1)$(PYTHON3_PKG_DIR)/deluge/ui
	$(CP) $(PKG_INSTALL_DIR)/usr/bin/deluge-web $(1)/usr/bin/
	$(CP) $(PKG_INSTALL_DIR)$(PYTHON3_PKG_DIR)/deluge/ui/web $(1)$(PYTHON3_PKG_DIR)/deluge/ui/
	$(call Python3/FixShebang,$(1)/usr/bin/*)
endef

$(eval $(call Py3Package,$(PKG_NAME)))
$(eval $(call BuildPackage,$(PKG_NAME)))

$(eval $(call Py3Package,$(PKG_NAME)-ui-web))
$(eval $(call BuildPackage,$(PKG_NAME)-ui-web))
