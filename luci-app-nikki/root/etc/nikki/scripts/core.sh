#!/bin/sh

. "$IPKG_INSTROOT/etc/nikki/scripts/include.sh"
auth_header="${GITHUB_TOKEN:+Authorization: Bearer $GITHUB_TOKEN}"
CACHE_DIR="/tmp/mihomo_core_cache"
CACHE_TTL=3600

set_status() { printf '%s\n' "$2" > "$1"; }

_Download() {
	local task_id="$1" url="$2" output="$3"
	local log_file="/tmp/dl_${task_id}.log"
	local status_file="/tmp/dl_${task_id}.status"
	local progress_file="/tmp/dl_${task_id}.progress"
	local ret mirrored_url; mirrored_url=$(mirror_url "$url")

	if command -v wget >/dev/null 2>&1; then
		wget --show-progress -T 15 --user-agent="$UA" -O "$output" "$mirrored_url" >>"$log_file" 2>&1 &
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
	local final_out archive_path status_file url_json msg

	[ -z "$task_id" ] || [ -z "$ARCH" ] && {
		log "error" "cache_core missing params"
		return 1
	}
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

	if gzip -dc "$archive_path" > "$final_out" 2>>"/tmp/dl_${task_id}.log" && [ -s "$final_out" ]; then
		chmod 755 "$final_out"
		rm -f "$archive_path"
		set_status "$status_file" "done"
	else
		set_status "$status_file" "error: extract failed"
		rm -f "$final_out" "$archive_path"
		return 1
	fi
}

download_file() {
	local task_id="$1" url="$2" path="$3"
	_Download "$task_id" "$url" "$path" && set_status "/tmp/dl_${task_id}.status" "done"
}

update_ui() {
	local task_id="$1" url="$2" target_dir="$3"
	local  temp_dir tmp_zip src_dir count only_entry entry

	tmp_zip="/tmp/nikki_ui_${task_id}_$$.zip"
	temp_dir=$(mktemp -d)

	if ! _Download "$task_id" "$url" "$tmp_zip"; then
		rm -rf "$temp_dir"
		return 1
	fi

	if ! unzip -o "$tmp_zip" -d "$temp_dir" 2>>"/tmp/dl_${task_id}.log"; then
		set_status "/tmp/dl_${task_id}.status" "error: unzip failed"
		rm -rf "$tmp_zip" "$temp_dir"
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
	set_status "/tmp/dl_${task_id}.status" "done"
}

ACTION="$1"
shift
case "$ACTION" in
	get_core_url)  get_core_url "$1" ;;
	do_cache)      do_cache "$1" ;;
	update_ui)     update_ui "$1" "$2" "$3" ;;
	download_file) download_file "$1" "$2" "$3" ;;
esac
