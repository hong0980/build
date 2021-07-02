#!/bin/sh
#Write for Almquist Shell version: 1.8
# Copyright (C) 2019 Jianpeng Xiang (1505020109@mail.hnust.edu.cn)
# This is free software, licensed under the GNU General Public License v3.

pkglist_base="wget unzip e2fsprogs ca-certificates"

status(){
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

#tar -czf "/tmp/opt_backup_$(date +%F_%H-%M).tgz" /opt/*

make_dir(){
	for p in "$@"; do
		[ -d "$p" ] || { mkdir -p $p && echo_time "新建目录 $p";}
	done
	return 0
}

# entware环境设定 参数：$1:安装位置 $2:设备底层架构 说明：此函数用于写入新配置
entware_set(){
	entware_unset
	[ "$1" ] && USB_PATH="$1" || { echo_time "未选择安装路径！" && exit 1; }
	[ "$2" ] || { echo_time "未选择CPU架构！" && exit 1; }
	system_check $USB_PATH
	echo_time "安装基本软件" && install_soft "$pkglist_base"
	make_dir "$USB_PATH/opt" "/opt"
	mount -o bind $USB_PATH/opt /opt

	Kernel_V=$(expr substr `uname -r` 1 3)
	if [ "$2" = "mips" ]; then
		if [ $Kernel_V = "2.6" ]; then
			INST_URL=http://pkg.entware.net/binaries/mipsel/installer/installer.sh
		else
			INST_URL=http://bin.entware.net/mipselsf-k3.4/installer/generic.sh
		fi
	fi

	case $2 in
		x86_64)		INST_URL=http://bin.entware.net/x64-k3.2/installer/generic.sh;;
		x86_32)		INST_URL=http://pkg.entware.net/binaries/x86-32/installer/entware_install.sh;;
		armv5*)		INST_URL=http://bin.entware.net/armv5sf-k3.2/installer/generic.sh;;
		aarch64)	INST_URL=http://bin.entware.net/aarch64-k3.10/installer/generic.sh;;
		armv7l)		INST_URL=http://bin.entware.net/armv7sf-k${Kernel_V}/installer/generic.sh;;
	esac

	if [ $INST_URL ]; then
		wget -t 5 -qcNO - $INST_URL | /bin/sh
	else
		echo_time "抱歉，不支持您的设备！"
		exit 1
	fi

	[ -s /opt/etc/init.d ] || {
	 echo_time "安装 Entware 出错，请重试！"
	 exit 1
	}

cat > "/etc/init.d/entware" <<-\ENTWARE
#!/bin/sh /etc/rc.common
START=51

get_entware_path(){
for mount_point in `lsblk -s | awk '/mnt/{print $7}'`; do
if [ -d "$mount_point/opt/etc" ]; then
echo "$mount_point"
break
fi
done
}

start(){
mkdir -p /opt
ENTWARE_PATH=`uci get softwarecenter.main.disk_mount`
[ $ENTWARE_PATH ] || ENTWARE_PATH=$(get_entware_path)
mount -o bind $ENTWARE_PATH/opt /opt
}

stop(){
/opt/etc/init.d/rc.unslung stop
umount -lf /opt
rm -r /opt
}

restart(){
stop;start
}
ENTWARE

	chmod +x /etc/init.d/entware
	/etc/init.d/entware enable
	echo "export PATH=/opt/bin:/opt/sbin:$PATH" >> /etc/profile

	if wget -qcNO- -t 5 http://pkg.entware.net/sources/i18n_glib223.tar.gz | tar xvz -C /opt/usr/share/ > /dev/null; then
    echo_time "添加 zh_CN.UTF-8"
    /opt/bin/localedef.new -c -f UTF-8 -i zh_CN zh_CN.UTF-8
    sed -i 's/en_US.UTF-8/zh_CN.UTF-8/g' /opt/etc/profile
	fi

	echo_time "Entware 安装成功！\n"
}

# entware环境解除 说明：此函数用于删除OPKG配置设定
entware_unset(){
	/etc/init.d/entware stop > /dev/null 2>&1
	/etc/init.d/entware disable > /dev/null 2>&1
	rm /etc/init.d/entware
	sed -i "/export PATH=\/opt\/bin/d" /etc/profile
	source /etc/profile >/dev/null 2>&1
	umount -lf /opt
	rm -rf /opt
}

