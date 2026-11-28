# UI-Polish-Audit J.A.R.V.I.S. PWA (07.08.2026)

Audit nach Skill `make-interfaces-feel-better`. Status: Befunde + Fixes (nur Entwicklung).

## ✅ BEREITS GUT

| Punkt | Befund |
|-------|--------|
| Font-Smoothing | `-webkit-font-smoothing: antialiased` vorhanden (styles.css:34) |
| Focus-State | `.hud-input:focus` mit outline + glow (styles.css:103) |
| Hover-States | 23 Hover-Definitionen mit konsistenter Glow-Ästhetik |
| Tabular-Nums (1) | `.phase-value` hat bereits `tabular-nums` (styles.css:502) |
| Radien-System | Konsistentes 4/6/8/10/12px-System, keine Ausreißer |

## ❌ BEFUNDE (nach Skill-Prinzipien)

### 1. KPI-Zahlen (IMO-Tool) fehlt `tabular-nums` ⭐ WICHTIGST
`.kpi-value` (styles.css:1767) – die großen €-Zahlen (Investition, Rate, Rendite) haben KEIN `font-variant-numeric: tabular-nums`. Bei Live-Updates "zittern" die Ziffern (Layout-Shift).
**Fix:** `font-variant-numeric: tabular-nums;` in `.kpi-value` + `.imo-kpi-card .kpi-value`.

### 2. `transition: all` (13×) – Anti-Pattern
`transition: all 0.3s ease` animiert ALLE Eigenschaften (auch invisible). Laut Skill: nur gezielt die animierten Properties (transform, opacity, border-color, box-shadow).
**Fix:** Bei den 13 Stellen auf gezielte Properties umstellen.

### 3. Kein `:focus-visible` – Tastatur-Nutzer sehen keinen Fokus
Nur `:focus` auf Inputs, keine `:focus-visible`-States für Buttons/User-Cards.
**Fix:** `:focus-visible` mit Glow-Outline für `.hud-button`, `.menu-item`, `.user-card`.

### 4. IMO-Zahlen via `toFixed(2)` ohne de-DE-Format
`imo-module.js:80-81` nutzt `toFixed(2)` → Punkt statt Komma (2.500.00 statt 2.500,00 €).
**Fix:** `toLocaleString('de-DE', {minimumFractionDigits: 2})`.

### 5. KPI-Hover: `translateY(-2px)` ohne Transition-Definition der Bewegung
`.imo-kpi-card` hat `transition: all 0.3s` – nach Fix #2 muss transform mit rein.

## 🛠 ANWENDUNG
- [x] Fix 1: tabular-nums für .kpi-value
- [x] Fix 2: transition: all → gezielt (13 Stellen ersetzt)
- [x] Fix 3: :focus-visible (7 Element-Typen)
- [x] Fix 4: de-DE-Format in imo-module.js
- [x] Fix 5: KPI-Hover via gezielte Transition (transform+box-shadow)

## GIT
- Branch: development (NUR hier!)
- Kein Push ohne Anweisung.
