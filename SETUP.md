# J.A.R.V.I.S. Setup Dokumentation

**Dokumentation erstellt:** 12.07.2026  
**Letzte Aktualisierung:** 12.07.2026 12:21 UTC  
**Version:** 2.2 (Production / Option B)

## System-Übersicht

| Komponente | Port | Pfad |
|------------|------|------|
| API-Server | 8124 | `/home/mike/projects/jarvis/jarvis_api_server.py` |
| Proxy | 8645 | `/home/mike/projects/jarvis/jarvis_proxy.py` |
| Startup-Skript | - | `/home/mike/projects/jarvis/start_jarvis.sh` |
| ngrok Config | - | `~/.config/ngrok/ngrok.yml` |
| Vercel Routing | - | `/home/mike/projects/jarvis/vercel.json` |

## Architektur PWA → API

```
┌────────────────────────────┐        ┌────────────────────────────┐        ┌─────────────────┐
│  PWA auf Vercel            │        │  ngrok (feste Domain)      │        │  jarvis_api_    │
│  jarvis-app.quixx24.com    │───────▶│  nonconvergent-...         │───────▶│  server.py      │
│  /api/jarvis/*             │        │  HTTPS → localhost:8124    │        │  Port 8124      │
└────────────────────────────┘        └────────────────────────────┘        └─────────────────┘
```

## ngrok-Tunnel (feste Domain)

```yaml
tunnels:
  jarvis-api-direct:
    proto: http
    addr: 8124
    domain: nonconvergent-francene-toxically.ngrok-free.dev
  jarvis-pwa:
    proto: http
    addr: 8645
```

## Automatisches Starten

```bash
# API-Server und ngrok mit fester Domain starten
/home/mike/projects/jarvis/start_jarvis.sh

# Logs ansehen
tail -f /home/mike/projects/jarvis/logs/start_jarvis_$(date +%Y%m%d).log
tail -f /home/mike/projects/jarvis/logs/ngrok.log
tail -f /home/mike/projects/jarvis/logs/api_server.log
```

## Manuelle Statusprüfung

```bash
# Lokale API
curl http://localhost:8124/health

# Öffentliche API (feste Domain)
curl -H "ngrok-skip-browser-warning: true" https://nonconvergent-francene-toxically.ngrok-free.dev/health

# ngrok Tunnel-Status
curl -s http://127.0.0.1:4041/api/tunnels | python3 -m json.tool
```

## Vercel-Konfiguration

`vercel.json` rewrites `/api/jarvis/:path*` zu:
```
https://nonconvergent-francene-toxically.ngrok-free.dev/:path*
```

## PWA Konfiguration

Die PWA nutzt per Default relative Pfade (`apiUrl = ''`), damit Vercels Rewrite greift.

Falls nötig, kann im Login-Bildschirm unter **Einstellungen** manuell eingetragen werden:
```
https://nonconvergent-francene-toxically.ngrok-free.dev
```

## Troubleshooting

### Feste Domain reagiert nicht
1. Prüfen, ob `start_jarvis.sh` ausgeführt wurde.
2. ngrok-Log prüfen: `tail -f /home/mike/projects/jarvis/logs/ngrok.log`
3. Tunnel-Status prüfen: `curl http://127.0.0.1:4041/api/tunnels`
4. Port 8124 belegt? Script beendet alte Prozesse automatisch. Falls nicht: `pkill -9 -f jarvis_api_server.py && pkill -9 ngrok`

### PWA zeigt weiterhin keine Daten
1. Chrome DevTools öffnen → Network Tab → Fehler prüfen
2. Service Worker und Cache leeren (siehe separate Anleitung)
3. Domain im PWA-Einstellungsfeld kontrollieren (sollte leer sein, damit Vercel-Rewrite funktioniert)

---

**Version:** API-Server v3.2, PWA v1.0.0  
**Autor:** J.A.R.V.I.S. / Hermes Agent  
**Status:** Option B aktiv (feste ngrok-Domain)
