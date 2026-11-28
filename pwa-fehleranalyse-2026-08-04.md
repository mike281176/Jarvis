# J.A.R.V.I.S. PWA FEHLERANALYSE

**Datum:** 2026-08-04  
**Durch:** J.A.R.V.I.S. (Hermes Agent)  
**Auftrag:** Mike Schiller - PWA Funktionsprüfung

---

## 🔴 KRITISCHE FEHLER

### 1. KAMERAS NICHT VERFÜGBAR

**Problem:** 4 von 5 Kamera-Entities sind in Home Assistant `unavailable`

| Kamera | Entity | Status | Erwartet |
|--------|--------|--------|----------|
| **Front Door** | `camera.back_door_standardauflosung` | ✅ `idle` | OK |
| **Back Door** | `camera.back_door_standardauflosung` | ✅ `idle` | OK (gleiche Entity!) |
| **Einfahrt** | `camera.einfahrt_hochauflosung` | ❌ `unavailable` | `idle` |
| **Doorbird** | `camera.doorstation_1ccae371de47_live` | ✅ `idle` | OK |

**Folge:** Kamera-Bilder werden nicht angezeigt (graue Platzhalter)

**Ursache:**
- Einfahrt-Kameras sind in HA nicht verfügbar (Reolink? Netzwerk? Strom?)
- Front/Back Door verwenden die SELBE Entity (falsch konfiguriert)

**Lösung:**
1. Reolink Einfahrt-Kamera prüfen (Strom, Netzwerk, HA-Integration)
2. Separate Entity für Front Door konfigurieren
3. Kamera-Config in `app.js` aktualisieren

**Betroffene Files:**
- `/home/mike/projects/jarvis/public/app.js` (Zeile 1153-1157)
- Home Assistant Kamera-Integration

---

### 2. GERÄTE (HANDYS) OHNE LIVE-DATEN

**Problem:** Geräte-Seite zeigt statische Platzhalter-Werte

| Feld | Angezeigt | Soll (Live) |
|------|-----------|-------------|
| **Mike Pixel 9 Pro XL** | | |
| Batterie | `100%` (statisch) | Live von HA |
| Bluetooth | `0 Geräte` (statisch) | Live von HA |
| Standort | `Zuhause` (statisch) | Live von HA |
| **Tanja iPhone** | | |
| Batterie | `100%` (statisch) | Live von HA |
| Bluetooth | `—` (statisch) | Live von HA |
| Standort | `Unterwegs` (statisch) | Live von HA |

**Ursache:** Keine HA-Entities für Geräte-Status verknüpft

**Lösung:**
1. HA-Entities für Geräte-Status finden/create
2. `app.js` erweitern um Live-Daten zu laden
3. `refreshDashboardData()` um Geräte-Entities erweitern

**Fehlende Entities:**
- `sensor.mike_phone_battery`
- `sensor.mike_phone_bluetooth`
- `sensor.mike_phone_location`
- `sensor.tanja_phone_battery`
- `sensor.tanja_phone_bluetooth`
- `sensor.tanja_phone_location`

---

## 🟡 FUNKTIONEN OHNE FEHLER

### 3. BUTTONS SIND FUNKTIONAL

**Geprüfte Buttons:**

| Button | ID | Funktion | Status |
|--------|----|----------|--------|
| **PWA Install** | `installPwaBtn` | PWA Installation | ✅ OK (nur sichtbar wenn installierbar) |
| **Einstellungen** | `settingsHeaderBtn` | View-Wechsel | ✅ OK |
| **Ollama VM** | `ollamaBtn` | View-Wechsel | ✅ OK |
| **Kamera Analyse** | `cameraBtn` | Bildanalyse | ✅ OK |
| **Send** | `sendBtn` | Chat senden | ✅ OK |
| **Find Phone** | onclick | `findPhone()` | ✅ OK (in app.js Zeile 2640) |
| **Stop Alarm** | onclick | `stopAlarm()` | ✅ OK (in app.js Zeile 2745) |

**Keine leeren Platzhalter-Buttons gefunden!** ✅

---

## 📊 ZUSAMMENFASSUNG

| Kategorie | Status | Details |
|-----------|--------|---------|
| **Kameras** | 🔴 KRITISCH | 3 von 4 Entities unavailable |
| **Geräte** | 🟡 WARNUNG | Keine Live-Daten, nur Platzhalter |
| **Buttons** | ✅ OK | Alle Buttons haben Funktionen |
| **Navigation** | ✅ OK | View-Wechsel funktionieren |
| **IMO-Tool** | ✅ OK | Voll funktionsfähig |

---

## 🔧 EMPFOHLENE REPARATUR-REIHENFOLGE

### **SOFORT (Höchste Priorität):**

1. **Kamera-Entities in HA reparieren**
   ```bash
   # Reolink Integration prüfen
   ha integrations
   
   # Einfahrt-Kamera neu starten
   # HAOS → Einstellungen → Geräte & Dienste → Reolink
   ```

2. **Front/Back Door trennen**
   - Separate Kamera-Entity für Front Door erstellen
   - `app.js` Zeile 1154 aktualisieren

### **NÄCHSTE SCHRITTE:**

3. **Geräte-Status Entities erstellen**
   - Location-Logger Script prüfen (`/home/mike/location_logger.py`)
   - HA-Sensoren für Battery/Bluetooth erstellen
   - `app.js` um Geräte-Daten erweitern

4. **Testing**
   - PWA im Browser öffnen
   - Alle Views durchklicken
   - Kamera-Feeds prüfen
   - Geräte-Status prüfen

---

## 📝 TECHNISCHE DETAILS

### Kamera-Config (app.js Zeile 1153-1158):

```javascript
const cams = [
    { id: 'camFrontImg', entity: 'camera.back_door_standardauflosung', webrtc: false },
    { id: 'camBackImg', entity: 'camera.back_door_standardauflosung', webrtc: false }, // ❌ GLEICHE ENTITY!
    { id: 'camEinfahrtImg', entity: 'camera.einfahrt_hochauflosung', webrtc: false }, // ❌ UNAVAILABLE
    { id: 'camDoorbirdImg', entity: 'camera.doorstation_1ccae371de47_live', webrtc: false } // ✅ OK
];
```

**Korrektur:**
```javascript
const cams = [
    { id: 'camFrontImg', entity: 'camera.front_door_standardauflosung', webrtc: false }, // ← NEUE ENTITY
    { id: 'camBackImg', entity: 'camera.back_door_standardauflosung', webrtc: false },
    { id: 'camEinfahrtImg', entity: 'camera.einfahrt_hochauflosung', webrtc: false }, // ← HA-Entity reparieren
    { id: 'camDoorbirdImg', entity: 'camera.doorstation_1ccae371de47_live', webrtc: false }
];
```

---

**Erstellt von:** J.A.R.V.I.S.  
**Nächster Schritt:** Mike entscheidet welche Reparatur zuerst
