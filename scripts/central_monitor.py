#!/usr/bin/env python3
"""
J.A.R.V.I.S. Central Monitor
Überwacht alle kritischen Endpunkte und sendet Telegram-Alerts bei Ausfällen.
Alternative zu Uptime Kuma - läuft nativ ohne Docker.
"""

import json
import os
import sys
import time
import urllib.request
import urllib.error
from datetime import datetime
from collections import defaultdict
from typing import Optional

# Konfiguration
MONITORS = [
    {
        'name': 'Hermes API',
        'url': 'http://192.168.1.81:8124/api/jarvis/health',
        'timeout': 10,
        'interval': 60  # Prüfe alle 60 Sekunden
    },
    {
        'name': 'J.A.R.V.I.S. Proxy',
        'url': 'http://192.168.1.81:8645',
        'timeout': 10,
        'interval': 60
    },
    {
        'name': 'Home Assistant',
        'url': 'http://192.168.1.91:8123',
        'timeout': 10,
        'interval': 60
    },
    {
        'name': 'Cloudflare Tunnel',
        'url': 'https://jarvis-api.quixx24.eu/api/jarvis/health',
        'timeout': 15,
        'interval': 60
    },
    {
        'name': 'Proxmox VE',
        'url': 'https://192.168.1.130:8006',
        'timeout': 10,
        'interval': 120  # Alle 2 Minuten
    }
]

# Telegram-Konfiguration (aus .env laden)
TELEGRAM_BOT_TOKEN = os.getenv('TELEGRAM_BOT_TOKEN', '')
TELEGRAM_CHAT_ID = os.getenv('TELEGRAM_HOME_CHANNEL', os.getenv('TELEGRAM_ALLOWED_USERS', '232134943'))

# Alert-Cooldown (vermeidet Spam)
ALERT_COOLDOWN = 300  # 5 Minuten zwischen Alerts für denselben Monitor
LAST_ALERTS = defaultdict(float)

LOG_DIR = '/home/mike/projects/jarvis/logs'
LOG_FILE = os.path.join(LOG_DIR, 'central_monitor.log')
STATUS_FILE = os.path.join(LOG_DIR, 'monitor_status.json')


def send_telegram_alert(message: str, monitor_name: str = None) -> bool:
    """Sendet Telegram-Nachricht"""
    if not TELEGRAM_BOT_TOKEN:
        print(f"[ALERT] {message}")
        return False
    
    # Cooldown prüfen
    if monitor_name:
        now = time.time()
        if now - LAST_ALERTS[monitor_name] < ALERT_COOLDOWN:
            print(f"[ALERT COOLDOWN] {monitor_name}: {message}")
            return False
        LAST_ALERTS[monitor_name] = now
    
    url = f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/sendMessage"
    data = json.dumps({
        'chat_id': TELEGRAM_CHAT_ID,
        'text': message,
        'parse_mode': 'HTML'
    }).encode('utf-8')
    
    try:
        req = urllib.request.Request(url, data=data, headers={'Content-Type': 'application/json'})
        with urllib.request.urlopen(req, timeout=10) as response:
            result = json.loads(response.read().decode())
            if result.get('ok'):
                print(f"[TELEGRAM SENT] {message[:100]}...")
                return True
            else:
                print(f"[TELEGRAM ERROR] API returned: {result}")
                return False
    except Exception as e:
        print(f"[TELEGRAM FAILED] {e}")
        return False


def check_endpoint(monitor: dict) -> dict:
    """Prüft einen Endpunkt und gibt Status-Dict zurück"""
    name = monitor['name']
    url = monitor['url']
    timeout = monitor['timeout']
    
    # SSL-Verifikation für lokale IPs deaktivieren
    import ssl
    ctx = ssl.create_default_context()
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_NONE
    
    start_time = time.time()
    status = {
        'name': name,
        'url': url,
        'status': 'unknown',
        'response_time': None,
        'error': None,
        'timestamp': datetime.now().isoformat()
    }
    
    try:
        req = urllib.request.Request(url, method='GET')
        req.add_header('User-Agent', 'JARVIS-Monitor/1.0')
        
        with urllib.request.urlopen(req, timeout=timeout, context=ctx) as response:
            status['response_time'] = round((time.time() - start_time) * 1000, 2)  # ms
            status['status'] = 'online'
            status['status_code'] = response.getcode()
            
    except urllib.error.HTTPError as e:
        status['status'] = 'error'
        status['error'] = f'HTTP {e.code}'
        status['status_code'] = e.code
        
    except urllib.error.URLError as e:
        status['status'] = 'offline'
        status['error'] = str(e.reason)
        
    except Exception as e:
        status['status'] = 'offline'
        status['error'] = str(e)
    
    return status


