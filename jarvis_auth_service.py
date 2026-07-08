#!/usr/bin/env python3
"""
J.A.R.V.I.S. lokaler Auth-Service
Bietet Login/Verify für Mike und Tanja ohne Supabase/Firebase.
Läuft auf Port 8643.
"""

import json
import os
import hmac
import hashlib
import secrets
import time
from datetime import datetime, timezone
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import parse_qs, urlparse
import base64

USERS_FILE = '/home/mike/.config/hermes/jarvis-users.json'
SECRET_FILE = '/home/mike/.config/hermes/jarvis-auth-secret.key'
PORT = 8643
TOKEN_TTL = 7 * 24 * 3600  # 7 Tage


def load_or_create_secret():
    if os.path.exists(SECRET_FILE):
        with open(SECRET_FILE, 'rb') as f:
            return f.read()
    secret = secrets.token_bytes(32)
    os.makedirs(os.path.dirname(SECRET_FILE), exist_ok=True)
    with open(SECRET_FILE, 'wb') as f:
        f.write(secret)
    os.chmod(SECRET_FILE, 0o600)
    return secret


SECRET = load_or_create_secret()


def load_users():
    if not os.path.exists(USERS_FILE):
        return {'users': []}
    with open(USERS_FILE, 'r') as f:
        return json.load(f)


def verify_password(password: str, stored: dict) -> bool:
    salt = base64.b64decode(stored['salt'])
    hash_value = hashlib.pbkdf2_hmac(
        stored['algorithm'],
        password.encode('utf-8'),
        salt,
        stored['iterations']
    )
    return hmac.compare_digest(
        base64.b64decode(stored['hash']),
        hash_value
    )


def create_token(user_id: str, role: str) -> str:
    expires = int(time.time()) + TOKEN_TTL
    payload = f"{user_id}:{role}:{expires}"
    sig = hmac.new(SECRET, payload.encode('utf-8'), hashlib.sha256).hexdigest()
    return base64.b64encode(f"{payload}:{sig}".encode('utf-8')).decode('utf-8')


def verify_token(token: str) -> dict:
    try:
        decoded = base64.b64decode(token.encode('utf-8')).decode('utf-8')
        user_id, role, expires, sig = decoded.rsplit(':', 3)
        if int(expires) < time.time():
            return {'valid': False, 'error': 'token_expired'}
        payload = f"{user_id}:{role}:{expires}"
        expected = hmac.new(SECRET, payload.encode('utf-8'), hashlib.sha256).hexdigest()
        if not hmac.compare_digest(sig, expected):
            return {'valid': False, 'error': 'invalid_signature'}
        return {'valid': True, 'user_id': user_id, 'role': role}
    except Exception:
        return {'valid': False, 'error': 'malformed_token'}


class AuthHandler(BaseHTTPRequestHandler):
    def log_message(self, format, *args):
        timestamp = datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')
        print(f"[{timestamp}] {self.address_string()} {format % args}")

    def _send_json(self, status, data):
        self.send_response(status)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'POST, GET, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type, Authorization')
        self.end_headers()
        self.wfile.write(json.dumps(data).encode('utf-8'))

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'POST, GET, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type, Authorization')
        self.end_headers()

    def do_POST(self):
        parsed = urlparse(self.path)
        if parsed.path != '/auth/login':
            self._send_json(404, {'error': 'not_found'})
            return

        content_length = int(self.headers.get('Content-Length', 0))
        body = self.rfile.read(content_length).decode('utf-8')
        try:
            data = json.loads(body)
        except json.JSONDecodeError:
            data = {k: v[0] for k, v in parse_qs(body).items()}

        username = (data.get('username', '') if isinstance(data, dict) else '').lower().strip()
        password = data.get('password', '') if isinstance(data, dict) else ''

        if not username or not password:
            self._send_json(400, {'error': 'missing_credentials'})
            return

        users = load_users()
        user = next((u for u in users['users'] if u['id'] == username), None)

        if not user or not verify_password(password, user['password_hash']):
            self._send_json(401, {'error': 'invalid_credentials'})
            return

        token = create_token(user['id'], user['role'])
        self._send_json(200, {
            'success': True,
            'token': token,
            'user': {
                'id': user['id'],
                'name': user['name'],
                'role': user['role']
            }
        })

    def do_GET(self):
        parsed = urlparse(self.path)
        if parsed.path != '/auth/me':
            self._send_json(404, {'error': 'not_found'})
            return

        auth_header = self.headers.get('Authorization', '')
        if not auth_header.startswith('Bearer '):
            self._send_json(401, {'error': 'missing_token'})
            return

        token = auth_header[7:]
        result = verify_token(token)
        if not result['valid']:
            self._send_json(401, {'error': result.get('error', 'invalid_token')})
            return

        users = load_users()
        user = next((u for u in users['users'] if u['id'] == result['user_id']), None)
        if not user:
            self._send_json(401, {'error': 'user_not_found'})
            return

        self._send_json(200, {
            'user': {
                'id': user['id'],
                'name': user['name'],
                'role': user['role']
            }
        })


def run():
    server = HTTPServer(('127.0.0.1', PORT), AuthHandler)
    print(f"J.A.R.V.I.S. Auth Service running on http://127.0.0.1:{PORT}")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nShutting down...")
        server.shutdown()


if __name__ == '__main__':
    run()