# 软件包安装 参数: $@:安装列表 说明：本函数将负责安装指定列表的软件到外置存储区，请保证区域指向正常且空间充足
install_soft(){
	source /etc/profile > /dev/null 2>&1 && opkg update > /dev/null 2>&1
	for ipk in $@; do
		if [ "`which $ipk`" ]; then
			echo_time "$ipk	已经安装"
		else
			echo_time "正在安装  $ipk\c"
			opkg install $ipk > /dev/null 2>&1
			status
			if [ $? != 0 ]; then
				echo_time "强制安装  $ipk\c"
				opkg --force-depends --force-overwrite install $ipk > /dev/null 2>&1
				status
			fi
		fi
	done
}

# 软件包卸载 参数: $1:卸载列表 说明：本函数将负责强制卸载指定的软件包
remove_soft(){
	for ipk in $@ ; do
		echo_time "正在卸载 $ipk\c"
		opkg remove --force-depends $ipk > /dev/null 2>&1
		status
	done
}

echo_time() {
	echo -e "[ `date +"%m月%d日 %H:%M:%S"` ]  $@"
}

# 磁盘分区挂载
system_check(){
	[ $1 ] && Partition_disk=${1} || Partition_disk="`uci get softwarecenter.main.Partition_disk`1"

	if [ -n "`lsblk -p | grep ${Partition_disk}`" ]; then
		filesystem="`blkid -s TYPE | grep ${Partition_disk/mnt/dev} | cut -d'"' -f2`"
		if [ "$filesystem" = "ext4" ]; then
			echo_time "磁盘 $1 符合安装要求"
		else
			echo_time "磁盘$Partition_disk原是$filesystem重新格式化ext4。"
			umount -l ${Partition_disk}
			echo y | mkfs.ext4 ${Partition_disk/mnt/dev}
			mount ${Partition_disk/mnt/dev} ${Partition_disk}
		fi
	else
		Partition_disk=`uci get softwarecenter.main.Partition_disk`
		echo_time "磁盘$Partition_disk没有分区，进行分区并格式化ext4。"
		parted -s ${Partition_disk} mklabel msdos
		parted -s ${Partition_disk} mklabel gpt \
		mkpart primary ext4 512s 100%
		sync; sleep 2
		echo y | mkfs.ext4 ${Partition_disk}1
		make_dir ${Partition_disk/dev/mnt}1
		mount ${Partition_disk}1 ${Partition_disk/dev/mnt}1
	fi

}

# 配置交换分区文件 参数: $1:交换空间大小(M) $2:交换分区挂载点
config_swap_init(){
	status=$(cat /proc/swaps | awk 'NR==2')
	if [ "$status" ]; then
		echo_time "Swap 已经启用"
	else
		[ -e "$1/opt/.swap" ] || {
			echo_time "正在生成swap文件，请耐心等待..."
			dd if=/dev/zero of=$2/opt/.swap bs=1M count=$1
			mkswap $2/opt/.swap
			chmod 0600 $2/opt/.swap
		}
		# 启用交换分区
		swapon $2/opt/.swap
		echo_time "现在你可以使用 free 命令查看swap是否启用"
	fi
}

# 删除交换分区文件 参数: $disk_mount:交换分区挂载点
config_swap_del(){
	[ -e /opt/.swap ] && {
		swapoff /opt/.swap
		rm -f /opt/.swap
		echo_time "$1/opt/.swap文件已删除！\n"
	}
}

# 获取通用环境变量
get_env(){
# 获取用户名
	[ "$USER" ] && username=$USER || username=$(cat /etc/passwd | awk -F: 'NR==1{print $1}')

# 获取路由器IP
	localhost=$(ifconfig | awk '/inet addr/{print $2}' | awk -F: 'NR==1{print $2}')
	[ "$localhost" ] || localhost="你的路由器IP"
}

# 容量验证 参数：$1：目标位置
check_available_size(){
	available_size="`lsblk -s | grep $1 | awk '{print $4}'`"
	[ $available_size ] && echo "$available_size"
}

opkg_install(){
	[ ! -x /etc/init.d/entware ] && echo_time "安装应用前应先部署或开启Entware" && exit 1
	source /etc/profile > /dev/null 2>&1 && echo_time "更新软件源中" && opkg update > /dev/null 2>&1
	make_dir /opt/etc/config /opt/downloads > /dev/null 2>&1
	for i in $@; do
		if [ "`opkg list | awk '{print $1}' | grep -w $i`" ]; then
			echo_time "请耐心等待 $i 安装中"
			opkg install $i
		else
			echo_time "$i 不在 Entware 软件源，跳过安装！"
		fi
	done
}

