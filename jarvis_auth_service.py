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
import threading
from collections import defaultdict, deque
from datetime import datetime, timezone
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import parse_qs, urlparse
import base64

USERS_FILE = '/home/mike/.config/hermes/jarvis-users.json'
SECRET_FILE = '/home/mike/.config/hermes/jarvis-auth-secret.key'
PORT = 8643
TOKEN_TTL = 7 * 24 * 3600  # 7 Tage

# Ratenbegrenzung für den Login (Schutz gegen Durchprobieren von Passwörtern)
LOCK_ATTEMPTS = 3          # nach 3 Fehlversuchen wird gesperrt
LOCK_SECONDS = 5 * 60      # Sperrdauer: 5 Minuten
FAIL_WINDOW = LOCK_SECONDS # Beobachtungsfenster = Sperrdauer
FAIL_MAX_PER_IP = LOCK_ATTEMPTS
FAIL_MAX_GLOBAL = 30       # Fehlversuche insgesamt im Fenster (verteilte Angriffe)
FAIL_PAUSE = 0.5           # künstliche Verzögerung je Fehlversuch in Sekunden

# Passwort-Rücksetzung per Mail — Empfänger ist fest hinterlegt, nicht wählbar
STATE_FILE = '/home/mike/.config/hermes/jarvis-auth-state.json'
RESET_CODE_TTL = 15 * 60   # Code 15 Minuten gültig
RESET_MAX_TRIES = 5        # Fehlversuche beim Code
RESET_MAIL_TO = 'mikeschiller76@googlemail.com'
RESET_MAIL_FROM = 'WohnAnker <info@mike-schiller.de>'
RESET_MAIL_NAME = 'WohnAnker'
MIN_PASSWORT = 8

_fail_lock = threading.Lock()
_fail_by_ip = defaultdict(deque)
_fail_global = deque()


def _client_ip(handler) -> str:
    """Ermittelt die echte Absenderadresse.

    Der Dienst lauscht nur auf 127.0.0.1, jeder Aufruf kommt also über den Proxy.
    Cloudflare setzt CF-Connecting-IP, sonst greift X-Forwarded-For.
    """
    for header in ('CF-Connecting-IP', 'X-Forwarded-For', 'X-Real-IP'):
        value = handler.headers.get(header)
        if value:
            return value.split(',')[0].strip()
    return handler.client_address[0]


def _prune(queue, now):
    while queue and now - queue[0] > FAIL_WINDOW:
        queue.popleft()


def _login_allowed(ip: str):
    """(erlaubt, wartesekunden) — prüft die Fehlversuche dieses Absenders."""
    now = time.time()
    with _fail_lock:
        own = _fail_by_ip[ip]
        _prune(own, now)
        _prune(_fail_global, now)
        if len(own) >= FAIL_MAX_PER_IP:
            return False, int(FAIL_WINDOW - (now - own[0])) + 1
        if len(_fail_global) >= FAIL_MAX_GLOBAL:
            return False, int(FAIL_WINDOW - (now - _fail_global[0])) + 1
        return True, 0


def _record_failure(ip: str):
    now = time.time()
    with _fail_lock:
        _fail_by_ip[ip].append(now)
        _fail_global.append(now)


def _reset_failures(ip: str):
    with _fail_lock:
        _fail_by_ip.pop(ip, None)



_state_lock = threading.Lock()


def _state_laden():
    try:
        with open(STATE_FILE, 'r', encoding='utf-8') as f:
            d = json.load(f)
            if isinstance(d, dict):
                d.setdefault('users', {})
                d.setdefault('resets', {})
                return d
    except Exception:
        pass
    return {'users': {}, 'resets': {}}


