#!/bin/sh

# paths
HOME_DIR="/etc/nikki"
PROFILES_DIR="$HOME_DIR/profiles"
SUBSCRIPTIONS_DIR="$HOME_DIR/subscriptions"
MIXIN_FILE_PATH="$HOME_DIR/mixin.yaml"
RUN_DIR="$HOME_DIR/run"
RUN_PROFILE_PATH="$RUN_DIR/config.yaml"
PROVIDERS_DIR="$RUN_DIR/providers"
RULE_PROVIDERS_DIR="$PROVIDERS_DIR/rule"
PROXY_PROVIDERS_DIR="$PROVIDERS_DIR/proxy"

PROG="$RUN_DIR/mihomo"
ARCH="$(uci -q get nikki.config.core_version)"
GITHUB_TOKEN="$(uci -q get nikki.config.github_token)"
UA="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36"

# log
LOG_DIR="/var/log/nikki"
APP_LOG_PATH="$LOG_DIR/app.log"
CORE_LOG_PATH="$LOG_DIR/core.log"

# temp
TEMP_DIR="/var/run/nikki"
PID_FILE_PATH="$TEMP_DIR/nikki.pid"
TEMP_CONFIG="$TEMP_DIR/config.temp"
STARTED_FLAG_PATH="$TEMP_DIR/started.flag"
BRIDGE_NF_CALL_IPTABLES_FLAG_PATH="$TEMP_DIR/bridge_nf_call_iptables.flag"
BRIDGE_NF_CALL_IP6TABLES_FLAG_PATH="$TEMP_DIR/bridge_nf_call_ip6tables.flag"

# ucode
UCODE_DIR="$HOME_DIR/ucode"
INCLUDE_UC="$UCODE_DIR/include.uc"
MIXIN_UC="$UCODE_DIR/mixin.uc"
HIJACK_UT="$UCODE_DIR/hijack.ut"

# scripts
SH_DIR="$HOME_DIR/scripts"
INCLUDE_SH="$SH_DIR/include.sh"
FIREWALL_INCLUDE_SH="$SH_DIR/firewall_include.sh"

# nftables
NFT_DIR="$HOME_DIR/nftables"
GEOIP_CN_NFT="$NFT_DIR/geoip_cn.nft"
GEOIP6_CN_NFT="$NFT_DIR/geoip6_cn.nft"

[ -d "$LOG_DIR"  ] || mkdir -p "$LOG_DIR"
[ -d "$TEMP_DIR" ] || mkdir -p "$TEMP_DIR"

# functions
format_filesize() {
	local b; b=1
	local kb; kb=$((b * 1024))
	local mb; mb=$((kb * 1024))
	local gb; gb=$((mb * 1024))
	local tb; tb=$((gb * 1024))
	local pb; pb=$((tb * 1024))
	local size; size="$1"
	if [ -n "$size" ]; then
		if [ "$size" -lt "$kb" ]; then
			echo "$(awk "BEGIN {print $size / $b}") B"
		elif [ "$size" -lt "$mb" ]; then
			echo "$(awk "BEGIN {print $size / $kb}") KB"
		elif [ "$size" -lt "$gb" ]; then
			echo "$(awk "BEGIN {print $size / $mb}") MB"
		elif [ "$size" -lt "$tb" ]; then
			echo "$(awk "BEGIN {print $size / $gb}") GB"
		elif [ "$size" -lt "$pb" ]; then
			echo "$(awk "BEGIN {print $size / $tb}") TB"
		else
			echo "$(awk "BEGIN {print $size / $pb}") PB"
		fi
	fi
}

[ -z "$lang" ] && lang=$(uci get luci.main.lang 2>/dev/null)
[ -z "$lang" ] && lang="en"

