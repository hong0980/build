#!/bin/sh

download_dir=$(uci get softwarecenter.main.download_dir)
status() {
	local p=$?
	# echo -en "\\033[40G[ "
	if [ "$p" = "0" ]; then
		# echo -e "\\033[1;33m成功\\033[0;39m ]"
		echo "   成功"
		return 0
	else
		# echo -e "\\033[1;31m失败\\033[0;39m ]"
		echo "   失败"
		return 1
	fi
}

make_dir() {
	for p in "$@"; do
		[ -d "$p" ] || mkdir -m 777 -p $p
	done
	return 0
}

_pidof() {
	for g in $@; do
		ps | grep $g | grep -q opt && {
			echo_time "$g 已经运行\n"
			return 0
		} || {
			echo_time "$g 没有运行"
			return 1
		}
	done
}

network() {
    #超时时间
    local timeout=1
    #目标网站
    local target=bin.entware.net
    #获取响应状态码
    local ret_code=`curl -I -s --connect-timeout ${timeout} ${target} -w %{http_code} | tail -n1`
    if [ "x$ret_code" != "x200" ]; then
        echo_time "${target} 网络不畅通"
        return 1
    else
		[ -e /tmp/ping ] || echo_time "${target} 网络平均响应时间 `ping -c 3 ${target} | awk -F/ '/avg/{print $4}' | tee /tmp/ping`毫秒"
		# echo_time "${target} 网络平均响应时间 `ping -c 3 ${target} | awk -F/ '/avg/{print $4}'`毫秒"
        return 0
    fi
}

echo_time() {
	echo -e "[ $(date +"%m月%d日 %H:%M:%S") ]  $@" | sed '/\\\033/d'
}

# entware环境设定 参数：$1:安装位置 $2:设备底层架构 说明：此函数用于写入新配置
entware_set() {
	entware_unset
	[ "$1" ] && disk_mount="$1" || { echo_time "未选择安装路径！" && exit 1; }
	[ "$2" ] && PLATFORM="$2" || { echo_time "未选择CPU架构！" && exit 1; }
	system_check $disk_mount
	echo_time "安装基本软件" && install_soft "e2fsprogs ca-certificates"
	make_dir "$disk_mount/opt" "/opt"
	mount -o bind $disk_mount/opt /opt

	case $PLATFORM in
		x86_64)	INST_URL=http://bin.entware.net/x64-k3.2/installer/generic.sh ;;
		x86_32) INST_URL=http://pkg.entware.net/binaries/x86-32/installer/entware_install.sh ;;
		armv5*) INST_URL=http://bin.entware.net/armv5sf-k3.2/installer/generic.sh ;;
		mipsel) INST_URL=http://bin.entware.net/mipselsf-k3.4/installer/generic.sh ;;
		mips)	INST_URL=http://bin.entware.net/mipselsf-k3.4/installer/generic.sh ;;
		aarch64) INST_URL=http://bin.entware.net/aarch64-k3.10/installer/generic.sh ;;
		armv7*)	INST_URL=http://bin.entware.net/armv7sf-k3.2/installer/generic.sh ;;
	esac

	if [ $INST_URL ]; then
		wget -t5 -qcNO - $INST_URL | /bin/sh || {
		echo_time "安装 Entware 出错，请重试！"
		exit 1
		}
	else
		echo_time "抱歉，不支持您的设备！"
		exit 1
	fi

	cat >"/etc/init.d/entware" <<-\ENTWARE
	#!/bin/sh /etc/rc.common
	START=51

	get_entware_path() {
	  for mount_point in `mount | awk '/mnt/{print $3}'`; do
		if [ -e "$mount_point/opt/etc/init.d/rc.unslung" ]; then
		  echo "$mount_point"
		  break
		fi
	  done
	}

	start() {
	  [ -d opt ] || mkdir -p /opt
	  entware_path=`get_entware_path`
	  [ $entware_path ] || entware_path=`uci get softwarecenter.main.disk_mount`
	  mount -o bind $entware_path/opt /opt
	}

	stop() {
	  /opt/etc/init.d/rc.unslung stop
	  umount -lf /opt
	  rm -r /opt
	}

	restart() {
	  stop
	  start
	}
	ENTWARE

	chmod +x /etc/init.d/entware
	/etc/init.d/entware enable
	echo "export PATH=/opt/bin:/opt/sbin:$PATH" >>/etc/profile

	wget -qcNO- -t5 http://pkg.entware.net/sources/i18n_glib223.tar.gz | tar xz -C /opt/usr/share/ && {
		echo_time "添加 zh_CN.UTF-8"
		/opt/bin/localedef.new -c -f UTF-8 -i zh_CN zh_CN.UTF-8
		sed -i 's/en_US.UTF-8/zh_CN.UTF-8/g' /opt/etc/profile
		ln -sf /opt/share/zoneinfo/Asia/Shanghai /opt/etc/localtime
	}
	sed -i '/^ansi/d' /opt/etc/init.d/rc.func
	echo_time "Entware 安装成功！\n"
}

