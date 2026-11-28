#!/bin/bash
# J.A.R.V.I.S. Daily Backup
# Erstellt täglich um 3:00 Uhr ein Backup auf NAS

set -e

BACKUP_DIR="/mnt/nas_llm_wiki/backups/jarvis"
SOURCE_DIR="/home/mike/projects/jarvis"
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
BACKUP_FILE="${BACKUP_DIR}/jarvis-backup-${TIMESTAMP}.tar.gz"
LOG_FILE="/home/mike/projects/jarvis/logs/backup.log"

log() {
    echo "$(date '+%Y-%m-%d %H:%M:%S') - $1" >> "$LOG_FILE"
}

log "Backup gestartet"

# Backup-Verzeichnis erstellen
mkdir -p "$BACKUP_DIR"

# Backup erstellen (ohne node_modules, logs, __pycache__)
log "Erstelle Backup: ${BACKUP_FILE}"
tar -czf "$BACKUP_FILE" \
    --exclude='node_modules' \
    --exclude='logs' \
    --exclude='__pycache__' \
    --exclude='*.log' \
    -C "$(dirname "$SOURCE_DIR")" \
    "$(basename "$SOURCE_DIR")"

# Verify Backup
if [ -f "$BACKUP_FILE" ]; then
    size=$(du -h "$BACKUP_FILE" | cut -f1)
    log "✅ Backup erfolgreich erstellt: ${BACKUP_FILE} (${size})"
else
    log "❌ Backup FEHLGESCHLAGEN"
    exit 1
fi

# Alte Backups löschen (>30 Tage)
log "Lösche alte Backups (>30 Tage)"
find "$BACKUP_DIR" -name "jarvis-backup-*.tar.gz" -mtime +30 -delete

log "Backup abgeschlossen"
