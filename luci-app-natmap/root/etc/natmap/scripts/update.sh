#!/bin/sh
export ip="$1"
export port="$2"
export ip4p="$3"
export inner_port="$4"
export protocol="$5"
export inner_ip="$6"
shift 6

. /usr/share/libubox/jshn.sh
INITD='/etc/init.d/natmap'
STATUS_PATH='/var/run/natmap'

# fallloop <retry interval> <max attempts> <func> [args...]
fallloop() {
	local retry="$1"; shift
	local limit="$1"; shift
	local func="$1"; shift

	local error=1 count=0
	while [ "$error" -ne 0 ] && [ "$count" -lt "$limit" ]; do
		count=$((count + 1))
		if "$func" "$@"; then
			error=0
		else
			error=$?
			if [ "$error" -ne 0 ] && [ "$count" -lt "$limit" ]; then
				sleep "$retry"
			fi
		fi
	done
	return "$error"
}

# keep dest_port(forward port) consistent with public port
if [ -n "$RWFW" -a "$($INITD info | jsonfilter -qe "@['$(basename "$INITD")'].instances['$SECTIONID'].data.firewall[0].dest_port")" != "$port" ]; then
	export PUBPORT="$port" #PROCD_DEBUG=1
	"$INITD" start "$SECTIONID"
fi

(
	json_init
	json_add_int    port "$port"
	json_add_int    inner_port "$inner_port"
	json_add_string ip "$ip"
	json_add_string ip4p "$ip4p"
	json_add_string sid "$SECTIONID"
	json_add_string comment "$COMMENT"
	json_add_string protocol "$protocol"
	json_add_string inner_ip "$inner_ip"
	json_dump > "$STATUS_PATH/$PPID.json"
)

if [ -n "$CLIENT" ]; then
	json_init
	json_load "$REFRESH_PARAM"
	json_add_int port "$port"
	/etc/natmap/client "$(json_dump)"
fi

if [ -n "$NOTIFY" ]; then
	_proto_upper="$(printf '%s' "$protocol" | tr 'a-z' 'A-Z')"
	_text="$(jsonfilter -qs "$NOTIFY_PARAM" -e '@["text"]')"
	if [ -z "$_text" ]; then
		_text="NATMap: ${COMMENT:+$COMMENT: }[${_proto_upper}] $inner_ip:$inner_port -> $ip:$port"
	else
		_text="$(printf '%s\n' "$_text" | sed " \
			s|<comment>|$COMMENT|g; \
			s|<protocol>|$protocol|g; \
			s|<inner_ip>|$inner_ip|g; \
			s|<inner_port>|$inner_port|g; \
			s|<ip>|$ip|g; \
			s|<port>|$port|g")"
	fi
	json_init
	json_load "$NOTIFY_PARAM"
	json_add_string comment "$COMMENT"
	json_add_string text "$_text"
	fallloop 5m 4 "$NOTIFY" "$(json_dump)" &
fi

if [ -n "$DDNS" ]; then
	_hostype="$(jsonfilter -qs "$DDNS_PARAM" -e '@["hostype"]')"
	_content="$(jsonfilter -qs "$DDNS_PARAM" -e '@["txt_content"]')"
	_svcparams="$(jsonfilter -qs "$DDNS_PARAM" -e '@["https_svcparams"]')"
	_content="$(printf '%s\n' "$_content" | sed "s,{{port}},${port},")"                                          # port
	_svcparams="$(printf '%s\n' "$_svcparams" | sed -E "s,\s*(port=[0-9]*|$), port=${port},")"                  # port
	_content="$(printf '%s\n' "$_content" | sed "s,{{ip}},${ip},")"                                              # ip
	[ "$_hostype" = "A" ]    && _svcparams="$(printf '%s\n' "$_svcparams" | sed -E "s|\b(ipv4hint=)[^[:space:]]*|\1${ip}|")" # ipv4hint
	[ "$_hostype" = "AAAA" ] && _svcparams="$(printf '%s\n' "$_svcparams" | sed -E "s|\b(ipv6hint=)[^[:space:]]*|\1${ip}|")" # ipv6hint
	json_init
	json_load "$DDNS_PARAM"
	json_add_string txt_content "$_content"
	json_add_string https_svcparams "$_svcparams"
	json_add_string ip "$ip"
	json_add_int port "$port"
	fallloop 5m 4 "$DDNS" "$(json_dump)" &
fi

[ -n "${CUSTOM_SCRIPT}" ] && {
	[ -x "$CUSTOM_SCRIPT" ] || chmod +x "$CUSTOM_SCRIPT"
	export -n CUSTOM_SCRIPT
	exec "${CUSTOM_SCRIPT}" "$ip" "$port" "$ip4p" "$inner_port" "$protocol" "$inner_ip" "$SECTIONID" "$COMMENT" "$@"
}
