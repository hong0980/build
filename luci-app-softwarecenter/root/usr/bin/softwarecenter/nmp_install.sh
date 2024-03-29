#!/bin/sh
. /usr/bin/softwarecenter/lib_functions.sh

pkglist_nginx="nginx-extras"
pkglist_php8="coreutils-stat coreutils-fold php8 php8-cgi php8-cli php8-fastcgi php8-fpm"
phpmod="php8-mod-calendar php8-mod-gd php8-mod-ctype php8-mod-curl php8-mod-dom php8-mod-exif php8-mod-fileinfo php8-mod-filter php8-mod-ftp php8-mod-gettext php8-mod-gmp php8-mod-iconv php8-mod-intl php8-mod-ldap php8-mod-mbstring php8-mod-mysqli php8-mod-opcache php8-mod-openssl php8-mod-pcntl php8-mod-pdo php8-mod-phar php8-mod-session php8-mod-shmop php8-mod-simplexml php8-mod-snmp php8-mod-soap php8-mod-sockets php8-mod-sqlite3 php8-mod-sysvmsg php8-mod-sysvsem php8-mod-sysvshm php8-mod-tokenizer php8-mod-xml php8-mod-xmlreader php8-mod-xmlwriter php8-mod-zip php8-pecl-dio php8-pecl-http  php8-pecl-raphf php8-pecl-redis redis-utils snmp-mibs snmp-utils zoneinfo-core"
dblist="mariadb-client-extra mariadb-server-extra php8-mod-pdo-mysql"

# Nginx Server管理 参数：$1:动作
nginx_manage() {
    /opt/etc/init.d/S47snmpd $1 >/dev/null 2>&1
    /opt/etc/init.d/S70redis $1 >/dev/null 2>&1
    /opt/etc/init.d/S80nginx $1 >/dev/null 2>&1
    /opt/etc/init.d/S79php8-fpm $1 >/dev/null 2>&1
}

# 卸载nginx
del_nginx() {
    nginx_manage stop
    del_php
    remove_soft "$pkglist_nginx"
    rm -rf /opt/etc/nginx
    /usr/bin/find /opt -name "*nginx*" -exec rm -rf {} \;
    rm /opt/etc/redis.conf
    echo_time "========= 卸载Nginx完成 =========\n"
}

# 卸载PHP
del_php() {
    remove_soft "$pkglist_php8" "$phpmod"
    rm /opt/etc/php.ini
    /usr/bin/find /opt -name "php*" -exec rm -rf {} \;
    echo_time "========= 卸载PHP完成 =========\n"
}

del_mysql() {
    # 停止MySQL
    /opt/etc/init.d/S70mysqld stop >/dev/null 2>&1
    echo_time "正在停止MySQL"
    sleep 10

    # 卸载相关的软件包，文件与目录
    remove_soft "$(opkg list-installed | awk '/mariadb/{print $1}' | xargs echo)"
    rm -rf /opt/etc/mysql /opt/var/mariadb/ /opt/var/mysql
    echo_time "========= 卸载MySQ完成 =========\n"
}

# PHP初始化
init_php() {
    # 安装php
    opkg_install $pkglist_php8 $phpmod
    [ $? = 1 ] && return 1
    make_dir /opt/usr/php/session/

    sed -i "{
        /^doc_root/d
        /^memory_limit/ {s|= .*|= 128M|}
        /^post_max_size/ {s|= .*|= 8000M|}
        /^output_buffering/ {s|= .*|= 4096|}
        /^max_execution_time/ {s|= .*|= 2000|}
        /^upload_max_filesize/ {s|= .*|= 8000M|}
    }" /opt/etc/php.ini
    sed -i "/listen.mode/ {s|= .*|= 0666|}" /opt/etc/php8-fpm.d/www.conf

    # PHP配置文件
	cat >>"/opt/etc/php.ini" <<-\PHPINI
	session.save_path = "/opt/usr/php/session/"
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

	cat >>"/opt/etc/php8-fpm.d/www.conf" <<-\PHPFPM
	env[HOSTNAME] = $HOSTNAME
	env[PATH] = /opt/bin:/opt/sbin:/usr/sbin:/usr/bin:/sbin:/bin
	env[TMP] = /opt/tmp
	env[TMPDIR] = /opt/tmp
	env[TEMP] = /opt/tmp
	PHPFPM
    echo_time "========= PHP 安装完成 =========\n"
}

