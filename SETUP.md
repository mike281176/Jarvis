# J.A.R.V.I.S. Setup Dokumentation

## System-Übersicht

| Komponente | Port | Pfad |
|------------|------|------|
| API-Server | 8124 | `/home/mike/projects/jarvis/jarvis_api_server.py` |
| Proxy | 8645 | `/home/mike/projects/jarvis/jarvis_proxy.py` |
| ngrok Config | - | `~/.config/ngrok/ngrok.yml` |

## ngrok-Tunnel

```yaml
tunnels:
  jarvis-api:
    proto: http
    addr: 8124
    domain: nonconvergent-francene-toxically.ngrok-free.dev
```

## PWA Konfiguration

Die PWA läuft auf Vercel: **https://jarvis-app.quixx24.com**

### API-URL einstellen:
1. PWA im Browser öffnen
2. Login-Screen → unten links **"Einstellungen"** klicken
3. Bei **"API Präfix"** die ngrok-URL eintragen:
   ```
   https://nonconvergent-francene-toxically.ngrok-free.dev
   ```
4. **Speichern** und mit `Strg + F5` neu laden

### Erforderliche Entities:
- Solar: `sensor.jarvis_solar_aktuell`, `sensor.jarvis_solar_heute`
- Batterie: `sensor.gesamt_batterie_soc`
- Klima: `climate.split_klimaanlage`
- Temperaturen: `sensor.garten`, `sensor.pool_temperatur`, `sensor.wohnzimmer_echo_temperatur`, `sensor.arbeitszimmer_temperatur`
- Status: `binary_sensor.jarvis_status_*`

## Schnellstart

```bash
# Systeme starten
cd /home/mike/projects/jarvis
./start.sh

# Status prüfen
curl http://localhost:8124/health
curl https://nonconvergent-francene-toxically.ngrok-free.dev/api/jarvis/health
```

## API-Endpoints

| Endpoint | Methode | Beschreibung |
|----------|---------|--------------|
| `/health` | GET | Server Health Check |
| `/api/jarvis/ha-proxy/api/states/{entity}` | GET | Home Assistant Entity abrufen |
| `/api/jarvis/ha-proxy/api/services/{domain}/{service}` | POST | Home Assistant Service aufrufen |

## Troubleshooting

### PWA zeigt keine Daten:
1. Browser Console öffnen (F12)
2. Auf Fehler prüfen (404, 401, CORS)
3. API-URL in den Einstellungen prüfen
4. ngrok-Tunnel aktiv? → `curl https://nonconvergent-francene-toxically.ngrok-free.dev/health`

### ngrok verbindet nicht:
```bash
# ngrok neustarten
pkill -f "ngrok.*jarvis-api"
ngrok start --config ~/.config/ngrok/ngrok.yml jarvis-api

# Tunnel prüfen
curl http://127.0.0.1:4041/api/tunnels
```

### API-Server antwortet nicht:
```bash
# Server neustarten
pkill -f jarvis_api_server.py
python3 /home/mike/projects/jarvis/jarvis_api_server.py &

# Health Check
curl http://localhost:8124/health
```

## Version

- API-Server: v3.2
- PWA: v1.0.0
- Letztes Update: 2026-07-10