# entware环境解除 说明：此函数用于删除OPKG配置设定
entware_unset() {
	/etc/init.d/entware stop >/dev/null 2>&1
	/etc/init.d/entware disable >/dev/null 2>&1
	rm /etc/init.d/entware
	sed -i "/export PATH=\/opt\/bin/d" /etc/profile
	source /etc/profile >/dev/null 2>&1
	umount -lf /opt
	rm -rf /opt
}

# 磁盘分区挂载
system_check() {
	partition_disk="$1"
	grep -q $partition_disk /proc/mounts && {
		filesystem="$(grep $partition_disk /proc/mounts | awk '{print $3}')"
		lo=`lsblk | grep $partition_disk | awk '{print $4}' | sed 's/G//'`
		if [ "$filesystem" = "ext4" ]; then
			[ "$lo" -gt 2 ] && {
			echo_time "磁盘 $1 符合安装要求"
			} || { echo_time "磁盘 $1 小于2G" && exit 1; }
		else
			echo_time "磁盘 $partition_disk 原是 $filesystem 重新格式化ext4。"
			umount -l "$partition_disk"
			echo y | mkfs.ext4 ${partition_disk/mnt/dev}
			mount ${partition_disk/mnt/dev} "$partition_disk"
		fi
	} || {
		partition_disk=`uci get softwarecenter.main.partition_disk`
		echo_time "磁盘$partition_disk没有分区，进行分区并格式化ext4。"
		parted -s "$partition_disk" mklabel msdos
		parted -s "$partition_disk" mklabel gpt \
		mkpart primary ext4 512s 100%
		sync
		sleep 2
		echo y | mkfs.ext4 "$partition_disk"1
		make_dir ${partition_disk/dev/mnt}1
		mount "$partition_disk"1 ${partition_disk/dev/mnt}1
	}
}

# 配置交换分区文件 参数: $1:交换分区挂载点 $2:交换空间大小(M)
config_swap_init() {
	[ "x$2" = "x" ] && swap_path=/opt || swap_path=$2
	grep -q "$swap_path/.swap" /proc/swaps || {
		[ -e "$swap_path/.swap" ] || {
			echo_time "正在生成swap文件，请耐心等待..."
			dd if=/dev/zero of=$swap_path/.swap bs=1M count=$1 >/dev/null 2>&1
			mkswap $swap_path/.swap
			chmod 0600 $swap_path/.swap
		}
		# 启用交换分区
		swapon $swap_path/.swap && \
		echo_time "$swap_path/.swap 交换分区已启用\n"
	}
}

# 删除交换分区文件 参数: $1:交换分区挂载点
config_swap_del() {
	[ "x$1" = "x" ] && swap_path=/opt
	[ -e $swap_path/.swap ] && {
		swapoff $swap_path/.swap
		rm -f $swap_path/.swap
		echo_time "$swap_path/.swap 交换分区已删除！\n"
	}
}

# 获取通用环境变量
get_env() {
	# 获取用户名
	[ "$USER" ] && username=$USER || username=$(awk -F: 'NR==1{print $1}' /etc/passwd)

	# 获取路由器IP
	localhost=$(ifconfig | awk '/inet addr/{print $2}' | awk -F: 'NR==1{print $2}')
	[ "$localhost" ] || localhost="你的路由器IP"
}

