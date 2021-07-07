#!/bin/sh
#Ningx安装脚本，本脚本提供以下函数接口： init_nginx del_nginx init_php del_php

# Copyright (C) 2019 Jianpeng Xiang (1505020109@mail.hnust.edu.cn)
# This is free software, licensed under the GNU General Public License v3.

# 加载库函数
. /usr/bin/softwarecenter/lib_functions.sh

# 在Entware软件仓库中，nginx 与 nginx-extras冲突，后者提供一个更加完整的nginx支持
pkglist_nginx="nginx-extras"
pkglist_php7="php7 php7-cgi php7-cli php7-fastcgi php7-fpm"

phpmod="php7-mod-mysqli php7-mod-pdo php7-mod-pdo-mysql php7-mod-calendar php7-mod-ctype php7-mod-curl php7-mod-dom php7-mod-exif php7-mod-fileinfo php7-mod-ftp php7-mod-gd php7-mod-gettext php7-mod-gmp php7-mod-iconv php7-mod-intl php7-mod-json php7-mod-ldap php7-mod-session php7-mod-mbstring php7-mod-opcache php7-mod-openssl php7-mod-pcntl php7-mod-phar php7-pecl-redis php7-mod-session php7-mod-shmop php7-mod-simplexml php7-mod-snmp php7-mod-soap php7-mod-sockets php7-mod-sqlite3 php7-mod-sysvmsg php7-mod-sysvsem php7-mod-sysvshm php7-mod-tokenizer php7-mod-xml php7-mod-xmlreader php7-mod-xmlwriter php7-mod-zip php7-pecl-dio php7-pecl-http php7-pecl-libevent php7-pecl-propro php7-pecl-raphf redis-utils snmpd snmp-mibs snmp-utils zoneinfo-core zoneinfo-asia"

# PHP初始化
init_php(){
	# 安装php
	[ "`grep x64-k3.2 /opt/etc/opkg.conf`" ] || sed -i 's|src/gz.*|src/gz entware http://204.44.71.241/entware/x64-k3.2/2019|' /opt/etc/opkg.conf
	install_soft $pkglist_php7 $phpmod
	[ "`grep '"x64-k3.2"' /opt/etc/opkg.conf`" ] && sed -i 's|src/gz.*|src/gz entware http://bin.entware.net/x64-k3.2|' /opt/etc/opkg.conf
	make_dir /opt/usr/php/tmp/ > /dev/null 2>&1 && chmod -R 777 /opt/usr/php/tmp/

	sed -i "/^doc_root/d" /opt/etc/php.ini
	sed -i "s|.*memory_limit.*|memory_limit = 128M|g" /opt/etc/php.ini
	sed -i "s|.*post_max_size.*|post_max_size = 8000M|g" /opt/etc/php.ini
	sed -i "s|.*output_buffering.*|output_buffering = 4096|g" /opt/etc/php.ini
	sed -i "s|.*upload_max_filesize.*|upload_max_filesize = 8000M|g" /opt/etc/php.ini
	sed -i "s|.*max_execution_time.*|max_execution_time = 2000|g" /opt/etc/php.ini
	sed -i "s|.*listen.mode.*|listen.mode = 0666|g" /opt/etc/php7-fpm.d/www.conf

	# PHP配置文件
cat >> "/opt/etc/php.ini" <<-\PHPINI
session.save_path = "/opt/usr/php/tmp/"
opcache.enable=1
opcache.enable_cli=1
opcache.interned_strings_buffer=8
opcache.max_accelerated_files=10000
opcache.memory_consumption=128
opcache.save_comments=1
opcache.revalidate_freq=60
opcache.fast_shutdown=1
mysqli.default_socket=/opt/var/run/mysqld.sock
pdo_mysql.default_socket=/opt/var/run/mysqld.sock
PHPINI

cat >> "/opt/etc/php7-fpm.d/www.conf" <<-\PHPFPM
env[HOSTNAME] = $HOSTNAME
env[PATH] = /opt/bin:/usr/local/bin:/usr/bin:/bin
env[TMP] = /opt/tmp
env[TMPDIR] = /opt/tmp
env[TEMP] = /opt/tmp
PHPFPM
}

