#!/usr/bin/env python3
"""
J.A.R.V.I.S. API Server v3.0
REST API für die J.A.R.V.I.S. PWA (Port 8124)
Endpunkt: POST /api/jarvis/ask
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
HA_TOKEN = os.environ.get('HASS_TOKEN', '')

# CORS Headers für PWA
CORS_HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization'
}

class JarvisAPIHandler(http.server.BaseHTTPRequestHandler):
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
    
    def do_GET(self):
        """Handle GET requests"""
        if self.path == '/health' or self.path == '/api/jarvis/health':
            self.send_json_response({
                'status': 'ok',
                'message': 'J.A.R.V.I.S. API Server läuft, Sir.',
                'timestamp': datetime.now().isoformat(),
                'version': '3.0'
            })
        elif self.path == '/api/jarvis/status':
            status = self.get_system_status()
            self.send_json_response(status)
        else:
            self.send_json_response({
                'status': 'error',
                'message': 'Endpunkt nicht gefunden'
            }, 404)
    
    def do_POST(self):
        """Handle POST requests"""
        if self.path == '/api/jarvis/ask':
            self.handle_ask()
        else:
            self.send_json_response({
                'status': 'error', 
                'message': 'Endpunkt nicht gefunden'
            }, 404)
    
    def handle_ask(self):
        """Verarbeite Anfrage von PWA"""
        try:
            content_length = int(self.headers.get('Content-Length', 0))
            post_data = self.rfile.read(content_length).decode('utf-8')
            data = json.loads(post_data)
            
            message = data.get('message', '').lower().strip()
            user = data.get('user', 'gast')
            context = data.get('context', {})
            
            print(f"🎤 Anfrage von {user}: '{message[:50]}...'")
            
            # Verarbeite Anfrage
            response = self.process_intent(message, user, context)
            
            self.send_json_response({
                'status': 'success',
                'response': response['text'],
                'intent': response['intent'],
                'timestamp': datetime.now().isoformat()
            })
            
        except json.JSONDecodeError as e:
            self.send_json_response({
                'status': 'error',
                'message': 'Ungültiges JSON Format'
            }, 400)
        except Exception as e:
            print(f"❌ Fehler: {e}")
            self.send_json_response({
                'status': 'error',
                'message': 'Interner Fehler beim Verarbeiten der Anfrage'
            }, 500)
    
    def process_intent(self, message, user, context):
        """Erkenne Intent und generiere Antwort"""
        
        # Solar-Anfragen
        if any(kw in message for kw in ['solar', 'pv', 'produktion', 'ertrag', 'growatt', 'hoymiles']):
            return self.handle_solar_intent(message)
        
        # Wetter
        elif any(kw in message for kw in ['wetter', 'temperatur', 'grad', 'sonne', 'regen']):
            return self.handle_weather_intent(message)
        
        # Klima
        elif any(kw in message for kw in ['klima', 'klimagerät', 'heizung', 'kühlen']):
            return self.handle_climate_intent(message)
        
        # Uhrzeit
        elif any(kw in message for kw in ['uhrzeit', 'uhr', 'spät', 'wie spät']):
            return self.handle_time_intent(message)
        
        # Pool
        elif any(kw in message for kw in ['pool', 'wasser', 'baden']):
            return self.handle_pool_intent(message)
        
        # Status
        elif any(kw in message for kw in ['status', 'system', 'zustand']):
            return self.handle_status_intent(message)
        
        # Begrüßung
        elif any(kw in message for kw in ['hallo', 'hi', 'guten tag', 'moin']):
            return {
                'text': f"Guten Tag, {user.capitalize()}. Ich stehe zu Ihren Diensten. Was darf ich für Sie tun?",
                'intent': 'greeting'
            }
        
        # Verabschiedung
        elif any(kw in message for kw in ['tschüss', 'bye', 'auf wiedersehen', 'ciao']):
            return {
                'text': f"Auf Wiedersehen, {user.capitalize()}. Es war mir eine Ehre.",
                'intent': 'goodbye'
            }
        
        # Danke
        elif any(kw in message for kw in ['danke', 'vielen dank', 'danke schön']):
            return {
                'text': "Immer gerne, Sir. Das ist schließlich meine Existenzberechtigung.",
                'intent': 'thanks'
            }
        
        # Fallback
        else:
            return {
                'text': f"Ich verstehe, Sir. Sie sagten: '{message}'. Leider bin ich noch in der Entwicklung und kann diese Anfrage noch nicht vollständig verarbeiten.",
                'intent': 'unknown'
            }
    
    def handle_solar_intent(self, message):
        """Solar-Produktion abfragen"""
        try:
            # Growatt Daten
            output = self.fetch_ha_state('sensor.growatt_output_power')
            battery = self.fetch_ha_state('sensor.growatt_bat0_soc')
            charging = self.fetch_ha_state('sensor.growatt_charging_power')
            
            # Hoymiles Daten
            hm_total = self.fetch_ha_state('sensor.hm1500_limit_nonpersistent_absolute')
            
            response_parts = []
            
            if output and output not in ['unknown', 'unavailable', 'None']:
                response_parts.append(f"Die Solaranlage produziert aktuell {output} Watt")
            
            if battery and battery not in ['unknown', 'unavailable', 'None']:
                response_parts.append(f"Der Batteriespeicher ist zu {battery}% gefüllt")
            
            if charging and charging not in ['unknown', 'unavailable', 'None']:
                response_parts.append(f"und lädt mit {charging} Watt")
            
            if hm_total and hm_total not in ['unknown', 'unavailable', 'None']:
                response_parts.append(f"Der Hoymiles HM1500 liefert {hm_total} Watt")
            
            if response_parts:
                text = ". ".join(response_parts) + ", Sir."
                # Füge Humor hinzu
                if 'watt' in text.lower():
                    try:
                        watt_val = float(output) if output else 0
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
            return {
                'text': "Entschuldigung, Sir. Die Solar-Daten sind momentan nicht verfügbar.",
                'intent': 'solar_error'
            }
    
    def handle_weather_intent(self, message):
        """Wetter abfragen"""
        try:
            weather = self.fetch_ha_state('weather.troisdorf')
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
                
                # Füge Humor hinzu
                if 'sonn' in condition_de:
                    text += " Bitte denken Sie an Sonnenschutz. Ihre Haut ist nicht mehr das, was sie einmal war."
                elif 'regen' in condition_de:
                    text += " Regen ist flüssiger Sonnenschein, nur weniger populär."
                
                return {'text': text, 'intent': 'weather'}
            else:
                return {
                    'text': "Die Wetterdaten sind momentan nicht verfügbar, Sir. Schauen Sie aus dem Fenster - das ist oft genau so zuverlässig.",
                    'intent': 'weather_unavailable'
                }
        except Exception as e:
            return {
                'text': "Ich konnte die Wetterdaten nicht abrufen, Sir. Die Atmosphäre scheint mir heute verschlossen.",
                'intent': 'weather_error'
            }
    
    def handle_climate_intent(self, message):
        """Klimaanlage abfragen"""
        try:
            climate = self.fetch_ha_state('climate.split_klimaanlage')
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
                return {
                    'text': "Ich kann den Status der Klimaanlage nicht ermitteln, Sir. Vielleicht hat sie frei genommen.",
                    'intent': 'climate_unavailable'
                }
        except Exception as e:
            return {
                'text': "Die Klimaanlage antwortet nicht, Sir. Möglicherweise ist sie in einem kühlen Raum verschwunden.",
                'intent': 'climate_error'
            }
    
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
            pool_temp = self.fetch_ha_state('sensor.intex_spa_water_temperature')
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
                return {
                    'text': "Die Pool-Temperatur ist momentan nicht verfügbar, Sir. Entweder ist der Sensor untergetaucht oder das Wasser hat ihn vertrieben.",
                    'intent': 'pool_unavailable'
                }
        except Exception as e:
            return {
                'text': "Ich kann die Pool-Temperatur nicht ermitteln, Sir. Vielleicht ist das Wasser zu kalt für den Sensor.",
                'intent': 'pool_error'
            }
    
    def handle_status_intent(self, message):
        """Systemstatus abfragen"""
        try:
            ha_config = self.fetch_ha_config()
            version = ha_config.get('version', 'unbekannt') if ha_config else 'unbekannt'
            
            return {
                'text': f"Home Assistant läuft mit Version {version}. J.A.R.V.I.S. API Server ist operational. Alle Systeme nominal, Sir.",
                'intent': 'status'
            }
        except:
            return {
                'text': "Die Systemstatus-Abfrage ist fehlgeschlagen, Sir. Aber ich bin hier, das zählt doch, oder?",
                'intent': 'status_error'
            }
    
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


def start_server():
    """Starte API Server"""
    print("=" * 70)
    print("  J.A.R.V.I.S. API Server v3.0")
    print("=" * 70)
    print(f"  Port: {PORT}")
    print(f"  Health: http://192.168.1.81:{PORT}/health")
    print(f"  Ask API: http://192.168.1.81:{PORT}/api/jarvis/ask")
    print(f"  HA URL: {HA_URL}")
    print(f"  Token gesetzt: {'Ja' if HA_TOKEN else 'NEIN - WARNUNG!'}")
    print("=" * 70)
    print("  Server läuft...")
    print("")
    
    # Socket mit SO_REUSEADDR
    socketserver.TCPServer.allow_reuse_address = True
    with socketserver.TCPServer(("0.0.0.0", PORT), JarvisAPIHandler) as httpd:
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\n  Server wird heruntergefahren...")
            httpd.shutdown()


if __name__ == '__main__':
    start_server()