def _state_speichern(state):
    try:
        os.makedirs(os.path.dirname(STATE_FILE), exist_ok=True)
        tmp = STATE_FILE + '.tmp'
        with open(tmp, 'w', encoding='utf-8') as f:
            json.dump(state, f, ensure_ascii=False, indent=2)
        os.chmod(tmp, 0o600)
        os.replace(tmp, STATE_FILE)
    except Exception as exc:
        print(f"[AUTH SERVICE] Zustand konnte nicht gespeichert werden: {type(exc).__name__}")


def _konto_status(username):
    """(erlaubt, wartesekunden, versuche_uebrig) für ein Konto."""
    now = time.time()
    st = _state_laden()
    eintrag = st['users'].get(username, {}) or {}
    bis = float(eintrag.get('locked_until') or 0)
    if bis > now:
        return False, int(bis - now) + 1, 0
    fails = [t for t in (eintrag.get('fails') or []) if now - float(t) < FAIL_WINDOW]
    uebrig = max(0, LOCK_ATTEMPTS - len(fails))
    return True, 0, uebrig


def _konto_fehlversuch(username):
    """Zählt einen Fehlversuch und sperrt beim dritten. Gibt (versuche_uebrig, gesperrt_bis) zurück."""
    now = time.time()
    with _state_lock:
        st = _state_laden()
        eintrag = st['users'].setdefault(username, {})
        fails = [t for t in (eintrag.get('fails') or []) if now - float(t) < FAIL_WINDOW]
        fails.append(now)
        eintrag['fails'] = fails
        gesperrt_bis = 0
        if len(fails) >= LOCK_ATTEMPTS:
            gesperrt_bis = now + LOCK_SECONDS
            eintrag['locked_until'] = gesperrt_bis
        _state_speichern(st)
        uebrig = max(0, LOCK_ATTEMPTS - len(fails))
        return uebrig, gesperrt_bis


def _konto_entsperren(username):
    with _state_lock:
        st = _state_laden()
        if username in st['users']:
            st['users'][username] = {}
            _state_speichern(st)


def make_password_hash(password: str) -> dict:
    salt = os.urandom(16)
    iterations = 100000
    h = hashlib.pbkdf2_hmac('sha256', password.encode('utf-8'), salt, iterations)
    return {
        'algorithm': 'sha256',
        'salt': base64.b64encode(salt).decode('utf-8'),
        'iterations': iterations,
        'hash': base64.b64encode(h).decode('utf-8')
    }


def set_password(user_id: str, password: str) -> bool:
    users = load_users()
    for u in users['users']:
        if u['id'] == user_id:
            u['password_hash'] = make_password_hash(password)
            with open(USERS_FILE, 'w', encoding='utf-8') as f:
                json.dump(users, f, ensure_ascii=False, indent=2)
            os.chmod(USERS_FILE, 0o600)
            return True
    return False


def _env_lesen():
    werte = {}
    try:
        with open('/home/mike/.hermes/.env', 'r', encoding='utf-8') as f:
            for zeile in f:
                if '=' in zeile and not zeile.strip().startswith('#'):
                    k, v = zeile.split('=', 1)
                    werte[k.strip()] = v.strip().strip('"').strip("'")
    except Exception:
        pass
    return werte


