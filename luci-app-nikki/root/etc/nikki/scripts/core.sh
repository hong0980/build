#!/bin/sh

. "$IPKG_INSTROOT/etc/nikki/scripts/include.sh"
auth_header="${GITHUB_TOKEN:+Authorization: Bearer $GITHUB_TOKEN}"

set_status() { printf '%s\n' "$2" > "$1"; }

download() {
	local url="$1" output="$2" log="$3"
	curl -SsL -C - --connect-timeout 15 --max-time 300 --retry 3 --retry-delay 2 \
		-A "$UA" -o "$output" "$url" 2>>"$log"
}

with_lock() {
	exec 200>"$1"
	if ! flock -n 200; then
		set_status "$2" "downloading"
		return 1
	fi
	return 0
}

release_lock() { flock -u 200 2>/dev/null; }

mirror_url() {
	local url="$1" target
	target="$(uci -q get nikki.mixin.github_mirror)"
	[ -z "$target" ] && target='raw'

	ucode -e "
		import { mirrorGithubUrl } from '/etc/nikki/ucode/include.uc';
		print(mirrorGithubUrl('${url//\'/\\\'}', '${target//\'/\\\'}'));
	"
}

github_api() {
	local api_path="$1" api_out msg

	api_out=$(curl -sL --max-time 15 \
		${auth_header:+-H "$auth_header"} \
		-A "${UA:-Mozilla/5.0}" "https://api.github.com/${api_path}" 2>/dev/null)

	if [ -z "$api_out" ]; then
		printf '{"status":"error","message":"github api empty response"}\n'
		return 1
	fi

	msg=$(printf '%s' "$api_out" | jsonfilter -qe '@.message' 2>/dev/null)
	if [ -n "$msg" ]; then
		printf '{"status":"error","message":"github api error: %s"}\n' "$msg"
		return 1
	fi

	printf '%s\n' "$api_out"
}

get_ui_url() {
	local repo="$1" asset_pattern="$2"
	local api_out status tag asset_count i name url

	api_out=$(github_api "repos/${repo}/releases/latest")
	status=$(printf '%s' "$api_out" | jsonfilter -qe '@.status' 2>/dev/null)
	[ "$status" = "error" ] && { printf '%s\n' "$api_out"; return 1; }

	tag=$(printf '%s' "$api_out" | jsonfilter -qe '@.tag_name' 2>/dev/null)
	asset_count=$(printf '%s' "$api_out" | jsonfilter -qe '@.assets[*].name' 2>/dev/null | wc -l)

	i=0
	while [ "$i" -lt "$asset_count" ]; do
		name=$(printf '%s' "$api_out" | jsonfilter -qe "@.assets[$i].name" 2>/dev/null)
		url=$(printf '%s' "$api_out"  | jsonfilter -qe "@.assets[$i].browser_download_url" 2>/dev/null)

		case "$name" in
			*"$asset_pattern"*)
				printf '{"status":"ok","url":"%s","tag":"%s","name":"%s"}\n' "$url" "$tag" "$name"
				return 0
				;;
		esac
		i=$((i + 1))
	done

	printf '{"status":"error","message":"no matching asset for %s"}\n' "$asset_pattern"
	return 1
}

