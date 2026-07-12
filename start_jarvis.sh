#!/usr/bin/env bash
#
# J.A.R.V.I.S. Startskript (Option B: feste ngrok-Domain)
# Erstellt: 12.07.2026
# Zweck:   API-Server und ngrok-Tunnel sicher & robust starten
#
# Wichtig:
#   - Läuft als Benutzer 'mike'.
#   - Startet sowohl ngrok (feste Domain) als auch jarvis_api_server.py.
#   - Beendet alte Prozesse, falls Port 8124 bereits belegt ist.
#

set -euo pipefail

# ---------------------------------------------------------------------------
# Konfiguration (anpassen, falls nötig)
# ---------------------------------------------------------------------------
PROJECT_DIR="/home/mike/projects/jarvis"
NGROK_CONFIG="/home/mike/.config/ngrok/ngrok.yml"
API_SCRIPT="${PROJECT_DIR}/jarvis_api_server.py"
NGROK_TUNNEL_NAME="jarvis-api-direct"
API_PORT=8124
NGROK_DOMAIN="nonconvergent-francene-toxically.ngrok-free.dev"

# Logdateien (rotiert täglich)
LOG_DIR="${PROJECT_DIR}/logs"
mkdir -p "${LOG_DIR}"
LOG_FILE="${LOG_DIR}/start_jarvis_$(date +%Y%m%d).log"

# ---------------------------------------------------------------------------
# Hilfsfunktionen
# ---------------------------------------------------------------------------
log() {
    local msg="[$(date '+%Y-%m-%d %H:%M:%S')] $*"
    echo "${msg}" | tee -a "${LOG_FILE}"
}

# Laufende Prozesse anhand eines Kommandos finden und beenden
kill_process() {
    local pattern="$1"
    local pids
    pids=$(pgrep -f "${pattern}" || true)
    if [[ -n "${pids}" ]]; then
        log "  -> Beende vorherige Instanz(en) von: ${pattern}"
        log "     PID(s): ${pids}"
        # Erst freundlich (SIGTERM), dann hart (SIGKILL) bei Bedarf
        kill -TERM ${pids} 2>/dev/null || true
        sleep 2
        # Übriggebliebene PIDs hart beenden
        pids_remaining=$(pgrep -f "${pattern}" || true)
        if [[ -n "${pids_remaining}" ]]; then
            log "     Erzwinge Beendigung für PID(s): ${pids_remaining}"
            kill -KILL ${pids_remaining} 2>/dev/null || true
        fi
    fi
}

# ---------------------------------------------------------------------------
# Start Logging
# ---------------------------------------------------------------------------
log "============================================"
log "J.A.R.V.I.S. Startvorgang"
log "============================================"

# ---------------------------------------------------------------------------
# 1. Prüfen, ob Port 8124 belegt ist
# ---------------------------------------------------------------------------
log "Schritt 1: Prüfe Port ${API_PORT} ..."

PORT_PID=$(lsof -ti tcp:${API_PORT} 2>/dev/null || ss -ltnp 2>/dev/null | grep ":${API_PORT}" | awk '{for(i=1;i<=NF;i++) if($i~/'"'"'pid='"'"'/) print $i}' | head -n1 || true)

if lsof -Pi :${API_PORT} -sTCP:LISTEN >/dev/null 2>&1; then
    log "  -> Port ${API_PORT} ist BELEGT. Bereinige blockierenden Prozess."
    # Versuche, den Prozess über den Port zu beenden (robust)
    BLOCKING_PID=$(lsof -ti tcp:${API_PORT})
    if [[ -n "${BLOCKING_PID}" ]]; then
        log "     Blockierende PID: ${BLOCKING_PID}"
        kill -TERM "${BLOCKING_PID}" 2>/dev/null || true
        sleep 2
        if lsof -Pi :${API_PORT} -sTCP:LISTEN >/dev/null 2>&1; then
            log "     Erzwinge Beendigung von PID ${BLOCKING_PID}"
            kill -KILL "${BLOCKING_PID}" 2>/dev/null || true
            sleep 1
        fi
    fi
else
    log "  -> Port ${API_PORT} ist frei"
fi

# Zusätzlich: Alte jarvis_api_server.py-Prozesse bereinigen
kill_process "jarvis_api_server.py"
sleep 1