def reset_mail_senden(code: str, user_name: str) -> bool:
    """Schickt den Code an die fest hinterlegte Adresse. Gibt Erfolg zurück."""
    import smtplib
    from email.message import EmailMessage
    env = _env_lesen()
    host = env.get('IONOS_EMAIL_SMTP_HOST') or 'smtp.ionos.de'
    port = int(env.get('IONOS_EMAIL_SMTP_PORT') or 587)
    user = env.get('IONOS_EMAIL_USER', '')
    pw = env.get('IONOS_EMAIL_PASSWORD', '')
    if not user or not pw:
        print('[AUTH SERVICE] Kein SMTP-Zugang in .env gefunden')
        return False
    nachricht = EmailMessage()
    nachricht['From'] = RESET_MAIL_FROM
    nachricht['To'] = RESET_MAIL_TO
    nachricht['Subject'] = f'WohnAnker: Code zum Zurücksetzen des Passworts ({code})'
    nachricht.set_content(
        f"Hallo {user_name},\n\n"
        f"fuer den Zugang zu WohnAnker wurde ein neues Passwort angefordert.\n\n"
        f"Dein Code: {code}\n\n"
        f"Der Code gilt {RESET_CODE_TTL // 60} Minuten. Gib ihn in der App ein und vergib dabei ein neues Passwort.\n\n"
        f"Wenn du das nicht warst, ignoriere diese Mail - das alte Passwort bleibt dann gueltig.\n\n"
        f"Viele Gruesse\nWohnAnker"
    )
    try:
        srv = smtplib.SMTP(host, port, timeout=25)
        srv.starttls()
        srv.login(user, pw)
        srv.send_message(nachricht)
        srv.quit()
        print(f'[AUTH SERVICE] Rücksetz-Code per Mail an {RESET_MAIL_TO} gesendet')
        return True
    except Exception as exc:
        print(f'[AUTH SERVICE] Mailversand fehlgeschlagen: {type(exc).__name__}')
        return False


def reset_code_anfordern(username: str) -> bool:
    code = f"{secrets.randbelow(900000) + 100000}"
    h = hashlib.sha256(code.encode('utf-8')).hexdigest()
    with _state_lock:
        st = _state_laden()
        st['resets'][username] = {'hash': h, 'expires': time.time() + RESET_CODE_TTL, 'tries': 0}
        _state_speichern(st)
    return code


