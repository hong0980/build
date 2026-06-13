include $(TOPDIR)/rules.mk

PKG_VERSION:=1.26.1
LUCI_TITLE:=Transparent Proxy with Mihomo on OpenWrt.
LUCI_DEPENDS:=+luci-base +ca-bundle +curl +yq firewall4 +ip-full +kmod-inet-diag +kmod-nft-socket +kmod-nft-tproxy +kmod-tun +kmod-dummy +mihomo

include $(TOPDIR)/feeds/luci/luci.mk

# call BuildPackage - OpenWrt buildroot signature
