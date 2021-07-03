#!/bin/sh
#check usb disk size version: 1.0
# Copyright (C) 2019 Jianpeng Xiang (1505020109@mail.hnust.edu.cn)
# This is free software, licensed under the GNU General Public License v3.

# 加载通用函数库
. /usr/bin/softwarecenter/lib_functions.sh
	case $1 in
		1)
			check_available_size "$2"
			;;
		2)
			PART_TYPES="ext2|ext3|ext4|.*fat|.*ntfs|fuseblk|btrfs|ufsd"; i=1
			for mounted in $(/bin/mount | grep -E "$PART_TYPES" | grep -v -E "/opt|/boot|/root" | grep -v -E -w "/" | cut -d' ' -f3); do
				for m in `seq 5`; do
					n=$((m + 1))
					eval value$m=`df -h | grep $mounted | awk '{print $(eval echo '$n')}'`
					eval pp$m=`/bin/mount | grep $mounted | awk '{print $5}'`
				done
				echo "$i. $value5 [ 总容量:$value1 ($pp5) 已用:$value2($value4) 可用:$value3 ]<br>"
				i=$((i + 1))
			done
			;;
		3)
			if [ `which lsscsi` ]; then
				echo "`lsscsi | awk '/disk/{print $NF}'`"
			elif [ `which mount` ]; then
				echo "`mount | awk '/mnt/{print $3}'`"
			else
				echo "`blkid -s PARTLABEL | cut -d: -f1`"
			fi
			;;
	esac