# ---------------------------------------------------------------------------
# 2. ngrok-Tunnel starten (feste Domain)
# ---------------------------------------------------------------------------
log "Schritt 2: Starte ngrok-Tunnel '${NGROK_TUNNEL_NAME}' mit fester Domain ${NGROK_DOMAIN} ..."

# Alte ngrok-Instanzen beenden (egal welche Domain/Tunnel)
log "  -> Beende laufende ngrok-Prozesse, falls vorhanden."
pkill -f "^ngrok" 2>/dev/null || true
# Warte, bis ngrok-Admin-Port 4041 frei ist
for i in {1..5}; do
    if ! lsof -Pi :4041 -sTCP:LISTEN >/dev/null 2>&1; then
        break
    fi
    log "     Warte auf Freigabe von 4041..."
    sleep 1
done
if lsof -Pi :4041 -sTCP:LISTEN >/dev/null 2>&1; then
    log "     WARNUNG: 4041 noch belegt, versuche Listener zu beenden."
    NGROK_ADMIN_PID=$(lsof -ti tcp:4041 2>/dev/null || true)
    if [[ -n "${NGROK_ADMIN_PID}" ]]; then
        kill -TERM "${NGROK_ADMIN_PID}" 2>/dev/null || true
        sleep 2
        kill -KILL "${NGROK_ADMIN_PID}" 2>/dev/null || true
    fi
fi
sleep 1

# ngrok im Hintergrund starten
nohup ngrok start --config "${NGROK_CONFIG}" "${NGROK_TUNNEL_NAME}" >> "${LOG_DIR}/ngrok.log" 2>&1 &
NGROK_PID=$!
log "  -> ngrok gestartet mit PID: ${NGROK_PID}"

# Kurz warten, bis der Tunnel verfügbar ist
sleep 4

# Prüfen, ob ngrok Admin-API bereit ist und die feste Domain aktiv ist
RETRY=0
NGROK_URL=""
while [[ -z "${NGROK_URL}" && ${RETRY} -lt 15 ]]; do
    NGROK_URL=$(curl -s http://127.0.0.1:4041/api/tunnels 2>/dev/null | python3 -c "import sys, json; d=json.load(sys.stdin); print([t['public_url'] for t in d.get('tunnels',[]) if t['name']=='${NGROK_TUNNEL_NAME}'][0])" 2>/dev/null || true)
    sleep 1
    RETRY=$((RETRY + 1))
done

if [[ -n "${NGROK_URL}" ]]; then
    log "  -> Tunnel aktiv: ${NGROK_URL}"
else
    log "  ⚠ WARNUNG: ngrok-Tunnel konnte nicht verifiziert werden. Bitte Log prüfen: ${LOG_DIR}/ngrok.log"
fi

# ---------------------------------------------------------------------------
# 3. API-Server starten
# ---------------------------------------------------------------------------
log "Schritt 3: Starte jarvis_api_server.py auf Port ${API_PORT} ..."

cd "${PROJECT_DIR}"
nohup python3 "${API_SCRIPT}" >> "${LOG_DIR}/api_server.log" 2>&1 &
API_PID=$!
log "  -> API-Server gestartet mit PID: ${API_PID}"

# Kurz warten und Health-Check durchführen
sleep 2
RETRY=0
HEALTH_OK=false
while [[ ${RETRY} -lt 10 ]]; do
    if curl -sf http://127.0.0.1:${API_PORT}/health >/dev/null 2>&1; then
        HEALTH_OK=true
        break
    fi
    sleep 1
    RETRY=$((RETRY + 1))
done

if [[ "${HEALTH_OK}" == "true" ]]; then
    log "  -> API-Server Health-Check: OK"
else
    log "  ⚠ WARNUNG: API-Server antwortet nicht auf /health. Bitte prüfen: ${LOG_DIR}/api_server.log"
fi

# ---------------------------------------------------------------------------
# 4. Zusammenfassung
# ---------------------------------------------------------------------------
log "============================================"
log "Zusammenfassung:"
log "  API-Server:  http://127.0.0.1:${API_PORT}"
log "  ngrok-Tunnel: ${NGROK_URL:-<Verifizierung fehlgeschlagen>}"
log "  Öffentlich: https://${NGROK_DOMAIN}"
log "============================================"
log "Logs unter: ${LOG_DIR}/"

exit 0
