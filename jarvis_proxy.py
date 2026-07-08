#!/usr/bin/env python3
"""
J.A.R.V.I.S. Unified Gateway Proxy
Empfängt alles über Port 8645 und routed:
  /auth/*  -> lokaler Auth-Service (127.0.0.1:8643)
  /*       -> Hermes API Server (127.0.0.1:8642)
Damit erreicht die PWA Auth und Chat-API über dieselbe Domain.
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
        if parsed.path.startswith('/auth/'):
            self._proxy(AUTH_BACKEND)
        else:
            self._proxy(HERMES_BACKEND)


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