translate() {
	local tpl="$1"; shift
	local translated
	translated=$(TR_LANG="$lang" TR_TPL="$tpl" lua -e '
		local lang = os.getenv("TR_LANG")
		local tpl  = os.getenv("TR_TPL")
		require "luci.i18n".setlanguage(lang)
		print(require "luci.i18n".translate(tpl))
	' 2>/dev/null)
	[ -z "$translated" ] && translated="$tpl"
	[ $# -gt 0 ] && printf "$translated" "$@" || printf '%s' "$translated"
}

log() {
	local level="$1"; shift
	local tpl="$1"; shift
	local msg
	msg="$(translate "$tpl" "$@")"
	echo "[$(date "+%Y-%m-%d %H:%M:%S")] [$level] $msg" >> "$APP_LOG_PATH"
}

strip_proxy_prefix() {
    echo "$1" | sed -E \
        -e 's|^https?://gh-proxy\.com/https?://|https://|' \
        -e 's|^https?://gh-proxy\.com/|https://|' \
        -e 's|^https?://ghproxy\.com/https?://|https://|' \
        -e 's|^https?://ghproxy\.com/|https://|' \
        -e 's|^https?://mirror\.ghproxy\.com/https?://|https://|' \
        -e 's|^https?://mirror\.ghproxy\.com/|https://|' \
        -e 's|^https?://ghps\.cc/https?://|https://|' \
        -e 's|^https?://ghps\.cc/|https://|' \
        -e 's|^https?://ghfast\.top/https?://|https://|' \
        -e 's|^https?://ghfast\.top/|https://|' \
        -e 's|^https?://gh\.api\.99988866\.xyz/https?://|https://|' \
        -e 's|^https?://gh\.api\.99988866\.xyz/|https://|' \
        -e 's|^https?://gh\.con\.sh/https?://|https://|' \
        -e 's|^https?://gh\.con\.sh/|https://|' \
        -e 's|^https?://gh\.liuzhijin\.cn/https?://|https://|' \
        -e 's|^https?://gh\.liuzhijin\.cn/|https://|' \
        -e 's|^https?://gh\.moeyy\.cn/https?://|https://|' \
        -e 's|^https?://gh\.moeyy\.cn/|https://|' \
        -e 's|^https?://ghproxy\.net/https?://|https://|' \
        -e 's|^https?://ghproxy\.net/|https://|' \
        -e 's|^https?://github\.moeyy\.xyz/https?://|https://|' \
        -e 's|^https?://github\.moeyy\.xyz/|https://|' \
        -e 's|^https?://hub\.gitmirror\.com/https?://|https://|' \
        -e 's|^https?://hub\.gitmirror\.com/|https://|' \
        -e 's|^https?://kkgithub\.com/https?://|https://|' \
        -e 's|^https?://kkgithub\.com/|https://|' \
        -e 's|^https?://raw\.ghproxy\.cc/https?://|https://|' \
        -e 's|^https?://raw\.ghproxy\.cc/|https://|'
}

parse_github_url() {
    _url="$1"
    _tmp=$(echo "$_url" | sed -E -n \
        -e 's|^https://raw\.githubusercontent\.com/([^/]+)/([^/]+)/refs/heads/([^/]+)/(.+)|\1 \2 \3 \4|p' \
        -e 's|^https://raw\.githubusercontent\.com/([^/]+)/([^/]+)/refs/tags/([^/]+)/(.+)|\1 \2 \3 \4|p' \
        -e 's|^https://raw\.githubusercontent\.com/([^/]+)/([^/]+)/([^/]+)/(.+)|\1 \2 \3 \4|p')
    [ -n "$_tmp" ] && { echo "$_tmp"; return; }

    # github.com
    _tmp=$(echo "$_url" | sed -E -n \
        -e 's|^https://github\.com/([^/]+)/([^/]+)/raw/refs/heads/([^/]+)/(.+)|\1 \2 \3 \4|p' \
        -e 's|^https://github\.com/([^/]+)/([^/]+)/raw/refs/tags/([^/]+)/(.+)|\1 \2 \3 \4|p' \
        -e 's|^https://github\.com/([^/]+)/([^/]+)/raw/([^/]+)/(.+)|\1 \2 \3 \4|p' \
        -e 's|^https://github\.com/([^/]+)/([^/]+)/blob/([^/]+)/(.+)|\1 \2 \3 \4|p' \
        -e 's|^https://github\.com/([^/]+)/([^/]+)/releases/download/([^/]+)/(.+)|\1 \2 \3 \4|p')
    [ -n "$_tmp" ] && { echo "$_tmp"; return; }

    echo ""
}

mirror_github_url() {
    _url="$1" _target="$2"
    [ -z "$_url" ] && { echo ""; return; }

    _url=$(strip_proxy_prefix "$_url")

    if [ -z "$_target" ] || [ "$_target" = "raw" ] || [ "$_target" = "github" ]; then
        echo "$_url"
        return
    fi

    case "$_target" in
        jsdelivr|cdn|fastly|testingcf|gcore)
            _parsed=$(parse_github_url "$_url")
            [ -z "$_parsed" ] && { echo "$_url"; return; }

            set -- $_parsed
            [ $# -lt 4 ] && { echo "$_url"; return; }

            _domain="cdn.jsdelivr.net"
            [ "$_target" = "fastly" ]    && _domain="fastly.jsdelivr.net"
            [ "$_target" = "testingcf" ] && _domain="testingcf.jsdelivr.net"
            [ "$_target" = "gcore" ]     && _domain="gcore.jsdelivr.net"

            echo "https://$_domain/gh/$1/$2@$3/$4"
            return
            ;;
    esac

    case "$_target" in
        ghproxy)         echo "https://ghproxy.com/$_url" ;;
        ghfast)          echo "https://ghfast.top/$_url" ;;
        gitmirror)       echo "https://hub.gitmirror.com/$_url" ;;
        moeyy)           echo "https://github.moeyy.xyz/$_url" ;;
        kkgithub)        echo "https://kkgithub.com/$_url" ;;
        ghps)            echo "https://ghps.cc/$_url" ;;
        ghproxy_net)     echo "https://ghproxy.net/$_url" ;;
        ghproxy_cc)      echo "https://raw.ghproxy.cc/$_url" ;;
        gh_con_sh)       echo "https://gh.con.sh/$_url" ;;
        gh_liuzhijin)    echo "https://gh.liuzhijin.cn/$_url" ;;
        gh_moeyy_cn)     echo "https://gh.moeyy.cn/$_url" ;;
        gh_skactor)      echo "https://gh.skactor.top/$_url" ;;
        gh_tryxd)        echo "https://gh.tryxd.cn/$_url" ;;
        gh_api_99988866) echo "https://gh.api.99988866.xyz/$_url" ;;
        *)               echo "$_url" ;;
    esac
}
