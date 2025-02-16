include $(TOPDIR)/rules.mk

PKG_NAME:=lsscsi
PKG_VERSION:=0.32
PKG_RELEASE:=1
PKG_BUILD_DIR:=$(BUILD_DIR)/lsscsi-$(PKG_VERSION)
PKG_SOURCE:=lsscsi-$(PKG_VERSION).tgz
PKG_SOURCE_URL:=http://sg.danny.cz/scsi
PKG_MD5SUM:=e61b12ca8819723c25acd71439ebc59a
PKG_INSTALL:=1

include $(INCLUDE_DIR)/package.mk

define Package/lsscsi
	SECTION:=utils
	CATEGORY:=Utilities
	TITLE:=Shell pipeline element to meter data passing through
	URL:=http://sg.danny.cz/scsi/lsscsi.html
endef

define Package/lsscsi/description
	The lsscsi command lists information about SCSI devices in Linux.
	http://sg.danny.cz/scsi/lsscsi.html
endef

define Package/lsscsi/install
	$(INSTALL_DIR) $(1)/usr/bin
	$(INSTALL_BIN) $(PKG_INSTALL_DIR)/usr/bin/lsscsi $(1)/usr/bin/
endef

$(eval $(call BuildPackage,lsscsi))
