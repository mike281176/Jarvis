#!/usr/bin/env python3
"""
J.A.R.V.I.S. PWA Erreichbarkeits-Watchdog
Prüft alle CHECK_INTERVAL Sekunden, ob der öffentliche API-Endpunkt
über den lokalen Proxy und direkt erreichbar ist. Falls nicht, werden
die betroffenen Services automatisch neu gestartet.
"""
import http.client
import json
import os
import subprocess
import sys
import time
from datetime import datetime, timezone

# Konfiguration
LOCAL_PROXY = ("127.0.0.1", 8645)
LOCAL_API = ("127.0.0.1", 8124)
LOCAL_AUTH = ("127.0.0.1", 8643)
PUBLIC_URL = "jarvis-api.quixx24.eu"
HEALTH_PATH = "/api/jarvis/health"
CHECK_INTERVAL = 60  # Sekunden
FAIL_THRESHOLD = 2   # aufeinanderfolgende Fehler bis Aktion
HTTP_TIMEOUT = 10

LOG_DIR = "/home/mike/projects/jarvis/logs"
LOG_FILE = os.path.join(LOG_DIR, "jarvis-watchdog.log")

def log(msg):
    ts = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    line = f"[{ts}] {msg}"
    print(line)
    try:
        os.makedirs(LOG_DIR, exist_ok=True)
        with open(LOG_FILE, "a", encoding="utf-8") as f:
            f.write(line + "\n")
    except Exception as e:
        print(f"[{ts}] Log-Write-Fehler: {e}")

def http_get(host, port, path, use_https=False, timeout=HTTP_TIMEOUT):
    try:
        if use_https:
            conn = http.client.HTTPSConnection(host, port, timeout=timeout)
        else:
            conn = http.client.HTTPConnection(host, port, timeout=timeout)
        conn.request("GET", path, headers={"Host": f"{host}:{port}"})
        resp = conn.getresponse()
        body = resp.read().decode("utf-8", errors="replace")
        conn.close()
        return resp.status, body
    except Exception as e:
        return None, str(e)

def systemd_restart(units):
    log(f"Neustart: {', '.join(units)}")
    for unit in units:
        try:
            subprocess.run(
                ["systemctl", "--user", "restart", unit],
                check=True,
                capture_output=True,
                text=True,
                timeout=30,
            )
            log(f"  ✓ {unit} neu gestartet")
        except subprocess.CalledProcessError as e:
            log(f"  ✗ {unit} Fehler: {e.stderr or e.stdout or 'unknown'}")
        except Exception as e:
            log(f"  ✗ {unit} Exception: {e}")

def check_once():
    # 1. Direkter lokaler API-Server
    status_api, body_api = http_get(*LOCAL_API, HEALTH_PATH)
    api_ok = status_api == 200

    # 2. Lokaler Proxy
    status_proxy, body_proxy = http_get(*LOCAL_PROXY, HEALTH_PATH)
    proxy_ok = status_proxy == 200

    # 3. Auth-Service (direkt)
    status_auth, body_auth = http_get(*LOCAL_AUTH, "/auth/me")
    auth_ok = status_auth in (200, 401)  # 401 bedeutet er lebt, Token fehlt

    # 4. Öffentlicher Endpunkt über Cloudflare
    status_pub, body_pub = http_get(PUBLIC_URL, 443, HEALTH_PATH, use_https=True, timeout=15)
    public_ok = status_pub == 200

    return {
        "api_ok": api_ok,
        "proxy_ok": proxy_ok,
        "auth_ok": auth_ok,
        "public_ok": public_ok,
        "status_api": status_api,
        "status_proxy": status_proxy,
        "status_auth": status_auth,
        "status_pub": status_pub,
    }

def main():
    log("Watchdog gestartet. Überwache PWA-Erreichbarkeit...")
    fail_count_public = 0
    fail_count_proxy = 0

    while True:
        result = check_once()
        summary = (
            f"API:{result['status_api']} Proxy:{result['status_proxy']} "
            f"Auth:{result['status_auth']} Public:{result['status_pub']}"
        )

        if result["public_ok"] and result["proxy_ok"] and result["api_ok"] and result["auth_ok"]:
            log(f"✓ Alles erreichbar ({summary})")
            fail_count_public = 0
            fail_count_proxy = 0
        else:
            log(f"⚠ Erreichbarkeitsproblem ({summary})")

            if not result["proxy_ok"]:
                fail_count_proxy += 1
                if fail_count_proxy >= FAIL_THRESHOLD:
                    log("Proxy scheint hängen/hängen geblieben — starte Proxy + Auth neu")
                    systemd_restart(["jarvis-auth.service", "jarvis-proxy.service"])
                    fail_count_proxy = 0
            else:
                fail_count_proxy = 0

            if not result["public_ok"]:
                fail_count_public += 1
                if fail_count_public >= FAIL_THRESHOLD:
                    log("Öffentlicher Endpunkt nicht erreichbar — starte Proxy + Cloudflare neu")
                    systemd_restart(["jarvis-proxy.service", "cloudflared-jarvis-api.service"])
                    fail_count_public = 0
            else:
                fail_count_public = 0

            # API-Server hängt? Dann auch ihn neu starten, aber separat zählen
            if not result["api_ok"]:
                log("Lokaler API-Server antwortet nicht — starte jarvis-api neu")
                systemd_restart(["jarvis-api.service"])

            if not result["auth_ok"]:
                log("Auth-Service antwortet nicht — starte jarvis-auth neu")
                systemd_restart(["jarvis-auth.service"])

        time.sleep(CHECK_INTERVAL)

if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        log("Watchdog beendet (SIGINT).")
        sys.exit(0)
