#!/bin/sh

. "$IPKG_INSTROOT/etc/nikki/scripts/include.sh"
CACHE_DIR="$RUN_DIR/core"
ACTION="$1"
auth_header="${GITHUB_TOKEN:+Authorization: Bearer $GITHUB_TOKEN}"

get_ui_url() {
	local repo="$1" asset_pattern="$2"
	local api_out status tag asset_count i name url

	api_out=$(github_api "repos/${repo}/releases/latest")
	status=$(echo "$api_out" | jsonfilter -qe '@.status' 2>/dev/null)
	[ "$status" = "error" ] && { echo "$api_out"; return 1; }

	tag=$(echo "$api_out" | jsonfilter -qe '@.tag_name' 2>/dev/null)
	asset_count=$(echo "$api_out" | jsonfilter -qe '@.assets[*].name' 2>/dev/null | wc -l)

	i=0
	while [ "$i" -lt "$asset_count" ]; do
		name=$(echo "$api_out" | jsonfilter -qe "@.assets[$i].name" 2>/dev/null)
		url=$(echo "$api_out" | jsonfilter -qe "@.assets[$i].browser_download_url" 2>/dev/null)

		case "$name" in
			*"$asset_pattern"*)
				echo '{"status":"ok","url":"'$url'","tag":"'$tag'","name":"'$name'"}'
				return 0
				;;
		esac
		i=$((i + 1))
	done

	echo '{"status":"error","message":"no matching asset for '${asset_pattern}'"}'
	return 1
}

github_api() {
	local api_path="$1" api_out msg

	api_out=$(curl -sL --max-time 15 \
		${auth_header:+-H "$auth_header"} \
		-A "${UA:-Mozilla/5.0}" "https://api.github.com/${api_path}" 2>/dev/null)

	if [ -z "$api_out" ]; then
		echo '{"status":"error","message":"github api empty response"}'
		return 1
	fi

	msg=$(echo "$api_out" | jsonfilter -qe '@.message' 2>/dev/null)
	if [ -n "$msg" ]; then
		printf '{"status":"error","message":"github api error: %s"}\n' "$msg"
		return 1
	fi

	echo "$api_out"
}

get_core_url() {
	local api_out status tag filename url asset_count prefix found_url i name

	if [ -z "$CORE_TYPE" -a -z "$ARCH" ]; then
		echo '{"status":"error","message":"missing params"}'
		return 1
	fi

	if [ "$CORE_TYPE" = "smart" ]; then
		echo '{"status":"ok","url":"https://raw.githubusercontent.com/vernesong/OpenClash/core/dev/smart/clash-'${ARCH}'-compatible.tar.gz"}'
		return 0
	fi

	case "$CORE_TYPE" in
		meta)
			api_out=$(github_api "repos/MetaCubeX/mihomo/releases/latest")
			;;
		alpha)
			api_out=$(github_api "repos/MetaCubeX/mihomo/releases/tags/Prerelease-Alpha")
			;;
		*)
			echo '{"status":"error","message":"invalid core type"}'
			return 1
			;;
	esac

	status=$(echo "$api_out" | jsonfilter -qe '@.status' 2>/dev/null)
	if [ "$status" = "error" ]; then
		echo "$api_out"
		return 1
	fi

	tag=$(echo "$api_out" | jsonfilter -qe '@.tag_name' 2>/dev/null)

	if [ "$CORE_TYPE" = "meta" ]; then
		if [ -z "$tag" ]; then
			echo '{"status":"error","message":"no tag found"}'
			return 1
		fi
		filename="mihomo-${ARCH}-compatible-${tag}.gz"
		url="https://github.com/MetaCubeX/mihomo/releases/download/${tag}/${filename}"
		echo '{"status":"ok","url":"'$url'"}'
		return 0
	fi

	asset_count=$(echo "$api_out" | jsonfilter -qe '@.assets[*].name' 2>/dev/null | wc -l)
	if [ "$asset_count" -eq 0 ]; then
		echo '{"status":"error","message":"no assets found"}'
		return 1
	fi

	prefix="mihomo-${ARCH}"
	found_url=""

	i=0
	while [ "$i" -lt "$asset_count" ]; do
		name=$(echo "$api_out" | jsonfilter -qe "@.assets[$i].name" 2>/dev/null)
		url=$(echo "$api_out"  | jsonfilter -qe "@.assets[$i].browser_download_url" 2>/dev/null)

		case "$name" in
			*"${prefix}"*".gz"*)
				if [ -z "$found_url" ]; then
					found_url="$url"
				fi
				case "$name" in
					*"compatible"*)
						found_url="$url"
						break
						;;
				esac
				;;
		esac
		i=$((i + 1))
	done

	if [ -z "$found_url" ]; then
		echo '{"status":"error","message":"no matching asset for '${ARCH}'"}'
		return 1
	fi

	echo '{"status":"ok","url":"'$found_url'"}'
}

