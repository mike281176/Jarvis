# J.A.R.V.I.S. System - Master Project

**Projekt-Root:** `/home/mike/projects/jarvis/`  
**Aktiv seit:** 07.07.2026  
**Status:** PWA → Hermes Direct API

---

## Architektur: Weg A (PWA ↔ Hermes Direct)

```
┌─────────────────────────────────────────┐
│   PWA (Phone/Tablet/PC)                 │
│   /home/mike/jarvis-voice-client/       │
│  - Web Speech API (Voice/Text)          │
│  - User Login (Mike/Gäste)              │
│  - HTTPS erforderlich für Mic           │
└──────────────┬──────────────────────────┘
               │ POST /api/jarvis/ask
               │ {user: "mike", message: "..."}
               ▼
┌─────────────────────────────────────────┐
│   Hermes API Endpoint                   │
│   Port: 8124 (fest)                     │
│  - Empfängt Anfragen                    │
│  - Lädt User Memory                     │
│  - Fragt HA nach Daten                  │
│  - Generiert Antwort (JARVIS-Stil)      │
└──────────────┬──────────────────────────┘
               │
    ┌──────────┴──────────┐
    ▼                     ▼
┌──────────┐        ┌──────────────┐
│   HA     │        │  Memory DB   │
│192.168.1.│        │  (per User)  │
│    91:   │        │              │
│  8123    │        │ ~/.hermes/   │
└──────────┘        └──────────────┘
```

---

## PWA Location

```
/home/mike/jarvis-voice-client/
├── index.html          ← Main UI
├── app.js              ← Voice + API Calls
├── styles.css          ← Styling
├── manifest.json       ← PWA Config
├── sw.js               ← Service Worker
├── jarvis_direct_server.py    ← HTTP Server (alt)
├── jarvis_intelligent_responder.py  ← Intent + HA
└── jarvis_websocket_server.py       ← Alternative
```

**WICHTIG:** PWA benötigt HTTPS für Microphone-API!

---

## Hermes API Endpunkt

**Neu:** `/home/mike/projects/jarvis/hermes_api/` - Integriert in Hermes Agent

| Endpoint | Methode | Beschreibung |
|----------|---------|--------------|
| `/api/jarvis/ask` | POST | Haupt-Endpoint für Anfragen |
| `/api/jarvis/health` | GET | Health-Check |
| `/api/jarvis/users` | GET | Verfügbare User |

**Request Format:**
```json
{
  "user": "mike",
  "message": "Wie viel Solar?",
  "context": {
    "location": "wohnzimmer",
    "timestamp": "2026-07-07T12:00:00Z"
  }
}
```

**Response Format:**
```json
{
  "response": "Aktuell produzieren wir 3.2 kW Solarstrom, Sir.",
  "intent": "solar_query",
  "data": {
    "power": 3200,
    "unit": "W"
  },
  "processing_time_ms": 450
}
```

---

## Kommunikationsprotokoll

### Nachrichten-Format (JSON)
```json
{
  "messages": [
    {
      "id": "uuid",
      "timestamp": "ISO8601",
      "source": "echo_device_entity",
      "message": "Wie viel Solar?",
      "status": "pending|processing|completed|failed",
      "response": "Antworttext",
      "processed_at": "ISO8601"
    }
  ]
}
```

### Status-Flow
```
pending → processing → completed
                    └→ failed (mit retry_count)
```

---

| Wichtige Pfade (NICHT `/tmp/`)

| Zweck | Pfad | Status |
|-------|------|--------|
| Nachrichten-Queue | `/home/mike/projects/jarvis/data/messages.json` | ❌ EINGESTELLT |
| Log-Dateien | `/home/mike/projects/jarvis/data/logs/` | ✅ Aktiv |
| Python Scripts | `/home/mike/projects/jarvis/scripts/` | ✅ Aktiv |
| Config Backups | `/home/mike/projects/jarvis/config/backups/` | ✅ Aktiv |

---

## 🔒 Sicherheitshinweise

### Credentials & API Tokens

**WICHTIG:** Alle sensiblen API-Keys und Tokens befinden sich ausschließlich in:
- `/home/mike/.hermes/.env`

**Regeln:**
- Tokens sind NUR zum **Lesen und Anwenden** bestimmt
- KEINE Tokens in Chat-Verläufen preisgeben
- KEINE Tokens in Projektdateien, Logs oder Dokumentationen speichern
- KEINE Tokens in Git-Commits einschließen
- Bei Verwendung immer aus `.env` laden, niemals hardcodieren

**Enthaltene Credentials:**
- GitHub API Token
- Home Assistant Long-Lived Access Token
- Weitere projektrelevante API-Keys

---

## Aufgaben/Kanban

### In Progress
- [ ] Migration von `/tmp/` zu persistentem Speicher
- [x] ~~Echo-Geräte Mapping finalisieren~~ ❌ EINGESTELLT
- [ ] Solar-Entity Discovery verbessern

### Todo
- [ ] REST-API Endpunkt für externe Integrationen
- [ ] Fehler-Retry-Mechanismus
- [ ] Logging & Monitoring Dashboard
- [x] ~~Stimmen-Erkennung (wer spricht)~~ ❌ EINGESTELLT

### Eingestellt / On Hold
- [ ] ~~Echo-Geräte Sprachausgabe (Alexa TTS)~~ ❌ Vorerst eingestellt wegen technischer Komplexität

### Done
- [x] Basis-Skripte erstellt
- [x] Home Assistant Integration

---

## Echo-Geräte Mapping (❌ EINGESTELLT)

> **Hinweis:** Die Echo-Geräte Sprachausgabe wurde vorerst eingestellt.
> Die PWA-Variante über Browser-Spracherkennung bleibt aktiv.

| Raum | Event Entity | Notify Service | Status |
|------|------------|----------------|--------|
| Wohnzimmer | `event.wohnzimmer_wohnzimmer_echo_sprachereignis` | `notify.wohnzimmer_echo_durchsagen` | ❌ Paused |
| Arbeitszimmer | `event.arbeitzimmer_arbeitszimmer_sprachereignis` | `notify.arbeitszimmer_durchsagen` | ❌ Paused |
| Bad | `event.bad_bad_sprachereignis` | `notify.bad_durchsagen` | ❌ Paused |
| Lager | `event.lager_sprachereignis` | `notify.lager_durchsagen` | ❌ Paused |
| Schlafzimmer | `event.schlafzimmer_sprachereignis` | `notify.schlafzimmer_durchsagen` | ❌ Paused |
| Auto | `event.kontrollraum_mikes_echo_auto_sprachereignis` | `notify.mikes_echo_auto_durchsagen` | ❌ Paused |

---

## Solar-Entities (Auto-Discovery)

Geprüfte Entities in Reihenfolge:
1. `sensor.solar_aktuell`
2. `sensor.solar_power`
3. `sensor.pv_power`
4. `sensor.*solar*` (wildcard search)

---

## Letzte Änderung

- **07.07.2026:** Echo-Geräte Sprachausgabe vorerst eingestellt. PWA-Variante bleibt aktiv.
