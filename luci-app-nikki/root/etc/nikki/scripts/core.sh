#!/bin/sh

. "$IPKG_INSTROOT/etc/nikki/scripts/include.sh"
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
	local api_out status tag filename name found_url found_idx i=0 names urls
	local CORE_TYPE="$1"

	if [ -z "$CORE_TYPE" -a -z "$ARCH" ]; then
		echo '{"status":"error","message":"missing params"}'
		return 1
	fi

	case "$CORE_TYPE" in
		meta)
			api_out=$(github_api "repos/MetaCubeX/mihomo/releases/latest")
			;;
		alpha)
			api_out=$(github_api "repos/MetaCubeX/mihomo/releases/tags/Prerelease-Alpha")
			;;
		smart)
			echo '{"status":"ok","url":"https://raw.githubusercontent.com/vernesong/OpenClash/core/dev/smart/clash-'${ARCH}'-compatible.tar.gz"}'
			return 0
			;;
		*)
			echo '{"status":"error","message":"invalid core type"}'
			return 1
			;;
	esac

	status=$(echo "$api_out" | jsonfilter -qe '@.status' 2>/dev/null)
	if [ "$status" = "error" ]; then
		echo '{"status":"error","message":"no api out '${api_out}'"}'
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

	names=$(echo "$api_out" | jsonfilter -qe '@.assets[*].name')
	urls=$(echo "$api_out"  | jsonfilter -qe '@.assets[*].browser_download_url')

	if [ -z "$names" ]; then
		echo '{"status":"error","message":"no assets found"}'
		return 1
	fi

	found_idx=-1
	while IFS= read -r name; do
		case "$name" in
			*"${ARCH}"*".gz"*)
				if [ "$found_idx" -lt 0 ]; then
					found_idx=$i
				fi
				case "$name" in
					*"compatible"*)
						found_idx=$i
						break
						;;
				esac
				;;
		esac
		i=$((i + 1))
	done <<EOF
$names
EOF

	if [ "$found_idx" -lt 0 ]; then
		echo '{"status":"error","message":"no matching asset for '${ARCH}'"}'
		return 1
	fi

	found_url=$(echo "$urls" | sed -n "$((found_idx + 1))p")

	if [ -z "$found_url" ]; then
		echo '{"status":"error","message":"no matching asset for '${ARCH}'"}'
		return 1
	fi

	echo '{"status":"ok","url":"'$found_url'"}'
}

do_cache() {
	local CORE_TYPE="$1"
	CACHE_DIR="$RUN_DIR/core"
	mkdir -p "$CACHE_DIR"
	[ -z "$CORE_TYPE" -a -z "$ARCH" ] && {
		log "error" "cache_core missing params"
		echo '{"status":"error","message":"missing params"}'
		return 1
	}

	local out_name="${CORE_TYPE}-mihomo"
	local final_out="${CACHE_DIR}/${out_name}"
	local log_file="/tmp/nikki_dl_${CORE_TYPE}.log"
	local lock_file="/tmp/nikki_dl_${CORE_TYPE}.lock"
	local status_file="/tmp/nikki_dl_${CORE_TYPE}.status"

	local url_json url_status msg url
	url_json=$(get_core_url "$CORE_TYPE")
	eval "$(echo "$url_json" | jsonfilter -e 'url_status=@.status' -e 'msg=@.message' -e 'url=@.url' 2>/dev/null)"

	if [ "$url_status" != "ok" ]; then
		echo "error: get url failed: ${msg:-unknown}" > "$status_file"
		return 1
	fi

	exec 200>"$lock_file"
	if ! flock -n 200; then
		echo "downloading" > "$status_file"
		return 0
	fi

	local archive_name="$([ "$CORE_TYPE" = "smart" ] && echo "mihomo.tar.gz" || echo "mihomo.gz")"
	local tmp_file="/tmp/${out_name}.tmp"
	local archive_path="/tmp/${CORE_TYPE}-${archive_name}"

	rm -f "$log_file" "$archive_path" "$tmp_file"
	echo "downloading" > "$status_file"

	curl -SsL --connect-timeout 15 --max-time 120 --retry 3 --retry-delay 2 \
		-A "$UA" -o "$archive_path" "$url" 2>>"$log_file"

	if [ $? -ne 0 -o ! -s "$archive_path" ]; then
		echo "error: download failed" > "$status_file"
		flock -u 200 2>/dev/null
		return 1
	fi

	if [ "$CORE_TYPE" = "smart" ]; then
		tar -xzf "$archive_path" -O > "$tmp_file" 2>>"$log_file"
	else
		gzip -dc "$archive_path"    > "$tmp_file" 2>>"$log_file"
	fi

	if [ -s "$tmp_file" ]; then
		mv -f "$tmp_file" "$final_out"
		chmod 755 "$final_out"
		rm -f "$archive_path"
		echo "done" > "$status_file"
		flock -u 200 2>/dev/null
	else
		echo "error: tmp file missing" > "$status_file"
		flock -u 200 2>/dev/null
		return 1
	fi
}

update_ui() {
	local url="$1" name="$2" ui_path="${3:-ui}"
	local top_dir temp_dir target_dir status_file log_file tmp_zip
	target_dir="${RUN_DIR}/${ui_path}/${name}"
	log_file="/tmp/nikki_dl_ui_${name}.log"
	tmp_zip="/tmp/nikki_ui_${name}_$$.zip"
	status_file="/tmp/nikki_dl_ui_${name}.status"

	temp_dir=$(mktemp -d)
	echo "downloading" > "$status_file"

	curl -SsL --connect-timeout 15 --max-time 120 --retry 3 --retry-delay 2 \
		-A "$UA" -o "$tmp_zip" "$url" 2>>"$log_file"

	if [ $? -ne 0 -o ! -s "$tmp_zip" ]; then
		echo "error: download failed" > "$status_file"
		rm -f "$tmp_zip"
		return 1
	fi

	if ! unzip -o "$tmp_zip" -d "$temp_dir" 2>>"$log_file"; then
		echo "error: unzip failed" > "$status_file"
		rm -f "$tmp_zip"
		return 1
	fi

	rm -rf "${target_dir:?}"
	mkdir -p "$target_dir"
	top_dir=$(find "$temp_dir" -mindepth 1 -maxdepth 1 -type d | head -n 1)

	if [ -n "$top_dir" ]; then
		mv "$top_dir"/*      "$target_dir"/ 2>/dev/null || true
		mv "$top_dir"/..?*   "$target_dir"/ 2>/dev/null || true
		mv "$top_dir"/.[!.]* "$target_dir"/ 2>/dev/null || true
	else
		mv "$temp_dir"/*      "$target_dir"/ 2>/dev/null || true
		mv "$temp_dir"/..?*   "$target_dir"/ 2>/dev/null || true
		mv "$temp_dir"/.[!.]* "$target_dir"/ 2>/dev/null || true
	fi

	rm -rf "$tmp_zip" "$temp_dir"
	echo "done" > "$status_file"
}

ACTION="$1"
shift
case "$ACTION" in
	get_url)
		get_core_url "$1"
		;;
	cache)
		do_cache "$1"
		;;
	update_ui)
		update_ui "$1" "$2" "$3"
		;;
	*)
		echo '{"status":"error","message":"invalid action: '$ACTION'"}'
		exit 1
		;;
esac