# 安装nginx
init_nginx() {
    get_env
    echo_time "开始安装 php 环境\n"
    opkg_install "$pkglist_nginx"
    [ $? = 1 ] && return 1
    init_php
    make_dir $dir_vhost /opt/etc/nginx/conf

    # 初始化nginx配置文件
	cat >"/opt/etc/nginx/nginx.conf" <<-EOF
	user $username root;
	pid /opt/var/run/nginx.pid;
	env TZ=Asia/Shanghai;
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
	    include $dir_vhost/*.conf;
	    include /opt/etc/nginx/conf.d/*.conf;
	}
	EOF

    # 特定程序的nginx配置
    nginx_special_conf

    # 初始化redis
    echo -e "unixsocket /opt/var/run/redis.sock\nunixsocketperm 777" >> /opt/etc/redis.conf
    echo_time "========= nginx 安装完成 =========\n"
}

# 重置、初始化MySQL #
init_mysql() {
    get_env
    opkg_install "$dblist"
    [ $? = 1 ] && return 1
	cat >"/opt/etc/mysql/my.cnf" <<-EOF
	[client-server]
	port               = 3306
	socket             = /opt/var/run/mysqld.sock

	[mysqld]
	user               = $username
	socket             = /opt/var/run/mysqld.sock
	pid-file           = /opt/var/run/mysqld.pid
	basedir            = /opt
	lc_messages_dir    = /opt/share/mariadb
	lc_messages        = en_US
	datadir            = /opt/var/mariadb/
	tmpdir             = /opt/tmp/

	skip-external-locking

	bind-address       = 127.0.0.1

	key_buffer_size    = 24M
	max_allowed_packet = 24M
	thread_stack       = 192K
	thread_cache_size  = 8

	[mysqldump]
	quick
	quote-names
	max_allowed_packet = 24M

	[mysql]
	#no-auto-rehash

	[isamchk]
	key_buffer_size    = 24M

	[mysqlhotcopy]
	interactive-timeout
	EOF

    chmod 644 /opt/etc/mysql/my.cnf
    make_dir /opt/var/mysql

    # 数据库安装，同步方式，无需延时等待
    echo_time "正在初始化数据库，请稍等1分钟"
    mysql_install_db --user=$username --basedir=/opt --datadir=/opt/var/mariadb/ >/dev/null 2>&1

	# 初次启动MySQL，异步方式，加延时等待
	echo_time "正在启动MySQL"
	/opt/etc/init.d/S70mysqld start >/dev/null 2>&1
	sleep 20

	# 设置数据库密码
	# user=${user:-root}
	pass=${pass:-123456}
	mysqladmin -u $username password $pass
	echo_time "使用自定义数据库用户：$username 密码：$pass"
    echo_time "========= MySQL 安装完成 =========\n"
}

# 特定程序的nginx配置
nginx_special_conf() {
    # php-fpm
	cat >"/opt/etc/nginx/conf/php-fpm.conf" <<-\OOO
	location ~ \.php(?:$|/) {
	    fastcgi_split_path_info ^(.+\.php)(/.+)$;
	    fastcgi_pass unix:/opt/var/run/php8-fpm.sock;
	    fastcgi_index index.php;
	    fastcgi_param SCRIPT_FILENAME $document_root$fastcgi_script_name;
	    include fastcgi_params;
	}
	OOO

    # nextcloud
	cat >"/opt/etc/nginx/conf/nextcloud.conf" <<-\OOO
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
	    fastcgi_pass unix:/opt/var/run/php8-fpm.sock;
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
	cat >"/opt/etc/nginx/conf/owncloud.conf" <<-\OOO
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
	    fastcgi_pass unix:/opt/var/run/php8-fpm.sock;
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
	cat >"/opt/etc/nginx/conf/wordpress.conf" <<-\OOO
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
	    fastcgi_pass unix:/opt/var/run/php8-fpm.sock;
	    fastcgi_buffers 16 16k;
	    fastcgi_buffer_size 32k;
	}
	location ~* \.(js|css|png|jpg|jpeg|gif|ico)$ {
	    expires max;
	    log_not_found off;
	}
	OOO

    # typecho
	cat >"/opt/etc/nginx/conf/typecho.conf" <<-\OOO
	if (!-e $request_filename) {
	        rewrite ^(.*)$ /index.php$1 last;
	    }
	OOO
}
