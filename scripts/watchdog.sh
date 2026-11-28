#!/bin/bash
# J.A.R.V.I.S. Watchdog - Startet API bei Crash automatisch neu
# Wird alle 2 Minuten via Cron ausgeführt

set -e

HERMES_URL="http://127.0.0.1:8124/api/jarvis/health"
PID_FILE="/home/mike/projects/jarvis/jarvis.pid"
LOG_FILE="/home/mike/projects/jarvis/logs/watchdog.log"
START_SCRIPT="/home/mike/projects/jarvis/start_jarvis.sh"

log() {
    echo "$(date '+%Y-%m-%d %H:%M:%S') - $1" >> "$LOG_FILE"
}

log "Watchdog-Check gestartet"

# Prüfen ob Prozess läuft (via PID-File oder Port-Check)
if curl -f -s --connect-timeout 3 --max-time 5 "$HERMES_URL" > /dev/null 2>&1; then
    log "✅ API läuft (Health-Check erfolgreich)"
    exit 0
fi

log "❌ API NICHT erreichbar - versuche Neustart"

# Alten Prozess killen (falls noch im Hintergrund)
if [ -f "$PID_FILE" ]; then
    old_pid=$(cat "$PID_FILE")
    if kill -0 "$old_pid" 2>/dev/null; then
        log "Killing old process: $old_pid"
        kill "$old_pid" 2>/dev/null || true
        sleep 2
    fi
fi

# API neu starten
log "Starte J.A.R.V.I.S. API..."
cd /home/mike/projects/jarvis
nohup bash "$START_SCRIPT" > /dev/null 2>&1 &
new_pid=$!
echo "$new_pid" > "$PID_FILE"

sleep 5

# Verify Start
if curl -f -s --connect-timeout 3 "$HERMES_URL" > /dev/null 2>&1; then
    log "✅ Neustart erfolgreich (PID: $new_pid)"
else
    log "❌ Neustart FEHLGESCHLAGEN - manuelles Eingreifen erforderlich!"
fi

log "Watchdog-Check abgeschlossen"
