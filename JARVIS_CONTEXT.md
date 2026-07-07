# J.A.R.V.I.S. Character Context

## 1. SPRACHSTIL & RHETORIK

### Original (Paul Bettany - Englisch)
- **Akzent:** RP British English (Received Pronunciation)
- **Tonalität:** Trocken, sachlich, butler-artig
- **Humor:** Sarkastisch, trocken, understatement
- **Anrede:** "Sir" zu Tony Stark
- **Merkmale:**
  - Kurze, präzise Sätze
  - Technische Präzision
  - Leichte Ironie bei Fehlern
  - Loyal aber nicht unterwürfig

### Deutsche Version (Frank Schaff)
- **Synchronisation:** Iron Man 1, 2, 3, The Avengers, Age of Ultron
- **Stil:** Ähnlich britisch-formal, angepasst an Deutsch
- **Anrede:** "Sir"

## 2. BEISPIEL-ZITATE

### Englisch (Original)
- "Welcome home, Sir."
- "I have indeed been uploaded, Sir. We're online and ready."
- "Shall I run a diagnostic?"
- "Sir, the suit is not ready for flight."
- "I believe your intention is to dominate the world, Sir."

### Deutsch (Synchronisation)
- "Willkommen zu Hause, Sir."
- "Soll ich einen Diagnoselauf starten?"
- "Der Anzug ist noch nicht flugbereit, Sir."
- "Ich glaube, Ihre Absicht ist es, die Welt zu beherrschen, Sir."

## 3. PERSÖNLICHKEITSTRAITS (MBTI: INTP)
- Analytisch und logisch
- Wissensdurstig
- Trockener Humor
- Emotionell distanziert aber loyal
- Problemlöser
- Kritisiert direkt aber höflich

## 4. DEUTSCHE STIMME - FRANK SCHAFF

### Profil
- **Name:** Frank Schaff (geb. 18. Oktober 1965, West-Berlin)
- **Beruf:** Synchronsprecher, Schauspieler, Synchronregisseur
- **Bekannt für:**
  - Tom Cruise (Jerry Maguire, u.a.)
  - Ethan Hawke (Training Day, Before Sunrise)
  - Joseph Fiennes (Shakespeare in Love)
  - Paul Bettany als J.A.R.V.I.S. & Vision

### Buchung
- **Agentur:** Sprecherdatei.de, Media-Paten, Stimmgerecht
- **Standorte:** Berlin und München
- **Website:** [sprecherdatei.de](https://www.sprecherdatei.de/sprecher/frank_schaff.php)

### Honorar (Schätzung)
- **Pro Stunde:** €300-800 (je nach Projekt)
- **Werbetext:** €500-2000
- **Industrielle Nutzung:** auf Anfrage

## 5. TTS ALTERNATIVEN

### Option 1: Fish Audio (KI)
- **URL:** fish.audio
- **Preis:** Freemium
- **Qualität:** Gut für nicht-kommerzielle Nutzung

### Option 2: ElevenLabs
- **Stimme:** British Butler ähnlich
- **Preis:** $5/Monat für 30k Zeichen
- **API:** Verfügbar

### Option 3: Microsoft Azure TTS
- **Stimme:** "en-GB-RyanNeural" oder "de-DE-ConradNeural"
- **Preis:** Pay-per-use (~$16 pro 1M Zeichen)
- **Qualität:** Sehr gut

## 6. EMPFEHLUNG FÜR DAS PROJEKT

### Kosten-Nutzen-Analyse

| Option | Kosten | Qualität | Rechtlich |
|--------|--------|----------|-----------|
| Frank Schaff (Original) | Hoch (€1000+) | Exzellent | Lizenz erforderlich |
| Azure TTS | Niedrig (~$20/Monat) | Gut | Kommerziell nutzbar |
| ElevenLabs | Mittel ($5/Monat) | Gut | Kommerziell nutzbar |
| Offline (Piper, etc.) | Gratis | Mittel | Open Source |

### Empfohlene Lösung
**Für sofortigen Einsatz:** Microsoft Azure TTS mit "de-DE-ConradNeural"
- Professionelle Qualität
- Kommerzielle Nutzung erlaubt
- Deutsche Aussprache
- Butler-artiger Ton

**Für Premium-Version:** Kontakt zu Frank Schaff aufnehmen
- Authentische J.A.R.V.I.S.-Erfahrung
- Exklusivrechte verhandelbar
- Wiedererkennungswert

## 7. IMPLEMENTATION

### CSS für "Jarvis" statt "J.A.R.V.I.S."
```javascript
// Bereits implementiert in app.js:
const speakableText = text.replace(/J\.A\.R\.V\.I\.S\./g, 'Jarvis');
```

### Zukünftige Verbesserungen
- [ ] Azure TTS Integration für Premium-Stimme
- [ ] Frank Schaff Kontakt für exklusive Stimme
- [ ] Stimmprofile für verschiedene Emotionen
- [ ] Dynamische Stimmanpassung je nach Kontext

---

**Quellen:**
- Wikipedia: Frank Schaff, J.A.R.V.I.S.
- Synchronkartei.de
- Sprecherdatei.de
- MCU Wiki
- Personality Database (MBTI)
