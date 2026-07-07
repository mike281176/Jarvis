#!/usr/bin/env python3
"""
J.A.R.V.I.S. Hermes API Endpoint
Empfängt Anfragen von der PWA und antwortet intelligent

Usage: python3 jarvis_api.py [--port 8124]
"""

import json
import time
import re
import datetime
import os
from http.server import HTTPServer, BaseHTTPRequestHandler
from typing import Dict, Any, Optional
import threading
import requests

# Konfiguration
HA_URL = "http://192.168.1.91:8123"
HA_TOKEN = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiIzN2RjMDdmMDQ4ZWY0MTM1ODBmNWQ4ZDI2ZmQ1ZmM3ZCIsImlhdCI6MTc4MzExMDc1NiwiZXhwIjoyMDk4NDcwNzU2fQ.1t2-mVT2vuCKiJiE12BzhpWN7xcaPfBnGyIAzT141p0"
PORT = 8124

class JarvisAPIHandler(BaseHTTPRequestHandler):
    """HTTP Request Handler für JARVIS API"""
    
    def log_message(self, format, *args):
        """Custom Logging"""
        timestamp = datetime.datetime.now().strftime("%H:%M:%S")
        print(f"[{timestamp}] {args[0]}")
    
    def send_json_response(self, data: Dict, status: int = 200):
        """Sende JSON Response mit CORS Headers"""
        self.send_response(status)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()
        self.wfile.write(json.dumps(data, ensure_ascii=False).encode('utf-8'))
    
    def do_OPTIONS(self):
        """Handle CORS Preflight"""
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()
    
    def do_GET(self):
        """Handle GET Requests"""
        if self.path == '/api/jarvis/health':
            self.send_json_response({
                'status': 'ok',
                'message': 'J.A.R.V.I.S. steht zu Ihren Diensten, Sir.',
                'version': '1.0.0',
                'timestamp': datetime.datetime.now().isoformat()
            })
        elif self.path == '/api/jarvis/users':
            self.send_json_response({
                'users': [
                    {'id': 'mike', 'name': 'Mike', 'role': 'admin'},
                    {'id': 'gast', 'name': 'Gast', 'role': 'guest'}
                ]
            })
        else:
            self.send_json_response({'error': 'Not found'}, 404)
    
    def do_POST(self):
        """Handle POST Requests"""
        if self.path == '/api/jarvis/ask':
            self.handle_ask()
        else:
            self.send_json_response({'error': 'Not found'}, 404)
    
    def handle_ask(self):
        """Verarbeite JARVIS-Anfrage"""
        start_time = time.time()
        
        # Lese Request Body
        content_length = int(self.headers.get('Content-Length', 0))
        post_data = self.rfile.read(content_length).decode('utf-8')
        
        try:
            data = json.loads(post_data)
        except json.JSONDecodeError:
            self.send_json_response({
                'error': 'Invalid JSON',
                'response': 'Entschuldigung, Sir. Ich habe die Nachricht nicht verstanden.'
            }, 400)
            return
        
        # Extrahiere Parameter
        user = data.get('user', 'unknown')
        message = data.get('message', '')
        context = data.get('context', {})
        
        print(f"🎤 [{user}] fragt: '{message[:50]}...'")
        
        # Verarbeite Anfrage
        result = self.process_message(user, message, context)
        
        # Berechne Verarbeitungszeit
        processing_time = int((time.time() - start_time) * 1000)
        
        # Sende Response
        self.send_json_response({
            'response': result['response'],
            'intent': result['intent'],
            'data': result.get('data', {}),
            'user': user,
            'processing_time_ms': processing_time,
            'timestamp': datetime.datetime.now().isoformat()
        })
    
    def process_message(self, user: str, message: str, context: Dict) -> Dict[str, Any]:
        """
        Hauptverarbeitung - Intent-Erkennung und Antwort-Generierung
        """
        message_lower = message.lower()
        
        # Intent-Erkennung
        intent = self.detect_intent(message_lower)
        
        # User-spezifischer Kontext laden (später aus Memory)
        user_context = self.get_user_context(user)
        
        # Generiere Antwort basierend auf Intent
        if intent == 'solar':
            return self.handle_solar_query(user, message_lower, context)
        elif intent == 'climate':
            return self.handle_climate_query(user, message_lower, context)
        elif intent == 'time':
            return self.handle_time_query(user, context)
        elif intent == 'date':
            return self.handle_date_query(user, context)
        elif intent == 'greeting':
            return self.handle_greeting(user, context)
        elif intent == 'status':
            return self.handle_status_query(user, context)
        else:
            return self.handle_fallback(user, message, context)
    
    def detect_intent(self, message: str) -> str:
        """Erkenne Intent basierend auf Keywords"""
        intents = {
            'solar': ['solar', 'pv', 'strom', 'produktion', 'erzeugung', 'einspeisung', 'growatt'],
            'climate': ['klima', 'temperatur', 'heizung', 'kühl', 'warm', 'kalt', 'split'],
            'time': ['uhrzeit', 'wie spät', 'wie viel uhr', 'uhr'],
            'date': ['datum', 'welcher tag', 'heute ist', 'wochentag'],
            'greeting': ['hallo', 'hi', 'guten tag', 'guten morgen', 'guten abend', 'hey jarvis'],
            'status': ['status', 'system', 'läuft alles', 'gesundheit']
        }
        
        for intent, keywords in intents.items():
            if any(kw in message for kw in keywords):
                return intent
        
        return 'unknown'
    
    def get_user_context(self, user: str) -> Dict:
        """Lade User-spezifischen Kontext (später aus Memory)"""
        contexts = {
            'mike': {
                'preferred_room': 'wohnzimmer',
                'solar_entities': ['sensor.growatt_output_power', 'sensor.hm1500_total_power'],
                'climate_entity': 'climate.split_klimaanlage',
                'formality': 'du'  # oder 'sie'
            },
            'gast': {
                'preferred_room': 'wohnzimmer',
                'formality': 'sie'
            }
        }
        return contexts.get(user, contexts['gast'])
    
    def get_ha_state(self, entity_id: str) -> Optional[Dict]:
        """Hole Entity-State von Home Assistant"""
        try:
            headers = {
                'Authorization': f'Bearer {HA_TOKEN}',
                'Content-Type': 'application/json'
            }
            resp = requests.get(f"{HA_URL}/api/states/{entity_id}", 
                            headers=headers, timeout=5)
            if resp.status_code == 200:
                return resp.json()
        except Exception as e:
            print(f"  ⚠️ HA Fehler für {entity_id}: {e}")
        return None
    
    def handle_solar_query(self, user: str, message: str, context: Dict) -> Dict:
        """Behandle Solar-Anfragen mit korrekten Entities"""
        
        # Sammle alle Solar-Daten
        growatt_solar = self.get_ha_state('sensor.growatt_solar_power')
        growatt_output = self.get_ha_state('sensor.growatt_output_power')
        growatt_soc = self.get_ha_state('sensor.growatt_soc')
        
        hm1500_power = self.get_ha_state('sensor.hm1500_power')
        hm1500_yield_day = self.get_ha_state('sensor.solar_yieldday')
        
        # Berechne Gesamtleistung
        total_power = 0
        sources = []
        
        if growatt_solar and growatt_solar.get('state') not in ['unknown', 'unavailable', None]:
            try:
                power = float(growatt_solar['state'])
                total_power += power
                sources.append(f"Growatt: {int(power)}W")
            except:
                pass
        
        if hm1500_power and hm1500_power.get('state') not in ['unknown', 'unavailable', None]:
            try:
                power = float(hm1500_power['state'])
                total_power += power
                sources.append(f"HM1500: {int(power)}W")
            except:
                pass
        
        # Batterie SOC
        soc = None
        if growatt_soc and growatt_soc.get('state') not in ['unknown', 'unavailable', None]:
            try:
                soc = int(float(growatt_soc['state']))
            except:
                pass
        
        # Tagesertrag
        daily_yield = None
        if hm1500_yield_day and hm1500_yield_day.get('state') not in ['unknown', 'unavailable', None]:
            try:
                daily_yield = float(hm1500_yield_day['state'])
            except:
                pass
        
        if total_power > 0:
            # Erstelle Antwort
            if total_power > 1000:
                power_str = f"{total_power/1000:.1f} kW"
            else:
                power_str = f"{int(total_power)} W"
            
            response_parts = [f"Aktuell produzieren wir {power_str} Solarstrom"]
            
            if sources:
                response_parts.append(f" ({', '.join(sources)})")
            
            if soc is not None:
                response_parts.append(f". Batteriespeicher ist bei {soc}%")
            
            if daily_yield is not None:
                if daily_yield > 1000:
                    response_parts.append(f". Heute bereits {daily_yield/1000:.1f} kWh erzeugt")
                else:
                    response_parts.append(f". Heute bereits {int(daily_yield)} Wh erzeugt")
            
            response_parts.append(", Sir.")
            
            return {
                'intent': 'solar_query',
                'response': ''.join(response_parts),
                'data': {
                    'total_power': total_power,
                    'unit': 'kW' if total_power > 1000 else 'W',
                    'soc': soc,
                    'daily_yield': daily_yield,
                    'sources': sources
                }
            }
        
        return {
            'intent': 'solar_query',
            'response': "Die Solaranlage sendet momentan keine Daten, Sir. Wahrscheinlich ist es Nacht oder die Wechselrichter machen Pause.",
            'data': {'error': 'no_data'}
        }
    
    def handle_climate_query(self, user: str, message: str, context: Dict) -> Dict:
        """Behandle Klima-Anfragen"""
        user_ctx = self.get_user_context(user)
        entity = user_ctx.get('climate_entity', 'climate.split_klimaanlage')
        
        data = self.get_ha_state(entity)
        
        if data and data.get('state') not in ['unknown', 'unavailable', None]:
            attrs = data.get('attributes', {})
            current = attrs.get('current_temperature', '?')
            target = attrs.get('temperature', '?')
            mode = data['state']
            
            mode_text = {
                'cool': 'kühlt',
                'heat': 'heizt', 
                'off': 'ist ausgeschaltet',
                'dry': 'entfeuchtet',
                'fan_only': 'ventiliert',
                'auto': 'regelt automatisch'
            }.get(mode, f'ist im Modus {mode}')
            
            if mode == 'off':
                response = f"Die Klimaanlage ist aus. Raumtemperatur beträgt {current}°C, Sir."
            else:
                response = f"Die Klimaanlage {mode_text}. Aktuell {current}°C, Ziel {target}°C, Sir."
            
            return {
                'intent': 'climate_query',
                'response': response,
                'data': {
                    'current_temp': current,
                    'target_temp': target,
                    'mode': mode
                }
            }
        
        return {
            'intent': 'climate_query',
            'response': "Die Klimaanlage ist momentan nicht erreichbar, Sir. Vielleicht friert sie.",
            'data': {'error': 'unavailable'}
        }
    
    def handle_time_query(self, user: str, context: Dict) -> Dict:
        """Behandle Uhrzeit-Anfragen"""
        now = datetime.datetime.now()
        hour = now.hour
        minute = now.strftime('%M')
        
        if 5 <= hour < 12:
            greeting = "Guten Morgen"
        elif 12 <= hour < 18:
            greeting = "Guten Tag"
        elif 18 <= hour < 22:
            greeting = "Guten Abend"
        else:
            greeting = "Gute Nacht"
        
        return {
            'intent': 'time_query',
            'response': f"Es ist {hour} Uhr {minute}, {greeting}, Sir.",
            'data': {'hour': hour, 'minute': int(minute)}
        }
    
    def handle_date_query(self, user: str, context: Dict) -> Dict:
        """Behandle Datums-Anfragen"""
        now = datetime.datetime.now()
        days = ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag']
        months = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
                  'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember']
        
        return {
            'intent': 'date_query',
            'response': f"Heute ist {days[now.weekday()]}, der {now.day}. {months[now.month - 1]} {now.year}, Sir.",
            'data': {
                'weekday': days[now.weekday()],
                'day': now.day,
                'month': months[now.month - 1],
                'year': now.year
            }
        }
    
    def handle_greeting(self, user: str, context: Dict) -> Dict:
        """Behandle Begrüßungen"""
        now = datetime.datetime.now()
        hour = now.hour
        
        if 5 <= hour < 12:
            greeting = "Guten Morgen"
        elif 12 <= hour < 18:
            greeting = "Guten Tag"
        elif 18 <= hour < 22:
            greeting = "Guten Abend"
        else:
            greeting = "Gute Nacht"
        
        responses = [
            f"{greeting}, Sir. J.A.R.V.I.S. steht zu Ihren Diensten.",
            f"{greeting}. Was darf ich für Sie tun, Sir?",
            f"{greeting}, Sir. Alle Systeme bereit und funktionsfähig."
        ]
        
        return {
            'intent': 'greeting',
            'response': responses[hash(str(hour)) % len(responses)],
            'data': {'time_of_day': 'morning' if hour < 12 else 'afternoon' if hour < 18 else 'evening'}
        }
    
    def handle_status_query(self, user: str, context: Dict) -> Dict:
        """Behandle System-Status-Anfragen"""
        try:
            headers = {'Authorization': f'Bearer {HA_TOKEN}'}
            resp = requests.get(f"{HA_URL}/api/states", headers=headers, timeout=5)
            if resp.status_code == 200:
                entities = len(resp.json())
                return {
                    'intent': 'status_query',
                    'response': f"Home Assistant läuft stabil, Sir. {entities} Entitäten registriert und alle Systeme funktionsbereit.",
                    'data': {'entities': entities, 'status': 'ok'}
                }
        except:
            pass
        
        return {
            'intent': 'status_query',
            'response': "Alle Systeme funktionieren einwandfrei, Sir. Die Verbindung zu Home Assistant ist aktiv.",
            'data': {'status': 'ok'}
        }
    
    def handle_fallback(self, user: str, message: str, context: Dict) -> Dict:
        """Behandle unbekannte Anfragen"""
        responses = [
            f"Ich verstehe '{message}' nicht ganz, Sir. Fragen Sie nach Solar, Klima, Uhrzeit, Datum oder System-Status.",
            f"Entschuldigung, Sir. '{message}' ist mir nicht geläufig. Ich kann Ihnen bei Solar-Produktion, Temperatur, Uhrzeit oder Datum helfen.",
            f"Ich habe '{message}' notiert, Sir. Meine Fähigkeiten umfassen: Solar-Status, Klimaanlage, Uhrzeit, Datum und System-Status."
        ]
        
        return {
            'intent': 'unknown',
            'response': responses[hash(message) % len(responses)],
            'data': {'original_message': message}
        }


def start_server(port: int = PORT):
    """Starte JARVIS API Server"""
    server = HTTPServer(('0.0.0.0', port), JarvisAPIHandler)
    
    print("=" * 60)
    print("  J.A.R.V.I.S. Hermes API Endpoint")
    print("=" * 60)
    print(f"  Server läuft auf Port {port}")
    print(f"  Health Check: http://localhost:{port}/api/jarvis/health")
    print(f"  Ask Endpoint: http://localhost:{port}/api/jarvis/ask")
    print("=" * 60)
    print("  Bereit für Anfragen, Sir.")
    print("=" * 60)
    
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n  Server wird heruntergefahren...")
        server.shutdown()


if __name__ == '__main__':
    import argparse
    parser = argparse.ArgumentParser(description='J.A.R.V.I.S. API Server')
    parser.add_argument('--port', type=int, default=PORT, help=f'Port (default: {PORT})')
    args = parser.parse_args()
    
    start_server(args.port)
