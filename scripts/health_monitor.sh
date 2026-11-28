#!/bin/bash
# J.A.R.V.I.S. Health Monitor
# Prüft Hermes API und sendet Telegram-Alert bei Ausfall

set -e

# Konfiguration
HERMES_URL="http://192.168.1.81:8124/api/jarvis/health"
TELEGRAM_BOT_TOKEN="$(grep TELEGRAM_BOT_TOKEN ~/.hermes/.env | cut -d'=' -f2)"
TELEGRAM_CHAT_ID="232134943"
LOG_FILE="/home/mike/projects/jarvis/logs/health_monitor.log"
ALERT_COOLDOWN=300  # 5 Minuten zwischen Alerts

# Logging-Funktion
log() {
    echo "$(date '+%Y-%m-%d %H:%M:%S') - $1" >> "$LOG_FILE"
}

# Telegram-Alert senden
send_alert() {
    local message="$1"
    curl -s -X POST "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage" \
        -d "chat_id=${TELEGRAM_CHAT_ID}" \
        -d "text=🚨 J.A.R.V.I.S. Alert: ${message}" \
        -d "parse_mode=HTML" > /dev/null
    log "Alert gesendet: ${message}"
}

# Prüfen ob letzter Alert im Cooldown war
last_alert_file="/tmp/jarvis_last_alert"
if [ -f "$last_alert_file" ]; then
    last_alert=$(cat "$last_alert_file")
    now=$(date +%s)
    diff=$((now - last_alert))
    if [ $diff -lt $ALERT_COOLDOWN ]; then
        log "Alert-Cooldown aktiv (${diff}s < ${ALERT_COOLDOWN}s) - übersprungen"
        exit 0
    fi
fi

# Health-Check
log "Health-Check gestartet: ${HERMES_URL}"

if curl -f -s --connect-timeout 5 --max-time 10 "$HERMES_URL" > /dev/null 2>&1; then
    log "✅ Hermes API ist erreichbar"
    # Bei Erfolg: Cooldown-File entfernen
    rm -f "$last_alert_file"
else
    log "❌ Hermes API NICHT erreichbar"
    # Alert senden
    send_alert "Hermes API ist nicht erreichbar (192.168.1.81:8124). Bitte prüfen."
    # Timestamp speichern
    date +%s > "$last_alert_file"
fi

log "Health-Check abgeschlossen"
