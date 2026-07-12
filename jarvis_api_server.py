#!/usr/bin/env python3
"""
J.A.R.V.I.S. API Server v3.2
REST API für die J.A.R.V.I.S. PWA (Port 8124)
Endpunkt: POST /api/jarvis/ask
Proxy: /api/jarvis/ha-proxy/* -> Home Assistant
"""

import http.server
import socketserver
import json
import os
import sys
import time
import urllib.request
import urllib.error
from datetime import datetime
from urllib.parse import urlparse

PORT = 8124
HA_URL = "http://192.168.1.91:8123"

# Token aus Hermes-Umgebung oder .env laden
HA_TOKEN = os.environ.get('HASS_TOKEN', '')
if not HA_TOKEN:
    # Fallback: Token aus Hermes .env laden
    try:
        with open(os.path.expanduser('~/.hermes/.env'), 'r') as f:
            for line in f:
                if line.startswith('HASS_TOKEN='):
                    HA_TOKEN = line.strip().split('=', 1)[1]
                    break
    except:
        pass

if not HA_TOKEN:
    print("⚠️  WARNUNG: HASS_TOKEN nicht gesetzt!")

# CORS Headers für PWA
CORS_HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Jarvis-Auth-Token, X-Jarvis-User-Id'
}

AUTH_BACKEND = ('127.0.0.1', 8643)


