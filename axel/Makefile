include $(TOPDIR)/rules.mk

PKG_NAME:=axel
PKG_VERSION:=2.17.14
PKG_RELEASE:=1

PKG_SOURCE:=$(PKG_NAME)-$(PKG_VERSION).tar.bz2
PKG_SOURCE_URL:=https://github.com/axel-download-accelerator/axel/releases/download/v$(PKG_VERSION)
PKG_HASH:=73F3AEAFCB00B8101B212FCF47969A4962E7A1B50843306178B527A9942D8785

include $(INCLUDE_DIR)/package.mk

define Package/axel
	SECTION:=net
	CATEGORY:=Network
	SUBMENU:=File Transfer
	DEPENDS:=+libopenssl
	TITLE:=axel download accelerator
	URL:=https://github.com/axel-download-accelerator/axel
endef

define Package/axel/description
 Description: light command line download accelerator
 Axel tries to accelerate the downloading process by using multiple
 connections for one file, similar to DownThemAll and other famous
 programs. It can also use multiple mirrors for one download.
 Using Axel, you will get files faster from Internet. So, Axel can
 speed up a download up to 60% (approximately, according to some tests).
 Axel supports HTTP, HTTPS, FTP and FTPS protocols.
 Axel tries to be as light as possible, so it might be useful as a
 wget clone (and other console based programs) on byte-critical systems.
endef

define Package/axel/install
	$(INSTALL_DIR) $(1)/usr/bin
	$(INSTALL_BIN) $(PKG_BUILD_DIR)/axel $(1)/usr/bin
endef

$(eval $(call BuildPackage,axel))