amule(){
	if opkg_install amule; then
		/opt/etc/init.d/S57amuled start > /dev/null 2>&1 && sleep 5
		/opt/etc/init.d/S57amuled stop > /dev/null 2>&1
		if wget -O AmuleWebUI.zip https://codeload.github.com/MatteoRagni/AmuleWebUI-Reloaded/zip/master; then
			unzip -d /opt/share/amule/ AmuleWebUI.zip > /dev/null 2>&1 && rm AmuleWebUI.zip
			mv -f /opt/share/amule/AmuleWebUI-Reloaded-master /opt/share/amule/webserver/AmuleWebUI-Reloaded
			sed -i 's/ajax.googleapis.com/ajax.lug.ustc.edu.cn/g' /opt/share/amule/webserver/AmuleWebUI-Reloaded/*.php
		else
			echo_time AmuleWebUI-Reloaded 下载失败，使用原版UI。
		fi
		pp=`echo -n admin | md5sum | awk '{print $1}'`
		sed -i "{
		s/^Enabled=.*/Enabled=1/g
		s/^ECPas.*/ECPassword=$pp/g
		s/^UPnPEn.*/UPnPEnabled=1/g
		s/^Password=.*/Password=$pp/g
		s/^UPnPECE.*/UPnPECEnabled=1/g
		s/^Template=.*/Template=AmuleWebUI-Reloaded/g
		s/^AcceptExternal.*/AcceptExternalConnections=1/g
		s|^IncomingDir=.*|IncomingDir=/opt/downloads|g
		}" /opt/var/amule/amule.conf
	else
		echo_time amule 安装失败，再重试安装！ && exit 1
	fi
	ln -sf /opt/var/amule/amule.conf /opt/etc/config/amule.conf
	/opt/etc/init.d/S57amuled restart > /dev/null 2>&1 && \
	[ -n "`pidof amuled`" ] && echo_time amule 已经运行 || echo_time amule 没有运行
	echo
}