get_core_url() {
	local CORE_TYPE="$1"
	local api_out status tag names urls name found_idx found_url i=0

	if [ -z "$CORE_TYPE" ] && [ -z "$ARCH" ]; then
		printf '{"status":"error","message":"missing params"}\n'
		return 1
	fi

	case "$CORE_TYPE" in
		meta)   api_out=$(github_api "repos/MetaCubeX/mihomo/releases/latest") ;;
		alpha)  api_out=$(github_api "repos/MetaCubeX/mihomo/releases/tags/Prerelease-Alpha") ;;
		smart)  api_out=$(github_api "repos/vernesong/mihomo/releases/tags/Prerelease-Alpha") ;;
		*)      printf '{"status":"error","message":"invalid core type"}\n'; return 1 ;;
	esac

	status=$(printf '%s' "$api_out" | jsonfilter -qe '@.status' 2>/dev/null)
	if [ "$status" = "error" ]; then
		printf '{"status":"error","message":"no api out %s"}\n' "$api_out"
		return 1
	fi

	tag=$(printf '%s' "$api_out" | jsonfilter -qe '@.tag_name' 2>/dev/null)

	if [ "$CORE_TYPE" = "meta" ]; then
		if [ -z "$tag" ]; then
			printf '{"status":"error","message":"no tag found"}\n'
			return 1
		fi
		local filename="mihomo-${ARCH}-compatible-${tag}.gz"
		local url="https://github.com/MetaCubeX/mihomo/releases/download/${tag}/${filename}"
		printf '{"status":"ok","url":"%s"}\n' "$url"
		return 0
	fi

	names=$(printf '%s' "$api_out" | jsonfilter -qe '@.assets[*].name')
	urls=$(printf '%s' "$api_out"  | jsonfilter -qe '@.assets[*].browser_download_url')

	if [ -z "$names" ]; then
		printf '{"status":"error","message":"no assets found"}\n'
		return 1
	fi

	found_idx=-1
	while IFS= read -r name; do
		case "$name" in
			*"${ARCH}"*".gz"*)
				[ "$found_idx" -lt 0 ] && found_idx=$i
				case "$name" in
					*"compatible"*) found_idx=$i; break ;;
				esac
				;;
		esac
		i=$((i + 1))
	done <<EOF
$names
EOF

	if [ "$found_idx" -lt 0 ]; then
		printf '{"status":"error","message":"no matching asset for %s"}\n' "$ARCH"
		return 1
	fi

	found_url=$(printf '%s' "$urls" | sed -n "$((found_idx + 1))p")
	if [ -z "$found_url" ]; then
		printf '{"status":"error","message":"no matching asset for %s"}\n' "$ARCH"
		return 1
	fi

	printf '{"status":"ok","url":"%s"}\n' "$found_url"
}

do_cache() {
	local CORE_TYPE="$1" url="$2"
	local out_name final_out log_file lock_file status_file tmp_file archive_path

	[ -z "$CORE_TYPE" ] && [ -z "$ARCH" ] && {
		log "error" "cache_core missing params"
		return 1
	}

	CACHE_DIR="$RUN_DIR/core"
	mkdir -p "$CACHE_DIR"

	out_name="${CORE_TYPE}-mihomo"
	final_out="${CACHE_DIR}/${out_name}"
	log_file="/tmp/nikki_dl_${CORE_TYPE}.log"
	lock_file="/tmp/nikki_dl_${CORE_TYPE}.lock"
	status_file="/tmp/nikki_dl_${CORE_TYPE}.status"

	if [ "$url" = 'null' ] || [ -z "$url" ]; then
		local url_json url_status msg
		url_json=$(get_core_url "$CORE_TYPE")
		url_status=$(printf '%s' "$url_json" | jsonfilter -e '@.status' 2>/dev/null)
		msg=$(printf '%s' "$url_json" | jsonfilter -e '@.message' 2>/dev/null)
		url=$(printf '%s' "$url_json" | jsonfilter -e '@.url' 2>/dev/null)

		if [ "$url_status" != "ok" ]; then
			set_status "$status_file" "error: get url failed: ${msg:-unknown}"
			return 1
		fi
	fi

	if ! with_lock "$lock_file" "$status_file"; then
		return 0
	fi

	tmp_file="/tmp/${out_name}.tmp"
	archive_path="/tmp/${CORE_TYPE}-mihomo.gz"
	rm -f "$log_file" "$archive_path" "$tmp_file"

	if ! download "$(mirror_url "$url")" "$archive_path" "$log_file" || [ ! -s "$archive_path" ]; then
		set_status "$status_file" "error: download failed"
		rm -f "$archive_path" "$tmp_file"
		release_lock
		return 1
	fi

	if gzip -dc "$archive_path" > "$tmp_file" 2>>"$log_file" && [ -s "$tmp_file" ]; then
		mv -f "$tmp_file" "$final_out"
		chmod 755 "$final_out"
		rm -f "$archive_path"
		set_status "$status_file" "done"
	else
		set_status "$status_file" "error: extract failed"
		rm -f "$tmp_file" "$archive_path"
		release_lock
		return 1
	fi

	release_lock
}

