# J.A.R.V.I.S. PWA - Lokales Deployment

## 🚀 Schnelleinstieg

### 1. Lokalen Server starten

```bash
cd /home/mike/projects/jarvis
./scripts/start-local.sh
```

Der Server startet auf **https://localhost:8125** (oder LAN: https://192.168.1.81:8125)

### 2. Browser öffnen

- **Lokal:** https://localhost:8125
- **LAN (vom Handy):** https://192.168.1.81:8125

⚠️ **Browser-Warnung:** Self-signed Zertifikat → "Erweitert" → "Trotzdem fortfahren"

### 3. Einloggen

- User: `mike` oder `tanja`
- Passwort: wie gewohnt

---

## 📊 VORTEILE LOKALE VERSION

| Feature | Lokal | Vercel |
|---------|-------|--------|
| **Latenz** | <10ms (LAN) | ~100-500ms |
| **HA Zugriff** | Direkt (kein Proxy) | Über Proxy |
| **Paperless** | Direkt | Über Proxy |
| **Proxmox** | Direkt | Über Proxy |
| **Offline** | ✅ Ja | ❌ Nein |
| **Datenschutz** | ✅ Alles lokal | ❌ Cloud |
| **Kosten** | ✅ Kostenlos | ⚠️ Vercel Limits |
| **Entwicklung** | ✅ Live-Reload | ❌ Build/Deploy |

---

## 🔧 KONFIGURATION

### Umgebungs-Erkennung

Die PWA erkennt automatisch:

- **Lokal:** `localhost`, `127.0.0.1`, `192.168.x.x`
  → Direkter API-Zugriff (kein Proxy)
  
- **Cloud:** Alle anderen Hostnames
  → Proxy-Modus (Vercel)

### API-Endpoints (Lokal)

| Service | URL |
|---------|-----|
| Home Assistant | http://192.168.1.91:8123/api |
| Paperless-ngx | http://192.168.1.159:8777/api |
| Proxmox VE | https://192.168.1.130:8006/api2 |
| J.A.R.V.I.S. API | http://192.168.1.81:8124/api/jarvis |

---

## 🔒 HTTPS ZERTIFIKAT

Beim ersten Start wird ein self-signed Zertifikat erstellt:

```
./certs/server.crt
./certs/server.key
```

**Gültigkeit:** 10 Jahre  
**CN:** jarvis.local  
**SANs:** localhost, 192.168.1.81, 0.0.0.0

### Zertifikat im Browser akzeptieren

1. **Chrome/Edge:** "Erweitert" → "Trotzdem fortfahren"
2. **Firefox:** "Erweitert" → "Risiko akzeptieren und fortfahren"
3. **Safari:** "Details" → "Diese Website besuchen"

### Zertifikat im LAN vertrauen (optional)

Auf allen Geräten im LAN:

```bash
# Zertifikat installieren
sudo cp /home/mike/projects/jarvis/certs/server.crt /usr/local/share/ca-certificates/
sudo update-ca-certificates
```

---

## 🛠️ PROBLEMLÖSUNG

### Server startet nicht

```bash
# Port prüfen
sudo netstat -tlnp | grep 8125

# Anderen Port verwenden
PORT=8126 ./scripts/start-local.sh
```

### Kamera-Bilder laden nicht

- **Lokal:** Direkter Zugriff, CORS nicht nötig
- **HA CORS prüfen:** `configuration.yml`:
  ```yaml
  http:
    cors_allowed_origins:
      - https://localhost:8125
      - https://192.168.1.81:8125
  ```

### PWA installiert sich nicht

- HTTPS erforderlich (Zertifikat akzeptieren)
- `manifest.json` muss erreichbar sein
- Service Worker muss registriert sein

---

## 📱 MOBILE NUTZUNG

### Vom Handy zugreifen

1. **WiFi:** Mit demselben Netzwerk verbinden
2. **Browser:** https://192.168.1.81:8125
3. **Zertifikat akzeptieren** (siehe oben)
4. **Zum Startbildschirm:** "Teilen" → "Zum Home-Bildschirm"

### IP-Adresse ändern

Falls Hermes auf anderer IP läuft:

```bash
# In api-config.js anpassen
local: {
    homeAssistant: 'http://NEUE.IP:8123/api',
    // ...
}
```

---

## 🔄 UPDATE

```bash
# Git pull
cd /home/mike/projects/jarvis
git pull origin development

# Server neu starten (STRG+C, dann neu starten)
./scripts/start-local.sh
```

---

## 🚀 PRODUCTION DEPLOY (Vercel)

Falls doch Vercel gewünscht:

```bash
# Vercel Login
vercel login

# Deploy to Production
vercel --prod
```

Oder im Vercel Dashboard auf "Deploy" klicken.

---

## 📞 SUPPORT

Bei Problemen:

1. Console öffnen (F12)
2. Fehlermeldungen prüfen
3. `console.log` Ausgaben lesen (Modus-Erkennung)

---

**Viel Erfolg mit J.A.R.V.I.S. lokal! 🚀**
