#!/bin/bash
# J.A.R.V.I.S. PWA - Lokaler Development Server
# Startet einen lokalen HTTPS-Server für die PWA
# 
# Vorteile:
# - Kein Vercel/Cloud nötig
# - Direkter Zugriff auf HA API (kein Proxy)
# - Live-Reload bei Änderungen
# - PWA-fähig mit HTTPS

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
cd "$PROJECT_DIR"

PORT=${PORT:-8125}
HOST=${HOST:-0.0.0.0}
PUBLIC_DIR="$PROJECT_DIR/public"

echo "╔════════════════════════════════════════════════════════╗"
echo "║         J.A.R.V.I.S. PWA - Local Server                ║"
echo "╠════════════════════════════════════════════════════════╣"
echo "║  Port: $PORT                                           ║"
echo "║  Host: $HOST                                           ║"
echo "║  Directory: $PUBLIC_DIR                                ║"
echo "╚════════════════════════════════════════════════════════╝"

# Prüfen ob Zertifikate existieren, sonst erstellen
if [ ! -f "certs/server.crt" ] || [ ! -f "certs/server.key" ]; then
    echo "📝 Erstelle self-signed HTTPS-Zertifikate..."
    mkdir -p certs
    
    # OpenSSL Zertifikat erstellen (10 Jahre gültig)
    openssl req -x509 -newkey rsa:4096 \
        -keyout certs/server.key \
        -out certs/server.crt \
        -days 3650 \
        -nodes \
        -subj "/C=DE/ST=NRW/L=Troisdorf/O=Quixx24/CN=jarvis.local" \
        -addext "subjectAltName=DNS:localhost,IP:192.168.1.81,IP:0.0.0.0"
    
    echo "✅ Zertifikate erstellt in ./certs/"
    echo "⚠️  Browser wird Zertifikat als 'nicht sicher' markieren (erwartet)"
    echo "   → 'Erweitert' → 'Trotzdem fortfahren' klicken"
fi

# Python HTTPS Server starten
echo ""
echo "🚀 Starte lokalen HTTPS-Server..."
echo ""
echo "📱 URLs:"
echo "   Local:  http://localhost:$PORT"
echo "   LAN:    http://192.168.1.81:$PORT"
echo "   (IP automatisch anpassen falls anders)"
echo ""
echo "🔧 API-Endpoints direkt nutzen (kein Proxy):"
echo "   Home Assistant: http://192.168.1.91:8123/api/..."
echo "   Paperless:      http://192.168.1.159:8777/api/..."
echo "   Proxmox:        https://192.168.1.130:8006/api2/..."
echo ""
echo "⏹️  Stoppen mit STRG+C"
echo ""

# Python3 HTTP Server (kein HTTPS für lokale Entwicklung)
cd "$PUBLIC_DIR"
python3 << EOF
import http.server
import socketserver
import os

PORT = $PORT
HOST = "$HOST"

Handler = http.server.SimpleHTTPRequestHandler

with socketserver.TCPServer((HOST, PORT), Handler) as httpd:
    print(f"Server running on http://{HOST}:{PORT}")
    print(f"Serving from: {os.getcwd()}")
    print("")
    
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\n\n🛑 Server gestoppt.")
        httpd.shutdown()
EOF
