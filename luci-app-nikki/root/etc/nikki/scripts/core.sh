#!/bin/sh

. /lib/functions.sh
. "$IPKG_INSTROOT/etc/nikki/scripts/include.sh"
auth_header="${GITHUB_TOKEN:+Authorization: Bearer $GITHUB_TOKEN}"
CACHE_TTL=3600

set_status() { printf '%s\n' "$2" > "$1"; }

mirror_url() {
	local url="$1" target
	target="$(uci -q get nikki.mixin.github_mirror)"
	[ -z "$target" ] && target='raw'

	ucode -e "
		import { mirrorGithubUrl } from '/etc/nikki/ucode/include.uc';
		print(mirrorGithubUrl(ARGV[0], ARGV[1]));
	" "$url" "$target"
}

utc_to_cst() {
	local iso="$1"
	local tz=$(uci -q get system.@system[0].timezone 2>/dev/null || echo 'CST-8')
	local offset=$(echo "$tz" | grep -oE '[+-]?[0-9]+' | head -1)

	echo "$iso" | awk -v off="${offset:-0}" '{
		gsub(/[-T:Z]/, " ")
		utc = mktime($1" "$2" "$3" "$4" "$5" "$6)
		if (utc < 0) { print "Invalid"; exit }
		print strftime("%m-%d %H:%M", utc - off * 3600)
	}'
}

urlencode() {
	local url="$1"
	ucode -e '
		const s = ARGV[0];
		let out = "";
		for (let i = 0; i < length(s); i++) {
			const c = substr(s, i, 1);
			if (match(c, /^[A-Za-z0-9_.~-]$/))
				out += c;
			else
				out += sprintf("%%%02X", ord(c));
		}
		print(out);
	' "$url"
}

_conv_str() {
	[ -n "$2" ] && QS="$QS&$1=$(urlencode "$2")"
}

_try_download() {
	local url="$1" ua="$2" out="$3" hdr="$4" add_flag="${5:-1}"
	local sep req_url="$url"

	if [ "$add_flag" = "1" ]; then
		case "$url" in
			*\?*) sep='&' ;;
			*)    sep='?' ;;
		esac
		req_url="${url}${sep}flag=${ua}"
	fi

	curl -sfL --max-time 120 --connect-timeout 15 --retry 2 \
		-A "$ua" -D "$hdr" -o "$out" "$req_url" > /dev/null 2>&1 || return 1

	[ "$(yq -r '(has("proxies") and has("proxy-groups")) // false' "$out" 2>/dev/null)" = "true" ]
}

build_converter_url() {
	local sub_url="$1" base sep flag val
	case "$converter_service" in
		api.asailor.org)     base="https://api.asailor.org/sub?target=clash" ;;
		api.wcc.best) base="https://api.wcc.best/sub?target=clash" ;;
		custom)              base="$converter_url" ;;
		*) return 1 ;;
	esac
	[ -z "$base" ] && return 1
	case "$base" in *\?*) sep='&' ;; *) sep='?' ;; esac

	local QS="url=$(urlencode "$sub_url")"
	_conv_str config   "$converter_template"
	_conv_str token    "$converter_token"
	_conv_str group    "$converter_group"
	_conv_str filename "$converter_filename"
	_conv_str include  "$converter_include"
	_conv_str exclude  "$converter_exclude"
	_conv_str rename   "$converter_rename"
	_conv_str script   "$converter_script"

	for flag in emoji udp tfo tls13 scv fdn sort expand new_name \
				append_type append_info classic list info; do
		eval "val=\$converter_$flag"
		[ "$val" = "1" ] && QS="$QS&$flag=true"
	done

	converter_extra="${converter_extra#&}"
	[ -n "$converter_extra" ] && QS="$QS&$converter_extra"

	printf '%s%s%s' "$base" "$sep" "$QS"
}