do_cache() {
	local CORE_TYPE="$1"
	[ -z "$CORE_TYPE" -a -z "$ARCH" ] && { log "error" "cache_core missing params"; echo '{"status":"error","message":"missing params"}'; return 1; }

	local out_name="${CORE_TYPE}-mihomo"
	local final_out="${CACHE_DIR}/${out_name}"
	local status_file="/tmp/nikki_dl_${CORE_TYPE}.status"
	local log_file="/tmp/nikki_dl_${CORE_TYPE}.log"
	local lock_file="/tmp/nikki_dl_${CORE_TYPE}.lock"

	local url_json url_status msg url
	url_json=$(get_core_url)
	eval "$(echo "$url_json" | jsonfilter -e 'url_status=@.status' -e 'msg=@.message' -e 'url=@.url' 2>/dev/null)"

	if [ "$url_status" != "ok" ]; then
		log "error" "cache_core get url failed"
		echo "error: get url failed: ${msg:-unknown}" > "$status_file"
		return 1
	fi

	exec 200>"$lock_file"
	if ! flock -n 200; then
		log "info" "cache_core already running"
		echo "downloading" > "$status_file"
		return 0
	fi

	local archive_name="$([ "$CORE_TYPE" = "smart" ] && echo "mihomo.tar.gz" || echo "mihomo.gz")"
	local archive_path="/tmp/${CORE_TYPE}-${archive_name}"
	local tmp_file="/tmp/${out_name}.tmp"

	rm -f "$log_file" "$archive_path" "$tmp_file"
	echo "downloading" > "$status_file"
	log "info" "cache_core start"

	curl -SsL --connect-timeout 15 --max-time 120 --retry 3 --retry-delay 2 \
		${auth_header:+-H "$auth_header"} \
		-A "$UA" -o "$archive_path" "$url" 2>>"$log_file"

	if [ $? -ne 0 ] || [ ! -s "$archive_path" ]; then
		log "error" "cache_core download failed"
		echo "error: download failed" > "$status_file"
		flock -u 200 2>/dev/null
		return 1
	fi

	if [ "$CORE_TYPE" = "smart" ]; then
		tar -xzf "$archive_path" -O > "$tmp_file" 2>>"$log_file"
	else
		gzip -dc "$archive_path" > "$tmp_file" 2>>"$log_file"
	fi

	if [ -s "$tmp_file" ]; then
		mv -f "$tmp_file" "$final_out"
		chmod 755 "$final_out"
		rm -f "$archive_path"
		echo "done" > "$status_file"
		log "info" "cache_core done"
		flock -u 200 2>/dev/null
	else
		log "error" "cache_core tmp file missing or empty"
		echo "error: tmp file missing" > "$status_file"
		flock -u 200 2>/dev/null
		return 1
	fi
}

update_ui() {
	local url="$1" name="$2" ui_path="${3:-ui}"
	local target_dir="${RUN_DIR}/${ui_path}/${name}"
	local status_file="/tmp/nikki_dl_ui_${name}.status"
	local log_file="/tmp/nikki_dl_ui_${name}.log"
	local tmp_zip="/tmp/ui_${name}_$$.zip"
	local curl_ret file_count dir_count subdir tmp

	rm -f "$status_file" "$log_file" "$tmp_zip"
	mkdir -p "$target_dir"

	echo "downloading" > "$status_file"
	log "info" "update_ui start"

	curl -SsL --connect-timeout 15 --max-time 120 --retry 3 --retry-delay 2 \
		-A "$UA" -o "$tmp_zip" "$url" 2>>"$log_file"

	curl_ret=$?
	if [ $curl_ret -ne 0 ] || [ ! -s "$tmp_zip" ]; then
		log "error" "update_ui download failed"
		echo "error: download failed" > "$status_file"
		rm -f "$tmp_zip"
		return 1
	fi

	if ! unzip -o "$tmp_zip" -d "$target_dir" 2>>"$log_file"; then
		log "error" "update_ui unzip failed"
		echo "error: unzip failed" > "$status_file"
		rm -f "$tmp_zip"
		return 1
	fi

	file_count=$(find "$target_dir" -maxdepth 1 -type f 2>/dev/null | wc -l)
	dir_count=$(find "$target_dir" -maxdepth 1 -mindepth 1 -type d 2>/dev/null | wc -l)

	if [ "$file_count" -eq 0 ] && [ "$dir_count" -eq 1 ]; then
		subdir=$(find "$target_dir" -maxdepth 1 -mindepth 1 -type d 2>/dev/null)
		tmp="/tmp/ui_flatten_$$"
		mkdir -p "$tmp"
		mv "$subdir"/* "$tmp/" 2>/dev/null
		mv "$subdir"/.* "$tmp/" 2>/dev/null
		rm -rf "$subdir"
		mv "$tmp"/* "$target_dir/" 2>/dev/null
		mv "$tmp"/.* "$target_dir/" 2>/dev/null
		rmdir "$tmp" 2>/dev/null
		log "info" "update_ui flattened"
	fi

	rm -f "$tmp_zip"
	echo "done" > "$status_file"
	log "info" "update_ui done"
}

case "$ACTION" in
	get_url)
		CORE_TYPE="$2"
		get_core_url "$2"
		;;
	cache)
		do_cache "$2"
		;;
	update_ui)
		update_ui "$2" "$3" "$4"
		;;
	*)
		echo '{"status":"error","message":"invalid action: '$ACTION'"}'
		exit 1
		;;
esac