download_file() {
	local task_id="$1" headers="$2" url="$3" path="$4" ua="$5" secret="$6" do_chmod="$7"
	local status_file="/tmp/nikki_dl_${task_id}.status"
	local log_file="/tmp/nikki_dl_${task_id}.log"

	set_status "$status_file" "downloading"
	rm -f "$log_file"

	local curl_cmd="curl -SsL --connect-timeout 15 --max-time 120 --retry 3 --retry-delay 2 --retry-max-time 180"
	curl_cmd="$curl_cmd -A '${ua:-$UA}' -o '$path'"

	[ -n "$secret" ] && curl_cmd="$curl_cmd -H '$secret'"

	if [ -n "$headers" ]; then
		local IFS='|'
		for h in $headers; do
			h=$(printf '%s' "$h" | sed 's/^ *//;s/ *$//')
			[ -n "$h" ] && curl_cmd="$curl_cmd -H '$h'"
		done
	fi

	echo "[$(date '+%Y-%m-%d %H:%M:%S')] start" >> "$log_file"
	eval "$curl_cmd '$url' 2>>'$log_file'"
	local ret=$?

	if [ $ret -eq 0 ] && [ -s "$path" ]; then
		[ "$do_chmod" = "1" ] && chmod 755 "$path"
		echo "[$(date '+%Y-%m-%d %H:%M:%S')] done" >> "$log_file"
		set_status "$status_file" "done"
	else
		echo "[$(date '+%Y-%m-%d %H:%M:%S')] error: download failed" >> "$log_file"
		set_status "$status_file" "error: download failed"
	fi
}

update_ui() {
	local url="$1" name="$2" ui_path="${3:-ui}"
	local target_dir temp_dir status_file log_file tmp_zip src_dir count only_entry entry

	target_dir="${RUN_DIR}/${ui_path}/${name}"
	log_file="/tmp/nikki_dl_ui_${name}.log"
	tmp_zip="/tmp/nikki_ui_${name}_$$.zip"
	status_file="/tmp/nikki_dl_ui_${name}.status"
	local lock_file="/tmp/nikki_dl_ui_${name}.lock"

	if ! with_lock "$lock_file" "$status_file"; then
		return 0
	fi

	temp_dir=$(mktemp -d)
	set_status "$status_file" "downloading"
	rm -f "$log_file"

	if ! download "$(mirror_url "$url")" "$tmp_zip" "$log_file"; then
		set_status "$status_file" "error: download failed"
		rm -rf "$tmp_zip" "$temp_dir"
		release_lock
		return 1
	fi

	if ! unzip -o "$tmp_zip" -d "$temp_dir" 2>>"$log_file"; then
		set_status "$status_file" "error: unzip failed"
		rm -rf "$tmp_zip" "$temp_dir"
		release_lock
		return 1
	fi

	rm -rf "${target_dir:?}"
	mkdir -p "$target_dir"

	src_dir="$temp_dir"
	count=$(find "$temp_dir" -mindepth 1 -maxdepth 1 | wc -l)

	if [ "$count" -eq 1 ]; then
		only_entry=$(find "$temp_dir" -mindepth 1 -maxdepth 1)
		[ -d "$only_entry" ] && src_dir="$only_entry"
	fi

	for entry in "$src_dir"/* "$src_dir"/.[!.]* "$src_dir"/..?*; do
		[ -e "$entry" ] || continue
		mv "$entry" "$target_dir"/ 2>/dev/null || true
	done

	rm -rf "$tmp_zip" "$temp_dir"
	set_status "$status_file" "done"
	release_lock
}

ACTION="$1"
shift
case "$ACTION" in
	get_core_url)    get_core_url "$1" ;;
	do_cache)        do_cache "$1" "$2" ;;
	update_ui)       update_ui "$1" "$2" "$3" ;;
	download_file)   download_file "$1" "$2" "$3" "$4" "$5" "$6" "$7" ;;
	*)               printf '{"status":"error","message":"invalid action: %s"}\n' "$ACTION"; exit 1 ;;
esac