def reset_code_pruefen(username: str, code: str):
    """(ok, fehlercode) — prüft den Code und zählt Fehlversuche."""
    code = (code or '').strip()
    with _state_lock:
        st = _state_laden()
        eintrag = st['resets'].get(username)
        if not eintrag:
            return False, 'no_code'
        if time.time() > float(eintrag.get('expires', 0)):
            st['resets'].pop(username, None)
            _state_speichern(st)
            return False, 'code_expired'
        if int(eintrag.get('tries', 0)) >= RESET_MAX_TRIES:
            st['resets'].pop(username, None)
            _state_speichern(st)
            return False, 'too_many_tries'
        if not hmac.compare_digest(hashlib.sha256(code.encode('utf-8')).hexdigest(), eintrag.get('hash', '')):
            eintrag['tries'] = int(eintrag.get('tries', 0)) + 1
            _state_speichern(st)
            return False, 'wrong_code'
        st['resets'].pop(username, None)
        _state_speichern(st)
        return True, 'ok'


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
        pfad = parsed.path

        content_length = int(self.headers.get('Content-Length', 0))
        body = self.rfile.read(content_length).decode('utf-8') if content_length else ''
        try:
            data = json.loads(body) if body else {}
        except json.JSONDecodeError:
            data = {k: v[0] for k, v in parse_qs(body).items()}
        if not isinstance(data, dict):
            data = {}

        if pfad == '/auth/login':
            self._login(data)
        elif pfad == '/auth/reset-request':
            self._reset_anfordern(data)
        elif pfad == '/auth/reset-confirm':
            self._reset_bestaetigen(data)
        else:
            self._send_json(404, {'error': 'not_found'})

    # ---------- Anmeldung ----------
    def _login(self, data):
        client_ip = _client_ip(self)
        allowed, wait = _login_allowed(client_ip)
        if not allowed:
            print(f"[AUTH SERVICE] Zu viele Fehlversuche von {client_ip} — gesperrt für {wait}s")
            self._send_json(429, {
                'error': 'too_many_attempts',
                'retry_after': wait,
                'message': 'Zu viele Fehlversuche. Bitte kurz warten.'
            })
            return

        username = (data.get('username', '') or '').lower().strip()
        password = data.get('password', '') or ''
        if not username or not password:
            self._send_json(400, {'error': 'missing_credentials'})
            return

        # Kontosperre: 3 Fehlversuche = 5 Minuten, gilt unabhängig von der Adresse
        erlaubt, wartezeit, uebrig = _konto_status(username)
        if not erlaubt:
            print(f"[AUTH SERVICE] Konto {username} gesperrt für {wartezeit}s")
            self._send_json(429, {
                'error': 'too_many_attempts',
                'retry_after': wartezeit,
                'attempts_left': 0,
                'message': f'Zu viele Fehlversuche. In {max(1, -(-wartezeit // 60))} Minuten wieder möglich.'
            })
            return

        users = load_users()
        user = next((u for u in users['users'] if u['id'] == username), None)

        print(f"[AUTH SERVICE] Login-Versuch von {client_ip} (Konto {username or '?'})")

        if not user or not verify_password(password, user['password_hash']):
            uebrig, gesperrt_bis = _konto_fehlversuch(username)
            _record_failure(client_ip)
            time.sleep(FAIL_PAUSE)
            antwort = {'error': 'invalid_credentials', 'attempts_left': uebrig}
            if gesperrt_bis:
                antwort['error'] = 'too_many_attempts'
                antwort['retry_after'] = LOCK_SECONDS
                antwort['message'] = 'Nach drei Fehlversuchen ist die Anmeldung für 5 Minuten gesperrt.'
            else:
                antwort['message'] = ('Noch 1 Versuch, dann ist die Anmeldung für 5 Minuten gesperrt.'
                                      if uebrig == 1 else f'Noch {uebrig} Versuche bis zur Sperre.')
            self._send_json(429 if gesperrt_bis else 401, antwort)
            return

        _reset_failures(client_ip)
        _konto_entsperren(username)
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

    # ---------- Passwort zurücksetzen ----------
    def _reset_anfordern(self, data):
        """Schickt einen Code an die fest hinterlegte Adresse."""
        username = (data.get('username', '') or '').lower().strip()
        users = load_users()
        user = next((u for u in users['users'] if u['id'] == username), None)
        if not user:
            self._send_json(404, {'error': 'unknown_user'})
            return

        code = reset_code_anfordern(username)
        if not reset_mail_senden(code, user.get('name') or username):
            self._send_json(502, {'error': 'mail_failed',
                                  'message': 'Die Mail konnte nicht versendet werden. Bitte später erneut versuchen.'})
            return

        ziel = RESET_MAIL_TO
        teile = ziel.split('@')
        maskiert = (teile[0][:2] + '…@' + teile[1]) if len(teile) == 2 else ziel
        self._send_json(200, {'success': True, 'sent_to': maskiert, 'valid_minutes': RESET_CODE_TTL // 60})

    def _reset_bestaetigen(self, data):
        username = (data.get('username', '') or '').lower().strip()
        code = (data.get('code', '') or '').strip()
        passwort = data.get('password', '') or ''

        if len(passwort) < MIN_PASSWORT:
            self._send_json(400, {'error': 'password_too_short',
                                  'message': f'Das neue Passwort braucht mindestens {MIN_PASSWORT} Zeichen.'})
            return

        ok, fehler = reset_code_pruefen(username, code)
        if not ok:
            texte = {
                'no_code': 'Es liegt kein Code vor. Bitte neu anfordern.',
                'code_expired': 'Der Code ist abgelaufen. Bitte neu anfordern.',
                'wrong_code': 'Der Code stimmt nicht.',
                'too_many_tries': 'Zu viele Fehlversuche beim Code. Bitte neu anfordern.'
            }
            self._send_json(400, {'error': fehler, 'message': texte.get(fehler, 'Code ungültig.')})
            return

        if not set_password(username, passwort):
            self._send_json(500, {'error': 'user_not_found'})
            return

        _konto_entsperren(username)
        print(f"[AUTH SERVICE] Passwort für {username} neu gesetzt (per Mail-Code)")
        self._send_json(200, {'success': True, 'message': 'Passwort geändert. Du kannst dich jetzt anmelden.'})

        # ---------- weitere Endpunkte ----------
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