aria2(){
	if opkg_install aria2; then
		Pro="/opt/var/aria2"
		make_dir $Pro > /dev/null && cd $Pro
		if for i in aria2.conf clean.sh delete.sh tracker.sh dht.dat core dht6.dat; do
				if [ ! -s $i ]; then
					wget -N -t2 -T3 https://raw.githubusercontent.com/P3TERX/aria2.conf/master/$i || \
					curl -fsSLO https://raw.githubusercontent.com/P3TERX/aria2.conf/master/$i || \
					wget -N -t2 -T3 https://cdn.jsdelivr.net/gh/P3TERX/aria2.conf/$i || \
					curl -fsSLO https://cdn.jsdelivr.net/gh/P3TERX/aria2.conf/$i
					[ -s $i ] && echo_time "$i 下载成功 !" || echo_time "$i 下载失败 !"
				fi
			done
			sed -i -e "s|session.dat|aria2.session|g;s|=/opt/etc|=$Pro|" /opt/etc/init.d/S81aria2
			sed -i -e 's|dir=.*|dir=/opt/downloads|g;s|/root/.aria2|'"$Pro"'|g;s/^rpc-se.*/rpc-secret=Passw0rd/g' ./aria2.conf
			sed -i -e '/^INFO/d;/^ERROR/d;/^FONT/d;/^LIGHT/d;/^WARRING/d' ./core
			sed -i -e '/^INFO/d;/^ERROR/d;/^FONT/d;/^LIGHT/d' ./tracker.sh
			sed -i 's|\#!/usr.*|\#!/bin/sh|g' ./*.sh; then
				chmod +x *.sh && sh ./tracker.sh > /dev/null 2>&1 && [ $? = 0 ] && \
				echo_time "BT 服务器地址下载成功！" || echo_time "BT 服务器地址下载失败！"
				ln -sf $Pro/aria2.conf /opt/etc/config/aria2.conf
				rm /opt/etc/aria2.conf
		fi
	else
		echo_time aria2 安装失败，再重试安装！ && exit 1
	fi
	/opt/etc/init.d/S81aria2 restart > /dev/null 2>&1 && \
	[ -n "`pidof aria2c`" ] && echo_time aria2 已经运行 || echo_time aria2 没有运行
	echo
}

deluge(){
	if opkg_install deluge-ui-web; then
		/opt/etc/init.d/S80deluged start > /dev/null 2>&1
		/opt/etc/init.d/S81deluge-web start > /dev/null 2>&1 
		sleep 5
		/opt/etc/init.d/S80deluged stop > /dev/null 2>&1
		/opt/etc/init.d/S81deluge-web stop > /dev/null 2>&1
		sed -i 's|root/Down|opt/down|g' /opt/etc/deluge/core.conf
		sed -i 's|"language.*|"language": "zh_CN",|g' /opt/etc/deluge/web.conf
		ln -sf /opt/etc/deluge/core.conf /opt/etc/config/deluge.conf
		sed -i '/deluged -l/a\	sleep 5\ndeluge-web -l \/opt\/etc\/deluge\/deluge-web.log -L error -p 888' /opt/etc/init.d/S80deluged
		sed -i '/killall deluged/a\	sleep 5\nkillall deluge-web' /opt/etc/init.d/S80deluged
	else
		echo_time deluge 安装失败，再重试安装！ && exit 1
	fi
	/opt/etc/init.d/S80deluged restart > /dev/null 2>&1 && \
	[ "`pidof deluged`" ] && echo_time deluge 已经运行 || echo_time deluge 没有运行
	/opt/etc/init.d/S81deluge-web restart > /dev/null 2>&1 && \
	[ "`pidof deluge-web`" ] && echo_time deluge-web 已经运行 || echo_time deluge-web 没有运行
	echo
}

qbittorrent(){
if opkg_install qbittorrent; then
	/opt/etc/init.d/S89qbittorrent start > /dev/null 2>&1 && sleep 5
	QBT_INI_FILE="/opt/etc/qBittorrent_entware/config/qBittorrent.conf"
cat > "$QBT_INI_FILE" << EOF
[Preferences]
Connection\PortRangeMin=44667
Queueing\QueueingEnabled=false
WebUI\CSRFProtection=false
WebUI\Port=9080
WebUI\Username=admin
General\Locale=zh
Downloads\UseIncompleteExtension=true
Downloads\SavePath=/opt/downloads/
EOF
		ln -sf /opt/etc/qBittorrent_entware/config/qBittorrent.conf /opt/etc/config/qBittorrent.conf
	else
		echo_time qBittorrent 安装失败，再重试安装！ && exit 1
	fi
	/opt/etc/init.d/S89qbittorrent restart > /dev/null 2>&1 && \
	[ "`pidof qbittorrent-nox`" ] && echo_time qbittorrent 已经运行 || echo_time qbittorrent 没有运行
	echo
}

rtorrent(){
	if opkg_install rtorrent-easy-install; then
		web_port=1099
		www_cfg=/opt/etc/lighttpd/conf.d/99-rtorrent-fastcgi-scgi-auth.conf
		if [ "`grep 'server.port' $www_cfg`" ]; then
			sed -i "s/^server.port = .*/server.port = $web_port/g" $www_cfg
		else
			echo "server.port = $web_port" >> $www_cfg
		fi
	else
		echo_time rtorrent 安装失败，再重试安装！ && exit 1
	fi

	install_soft ffmpeg mediainfo unrar php7-mod-json git-http > /dev/null
	rurelease=`git ls-remote -t https://github.com/Novik/ruTorrent v\* | awk -F/ 'NR == 1 {print $3}'`
	[ -e /opt/share/www/$rurelease.tar.gz* ] && rm /opt/share/www/$rurelease.tar.gz*
	if wget -cN -t 5 --no-check-certificate https://github.com/Novik/ruTorrent/archive/$rurelease.tar.gz -P /opt/share/www; then
		[ -d /opt/share/www/rutorrent ] && rm -rf /opt/share/www/rutorrent
		tar -xzf /opt/share/www/$rurelease.tar.gz -C /opt/share/www
		mv -f /opt/share/www/$(tar -tzf /opt/share/www/$rurelease.tar.gz | awk -F/ 'NR == 1 {print $1}') /opt/share/www/rutorrent
		rm /opt/share/www/$rurelease.tar.gz*

cat > /opt/share/www/rutorrent/conf/plugins.ini <<-\ENTWARE
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

	rut_cfg=/opt/share/www/rutorrent/conf/config.php
	sed -i 's|/tmp/errors.log|/opt/var/log/rutorrent_errors.log|g' $rut_cfg
	sed -i 's|$scgi_port = 5|// $scgi_port = 5|g' $rut_cfg
	sed -i 's|$scgi_host = "1|// $scgi_host = "1|g' $rut_cfg
	sed -i 's|// $scgi_port = 0|$scgi_port = 0|g' $rut_cfg
	sed -i 's|// $scgi_host = "unix:///tmp|$scgi_host = "unix:///opt/var|g' $rut_cfg
	sed -i "s|\"php\" 	=> ''|\"php\" 	=> '/opt/bin/php-cgi'|" $rut_cfg
	sed -i "s|\"curl\"	=> ''|\"curl\"	=> '/opt/bin/curl'|" $rut_cfg
	sed -i "s|\"gzip\"	=> ''|\"gzip\"	=> '/opt/bin/gzip'|" $rut_cfg
	sed -i "s|\"id\"	=> ''|\"id\"	=> '/opt/bin/id'|" $rut_cfg
	sed -i "s|\"stat\"	=> ''|\"stat\"	=> '/opt/bin/stat'|" $rut_cfg
	sed -i 's|this.request("?action=getplugins|this.requestWithoutTimeout("?action=getplugins|g' /opt/share/www/rutorrent/js/webui.js
	sed -i 's|this.request("?action=getuisettings|this.requestWithoutTimeout("?action=getuisettings|g' /opt/share/www/rutorrent/js/webui.js
	fi

	if [ -z "`grep execute /opt/etc/rtorrent/rtorrent.conf`" ]; then
cat > /opt/etc/rtorrent/rtorrent.conf << EOF
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
directory.default.set = /opt/downloads
# 免登陆 Web 服务初始化 rutorrent 的插件
execute = {sh,-c,/opt/bin/php-cgi /opt/share/www/rutorrent/php/initplugins.php $user &}
EOF
	fi
	ln -sf /opt/etc/rtorrent/rtorrent.conf /opt/etc/config/rtorrent.conf
	echo -e '[ $1 = start ] && /opt/etc/init.d/S80lighttpd start > /dev/null 2>&1 &\n[ $1 = stop ] && /opt/etc/init.d/S80lighttpd stop > /dev/null 2>&1 &\n[ $1 = restart ] && /opt/etc/init.d/S80lighttpd restart > /dev/null 2>&1 &' >> /opt/etc/init.d/S85rtorrent
	/opt/etc/init.d/S85rtorrent restart > /dev/null 2>&1 && \
	[ -n "`pidof rtorrent`" ] && echo_time rtorrent 已经运行 || echo_time rtorrent 没有运行
	[ -n "`pidof lighttpd`" ] && echo_time lighttpd 已经运行 || echo_time lighttpd 没有运行
	echo
}