class JarvisAPIHandler(http.server.BaseHTTPRequestHandler):
    def _proxy_to_backend(self, backend, method, body=None):
        """Interner Proxy zu einem anderen lokalen Service (Auth oder spaeter)."""
        import http.client
        parsed = urlparse(self.path)
        path = parsed.path
        # Auth-Service erwartet /auth/* statt /api/jarvis/auth/*
        if backend == AUTH_BACKEND and path.startswith('/api/jarvis/auth/'):
            path = path.replace('/api/jarvis/auth/', '/auth/', 1)
        query = parsed.query
        target_path = f"{path}?{query}" if query else path

        forward_headers = {}
        for key, value in self.headers.items():
            if key.lower() in ('host', 'connection', 'keep-alive', 'proxy-authenticate',
                               'proxy-authorization', 'te', 'trailers', 'transfer-encoding', 'upgrade'):
                continue
            forward_headers[key] = value
        forward_headers['Host'] = f"{backend[0]}:{backend[1]}"

        try:
            conn = http.client.HTTPConnection(*backend, timeout=10)
            conn.request(method, target_path, body=body, headers=forward_headers)
            resp = conn.getresponse()

            self.send_response(resp.status)
            for key, value in resp.getheaders():
                if key.lower() in ('transfer-encoding', 'content-encoding', 'content-length',
                                   'connection', 'keep-alive'):
                    continue
                self.send_header(key, value)
            for key, value in CORS_HEADERS.items():
                self.send_header(key, value)
            self.end_headers()
            self.wfile.write(resp.read())
            conn.close()
        except Exception as e:
            self.send_json_response({'status': 'error', 'message': f'Proxy Error: {str(e)}'}, 502)

    def log_message(self, format, *args):
        timestamp = datetime.now().strftime('%H:%M:%S')
        print(f"[{timestamp}] {args[0]}")
    
    def send_json_response(self, data, status=200):
        self.send_response(status)
        self.send_header('Content-Type', 'application/json')
        for key, value in CORS_HEADERS.items():
            self.send_header(key, value)
        self.end_headers()
        self.wfile.write(json.dumps(data).encode('utf-8'))
    
    def do_OPTIONS(self):
        """Handle CORS preflight"""
        self.send_response(200)
        for key, value in CORS_HEADERS.items():
            self.send_header(key, value)
        self.end_headers()
    
    def handle_ha_proxy(self, path, method, body=None):
        """Proxy-Funktion für Home Assistant Anfragen"""
        try:
            # Remove the proxy prefix to get the actual HA path
            ha_path = path.replace('/api/jarvis/ha-proxy', '', 1)
            if not ha_path.startswith('/'):
                ha_path = '/' + ha_path
                
            target_url = f"{HA_URL}{ha_path}"
            
            # Setup minimal headers for the request to HA.
            # Ngrok/Vercel inject headers like X-Forwarded-For, X-Original-Host,
            # etc. Home Assistant rejects these as a modified Host header, so we
            # only send what HA needs: Authorization and Content-Type.
            headers = {
                'Authorization': f'Bearer {HA_TOKEN}',
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            }

            req = urllib.request.Request(
                target_url,
                data=body if body else None,
                headers=headers,
                method=method
            )
            
            with urllib.request.urlopen(req, timeout=10) as response:
                resp_data = response.read()
                status = response.getcode()
                headers_dict = response.getheaders()
                
                self.send_response(status)
                for k, v in headers_dict:
                    if k.lower() not in ['content-encoding', 'transfer-encoding', 'content-length']:
                        self.send_header(k, v)
                for key, value in CORS_HEADERS.items():
                    self.send_header(key, value)
                self.end_headers()
                self.wfile.write(resp_data)
                
        except urllib.error.HTTPError as e:
            self.send_response(e.code)
            for key, value in CORS_HEADERS.items():
                self.send_header(key, value)
            self.end_headers()
            self.wfile.write(e.read())
        except Exception as e:
            print(f"❌ Proxy Error: {e}")
            self.send_json_response({'status': 'error', 'message': f'Proxy Error: {str(e)}'}, 500)

    def do_GET(self):
        if self.path.startswith('/api/jarvis/ha-proxy/'):
            self.handle_ha_proxy(self.path, 'GET')
            return

        if self.path.startswith('/api/jarvis/auth/'):
            self._proxy_to_backend(AUTH_BACKEND, 'GET')
            return

        if self.path == '/health' or self.path == '/api/jarvis/health':
            self.send_json_response({
                'status': 'ok',
                'message': 'J.A.R.V.I.S. API Server läuft, Sir.',
                'timestamp': datetime.now().isoformat(),
                'version': '3.2'
            })
        elif self.path == '/api/jarvis/status':
            status = self.get_system_status()
            self.send_json_response(status)
        else:
            self.send_json_response({'status': 'error', 'message': 'Endpunkt nicht gefunden'}, 404)
    
    def do_POST(self):
        if self.path.startswith('/api/jarvis/ha-proxy/'):
            content_length = int(self.headers.get('Content-Length', 0))
            body = self.rfile.read(content_length)
            self.handle_ha_proxy(self.path, 'POST', body)
            return

        if self.path.startswith('/api/jarvis/auth/'):
            content_length = int(self.headers.get('Content-Length', 0))
            body = self.rfile.read(content_length)
            self._proxy_to_backend(AUTH_BACKEND, 'POST', body)
            return

        if self.path == '/api/jarvis/ask':
            self.handle_ask()
        else:
            self.send_json_response({'status': 'error', 'message': 'Endpunkt nicht gefunden'}, 404)
    
    def handle_ask(self):
        try:
            content_length = int(self.headers.get('Content-Length', 0))
            post_data = self.rfile.read(content_length).decode('utf-8')
            data = json.loads(post_data)
            
            message = data.get('message', '').lower().strip()
            user = data.get('user', 'gast')
            context = data.get('context', {})
            
            print(f"🎤 Anfrage von {user}: '{message[:50]}...'")
            response = self.process_intent(message, user, context)
            
            self.send_json_response({
                'status': 'success',
                'response': response['text'],
                'intent': response['intent'],
                'timestamp': datetime.now().isoformat()
            })
            
        except Exception as e:
            print(f"❌ Error: {e}")
            self.send_json_response({'status': 'error', 'message': 'Interner Fehler'}, 500)
    
    def process_intent(self, message, user, context):
        if any(kw in message for kw in ['solar', 'pv', 'produktion']):
            return self.handle_solar_intent(message)
        elif any(kw in message for kw in ['wetter', 'temperatur']):
            return self.handle_weather_intent(message)
        elif any(kw in message for kw in ['klima', 'kühlen']):
            return self.handle_climate_intent(message)
        elif any(kw in message for kw in ['uhrzeit', 'uhr']):
            return self.handle_time_intent(message)
        elif any(kw in message for kw in ['pool', 'wasser']):
            return self.handle_pool_intent(message)
        elif any(kw in message for kw in ['status', 'system']):
            return self.handle_status_intent(message)
        elif any(kw in message for kw in ['hallo', 'hi']):
            return {'text': f"Guten Tag, {user.capitalize()}. Ich stehe zu Ihren Diensten.", 'intent': 'greeting'}
        else:
            return {'text': "Ich verstehe, Sir.", 'intent': 'unknown'}
    
    def handle_solar_intent(self, message):
        """Solar-Produktion abfragen"""
        try:
            # Moderne aggregierte JARVIS-Sensoren bevorzugen
            solar = self.fetch_ha_state('sensor.jarvis_solar_aktuell') or self.fetch_ha_state('sensor.gesamt_solar_eingang')
            today = self.fetch_ha_state('sensor.jarvis_solar_heute')
            battery = self.fetch_ha_state('sensor.gesamt_batterie_soc') or self.fetch_ha_state('sensor.batterie_summe')
            grid = self.fetch_ha_state('sensor.power_import_grid') or self.fetch_ha_state('sensor.power_grid_total_raw')

            parts = []
            if solar and solar not in ['unknown', 'unavailable', 'None']:
                parts.append(f"Die Solaranlage liefert aktuell {solar} Watt")
            if today and today not in ['unknown', 'unavailable', 'None']:
                parts.append(f"Heute wurden bereits {today} kWh erzeugt")
            if battery and battery not in ['unknown', 'unavailable', 'None']:
                parts.append(f"Der Batteriespeicher ist zu {battery}% gefüllt")
            if grid and grid not in ['unknown', 'unavailable', 'None']:
                try:
                    grid_val = float(grid)
                    if grid_val > 50:
                        parts.append(f"Wir beziehen {round(grid_val)} Watt aus dem Netz")
                    else:
                        parts.append("Das Haus ist aktuell autark")
                except:
                    pass

            if parts:
                text = ". ".join(parts) + ", Sir."
                try:
                    watt_val = float(solar) if solar else 0
                    if watt_val > 3000:
                        text += " Die Sonne scheint gnädig heute."
                    elif watt_val > 1000:
                        text += " Solides Ergebnis für die Stundenzeit."
                    else:
                        text += " Wir sollten vielleicht die Wolken anschreiben."
                except:
                    pass
            else:
                text = "Ich kann aktuell keine Solar-Daten abrufen, Sir. Entweder ist es Nacht oder die Verbindung ist unterbrochen."

            return {'text': text, 'intent': 'solar'}
        except Exception as e:
            return {'text': "Entschuldigung, Sir. Die Solar-Daten sind momentan nicht verfügbar.", 'intent': 'solar_error'}

    def handle_weather_intent(self, message):
        """Wetter abfragen"""
        try:
            weather = self.fetch_ha_state_object('weather.troisdorf')
            if weather and weather.get('state'):
                condition = weather.get('state')
                temp = weather.get('attributes', {}).get('temperature', 'unbekannt')
                conditions_map = {
                    'sunny': 'sonnig',
                    'cloudy': 'bewölkt',
                    'partlycloudy': 'teilweise bewölkt',
                    'rainy': 'regnerisch',
                    'clear-night': 'klar'
                }
                condition_de = conditions_map.get(condition, condition)
                text = f"In Troisdorf sind es aktuell {temp}°C bei {condition_de}em Wetter, Sir."
                if 'sonn' in (condition_de or ''):
                    text += " Bitte denken Sie an Sonnenschutz. Ihre Haut ist nicht mehr das, was sie einmal war."
                elif 'regen' in (condition_de or ''):
                    text += " Regen ist flüssiger Sonnenschein, nur weniger populär."
                return {'text': text, 'intent': 'weather'}
            else:
                return {'text': "Die Wetterdaten sind momentan nicht verfügbar, Sir. Schauen Sie aus dem Fenster - das ist oft genau so zuverlässig.", 'intent': 'weather_unavailable'}
        except Exception as e:
            return {'text': "Ich konnte die Wetterdaten nicht abrufen, Sir. Die Atmosphäre scheint mir heute verschlossen.", 'intent': 'weather_error'}

    def handle_climate_intent(self, message):
        """Klimaanlage abfragen"""
        try:
            climate = self.fetch_ha_state_object('climate.split_klimaanlage')
            if climate and climate.get('state'):
                state = climate.get('state')
                attrs = climate.get('attributes', {})
                temp = attrs.get('temperature', 'unbekannt')
                current = attrs.get('current_temperature', 'unbekannt')
                modes = {
                    'off': 'ausgeschaltet',
                    'cool': 'kühlend',
                    'heat': 'heizend',
                    'dry': 'entfeuchtend',
                    'fan_only': 'nur Lüftung'
                }
                mode = modes.get(state, state)
                text = f"Die Klimaanlage ist {mode} und steht auf {temp}°C. Aktuelle Raumtemperatur: {current}°C, Sir."
                if state == 'off':
                    text += " Wenn Sie möchten, kann ich sie für Sie aktivieren."
                return {'text': text, 'intent': 'climate'}
            else:
                return {'text': "Ich kann den Status der Klimaanlage nicht ermitteln, Sir. Vielleicht hat sie frei genommen.", 'intent': 'climate_unavailable'}
        except Exception as e:
            return {'text': "Die Klimaanlage antwortet nicht, Sir. Möglicherweise ist sie in einem kühlen Raum verschwunden.", 'intent': 'climate_error'}

    def handle_time_intent(self, message):
        """Uhrzeit abfragen"""
        now = datetime.now()
        time_str = now.strftime('%H:%M')
        date_str = now.strftime('%d.%m.%Y')
        text = f"Es ist {time_str} Uhr am {date_str}, Sir."
        hour = now.hour
        if 5 <= hour < 12:
            text += " Ein wunderbarer Morgen, nicht wahr?"
        elif 12 <= hour < 14:
            text += " Zeit für die Mittagspause, wenn Sie so geneigt sind."
        elif 14 <= hour < 18:
            text += " Der Nachmittag neigt sich dem Ende zu."
        elif 18 <= hour < 22:
            text += " Der Abend ist da. Ruhestand wäre angebracht."
        else:
            text += " Es ist spät, Sir. Selbst KI-Systeme brauchen manchmal Ruhe."
        return {'text': text, 'intent': 'time'}

    def handle_pool_intent(self, message):
        """Pool-Temperatur abfragen"""
        try:
            pool_temp = self.fetch_ha_state('sensor.pool_temperatur')
            if pool_temp and pool_temp not in ['unknown', 'unavailable', 'None']:
                text = f"Die Pool-Temperatur beträgt {pool_temp}°C, Sir."
                try:
                    temp_val = float(pool_temp)
                    if temp_val < 20:
                        text += " Das ist eher was für Hartgesottene."
                    elif temp_val < 25:
                        text += " Angenehm kühl für eine Erfrischung."
                    else:
                        text += " Badewannentemperatur. Wie im Luxushotel."
                except:
                    pass
                return {'text': text, 'intent': 'pool'}
            else:
                return {'text': "Die Pool-Temperatur ist momentan nicht verfügbar, Sir. Entweder ist der Sensor untergetaucht oder das Wasser hat ihn vertrieben.", 'intent': 'pool_unavailable'}
        except Exception as e:
            return {'text': "Ich kann die Pool-Temperatur nicht ermitteln, Sir. Vielleicht ist das Wasser zu kalt für den Sensor.", 'intent': 'pool_error'}

    def handle_status_intent(self, message):
        """Systemstatus abfragen"""
        try:
            ha_config = self.fetch_ha_config()
            version = ha_config.get('version', 'unbekannt') if ha_config else 'unbekannt'
            return {'text': f"Home Assistant läuft mit Version {version}. J.A.R.V.I.S. API Server ist operational. Alle Systeme nominal, Sir.", 'intent': 'status'}
        except:
            return {'text': "Die Systemstatus-Abfrage ist fehlgeschlagen, Sir. Aber ich bin hier, das zählt doch, oder?", 'intent': 'status_error'}

    def get_system_status(self):
        """Systemstatus für Health-Check"""
        return {
            'api': 'running',
            'timestamp': datetime.now().isoformat(),
            'home_assistant': self.check_ha_connection()
        }

    def check_ha_connection(self):
        """Prüfe Home Assistant Verbindung"""
        try:
            config = self.fetch_ha_config()
            return {'connected': True, 'version': config.get('version', 'unknown')} if config else {'connected': False}
        except:
            return {'connected': False}

    def fetch_ha_state(self, entity_id):
        """Hole State von Home Assistant Entity"""
        try:
            headers = {
                'Authorization': f'Bearer {HA_TOKEN}',
                'Content-Type': 'application/json'
            }
            req = urllib.request.Request(
                f"{HA_URL}/api/states/{entity_id}",
                headers=headers,
                method='GET'
            )
            with urllib.request.urlopen(req, timeout=5) as response:
                data = json.loads(response.read().decode())
                return data.get('state')
        except Exception as e:
            print(f"  ⚠️ HA Fehler für {entity_id}: {e}")
            return None

    def fetch_ha_config(self):
        """Hole Home Assistant Config"""
        try:
            headers = {
                'Authorization': f'Bearer {HA_TOKEN}',
                'Content-Type': 'application/json'
            }
            req = urllib.request.Request(
                f"{HA_URL}/api/config",
                headers=headers,
                method='GET'
            )
            with urllib.request.urlopen(req, timeout=5) as response:
                return json.loads(response.read().decode())
        except Exception as e:
            print(f"  ⚠️ HA Config Fehler: {e}")
            return None

    def fetch_ha_state_object(self, entity_id):
        """Hole komplettes State-Objekt (state + attributes) von HA"""
        try:
            headers = {
                'Authorization': f'Bearer {HA_TOKEN}',
                'Content-Type': 'application/json'
            }
            req = urllib.request.Request(
                f"{HA_URL}/api/states/{entity_id}",
                headers=headers,
                method='GET'
            )
            with urllib.request.urlopen(req, timeout=5) as response:
                return json.loads(response.read().decode())
        except Exception as e:
            print(f"  ⚠️ HA Fehler für {entity_id}: {e}")
            return None

    def get_environment_temperatures(self):
        """Aktuelle Umgebungstemperaturen aus HA abfragen"""
        return {
            'garten': self.fetch_ha_state('sensor.garten'),
            'pool': self.fetch_ha_state('sensor.pool_temperatur'),
            'wohnzimmer': self.fetch_ha_state('sensor.wohnzimmer_echo_temperatur'),
            'arbeitszimmer': self.fetch_ha_state('sensor.arbeitszimmer_temperatur')
        }

def start_server():
    socketserver.TCPServer.allow_reuse_address = True
    with socketserver.TCPServer(("0.0.0.0", PORT), JarvisAPIHandler) as httpd:
        print(f"J.A.R.V.I.S. API Server v3.2 on port {PORT}...")
        httpd.serve_forever()

if __name__ == '__main__':
    start_server()