# 安装nginx
init_nginx(){
	get_env

	echo_time "安装php环境支持" && init_php
	# 安装nginx软件包
	install_soft "$pkglist_nginx"
	make_dir /opt/etc/nginx/vhost /opt/etc/nginx/no_use /opt/etc/nginx/conf > /dev/null 2>&1

	# 初始化nginx配置文件
cat > "/opt/etc/nginx/nginx.conf" << EOF
user $username root;
pid /opt/var/run/nginx.pid;
worker_processes auto;
events {
	use epoll;
	multi_accept on;
	worker_connections 1024;
}
http {
	charset utf-8;
	include mime.types;
	default_type application/octet-stream;

	sendfile on;
	tcp_nopush on;
	tcp_nodelay on;
	keepalive_timeout 60;

	client_max_body_size 2000m;
	client_body_temp_path /opt/tmp/;

	gzip on;
	gzip_vary on;
	gzip_proxied any;
	gzip_min_length 1k;
	gzip_buffers 4 8k;
	gzip_comp_level 2;
	gzip_disable "msie6";
	gzip_types text/plain text/css application/json application/x-javascript text/xml application/xml application/xml+rss text/javascript application/javascript image/svg+xml;
	include /opt/etc/nginx/vhost/*.conf;
}
EOF

	# 特定程序的nginx配置
	nginx_special_conf

	# 初始化redis
	echo -e "unixsocket /opt/var/run/redis.sock\nunixsocketperm 777" >> /opt/etc/redis.conf
}

# 卸载nginx
del_nginx(){
	nginx_manage stop
	del_php
	remove_soft "$pkglist_nginx"
	rm -rf /opt/etc/nginx
	/usr/bin/find -name "*nginx*" -exec rm -rf {} \;
	rm /opt/etc/redis.conf

}

# 特定程序的nginx配置
nginx_special_conf(){
# php-fpm
cat > "/opt/etc/nginx/conf/php-fpm.conf" <<-\OOO
location ~ \.php(?:$|/) {
	fastcgi_split_path_info ^(.+\.php)(/.+)$;
	fastcgi_pass unix:/opt/var/run/php7-fpm.sock;
	fastcgi_index index.php;
	fastcgi_param SCRIPT_FILENAME $document_root$fastcgi_script_name;
	include fastcgi_params;
}
OOO

# nextcloud
cat > "/opt/etc/nginx/conf/nextcloud.conf" <<-\OOO
add_header X-Content-Type-Options nosniff;
add_header X-XSS-Protection "1; mode=block";
add_header X-Robots-Tag none;
add_header X-Download-Options noopen;
add_header X-Permitted-Cross-Domain-Policies none;
location = /robots.txt {
	allow all;
	log_not_found off;
	access_log off;
}
location = /.well-known/carddav {
	return 301 $scheme://$host/remote.php/dav;
}
location = /.well-known/caldav {
	return 301 $scheme://$host/remote.php/dav;
}
fastcgi_buffers 64 4K;
fastcgi_send_timeout 300;
fastcgi_read_timeout 2400;
gzip on;
gzip_vary on;
gzip_comp_level 4;
gzip_min_length 256;
gzip_proxied expired no-cache no-store private no_last_modified no_etag auth;
gzip_types application/atom+xml application/javascript application/json application/ld+json application/manifest+json application/rss+xml application/vnd.geo+json application/vnd.ms-fontobject application/x-font-ttf application/x-web-app-manifest+json application/xhtml+xml application/xml font/opentype image/bmp image/svg+xml image/x-icon text/cache-manifest text/css text/plain text/vcard text/vnd.rim.location.xloc text/vtt text/x-component text/x-cross-domain-policy;
location / {
	rewrite ^ /index.php$request_uri;
}
location ~ ^/(?:build|tests|config|lib|3rdparty|templates|data)/ {
	deny all;
}
location ~ ^/(?:\.|autotest|occ|issue|indie|db_|console) {
	deny all;
}
location ~ ^/(?:index|remote|public|cron|core/ajax/update|status|ocs/v[12]|updater/.+|ocs-provider/.+)\.php(?:$|/) {
	fastcgi_split_path_info ^(.+?\.php)(/.*)$;
	include fastcgi_params;
	fastcgi_param SCRIPT_FILENAME $document_root$fastcgi_script_name;
	fastcgi_param PATH_INFO $fastcgi_path_info;
	fastcgi_param modHeadersAvailable true;
	fastcgi_param front_controller_active true;
	fastcgi_pass unix:/opt/var/run/php7-fpm.sock;
	fastcgi_intercept_errors on;
	fastcgi_request_buffering off;
}
location ~ ^/(?:updater|ocs-provider)(?:$|/) {
	try_files $uri/ =404;
	index index.php;
}
location ~ \.(?:css|js|woff|svg|gif)$ {
	try_files $uri /index.php$request_uri;
	add_header Cache-Control "public, max-age=15778463";
	add_header X-Content-Type-Options nosniff;
	add_header X-XSS-Protection "1; mode=block";
	add_header X-Robots-Tag none;
	add_header X-Download-Options noopen;
	add_header X-Permitted-Cross-Domain-Policies none;
	access_log off;
}
location ~ \.(?:png|html|ttf|ico|jpg|jpeg)$ {
	try_files $uri /index.php$request_uri;
	access_log off;
}
OOO

# owncloud
cat > "/opt/etc/nginx/conf/owncloud.conf" <<-\OOO
add_header X-Content-Type-Options nosniff;
add_header X-Frame-Options "SAMEORIGIN";
add_header X-XSS-Protection "1; mode=block";
add_header X-Robots-Tag none;
add_header X-Download-Options noopen;
add_header X-Permitted-Cross-Domain-Policies none;
location = /robots.txt {
	allow all;
	log_not_found off;
	access_log off;
}
location = /.well-known/carddav {
	return 301 $scheme://$host/remote.php/dav;
}
location = /.well-known/caldav {
	return 301 $scheme://$host/remote.php/dav;
}
gzip off;
fastcgi_buffers 8 4K;
fastcgi_send_timeout 300;
fastcgi_read_timeout 2400;
fastcgi_ignore_headers X-Accel-Buffering;
error_page 403 /core/templates/403.php;
error_page 404 /core/templates/404.php;
location / {
	rewrite ^ /index.php$uri;
}
location ~ ^/(?:build|tests|config|lib|3rdparty|templates|data)/ {
	return 404;
}
location ~ ^/(?:\.|autotest|occ|issue|indie|db_|console) {
	return 404;
}
location ~ ^/(?:index|remote|public|cron|core/ajax/update|status|ocs/v[12]|updater/.+|ocs-provider/.+|core/templates/40[34])\.php(?:$|/) {
	fastcgi_split_path_info ^(.+\.php)(/.*)$;
	include fastcgi_params;
	fastcgi_param SCRIPT_FILENAME $document_root$fastcgi_script_name;
	fastcgi_param SCRIPT_NAME $fastcgi_script_name;
	fastcgi_param PATH_INFO $fastcgi_path_info;
	fastcgi_param modHeadersAvailable true;
	fastcgi_param front_controller_active true;
	fastcgi_read_timeout 180;
	fastcgi_pass unix:/opt/var/run/php7-fpm.sock;
	fastcgi_intercept_errors on;
	fastcgi_request_buffering on;
}
location ~ ^/(?:updater|ocs-provider)(?:$|/) {
	try_files $uri $uri/ =404;
	index index.php;
}
location ~ \.(?:css|js)$ {
	try_files $uri /index.php$uri$is_args$args;
	add_header Cache-Control "max-age=15778463";
	add_header X-Content-Type-Options nosniff;
	add_header X-Frame-Options "SAMEORIGIN";
	add_header X-XSS-Protection "1; mode=block";
	add_header X-Robots-Tag none;
	add_header X-Download-Options noopen;
	add_header X-Permitted-Cross-Domain-Policies none;
	access_log off;
}
location ~ \.(?:svg|gif|png|html|ttf|woff|ico|jpg|jpeg|map)$ {
	add_header Cache-Control "public, max-age=7200";
	try_files $uri /index.php$uri$is_args$args;
	access_log off;
}
OOO

# wordpress
cat > "/opt/etc/nginx/conf/wordpress.conf" <<-\OOO
location = /favicon.ico {
	log_not_found off;
	access_log off;
}
location = /robots.txt {
	allow all;
	log_not_found off;
	access_log off;
}
location ~ /\. {
	deny all;
}
location ~ ^/wp-content/uploads/.*\.php$ {
	deny all;
}
location ~* /(?:uploads|files)/.*\.php$ {
	deny all;
}
location / {
	try_files $uri $uri/ /index.php?$args;
}
location ~ \.php$ {
	include fastcgi.conf;
	fastcgi_intercept_errors on;
	fastcgi_pass unix:/opt/var/run/php7-fpm.sock;
	fastcgi_buffers 16 16k;
	fastcgi_buffer_size 32k;
}
location ~* \.(js|css|png|jpg|jpeg|gif|ico)$ {
	expires max;
	log_not_found off;
}
OOO

# typecho
cat > "/opt/etc/nginx/conf/typecho.conf" <<-\OOO
if (!-e $request_filename) {
		rewrite ^(.*)$ /index.php$1 last;
	}
OOO

}

# 卸载PHP
del_php(){
	remove_soft "$phpmod"
	remove_soft "$pkglist_php7"
	rm /opt/etc/php.ini;
	/usr/bin/find /opt -name "php*" -exec rm -rf {} \;
}

# Nginx Server管理 参数：$1:动作
nginx_manage(){
	/opt/etc/init.d/S47snmpd $1 > /dev/null 2>&1
	/opt/etc/init.d/S70redis $1 > /dev/null 2>&1
	/opt/etc/init.d/S80nginx $1 > /dev/null 2>&1
	/opt/etc/init.d/S79php7-fpm $1 > /dev/null 2>&1
}