update_subscription() {
	local section="$1" temp_config="$(mktemp)"
	[ -z "$section" ] && return
	config_load nikki

	local url name info_url user_agent detected_ua success=0 \
		  header_tmpfile info_file used_ua ua

	config_get url         "$section" url
	config_get name        "$section" name
	config_get info_url    "$section" info_url
	config_get user_agent  "$section" user_agent
	config_get detected_ua "$section" detected_user_agent

	local use_converter converter_service converter_url converter_template \
		  converter_token converter_group converter_filename \
		  converter_include converter_exclude converter_rename converter_script \
		  converter_emoji converter_udp converter_tfo converter_tls13 \
		  converter_scv converter_sort converter_fdn converter_expand \
		  converter_new_name converter_append_type converter_append_info \
		  converter_classic converter_list converter_info_node \
		  converter_extra
	config_get use_converter           "$section" use_converter           0
	config_get converter_service       "$section" converter_service       none
	config_get converter_url           "$section" converter_url           ""
	config_get converter_template      "$section" converter_template      ""
	config_get converter_token         "$section" converter_token         ""
	config_get converter_group         "$section" converter_group         ""
	config_get converter_filename      "$section" converter_filename      ""
	config_get converter_include       "$section" converter_include       ""
	config_get converter_exclude       "$section" converter_exclude       ""
	config_get converter_rename        "$section" converter_rename        ""
	config_get converter_script        "$section" converter_script        ""
	config_get converter_emoji         "$section" converter_emoji         0
	config_get converter_udp           "$section" converter_udp           1
	config_get converter_tfo           "$section" converter_tfo           0
	config_get converter_tls13         "$section" converter_tls13         0
	config_get converter_scv           "$section" converter_scv           0
	config_get converter_sort          "$section" converter_sort          1
	config_get converter_fdn           "$section" converter_fdn           0
	config_get converter_expand        "$section" converter_expand        0
	config_get converter_new_name      "$section" converter_new_name      0
	config_get converter_append_type   "$section" converter_append_type   1
	config_get converter_append_info   "$section" converter_append_info   0
	config_get converter_classic       "$section" converter_classic       0
	config_get converter_list          "$section" converter_list          0
	config_get converter_info_node     "$section" converter_info_node     0
	config_get converter_extra         "$section" converter_extra         ""

	local req_url="$url" add_flag=1
	if [ "$use_converter" = "1" ] && [ "$converter_service" != "none" ]; then
		log "Profile" "Use online converter: %s." "$converter_service"
		if req_url=$(build_converter_url "$url"); then
			add_flag=0
		else
			log "Profile" "Converter misconfigured, fallback to direct download."
			req_url="$url"
		fi
	fi

	log "Profile" "Update subscription: %s." "${name:-<unnamed>}"
	header_tmpfile="$TEMP_DIR/$section.header"

	log "Profile" "Download subscription."
	if [ -z "$user_agent" -o "$user_agent" = "auto" ]; then
		set -- "$detected_ua" meta clash clash.meta mihomo
	else
		set -- "$user_agent"
	fi

	for ua in "$@"; do
		[ -z "$ua" ] && continue
		_try_download "$req_url" "$ua" "$temp_config" "$header_tmpfile" "$add_flag" && {
			success=1
			used_ua="$ua"
			break
		}
	done

	if grep -q -i "subscription-userinfo:" "$header_tmpfile" 2>/dev/null; then
		info_file="$header_tmpfile"
	fi

	if [ "$success" != 1 ]; then
		log "Profile" "Subscription update failed."
		rm -f "$temp_config" "$header_tmpfile"
		uci_commit nikki
		return 1
	fi

	local userinfo expire upload download total used avaliable \
		  web_page_url content_disp sub_name name_changed=0

	content_disp=$(cat "$header_tmpfile" 2>/dev/null | grep -m1 -i "^content-disposition:" | tr -d '\r')
	content_disp=$(echo "$content_disp" | sed -En "s/.*filename\*=UTF-8''([^;[:space:]]*).*/\1/p")
	[ -n "$content_disp" ] && sub_name=$(printf '%b' "${content_disp//%/\\x}")
	sub_name=${sub_name//[\/\\:\*\?\"\<\>\|\ ]/_}

	if [ -z "$name" ]; then
		host=${url#*://}; host=${host%%[/?#]*}; host=${host%%:*}
		case $host in
			*[!0-9.]*)
				def=${host%.*}; def=${def##*.} ;;
			*)
				def=$host ;;
		esac
		name="${sub_name:-$def}"
		name_changed=1
	fi
	log "Profile" "Subscription update successful."

	if [ -f "$info_file" ]; then
		userinfo=$(grep -i "subscription-userinfo:" "$info_file" | tr -d '\r')
		total=$(echo    "$userinfo" | sed -En 's/.*total=([0-9]*).*/\1/p')
		expire=$(echo   "$userinfo" | sed -En 's/.*expire=([0-9]*).*/\1/p')
		upload=$(echo   "$userinfo" | sed -En 's/.*upload=([0-9]*).*/\1/p')
		download=$(echo "$userinfo" | sed -En 's/.*download=([0-9]*).*/\1/p')

		if [ -n "$upload" ] && [ -n "$download" ]; then
			used=$((upload + download))
			[ -n "$total" ] && avaliable=$((total - used))
		fi

		web_page_url=$(grep -m1 -i "^profile-web-page-url:" "$info_file" | sed -En 's/^[^:]*:[[:space:]]*(.*)$/\1/p' | tr -d '\r')

		for opt in used total avaliable; do
			eval "val=\$$opt"
			[ -n "$val" ] && uci_set nikki "$section" "$opt" "$(format_filesize "$val")"
		done
		[ -n "$expire" ]       && uci_set nikki "$section" expire       "$(date "+%Y-%m-%d %H:%M:%S" -d "@$expire")"
		[ -n "$web_page_url" ] && uci_set nikki "$section" web_page_url "$web_page_url"
	fi

	[ "$name_changed" = 1 ] && uci_set nikki "$section" name "$name"
	[ -n "$used_ua" ] && [ "$used_ua" != "$detected_ua" ] && uci_set nikki "$section" detected_user_agent "$used_ua"
	uci_set nikki "$section" update "$(date "+%Y-%m-%d %H:%M:%S")"
	mv -f "$temp_config" "$SUBSCRIPTIONS_DIR/$name.yaml"
	rm -f "$header_tmpfile"
	uci_commit nikki
	return 0
}

_Download() {
	local task_id="$1" url="$2" output="$3"
	local log_file="/tmp/dl_${task_id}.log"
	local status_file="/tmp/dl_${task_id}.status"
	local progress_file="/tmp/dl_${task_id}.progress"
	local ret mirrored_url; mirrored_url=$(mirror_url "$url")

	if command -v wget >/dev/null 2>&1; then
		wget -T 15 --user-agent="$UA" -O "$output" "$mirrored_url" >>"$log_file" 2>&1 &
		local pid=$!
		(
			while kill -0 $pid 2>/dev/null; do
				local pct=$(tail -c 500 "$log_file" 2>/dev/null | tr '\r' '\n' | sed -n 's/.*[[:space:]]\([0-9]\{1,3\}\)%.*/\1/p' | tail -1)
				[ -n "$pct" ] && echo "$pct" > "$progress_file"
				sleep 1
			done
			echo "100" > "$progress_file" 2>/dev/null
		) &
		wait $pid
		ret=$?
	# elif command -v axel >/dev/null 2>&1; then
	# 	rm -f "${output}.st" "${output}"
	# 	axel -p -T 15 -U "$UA" -o "$output" "$mirrored_url" >"$progress_file" 2>>"$log_file"
	# 	ret=$?
	else
		curl -SsL --connect-timeout 15 --max-time 300 --retry 3 --retry-delay 2 \
			-A "$UA" -o "$output" "$mirrored_url" 2>>"$log_file" &
		local pid=$!
		local total_size=$(curl -sIL -A "$UA" "$mirrored_url" 2>/dev/null | grep -i '^content-length:' | tail -1 | awk '{print $2}' | tr -d '\r')

		if [ -n "$total_size" ] && [ "$total_size" -gt 0 ]; then
			(
				while kill -0 $pid 2>/dev/null; do
					local cur=0
					[ -f "$output" ] && cur=$(wc -c < "$output" 2>/dev/null || echo 0)
					local pct=$(( cur * 100 / total_size ))
					[ "$pct" -gt 100 ] && pct=100
					echo "$pct" > "$progress_file"
					sleep 1
				done
				echo "100" > "$progress_file" 2>/dev/null
			) &
		fi
		wait $pid
		ret=$?
	fi

	if [ $ret -ne 0 ] || [ ! -s "$output" ]; then
		set_status "$status_file" "error: download failed"
		rm -f "$output"
		return 1
	fi
}

github_api() {
	local api_path="$1" task_id="$2" tag
	local now=$(date +%s) cache_file="${TEMP_DIR}/${task_id}.cache"

	if [ -f "$cache_file" ]; then
		local age=$(( now - $(head -n1 "$cache_file" 2>/dev/null || echo 0) ))
		[ "$age" -lt "$CACHE_TTL" ] && { tail -n +2 "$cache_file"; return 0; }
	fi

	if [ "$task_id" = "meta" ]; then
		tag=$(curl -sI --max-time 10 "https://github.com/MetaCubeX/mihomo/releases/latest" 2>/dev/null | \
			grep -i "^location:" | sed -n 's|.*/tag/\(.*\)|\1|p' | tr -d '\r\n')
		[ -z "$tag" ] && { printf '{"status":"error","message":"failed to get latest tag"}\n'; return 1; }
		api_path="${api_path}${tag}"
	elif [ "$task_id" = "smart_oix" ]; then
		api_path="${api_path}Pre-Alpha"
	else
		api_path="${api_path}Prerelease-Alpha"
	fi

	local api_out=$(curl -sL --max-time 15 ${auth_header:+-H "$auth_header"} -A "$UA" \
		"https://api.github.com/${api_path}" 2>/dev/null)

	[ -z "$api_out" ] && { printf '{"status":"error","message":"github api empty response"}\n'; return 1; }

	local msg=$(printf '%s' "$api_out" | jsonfilter -qe '@.message' 2>/dev/null)
	[ -n "$msg" ] && { printf '{"status":"error","message":"github api error: %s"}\n' "$msg"; return 1; }

	local urls=$(printf '%s' "$api_out" | jsonfilter -qe '@.assets[*].browser_download_url' | \
		grep "/mihomo-${ARCH}-[^/]*\.gz$" | grep -v '\-go[0-9]')

	local updated_at=$(printf '%s' "$api_out" | jsonfilter -qe '@.updated_at' 2>/dev/null)

	{
		printf '%s\n' "$now"
		printf '%s\n' "$urls"
		printf '%s\n' "$(utc_to_cst "$updated_at")"
	} > "${cache_file}.tmp" && mv "${cache_file}.tmp" "$cache_file"

	tail -n +2 "$cache_file"
}

get_core_url() {
	local task_id="$1" api_out urls_only found_url updated_at

	case "$task_id" in
		meta)      api_out=$(github_api "repos/MetaCubeX/mihomo/releases/tags/"     "$task_id") ;;
		alpha)     api_out=$(github_api "repos/MetaCubeX/mihomo/releases/tags/"     "$task_id") ;;
		smart)     api_out=$(github_api "repos/vernesong/mihomo/releases/tags/"     "$task_id") ;;
		smart_oix) api_out=$(github_api "repos/vernesong/mihomo-oix/releases/tags/" "$task_id") ;;
	esac
	[ -n "$api_out" ] || { printf '{"status":"error","message":"no api out"}\n'; return 1; }

	updated_at=$(printf '%s\n' "$api_out" | tail -n 1)
	urls_only=$(printf '%s\n' "$api_out" | sed '$d')

	found_url=$(printf '%s\n' "$urls_only" | grep "compatible" | head -n 1)
	[ -z "$found_url" ] && found_url=$(printf '%s\n' "$urls_only" | grep "\-v1-" | head -n 1)
	[ -z "$found_url" ] && found_url=$(printf '%s\n' "$urls_only" | head -n 1)
	[ -z "$found_url" ] && { printf '{"status":"error","message":"no matching asset for %s"}\n' "$ARCH"; return 1; }

	printf '{"status":"ok","url":"%s","updated_at":"%s"}\n' "$found_url" "$updated_at"
}

