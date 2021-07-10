#!/bin/sh

# 加载通用函数库
. /usr/bin/softwarecenter/lib_functions.sh
case $1 in
1)
	check_available_size "$2"
	;;
2)
	i=1
	for mounted in $(mount | awk '/ext.*|.*fat|.*ntfs|fuseblk|btrfs|ufsd/{print $3}' | egrep -v "/opt|/boot|/root|/overlay" | cut -d/ -f1-3 | uniq); do
		for m in $(seq 5); do
			n=$((m + 1))
			eval value$m=$(df -h | grep $mounted | awk 'NR==1{print $(eval echo '$n')}')
			eval pp$m=$(mount | grep $mounted | awk 'NR==1{print $5}')
		done
		echo "$i) $value5 [ 总容量:$value1 ($pp5) 可用:$value3 已用:$value2($value4) ]<br>"
		i=$((i + 1))
	done
	;;
3)
	if [ $(which lsscsi) ]; then
		echo "$(lsscsi | awk '/disk/{print $NF}')"
	elif [ $(which mount) ]; then
		echo "$(mount | awk '/mnt/{print $3}')"
	else
		echo "$(blkid -s PARTLABEL | cut -d: -f1)"
	fi
	;;
esac