def load_previous_status() -> dict:
    """Lädt vorherigen Status aus JSON-File"""
    if os.path.exists(STATUS_FILE):
        try:
            with open(STATUS_FILE, 'r') as f:
                return json.load(f)
        except:
            pass
    return {}


def save_current_status(statuses: list):
    """Speichert aktuellen Status"""
    try:
        with open(STATUS_FILE, 'w') as f:
            json.dump(statuses, f, indent=2)
    except Exception as e:
        print(f"[SAVE ERROR] {e}")


def format_alert(status: dict, previous_status: str) -> Optional[str]:
    """Formatiert Alert-Nachricht für Telegram"""
    name = status['name']
    current = status['status']
    error = status.get('error', '')
    response_time = status.get('response_time', 'N/A')
    
    if previous_status == 'online' and current in ('offline', 'error'):
        emoji = '🔴'
        title = 'AUSFALL'
    elif previous_status in ('offline', 'error') and current == 'online':
        emoji = '🟢'
        title = 'WIEDER ONLINE'
    else:
        return None  # Keine Änderung, kein Alert nötig
    
    message = f"""{emoji} <b>J.A.R.V.I.S. Monitor: {title}</b>

📍 Service: {name}
⚡ Status: {current.upper()}
⏱️ Response: {response_time}ms"""

    if error:
        message += f"\n❌ Fehler: {error}"
    
    message += f"\n\n🕒 {datetime.now().strftime('%d.%m.%Y %H:%M:%S')}"
    
    return message


def main():
    """Hauptloop"""
    print(f"[{datetime.now().strftime('%H:%M:%S')}] J.A.R.V.I.S. Central Monitor gestartet")
    print(f"Überwache {len(MONITORS)} Endpunkte...")
    
    # Log-Dir erstellen
    os.makedirs(LOG_DIR, exist_ok=True)
    
    # Vorherigen Status laden
    previous = load_previous_status()
    previous_dict = {item['name']: item['status'] for item in previous} if isinstance(previous, list) else {}
    
    iteration = 0
    while True:
        iteration += 1
        print(f"\n[{datetime.now().strftime('%H:%M:%S')}] Check #{iteration}")
        
        current_statuses = []
        
        for monitor in MONITORS:
            status = check_endpoint(monitor)
            current_statuses.append(status)
            
            # Log-Eintrag
            if status['status'] == 'online':
                print(f"  ✅ {status['name']}: {status['response_time']}ms")
            else:
                print(f"  ❌ {status['name']}: {status['status']} - {status.get('error', 'N/A')}")
            
            # Alert bei Status-Änderung
            prev_status = previous_dict.get(status['name'], 'unknown')
            if status['status'] != prev_status:
                alert_msg = format_alert(status, prev_status)
                if alert_msg:
                    send_telegram_alert(alert_msg, status['name'])
        
        # Status speichern
        save_current_status(current_statuses)
        
        # Update previous_dict für nächste Iteration
        previous_dict = {item['name']: item['status'] for item in current_statuses}
        
        # Warten bis zur nächsten Runde (nächste Minute)
        now = time.time()
        next_check = ((now // 60) + 1) * 60  # Nächste volle Minute
        sleep_time = next_check - now
        
        if sleep_time > 0:
            print(f"Nächster Check in {sleep_time:.0f}s")
            time.sleep(sleep_time)


if __name__ == '__main__':
    try:
        main()
    except KeyboardInterrupt:
        print("\nMonitor gestoppt.")
        sys.exit(0)