# 容量验证 参数：$1：目标位置
check_available_size() {
	available_size="$(lsblk -s | grep $1 | awk '{print $4}')"
	[ $available_size ] && echo "$available_size"
}

# 软件包卸载 参数: $1:卸载列表 说明：本函数将负责强制卸载指定的软件包
remove_soft() {
	for ipk in $@; do
		echo_time "正在卸载 ${ipk}\c"
		opkg remove --force-depends $ipk >/dev/null 2>&1
		status
	done
}

# 软件包安装 参数: $@:安装列表 说明：本函数将负责安装指定列表的软件到外置存储区，请保证区域指向正常且空间充足
install_soft() {
	network && {
		opkg update >/dev/null 2>&1
		for ipk in $@; do
			if [ "$(which $ipk)" ]; then
				echo_time "$ipk	已经安装"
			else
				echo_time "正在安装  $ipk\c"
				opkg install $ipk >/dev/null 2>&1
				status
				if [ $? != 0 ]; then
					echo_time "强制安装  $ipk\c"
					opkg --force-depends --force-overwrite install $ipk >/dev/null 2>&1
					status
				fi
			fi
		done
	} || exit 1
}

# 应用安装 参数: $@:安装列表 
opkg_install() {
	network && {
		source /etc/profile >/dev/null 2>&1
		echo_time "更新软件源中"
		opkg update >/dev/null 2>&1 || \
		rm /opt/tmp/opkg.lock \
		opkg update >/dev/null 2>&1

		for i in $@; do
			if [ "$(opkg list | awk '{print $1}' | grep -w $i)" ]; then
				echo_time "请耐心等待 $i 安装中"
				opkg install $i
			else
				echo_time "$i 不在 Entware 软件源，跳过安装！"
			fi
		done
	} || exit 1
	make_dir /opt/etc/config $download_dir
}

install_amule() {
	opkg_install amule && {
		/opt/etc/init.d/S57amuled start >/dev/null 2>&1 && sleep 5
		/opt/etc/init.d/S57amuled stop >/dev/null 2>&1
		wget -t5 -qO /tmp/AmuleWebUI.zip https://codeload.github.com/MatteoRagni/AmuleWebUI-Reloaded/zip/master && {
			unzip -d /tmp /tmp/AmuleWebUI.zip >/dev/null 2>&1
			mv -f /tmp/AmuleWebUI-Reloaded-master /opt/share/amule/webserver/AmuleWebUI-Reloaded
			sed -i 's/ajax.googleapis.com/ajax.lug.ustc.edu.cn/g' /opt/share/amule/webserver/AmuleWebUI-Reloaded/*.php
		} || {
			echo_time "AmuleWebUI-Reloaded 下载失败，使用原版UI。"
		}
		pp=$(echo -n admin | md5sum | awk '{print $1}')
		sed -i "{
			s/^Enabled=.*/Enabled=1/
			s/^ECPas.*/ECPassword=$pp/
			s/^UPnPEn.*/UPnPEnabled=1/
			s/^Password=.*/Password=$pp/
			s/^UPnPECE.*/UPnPECEnabled=1/
			s/^Template=.*/Template=AmuleWebUI-Reloaded/
			s/^AcceptExternal.*/AcceptExternalConnections=1/
			s|^IncomingDir=.*|IncomingDir=$download_dir|
		}" /opt/var/amule/amule.conf
	} || {
		echo_time "amule 安装失败，再重试安装！"
		exit 1
	}
	ln -sf /opt/var/amule/amule.conf /opt/etc/config/amule.conf
	/opt/etc/init.d/S57amuled restart >/dev/null 2>&1
	_pidof amuled

}

