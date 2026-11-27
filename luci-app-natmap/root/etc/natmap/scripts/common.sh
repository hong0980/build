#!/bin/sh
# Copyright (C) 2023 muink https://github.com/muink
#
# depends curl jsonfilter

# JSON_EXPORT <json>
JSON_EXPORT() {
	for k in $ALL_PARAMS; do
		jsonfilter -qs "$1" -e "$k=@['$k']"
	done
}

# INIT_GLOBAL_VAR <var1> [var2] [var3] ...
INIT_GLOBAL_VAR() {
	for _key in "$@"; do
		eval "$_key=''"
	done
}

# http_call <extra_curl_args...>
http_call() {
	curl -sS -L -k \
		--connect-timeout 3 \
		--max-time 10 \
		--retry 5 \
		"$@"
}

log() { echo "$*" >&2; }

# nft -c -a list chain inet fw4 dstnat_lan
# nft -c -a list chain inet fw4 srcnat_lan
