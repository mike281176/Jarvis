#!/usr/bin/env python3
"""
J.A.R.V.I.S. Unified Gateway Proxy
Empfängt alles über Port 8645 und routed:
  /auth/*  -> lokaler Auth-Service (127.0.0.1:8643)
  /api/*   -> Hermes API Server (127.0.0.1:8642)
  /*       -> Statische Dateien aus public/ (für PWA)
Damit erreicht die PWA Auth, Chat-API und Frontend über dieselbe Domain.
"""

import http.client
import json
import os
import socketserver
import sys
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse

PORT = 8645
AUTH_BACKEND = ('127.0.0.1', 8643)
HERMES_BACKEND = ('127.0.0.1', 8642)
API_BACKEND = ('127.0.0.1', 8124)  # Jarvis API Server für /api/jarvis/*
PUBLIC_DIR = '/home/mike/projects/jarvis/public'

# MIME types für statische Dateien
MIME_TYPES = {
    '.html': 'text/html',
    '.js': 'application/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
    '.webmanifest': 'application/manifest+json',
}


class ProxyHandler(BaseHTTPRequestHandler):
    def log_message(self, format, *args):
        print(f"[proxy] {format % args}")

    def _add_cors(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, DELETE')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type, Authorization, ngrok-skip-browser-warning')
        self.send_header('Access-Control-Max-Age', '86400')

    def do_OPTIONS(self):
        self.send_response(204)
        self._add_cors()
        self.end_headers()

    def _proxy(self, backend):
        parsed = urlparse(self.path)
        path = parsed.path
        query = parsed.query
        if query:
            target_path = f"{path}?{query}"
        else:
            target_path = path

        # Headers die weitergegeben werden sollen
        forward_headers = {}
        for key, value in self.headers.items():
            if key.lower() in ('host', 'connection', 'keep-alive', 'proxy-authenticate',
                               'proxy-authorization', 'te', 'trailers', 'transfer-encoding', 'upgrade'):
                continue
            forward_headers[key] = value
        forward_headers['Host'] = f"{backend[0]}:{backend[1]}"

        content_length = int(self.headers.get('Content-Length', 0))
        body = self.rfile.read(content_length) if content_length > 0 else None

        try:
            conn = http.client.HTTPConnection(*backend, timeout=120)
            conn.request(self.command, target_path, body=body, headers=forward_headers)
            resp = conn.getresponse()

            self.send_response(resp.status)
            for key, value in resp.getheaders():
                if key.lower() in ('transfer-encoding', 'content-encoding', 'content-length',
                                   'connection', 'keep-alive'):
                    continue
                self.send_header(key, value)
            # Setze Content-Length falls vorhanden
            if 'Content-Length' in dict(resp.getheaders()):
                self.send_header('Content-Length', dict(resp.getheaders())['Content-Length'])
            self._add_cors()
            self.end_headers()

            resp_body = resp.read()
            self.wfile.write(resp_body)
            conn.close()
        except Exception as e:
            self.send_response(502)
            self.send_header('Content-Type', 'application/json')
            self._add_cors()
            self.end_headers()
            self.wfile.write(json.dumps({'error': 'bad_gateway', 'detail': str(e)}).encode('utf-8'))

    def do_GET(self):
        self._route()

    def do_POST(self):
        self._route()

    def do_PUT(self):
        self._route()

    def do_DELETE(self):
        self._route()

    def _route(self):
        parsed = urlparse(self.path)
        # Auth-Service: /auth/* ODER /api/jarvis/auth/*
        if parsed.path.startswith('/auth/') or parsed.path.startswith('/api/jarvis/auth/'):
            # Strip /api/jarvis prefix for auth backend
            target_path = parsed.path
            if target_path.startswith('/api/jarvis/auth/'):
                target_path = target_path.replace('/api/jarvis/auth/', '/auth/', 1)
            if parsed.query:
                target_path = f"{target_path}?{parsed.query}"
            self._proxy_to_path(AUTH_BACKEND, target_path)
        # Hermes Chat API (/api/jarvis/v1/*) an Hermes API Server (8642)
        # Damit PWA-Chat durch Hermes Agent mit Skills/Memory verarbeitet wird.
        # Der Pfad wird auf /v1/* umgeschrieben, da Hermes den /api/jarvis Praefix nicht kennt.
        elif parsed.path.startswith('/api/jarvis/v1/'):
            target_path = parsed.path.replace('/api/jarvis/v1/', '/v1/', 1)
            if parsed.query:
                target_path = f"{target_path}?{parsed.query}"
            self._proxy_to_path(HERMES_BACKEND, target_path)
        # Jarvis API (/api/jarvis/*, aber nicht /v1/) an API-Server (8124)
        elif parsed.path.startswith('/api/jarvis/'):
            self._proxy(API_BACKEND)
        # Andere API-Requests an Hermes (8642)
        elif parsed.path.startswith('/api/') or parsed.path.startswith('/v1/'):
            self._proxy(HERMES_BACKEND)
        # Statische Dateien aus public/
        else:
            self._serve_static(parsed.path)
    
    def _serve_static(self, path):
        """Serviert statische Dateien aus PUBLIC_DIR"""
        # Security: Pfad auf public/ beschränken
        if '..' in path:
            self.send_error(403, 'Forbidden')
            return
        
        # Default zu index.html
        if path == '/' or path == '':
            path = '/index.html'
        
        file_path = os.path.join(PUBLIC_DIR, path.lstrip('/'))
        
        if not os.path.exists(file_path) or not os.path.isfile(file_path):
            self.send_error(404, 'Not Found')
            return
        
        try:
            with open(file_path, 'rb') as f:
                content = f.read()
            
            # MIME type bestimmen
            ext = os.path.splitext(file_path)[1].lower()
            content_type = MIME_TYPES.get(ext, 'application/octet-stream')
            
            self.send_response(200)
            self.send_header('Content-Type', content_type)
            self.send_header('Content-Length', len(content))
            self.send_header('Cache-Control', 'no-cache')
            self._add_cors()
            self.end_headers()
            self.wfile.write(content)
        except Exception as e:
            self.send_error(500, f'Internal error: {e}')
    
    def _proxy_to_path(self, backend, target_path):
        """Proxy zu einem spezifischen Pfad (für Routing-Anpassungen)"""
        forward_headers = {}
        for key, value in self.headers.items():
            if key.lower() in ('host', 'connection', 'keep-alive', 'proxy-authenticate',
                               'proxy-authorization', 'te', 'trailers', 'transfer-encoding', 'upgrade'):
                continue
            forward_headers[key] = value
        forward_headers['Host'] = f"{backend[0]}:{backend[1]}"
        
        content_length = int(self.headers.get('Content-Length', 0))
        body = self.rfile.read(content_length) if content_length > 0 else None
        
        try:
            conn = http.client.HTTPConnection(*backend, timeout=120)
            conn.request(self.command, target_path, body=body, headers=forward_headers)
            resp = conn.getresponse()
            
            self.send_response(resp.status)
            for key, value in resp.getheaders():
                if key.lower() in ('transfer-encoding', 'content-encoding', 'content-length',
                                   'connection', 'keep-alive'):
                    continue
                self.send_header(key, value)
            if 'Content-Length' in dict(resp.getheaders()):
                self.send_header('Content-Length', dict(resp.getheaders())['Content-Length'])
            self._add_cors()
            self.end_headers()
            
            resp_body = resp.read()
            self.wfile.write(resp_body)
            conn.close()
        except Exception as e:
            self.send_response(502)
            self.send_header('Content-Type', 'application/json')
            self._add_cors()
            self.end_headers()
            self.wfile.write(json.dumps({'error': 'bad_gateway', 'detail': str(e)}).encode('utf-8'))


class ReusableAddrServer(ThreadingHTTPServer):
    allow_reuse_address = True


def run():
    server = ReusableAddrServer(('0.0.0.0', PORT), ProxyHandler)
    print(f"J.A.R.V.I.S. Unified Proxy running on http://0.0.0.0:{PORT}")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nProxy shutting down...")
        server.shutdown()


if __name__ == '__main__':
    run()
