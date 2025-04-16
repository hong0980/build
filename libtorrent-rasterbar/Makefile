#
# Copyright (C) 2025 OpenWrt.org
#
# This is free software, licensed under the GNU General Public License v2.
# See /LICENSE for more information.
#

include $(TOPDIR)/rules.mk

PKG_NAME:=libtorrent-rasterbar
PKG_VERSION:=2.0.10
PKG_RELEASE:=1

PKG_SOURCE:=$(PKG_NAME)-$(PKG_VERSION).tar.gz
PKG_SOURCE_URL:=https://github.com/arvidn/libtorrent/releases/download/v$(PKG_VERSION)
PKG_HASH:=fc935b8c1daca5c0a4d304bff59e64e532be16bb877c012aea4bda73d9ca885d

PKG_MAINTAINER:=David Yang <mmyangfl@gmail.com>
PKG_LICENSE:=BSD-3-Clause
PKG_LICENSE_FILES:=COPYING

PKG_BUILD_DEPENDS:=python3/host
include $(INCLUDE_DIR)/package.mk
include $(INCLUDE_DIR)/cmake.mk
include $(TOPDIR)/feeds/packages/lang/python/python3-version.mk

define Package/libtorrent-rasterbar
  SECTION:=libs
  CATEGORY:=Libraries
  TITLE:=C++ bittorrent library by Rasterbar Software
  URL:=https://www.libtorrent.org
  DEPENDS:=+boost-system +libatomic +libopenssl +libstdcpp +libgcc
  ABI_VERSION:=2.0
endef

define Package/python3-libtorrent
  SECTION:=lang
  CATEGORY:=Languages
  SUBMENU:=Python
  TITLE:=Python 3 bindings for libtorrent-rasterbar
  URL:=https://www.libtorrent.org
  DEPENDS:=+libtorrent-rasterbar +python3-light +boost-python3
endef

define Package/libtorrent-rasterbar/description
  Rasterbar libtorrent is a C++ library that aims to be a good alternative to
  all the other bittorrent implementations around.
endef

define Package/python3-libtorrent/description
  $(call Package/libtorrent-rasterbar/description)
  This package contains Python 3 bindings for the libtorrent-rasterbar library.
endef

define Download/try_signal
  VERSION:=751a7e5a5be14892bcfdff1e63c653bcbf71cf39
  SUBDIR:=deps/try_signal
  FILE:=$(PKG_NAME)-try_signal-$(VERSION).tar.xz
  URL:=https://github.com/arvidn/try_signal.git
  MIRROR_HASH:=32a432e35e81c79f21c49744f00696c112e0deab45d15d91c61ceb63fe25a5f8
  PROTO:=git
endef
$(eval $(call Download,try_signal))

PKG_UNPACK:=$(HOST_TAR) -C $(PKG_BUILD_DIR) --strip-components=1 -xzf $(DL_DIR)/$(PKG_SOURCE)

define Build/Prepare
	$(Build/Prepare/Default)
	$(eval $(Download/try_signal))
	xzcat $(DL_DIR)/$(TITLE) | tar -C $(PKG_BUILD_DIR) $(TAR_OPTIONS)
endef

TARGET_CXXFLAGS += -DBOOST_BIND_GLOBAL_PLACEHOLDERS
TARGET_LDFLAGS += -latomic

CMAKE_OPTIONS += \
	-DCMAKE_BUILD_TYPE=Release \
	-Dpython-bindings=$(if $(CONFIG_PACKAGE_python3-libtorrent),ON,OFF) \
	-Dpython-egg-info=$(if $(CONFIG_PACKAGE_python3-libtorrent),ON,OFF) \
	-DPYTHON_EXECUTABLE=$(STAGING_DIR_HOSTPKG)/bin/python$(PYTHON3_VERSION) \
	-DPYTHON_INCLUDE_DIR=$(STAGING_DIR)/usr/include/python$(PYTHON3_VERSION) \
	-DPYTHON_LIBRARY=$(STAGING_DIR)/usr/lib/libpython$(PYTHON3_VERSION).so \
	-DBOOST_ROOT=$(STAGING_DIR)/usr \
	-DBoost_NO_BOOST_CMAKE=ON

define Build/InstallDev
	$(INSTALL_DIR) $(1)/usr/include $(1)/usr/lib $(1)/usr/lib/pkgconfig
	$(CP) $(PKG_INSTALL_DIR)/usr/include/libtorrent $(1)/usr/include/
	$(CP) $(PKG_INSTALL_DIR)/usr/lib/libtorrent-rasterbar.so* $(1)/usr/lib/
	$(CP) $(PKG_INSTALL_DIR)/usr/lib/pkgconfig/libtorrent-rasterbar.pc $(1)/usr/lib/pkgconfig/
endef

define Package/libtorrent-rasterbar/install
	$(INSTALL_DIR) $(1)/usr/lib
	$(CP) $(PKG_INSTALL_DIR)/usr/lib/libtorrent-rasterbar.so.* $(1)/usr/lib
endef

define Package/python3-libtorrent/install
	$(INSTALL_DIR) $(1)/usr/lib/python$(PYTHON3_VERSION)/site-packages
	$(CP) $(PKG_INSTALL_DIR)/usr/lib/python$(PYTHON3_VERSION)/site-packages/*.so $(1)/usr/lib/python$(PYTHON3_VERSION)/site-packages
endef

$(eval $(call BuildPackage,libtorrent-rasterbar))
$(eval $(call BuildPackage,python3-libtorrent))
