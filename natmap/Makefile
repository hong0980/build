include $(TOPDIR)/rules.mk

PKG_NAME:=natmap
PKG_VERSION:=20261109
PKG_RELEASE:=1

PKG_SOURCE:=$(PKG_NAME)-$(PKG_VERSION).tar.xz
PKG_SOURCE_URL:=https://github.com/heiher/natmap/releases/download/$(PKG_VERSION)
PKG_HASH:=1b34055b8df2b9bfd79d7fd519dedb6d1cca50e8bcf37b348e3c86760a718c88
PKG_BUILD_FLAGS:=no-mips16
PKG_BUILD_PARALLEL:=1

include $(INCLUDE_DIR)/package.mk

define Package/natmap
  SECTION:=net
  CATEGORY:=Network
  TITLE:=TCP/UDP port mapping tool for full cone NAT
  URL:=https://github.com/heiher/natmap
  USERID:=natmap:natmap
endef

MAKE_FLAGS += REV_ID="$(PKG_VERSION)"

define Package/natmap/install
	$(INSTALL_DIR) $(1)/usr/bin
	$(INSTALL_BIN) $(PKG_BUILD_DIR)/bin/natmap $(1)/usr/bin/natmap
endef

$(eval $(call BuildPackage,natmap))
