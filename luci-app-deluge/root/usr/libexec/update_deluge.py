#!/usr/bin/env python3
import os, re, subprocess, hashlib, random
from deluge.configmanager import ConfigManager, set_config_dir

def str_to_bool(value):
    s = str(value).strip().lower()
    if s not in {'1', '0', 'true', 'false'}:
        return value
    return s in {'1', 'true'}

def sha1_hash(password, salt):
    return hashlib.sha1(salt.encode() + password.encode()).hexdigest()

def generate_salt(length=40):
    return ''.join(random.choices('abcde0123456789', k=length))

def update_config(cfg, updates):
    changed = False
    for key, value in updates.items():
        if value is not None and cfg.get(key) != value:
            cfg[key] = value
            changed = True
    return changed

def get_uci_config():
    result = subprocess.run(
        ["uci", "show", "deluge"],
        capture_output=True,
        text=True
    )
    config = {}
    for line in result.stdout.splitlines():
        match = re.match(r".*main\.([^=]+)='(.*)'$", line)
        if match:
            config[match.group(1)] = match.group(2)
    return config

def initialize_web_config(config_dir):
    if not os.path.exists(os.path.join(config_dir, "web.conf")):
        from deluge.ui.web.server import DelugeWeb
        web = DelugeWeb()
        web.daemon = False
        web.start()
        web.shutdown()

def main():
    uci_config = get_uci_config()

    config_dir = os.path.normpath(uci_config.get("profile_dir", "/etc/deluge"))
    set_config_dir(config_dir)

    initialize_web_config(config_dir)

    web_config = ConfigManager("web.conf")
    core_config = ConfigManager("core.conf")

    salt = web_config.get("pwd_salt") or generate_salt()
    hashed_password = sha1_hash(uci_config["password"], salt) if uci_config.get("password") else None

    core_updates = {
        "download_location": uci_config.get("download_location", ""),
        "move_completed_path": uci_config.get("move_completed_path", ""),
        "torrentfiles_location": uci_config.get("torrentfiles_location", ""),

        "add_paused": str_to_bool(uci_config.get("add_paused", False)),
        "move_completed": str_to_bool(uci_config.get("move_completed", False)),
        "sequential_download": str_to_bool(uci_config.get("sequential_download", False)),
        "pre_allocate_storage": str_to_bool(uci_config.get("pre_allocate_storage", False)),
        "prioritize_first_last_pieces": str_to_bool(uci_config.get("prioritize_first_last_pieces", False)),

        "cache_size": int(uci_config.get("cache_size", 16384)),
        "cache_expiry": int(uci_config.get("cache_expiry", 60)),
        "max_upload_speed": int(uci_config.get("max_upload_speed", -1)),
        "max_download_speed": int(uci_config.get("max_download_speed", -1)),
        "max_active_downloading": int(uci_config.get("max_active_downloading", 3)),
        "max_active_limit": int(uci_config.get("max_active_limit", -1)),
        "max_active_seeding": int(uci_config.get("max_active_seeding", -1)),
        "max_connections_global": int(uci_config.get("max_connections_global", 200)),
        "max_upload_slots_global": int(uci_config.get("max_upload_slots_global", -1)),
    }
    core_changed = update_config(core_config, core_updates)

    web_updates = {
        "pwd_salt": salt,
        "pwd_sha1": hashed_password,
        "language": uci_config.get("language", "en_GB"),

        "port": int(uci_config.get("port", 8112)),
        "session_timeout": int(uci_config.get("session_timeout", 3600)),

        "https": str_to_bool(uci_config.get("https", False)),
        "show_session_speed": str_to_bool(uci_config.get("show_session_speed", True)),
        "geoip_db_location": os.path.join(
            uci_config.get("geoip_db_location", "/usr/share/GeoIP"),
            "GeoIP.dat"
        )
    }
    web_changed = update_config(web_config, web_updates)

    if core_changed:
        core_config.save()
    if web_changed:
        web_config.save()

if __name__ == "__main__":
    main()
