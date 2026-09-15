include $(TOPDIR)/rules.mk

PKG_NAME:=luci-app-nikki
PKG_VERSION:=1.26.1

LUCI_TITLE:=Transparent Proxy with Mihomo on OpenWrt.
LUCI_DEPENDS:=+luci-base +ca-bundle +curl +wget +yq +firewall4 +ip-full +coreutils-nohup +coreutils-timeout +kmod-inet-diag +kmod-nft-socket +kmod-nft-tproxy +kmod-tun +kmod-dummy +mihomo +unzip

include $(TOPDIR)/feeds/luci/luci.mk

# call BuildPackage - OpenWrt buildroot signature