install_aria2() {
	opkg_install aria2 && {
		pro="/opt/etc/aria2"
		rm -rf /opt/var/aria2
		make_dir $pro
		cd $pro
		for i in core aria2.conf clean.sh delete.sh tracker.sh dht.dat dht6.dat script.conf; do
				wget -qN -t2 -T3 raw.githubusercontent.com/P3TERX/aria2.conf/master/$i || \
				wget -qN -t2 -T3 cdn.jsdelivr.net/gh/P3TERX/aria2.conf/$i || \
				curl -fsSLO p3terx.github.io/aria2.conf/$i
				[ -s $i ] && echo_time " $i 下载成功 !" || echo_time " $i 下载失败 !"
		done

		[ -s aria2.conf ] && {
			sed -i "{
				s|path=/opt/etc|path=$pro|
				s|/opt/var/aria2/session.dat|$pro/aria2.session|g
			}" /opt/etc/init.d/S81aria2
			sed -i "{
				s|/root/\.aria2|$pro|g
				s|^dir=.*|dir=$download_dir|
				s|^rpc-se.*|rpc-secret=admin|
			}" aria2.conf
			sed -i '/033/d' core
			sed -i '/033/d' tracker.sh
			sed -i 's|\#!/usr.*|\#!/bin/sh|g' *.sh
			chmod +x *.sh && sh ./tracker.sh >/dev/null 2>&1
			rm /opt/etc/aria2.conf
			ln -sf $pro/aria2.conf /opt/etc/aria2.conf
			ln -sf $pro/aria2.conf /opt/etc/config/aria2.conf
		}

		wget -t5 -qO /tmp/ariang.zip github.com/mayswind/AriaNg/archive/refs/tags/1.2.3.zip && {
			unzip -oq /tmp/ariang.zip -d /opt/share/www/
			mv /opt/share/www/AriaNg* /opt/share/www/ariang-aria2
		}

		wget -t5 -qO /tmp/webui.zip github.com/ziahamza/webui-aria2/archive/refs/heads/master.zip && {
			unzip -oq /tmp/webui.zip -d /opt/share/www/
			mv /opt/share/www/webui* /opt/share/www/webui-aria2
		}
		/opt/etc/init.d/S81aria2 restart >/dev/null 2>&1
		_pidof aria2c

	} || {
		echo_time "aria2 安装失败，再重试安装！"
		exit 1
	}
}