do_cache() {
	local task_id="$1" url CORE_DIR; CORE_DIR="$RUN_DIR/core"
	local final_out archive_path status_file url_json msg tmp_out

	if [ -z "$task_id" ] || [ -z "$ARCH" ]; then
		log "error" "cache_core missing params"
		return 1
	fi
	mkdir -p "$CORE_DIR"

	final_out="${CORE_DIR}/${task_id}-mihomo"
	archive_path="/tmp/${task_id}-mihomo.gz"
	status_file="/tmp/dl_${task_id}.status"

	url_json=$(get_core_url "$task_id")
	url=$(printf '%s' "$url_json" | jsonfilter -e '@.url' 2>/dev/null)
	if [ -z "$url" ]; then
		msg=$(printf '%s' "$url_json" | jsonfilter -e '@.message' 2>/dev/null)
		set_status "$status_file" "error: get url failed: ${msg:-unknown}"
		return 1
	fi

	_Download "$task_id" "$url" "$archive_path" || return 1

	tmp_out="${final_out}.tmp.$$"
	if gzip -dc "$archive_path" > "$tmp_out" 2>>"/tmp/dl_${task_id}.log" && [ -s "$tmp_out" ]; then
		mv -f "$tmp_out" "$final_out"
		chmod 755 "$final_out"
		rm -f "$archive_path"
		set_status "$status_file" "done"
	else
		set_status "$status_file" "error: extract failed"
		rm -f "$tmp_out" "$archive_path"
		return 1
	fi
}

