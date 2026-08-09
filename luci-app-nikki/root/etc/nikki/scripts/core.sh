#!/bin/sh

. "$IPKG_INSTROOT/etc/nikki/scripts/include.sh"

CACHE_DIR="$RUN_DIR/core"

ACTION="$1"

github_api() {
	local api_path="$1"
	local api_url="https://api.github.com/${api_path}"
	local api_out

	if [ -n "$GITHUB_TOKEN" ]; then
		api_out=$(curl -sL --max-time 15 \
			-H "Authorization: Bearer $GITHUB_TOKEN" \
			-A "$UA" "$api_url" 2>/dev/null)
	else
		api_out=$(curl -sL --max-time 15 -A "$UA" "$api_url" 2>/dev/null)
	fi

	if [ -z "$api_out" ]; then
		echo '{"status":"error","message":"github api empty response"}'
		return 1
	fi

	local msg
	msg=$(echo "$api_out" | jsonfilter -qe '@.message' 2>/dev/null)
	if [ -n "$msg" ]; then
		echo '{"status":"error","message":"github api error: '$msg'"}'
		return 1
	fi

	echo "$api_out"
}

get_ui_url() {
	local repo="$1"
	local asset_pattern="$2"
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

get_core_url() {
	local api_out status tag filename url asset_count prefix found_url i name

	if [ -z "$CORE_TYPE" ] || [ -z "$ARCH" ]; then
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
		url=$(echo "$api_out" | jsonfilter -qe "@.assets[$i].browser_download_url" 2>/dev/null)

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
	local out_name final_out status_file log_file lock_file url_json url_status msg url
	local archive_name archive_path tmp_file tmpdir found curl_ret

	if [ -z "$CORE_TYPE" ] || [ -z "$ARCH" ]; then
		log "error" "cache_core missing params"
		echo '{"status":"error","message":"missing params"}'
		return 1
	fi

	out_name="${CORE_TYPE}-mihomo"
	final_out="${CACHE_DIR}/${out_name}"
	status_file="/tmp/nikki_dl_${CORE_TYPE}.status"
	log_file="/tmp/nikki_dl_${CORE_TYPE}.log"
	lock_file="/tmp/nikki_dl_${CORE_TYPE}.lock"

	url_json=$(get_core_url)
	url_status=$(echo "$url_json" | jsonfilter -qe '@.status' 2>/dev/null)

	if [ "$url_status" != "ok" ]; then
		msg=$(echo "$url_json" | jsonfilter -qe '@.message' 2>/dev/null)
		log "error" "cache_core get url failed"
		echo "error: get url failed: ${msg:-unknown}" > "$status_file"
		return 1
	fi

	url=$(echo "$url_json" | jsonfilter -qe '@.url' 2>/dev/null)

	exec 200>"$lock_file"
	if ! flock -n 200 >/dev/null 2>&1; then
		log "info" "cache_core already running"
		echo "downloading" > "$status_file"
		return 0
	fi

	archive_name="$([ "$CORE_TYPE" = "smart" ] && echo "mihomo.tar.gz" || echo "mihomo.gz")"
	archive_path="${CACHE_DIR}/${CORE_TYPE}-${archive_name}"
	tmp_file="${CACHE_DIR}/${out_name}.tmp"

	rm -f "$status_file" "$log_file" "$archive_path" "$tmp_file"
	mkdir -p "$CACHE_DIR"

	echo "downloading" > "$status_file"
	log "info" "cache_core start"

	if [ -n "$GITHUB_TOKEN" ]; then
		curl -SsL --connect-timeout 15 --max-time 120 --retry 3 --retry-delay 2 \
			-H "Authorization: Bearer $GITHUB_TOKEN" \
			-A "$UA" -o "$archive_path" "$url" 2>>"$log_file"
	else
		curl -SsL --connect-timeout 15 --max-time 120 --retry 3 --retry-delay 2 \
			-A "$UA" -o "$archive_path" "$url" 2>>"$log_file"
	fi

	curl_ret=$?
	if [ $curl_ret -ne 0 ] || [ ! -s "$archive_path" ]; then
		log "error" "cache_core download failed"
		echo "error: download failed" > "$status_file"
		return 1
	fi

	rm -f "$tmp_file"

	if [ "$CORE_TYPE" = "smart" ]; then
		tmpdir="/tmp/mihomo_extract_$$"
		rm -rf "$tmpdir" && mkdir -p "$tmpdir"
		if tar -xzf "$archive_path" -C "$tmpdir" 2>>"$log_file"; then
			found=$(ls -1 "$tmpdir" 2>/dev/null | head -1)
			if [ -n "$found" ] && [ -r "$tmpdir/$found" ]; then
				cp -f "$tmpdir/$found" "$tmp_file"
			fi
		fi
		rm -rf "$tmpdir"
	else
		gunzip -c "$archive_path" > "$tmp_file" 2>>"$log_file"
	fi

	if [ -r "$tmp_file" ]; then
		chmod 755 "$tmp_file"
		mv -f "$tmp_file" "$final_out"
		rm -f "$archive_path"
		echo "done" > "$status_file"
		log "info" "cache_core done"
	else
		log "error" "cache_core tmp file missing"
		echo "error: tmp file missing" > "$status_file"
		return 1
	fi
}

update_ui() {
	local url="$1"
	local name="$2"
	local ui_path="${3:-ui}"

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
		ARCH="$3"
		get_core_url
		;;
	cache)
		CORE_TYPE="$2"
		ARCH="$3"
		do_cache
		;;
	update_ui)
		update_ui "$2" "$3" "$4"
		;;
	*)
		echo '{"status":"error","message":"invalid action: '$ACTION'"}'
		exit 1
		;;
esac