install_deluge() {
	opkg_install deluge-ui-web && {
		sed -i '{
		/deluged -l/a\\tsleep 5\n\t/opt/etc/init.d/S81deluge-web start
		/killall deluged/a\\tsleep 5\n\t/opt/etc/init.d/S81deluge-web stop
		}' /opt/etc/init.d/S80deluged
		/opt/etc/init.d/S80deluged start >/dev/null 2>&1
		sleep 5
		/opt/etc/init.d/S80deluged stop >/dev/null 2>&1
		sleep 5
		sed -i "{
			/random_port/ {s|true|false|}
			/queue_new_to_top/ {s|false|true|}
			/new_release_check/ {s|true|false|}
			/listen_random_port/ {s|55554|null|}
			/pre_allocate_storage/ {s|false|true|}
			/download_location/ {s|: \".*\"|: \"$download_dir\"|}
			/move_completed_path/ {s|: \".*\"|: \"$download_dir\"|}
			/torrentfiles_location/ {s|: \".*\"|: \"$download_dir\"|}
		}" /opt/etc/deluge/core.conf
		sed -i '{
		/language/ {s|: ".*"|: "zh_CN"|}
		/show_session_speed/ {s|false|true|}
		/pwd_salt/ {s|: ".*"|: "fc9ac61c7a9f0f33939648f753a4382c30edafb2"|}
		/pwd_sha1/ {s|: ".*"|: "7f53a6eb03aa6d6e6b865de8bbede61741651a26"|}
		}' /opt/etc/deluge/web.conf
		[ $deluge_web_port ] && sed -i "s/888/$deluge_web_port/" /opt/etc/init.d/S81deluge-web
		ln -sf /opt/etc/deluge/core.conf /opt/etc/config/deluge.conf
		wget -t5 -qO /opt/*/*/*/*/*/zh_CN/*/deluge.mo raw.githubusercontent.com/hong0980/Deluge_zh_CN/main/deluge/i18n/zh_CN/LC_MESSAGES/deluge.mo
		/opt/etc/init.d/S80deluged start >/dev/null 2>&1
		_pidof deluged

	} || {
		echo_time "deluge 安装失败，再重试安装！" && exit 1
	}
}

install_qbittorrent() {
	opkg_install qbittorrent && {
		/opt/etc/init.d/S89qbittorrent start >/dev/null 2>&1 && sleep 5
		/opt/etc/init.d/S89qbittorrent stop >/dev/null 2>&1
		cat >"/opt/etc/qBittorrent_entware/config/qBittorrent.conf" <<-EOF
		[Preferences]
		Connection\PortRangeMin=44667
		Queueing\QueueingEnabled=false
		WebUI\CSRFProtection=false
		WebUI\Port=9080
		WebUI\Username=admin
		WebUI\LocalHostAuth=false
		General\Locale=zh
		Downloads\UseIncompleteExtension=true
		Downloads\SavePath=$download_dir
		EOF
		ln -sf /opt/etc/qBittorrent_entware/config/qBittorrent.conf /opt/etc/config/qBittorrent.conf
		/opt/etc/init.d/S89qbittorrent start >/dev/null 2>&1
		_pidof qbittorrent-nox

	} || {
		echo_time "qBittorrent 安装失败，再重试安装！"
		exit 1
	}
}

install_rtorrent() {
	opkg_install rtorrent-easy-install && {
		www_cfg=/opt/etc/lighttpd/conf.d/99-rtorrent-fastcgi-scgi-auth.conf
		sed -i '/server.port/d' $www_cfg && \
		echo "server.port = 1099" >>$www_cfg
		/opt/etc/init.d/S85rtorrent restart >/dev/null 2>&1 && sleep 5
		/opt/etc/init.d/S85rtorrent stop >/dev/null 2>&1

		opkg_install ffmpeg mediainfo unrar php7-mod-json git-http >/dev/null
		rurelease=$(git ls-remote -t https://github.com/Novik/ruTorrent v\* | awk -F/ 'NR == 1 {print $3}')
		wget -cN -t5 --no-check-certificate https://github.com/Novik/ruTorrent/archive/$rurelease.tar.gz -P /tmp && {
			tar -xzf /tmp/$rurelease.tar.gz -C /tmp
			[ -d /opt/share/www/rutorrent ] && rm -rf /opt/share/www/rutorrent
			mv -f /tmp/$(tar -tzf /tmp/$rurelease.tar.gz | awk -F/ 'NR == 1 {print $1}') /opt/share/www/rutorrent

			cat >/opt/share/www/rutorrent/conf/plugins.ini <<-\ENTWARE
				;; Plugins' permissions.
				;; If flag is not found in plugin section, corresponding flag from "default" section is used.
				;; If flag is not found in "default" section, it is assumed to be "yes".
				;;
				;; For setting individual plugin permissions you must write something like that:
				;;
				;; [ratio]
				;; enabled = yes ;; also may be "user-defined", in this case user can control plugin's state from UI
				;; canChangeToolbar = yes
				;; canChangeMenu = yes
				;; canChangeOptions = no
				;; canChangeTabs = yes
				;; canChangeColumns = yes
				;; canChangeStatusBar = yes
				;; canChangeCategory = yes
				;; canBeShutdowned = yes

				[default]
				enabled = user-defined
				canChangeToolbar = yes
				canChangeMenu = yes
				canChangeOptions = yes
				canChangeTabs = yes
				canChangeColumns = yes
				canChangeStatusBar = yes
				canChangeCategory = yes
				canBeShutdowned = yes

				;; Default
				[autodl-irssi]
				enabled = user-defined
				[cookies]
				enabled = user-defined
				[cpuload]
				enabled = user-defined
				[create]
				enabled = user-defined
				[data]
				enabled = user-defined
				[diskspace]
				enabled = user-defined
				[edit]
				enabled = user-defined
				[extratio]
				enabled = user-defined
				[extsearch]
				enabled = user-defined
				[filedrop]
				enabled = user-defined
				[geoip]
				enabled = user-defined
				[lookat]
				enabled = user-defined
				[mediainfo]
				enabled = user-defined
				[ratio]
				enabled = user-defined
				[rss]
				enabled = user-defined
				[rssurlrewrite]
				enabled = user-defined
				[screenshots]
				enabled = user-defined
				[show_peers_like_wtorrent]
				enabled = user-defined
				[throttle]
				enabled = user-defined
				[trafic]
				enabled = user-defined
				[unpack]
				enabled = user-defined

				;; Enabled
				[_getdir]
				enabled = yes
				canBeShutdowned =no
				[_noty]
				enabled = yes
				canBeShutdowned =no
				[_task]
				enabled = yes
				canBeShutdowned =no
				[autotools]
				enabled = yes
				[datadir]
				enabled = yes
				[erasedata]
				enabled = yes
				[httprpc]
				enabled = yes
				canBeShutdowned = no
				[seedingtime]
				enabled = yes
				[source]
				enabled = yes
				[theme]
				enabled = yes
				[tracklabels]
				enabled = yes

				;; Disabled
				[check_port]
				enabled = yes
				[chunks]
				enabled = yes
				[feeds]
				enabled = no
				[history]
				enabled = yes
				[ipad]
				enabled = no
				[loginmgr]
				enabled = yes
				[retrackers]
				enabled = yes
				[rpc]
				enabled = yes
				[rutracker_check]
				enabled = yes
				[scheduler]
				enabled = yes
				[spectrogram]
				enabled = no
				[xmpp]
				enabled = no
			ENTWARE

			sed -i "{
				/scgi_port/ {s|5000|0|}
				/\"id\"/   {s|''|'/opt/bin/id'|}
				/\"curl\"/ {s|''|'/opt/bin/curl'|}
				/\"gzip\"/ {s|''|'/opt/bin/gzip'|}
				/\"stat\"/ {s|''|'/opt/bin/stat'|}
				/\"php\"/  {s|''|'/opt/bin/php-cgi'|}
				/scgi_host/ {s|127.0.0.1|unix:///opt/var/rpc.socket|}
				s|/tmp/errors.log|/opt/var/log/rutorrent_errors.log|
			}" /opt/share/www/rutorrent/conf/config.php
		}

		cat >/opt/etc/rtorrent/rtorrent.conf <<-EOF
			# 高级设置：任务信息文件路径。用来生成任务信息文件，记录种子下载的进度等信息
			session.path.set = /opt/etc/rtorrent/session
			# 监听种子文件夹
			schedule2 = watch_directory,5,5,load_start=/opt/etc/rtorrent/watchdir/*.torrent
			# 监听目录中的新的种子文件，并停止那些已经被删除部分的种子
			schedule2 = untied_directory,5,5,stop_untied=
			# 当磁盘空间不足时停止下载
			schedule2 = low_diskspace,5,60,close_low_diskspace=100M
			# 高级设置：绑定 IP
			network.bind_address.set = 0.0.0.0
			# 选项将指定选用哪一个端口去侦听。建议使用高于 49152 的端口。虽然 rTorrent 允许使用多个的端口，还是建议使用单个的端口。
			network.port_range.set = 51411-51411
			# 是否使用随机端口
			# yes 是 / no 否
			# port_random = no
			network.port_random.set = no
			# 下载完成或 rTorrent 重新启动时对文件进行 Hash 校验。这将确保你下载/做种的文件没有错误( auto 自动/ yes 启动 / no 禁用)
			pieces.hash.on_completion.set = yes
			# 高级设置：支持 UDP 伺服器
			trackers.use_udp.set = yes
			# 如下例中的值将允许将接入连接加密，开始时以非加密方式作为连接的输出方式，
			# 如行不通则以加密方式进行重试，在加密握手后，优先选择将纯文本以 RC4 加密
			protocol.encryption.set = allow_incoming,enable_retry,prefer_plaintext
			# 是否启用 DHT 支持。
			# 如果你使用了 public trackers，你可能希望使能 DHT 以获得更多的连接。
			# 如果你仅仅使用了私有的连接 privite trackers ，请不要启用 DHT，因为这将降低你的速度，并可能造成一些泄密风险，如泄露 passkey。一些 PT 站点甚至会因为检测到你使用 DHT 而向你发出警告。
			# disable 完全禁止/ off 不启用/ auto 按需启用(即PT种子不启用，BT种子启用)/ on 启用
			dht.mode.set = auto
			# 启用 DHT 监听的 UDP 端口
			dht.port.set = 51412
			# 对未标记为私有的种子启用/禁用用户交换。默认情况下禁用。
			# yes 启用 / no 禁用
			protocol.pex.set = yes
			# 本地挂载点路径
			network.scgi.open_local = /opt/var/rpc.socket
			# 编码类型(UTF-8 支持中文显示，避免乱码)
			encoding.add = utf8
			# 每个种子的最大同时上传连接数
			throttle.max_uploads.set = 8
			# 全局上传通道数
			throttle.max_uploads.global.set = 32
			# 全局下载通道数
			throttle.max_downloads.global.set = 64
			# 全局的下载速度限制，“0”表示无限制
			# 默认单位为 B/s (设置为 4(B) 表示 4B/s；4K表示 4KB/s；4M 表示4MB/s；4G 表示 4GB/s)
			throttle.global_down.max_rate.set_kb = 0
			# 全局的上传速度限制，“0”表示无限制
			# 默认单位为 B/s (设置为 4(B) 表示 4B/s；4K表示 4KB/s；4M 表示4MB/s；4G 表示 4GB/s)
			throttle.global_up.max_rate.set_kb = 0
			# 默认下载路径(不支持绝对路径，如~/torrents)
			directory.default.set = $download_dir
			# 免登陆 Web 服务初始化 rutorrent 的插件
			execute = {sh,-c,/opt/bin/php-cgi /opt/share/www/rutorrent/php/initplugins.php $user &}
		EOF

		cat >>/opt/etc/init.d/S85rtorrent <<-\EOF
			case $1 in
			start)
			/opt/etc/init.d/S80lighttpd start >/dev/null 2>&1
			;;
			stop)
			/opt/etc/init.d/S80lighttpd stop >/dev/null 2>&1
			;;
			restart)
			/opt/etc/init.d/S80lighttpd restart >/dev/null 2>&1
			;;
			esac
		EOF
		ln -sf /opt/etc/rtorrent/rtorrent.conf /opt/etc/config/rtorrent.conf
		/opt/etc/init.d/S85rtorrent start >/dev/null 2>&1
		_pidof rtorrent lighttpd

	} || {
		echo_time "rtorrent 安装失败，再重试安装！"
		exit 1
	}
}

install_transmission() {
	[ $1 ] && pr="transmission-cfp-cli transmission-cfp-daemon" || pr="transmission-cli transmission-daemon"
	opkg_install $pr && {
		wget -t5 -qO /tmp/tr.zip github.com/ronggang/transmission-web-control/archive/master.zip && {
			make_dir "/opt/share/transmission"
			unzip -oq /tmp/tr.zip -d /tmp
			mv /tmp/transmission-web-control-master/src /opt/share/transmission/web
			sed -i '/original/d' /opt/share/transmission/web/index.html
			sed -i '/original/d' /opt/share/transmission/web/index.mobile.html
		} || {
			echo_time "下载 transmission-web-control 出错！"
			opkg_install transmission-web-control
			echo_time "使用 Entware transmission-web-control"
		}
		[ -e /opt/etc/init.d/S88transmission-cfp ] && mv /opt/etc/init.d/S88transmission-cfp /opt/etc/init.d/S88transmission
		sed -i "{
			/rpc-username/ {s|: \".*\"|: \"admin\"|}
			/rpc-password/ {s|: \".*\"|: \"admin\"|}
			/port-forwarding-enabled/ {s|false|true|}
			/download-dir/ {s|: \".*\"|: \"$download_dir\"|}
		}" /opt/etc/transmission/settings.json
		ln -sf /opt/etc/transmission/settings.json /opt/etc/config/transmission.json
		/opt/etc/init.d/S88transmission start >/dev/null 2>&1
		_pidof transmission

	} || {
		echo_time "transmission 安装失败，再重试安装！"
		exit 1
	}
}

if [ $1 ]; then
	log="/tmp/log/softwarecenter.log"
	case $1 in
		amuled)
			install_amule >>$log
			;;
		aria2)
			install_aria2 >>$log
			;;
		deluged)
			install_deluge >>$log
			;;
		rtorrent)
			install_rtorrent >>$log
			;;
		qbittorrent)
			install_qbittorrent >>$log
			;;
		transmission)
			shift
			[ $1 = 1 ] && install_transmission >>$log || \
						  install_transmission 277 >>$log
			;;
		system_check)
			shift
			system_check $1 >>$log
			;;
		opkg_install)
			shift
			opkg_install $@ >>$log
			;;
		*) break ;;
	esac
fi
