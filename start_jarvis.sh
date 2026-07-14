#!/usr/bin/env bash
#
# J.A.R.V.I.S. Startskript (Cloudflare Tunnel-Variante)
# Zweck: API-Server auf Port 8124 sicher & robust starten
#
# Wichtig:
#   - Läuft als Benutzer 'mike'.
#   - Cloudflare Tunnel (cloudflared) muss separat als Dienst laufen.
#   - Beendet alte Prozesse, falls Port 8124 bereits belegt ist.
#

set -euo pipefail

# ---------------------------------------------------------------------------
# Konfiguration
# ---------------------------------------------------------------------------
PROJECT_DIR="/home/mike/projects/jarvis"
API_SCRIPT="${PROJECT_DIR}/jarvis_api_server.py"
API_PORT=8124

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
        kill -TERM ${pids} 2>/dev/null || true
        sleep 2
        local pids_remaining
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
log "J.A.R.V.I.S. Startvorgang (Cloudflare Tunnel)"
log "============================================"

# ---------------------------------------------------------------------------
# 1. Prüfen, ob Port 8124 belegt ist
# ---------------------------------------------------------------------------
log "Schritt 1: Prüfe Port ${API_PORT} ..."

if lsof -Pi :${API_PORT} -sTCP:LISTEN >/dev/null 2>&1; then
    log "  -> Port ${API_PORT} ist BELEGT. Bereinige blockierenden Prozess."
    local BLOCKING_PID
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
# 2. API-Server starten
# ---------------------------------------------------------------------------
log "Schritt 2: Starte jarvis_api_server.py auf Port ${API_PORT} ..."

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
# 3. Zusammenfassung
# ---------------------------------------------------------------------------
log "============================================"
log "Zusammenfassung:"
log "  API-Server:    http://127.0.0.1:${API_PORT}"
log "  Öffentlich:    https://jarvis-api.quixx24.eu"
log "  Tunnel-Dienst: systemctl --user status cloudflared-jarvis-api.service"
log "============================================"
log "Logs unter: ${LOG_DIR}/"

exit 0
