include $(TOPDIR)/rules.mk

PKG_NAME:=luci-app-mesh-node
PKG_VERSION:=1.0.0
PKG_RELEASE:=1

LUCI_TITLE:=LuCI Mesh Node Configurator
LUCI_DEPENDS:=+mesh11sd +wpad-mbedtls +ip-full +kmod-nft-bridge +luci-ssl \
			  +luci-app-usteer +luci-proto-batman-adv +batctl-full

include $(TOPDIR)/feeds/luci/luci.mk

# call BuildPackage - OpenWrt buildroot signature