transmission(){
	[ $1 ] && r="transmission-cfp-cli transmission-cfp-daemon" || r="transmission-cli transmission-daemon"
	if opkg_install $r; then
		if wget -O tr.zip https://github.com/ronggang/transmission-web-control/archive/master.zip; then
			unzip -d /opt/share/ tr.zip > /dev/null 2>&1 && rm tr.zip
			make_dir /opt/share/transmission/web > /dev/null 2>&1 
			mv -f /opt/share/transmission-web-control-master/src/* /opt/share/transmission/web
			rm -rf /opt/share/transmission-w*
		else
			echo_time "下载 transmission-web-control 出错！" && opkg_install transmission-web-control
			echo_time "使用 Entware transmission-web-control"
		fi
		sed -i '/index.original.html/d' /opt/share/transmission/web/index.html
		sed -i '/index.original.html/d' /opt/share/transmission/web/index.mobile.html
		[ -e /opt/etc/init.d/S88transmission-cfp ] && mv /opt/etc/init.d/S88transmission-cfp /opt/etc/init.d/S88transmission
		sed -i -e 's|/torrent||g;s|root|admin|g;s|.*rpc-password.*|    "rpc-password": "admin",|g' /opt/etc/transmission/settings.json
		ln -sf /opt/etc/transmission/settings.json /opt/etc/config/transmission.json
	else
		echo_time transmission 安装失败，再重试安装！ && exit 1
	fi
	/opt/etc/init.d/S88transmission start > /dev/null 2>&1
	[ "`pidof transmission-daemon`" ] && echo_time transmission 已经运行 || echo_time transmission 没有运行
	echo
}

	if [ $1 ]; then
		log="/tmp/log/softwarecenter.log"
		case $1 in
			amule)			amule >> $log;;
			aria2)			aria2 >> $log;;
			deluge)			deluge >> $log;;
			rtorrent)		rtorrent >> $log;;
			qbittorrent)	qbittorrent >> $log;;
			transmission)	transmission >> $log;;
			transmi_2_77)	transmission 277 >> $log;;
			system_check)	system_check >> $log;;
			opkg_install)	opkg_install >> $log;;
			install_soft)	install_soft >> $log;;
			*)				break;;
		esac
	fi
