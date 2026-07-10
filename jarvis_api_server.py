#!/usr/bin/env python3
"""
J.A.R.V.I.S. API Server v3.1
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
    
    def handle_ha_proxy(self, path, method, body=None):
        """Proxy-Funktion für Home Assistant Anfragen"""
        try:
            ha_path = path.replace('/api/jarvis/ha-proxy', '', 1)
            if not ha_path.startswith('/'):
                ha_path = '/' + ha_path
                
            target_url = f"{HA_URL}{ha_path}"
            
            headers = {
                'Authorization': f'Bearer {HA_TOKEN}',
                'Content-Type': 'application/json'
            }
            
            for key, value in self.headers.items():
                if key.lower() not in ['host', 'content-length']:
                    headers[key] = value

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
            print(f"❌ Proxy Fehler: {e}")
            self.send_json_response({'status': 'error', 'message': f'Proxy Fehler: {str(e)}'}, 500)

    def do_GET(self):
        if self.path.startswith('/api/jarvis/ha-proxy/'):
            self.handle_ha_proxy(self.path, 'GET')
            return

        if self.path == '/health' or self.path == '/api/jarvis/health':
            self.send_json_response({
                'status': 'ok',
                'message': 'J.A.R.V.I.S. API Server läuft, Sir.',
                'timestamp': datetime.now().isoformat(),
                'version': '3.1'
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
            print(f"❌ Fehler: {e}")
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
        return {'text': "Solar-Daten werden abgerufen, Sir.", 'intent': 'solar'}
    
    def handle_weather_intent(self, message):
        return {'text': "Wetterdaten werden abgerufen, Sir.", 'intent': 'weather'}
    
    def handle_climate_intent(self, message):
        return {'text': "Klimaanlage wird geprüft, Sir.", 'intent': 'climate'}
    
    def handle_time_intent(self, message):
        return {'text': f"Es ist {datetime.now().strftime('%H:%M')} Uhr, Sir.", 'intent': 'time'}
    
    def handle_pool_intent(self, message):
        return {'text': "Pool-Temperatur wird abgefragt, Sir.", 'intent': 'pool'}
    
    def handle_status_intent(self, message):
        return {'text': "Alle Systeme nominal, Sir.", 'intent': 'status'}
    
    def get_system_status(self):
        return {'api': 'running', 'timestamp': datetime.now().isoformat(), 'home_assistant': {'connected': True}}

def start_server():
    socketserver.TCPServer.allow_reuse_address = True
    with socketserver.TCPServer(("0.0.0.0", PORT), JarvisAPIHandler) as httpd:
        print(f"J.A.R.V.I.S. API Server v3.1 on port {PORT}...")
        httpd.serve_forever()

if __name__ == '__main__':
    start_server()
