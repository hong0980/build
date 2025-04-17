include $(TOPDIR)/rules.mk

PKG_NAME:=deluge
PKG_VERSION:=2.1.1
PKG_RELEASE:=1

PYPI_NAME:=$(PKG_NAME)
PKG_HASH:=d6ea7e1f5bdd75f40cbd1d56f0c97cd1b5b74bc9e03783858c7daa81063dd4b9

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
	    +python3-ifaddr \
	    +python3-libtorrent \
	    +python3-mako \
	    +python3-pillow \
	    +python3-pyasn1 \
	    +python3-pyopenssl \
	    +python3-pyxdg \
	    +python3-rencode \
	    +python3-setproctitle \
	    +python3-setuptools \
	    +python3-twisted \
	    +python3-zope-interface
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

# define Build/Configure
# 	$(call Py3Build/Configure)
# 	$(SED) 's/^#.*disable-libevent/disable-libevent/' $(PKG_BUILD_DIR)/setup.cfg
# 	export CFLAGS="$(TARGET_CFLAGS)"; \
# 	export LDFLAGS="$(TARGET_LDFLAGS)"; \
# 	export PYTHON="$(PYTHON3)"; \
# 	cd $(PKG_BUILD_DIR); \
# 	$(PYTHON3) setup.py build_ext --inplace --force --disable-shared \
# 		--curl-config=$(STAGING_DIR_HOST)/bin/curl-config \
# 		--openssl=$(STAGING_DIR_HOST)/usr
# endef

# define Build/Compile
# 	$(call Py3Build/Compile)

# 	mkdir -p $(PKG_INSTALL_DIR)$(PYTHON3_PKG_DIR)/deluge
# 	$(CP) $(PKG_BUILD_DIR)/deluge/*.py $(PKG_INSTALL_DIR)$(PYTHON3_PKG_DIR)/deluge/
# 	$(TARGET_CC) -static -o $(PKG_INSTALL_DIR)/usr/bin/deluge $(PKG_BUILD_DIR)/deluge-*/deluge
# endef

$(eval $(call Py3Package,$(PKG_NAME)))
$(eval $(call BuildPackage,$(PKG_NAME)))

$(eval $(call Py3Package,deluge-ui-web))
$(eval $(call BuildPackage,deluge-ui-web))
