#!/bin/bash
# J.A.R.V.I.S. Startup Script
# Startet API-Server und ngrok-Tunnel

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "════════════════════════════════════════"
echo "  J.A.R.V.I.S. System Startup"
echo "════════════════════════════════════════"

# API-Server starten (falls nicht bereits laufend)
if ! pgrep -f "jarvis_api_server.py" > /dev/null; then
    echo "[1/2] Starte API-Server auf Port 8124..."
    python3 jarvis_api_server.py &
    API_PID=$!
    sleep 2
else
    echo "[1/2] API-Server läuft bereits"
    API_PID=$(pgrep -f "jarvis_api_server.py")
fi

# ngrok starten (falls nicht bereits laufend)
if ! pgrep -f "ngrok.*jarvis-api" > /dev/null; then
    echo "[2/2] Starte ngrok-Tunnel..."
    ngrok start --config ~/.config/ngrok/ngrok.yml jarvis-api &
    NGROK_PID=$!
    sleep 3
else
    echo "[2/2] ngrok läuft bereits"
    NGROK_PID=$(pgrep -f "ngrok.*jarvis-api")
fi

echo ""
echo "════════════════════════════════════════"
echo "  ✓ Systeme laufen"
echo "════════════════════════════════════════"
echo ""
echo "  API-Server:  http://localhost:8124"
echo "  ngrok URL:   https://nonconvergent-francene-toxically.ngrok-free.dev"
echo ""
echo "  PWA Setup:"
echo "  1. Öffne https://jarvis-app.quixx24.com"
echo "  2. Login → Einstellungen (unten links)"
echo "  3. API Präfix: https://nonconvergent-francene-toxically.ngrok-free.dev"
echo "  4. Speichern + Neu laden"
echo ""
echo "  Drücke Strg+C zum Stoppen"
echo ""

# Warte auf beide Prozesse
wait