download_file() {
	local task_id="$1" url="$2" path="$3"
	_Download "$task_id" "$url" "$path" && set_status "/tmp/dl_${task_id}.status" "done"
}

update_ui() {
	local task_id="$1" url="$2" target_dir="$3" src_dir
	local tmp_zip="/tmp/nikki_ui_${task_id}_$$.zip"
	local temp_dir=$(mktemp -d)

	if ! { _Download "$task_id" "$url" "$tmp_zip" \
		   && unzip -o "$tmp_zip" -d "$temp_dir" 2>>"/tmp/dl_${task_id}.log"; }; then
		set_status "/tmp/dl_${task_id}.status" "error: download or unzip failed"
		rm -rf "$tmp_zip" "$temp_dir"
		return 1
	fi

	set -- "$temp_dir"/*/index.html
	if [ -f "$1" ]; then
		src_dir="${1%/index.html}"
	else
		set_status "/tmp/dl_${task_id}.status" "error: invalid package"
		rm -rf "$tmp_zip" "$temp_dir"
		return 1
	fi

	rm -rf "${target_dir:?}"
	mkdir -p "$target_dir"
	cp -a "$src_dir"/. "$target_dir"/

	rm -rf "$tmp_zip" "$temp_dir"
	set_status "/tmp/dl_${task_id}.status" "done"
}

ACTION="$1"
shift
case "$ACTION" in
	get_core_url)  get_core_url "$1" ;;
	do_cache)      do_cache "$1" ;;
	update_ui)     update_ui "$1" "$2" "$3" ;;
	download_file) download_file "$1" "$2" "$3" ;;
	update_subscription) update_subscription "$1" ;;
esac
