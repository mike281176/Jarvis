/**
 * J.A.R.V.I.S. IMO - SCHULDENUHR
 * Nach Vorbild der deutschen Steuerzahler-Schuldenuhr
 * 2 Varianten: IST-Zustand und MIT zukünftigen Immobilien
 */

class ImoSchuldenuhr {
    constructor() {
        this.data = {
            // Moselstraße 46
            mosel: {
                kaufpreis: 0,
                nebenkosten: 0,
                gesamt: 0,
                wertAktuell: 0,
                restschuld: 0
            },
            // Konten
            kontoTanja: 0,
            kontoMike: 0,
            // Schulden
            ratenkredite: 0,
            dispo: 0,
            sonstige: 0,
            // Geplante Immobilien
            geplanteImmobilien: []
        };
        
        this.init();
    }
    
    init() {
        // Tabs initialisieren
        document.querySelectorAll('.schuldenuhr-tab').forEach(tab => {
            tab.addEventListener('click', (e) => this.switchVariant(e.currentTarget.dataset.variant));
        });
        
        // Editierbare Felder mit Event-Listenern
        this.initEditableFields();
        
        // Buttons
        const speichernBtn = document.getElementById('suDatenSpeichern');
        if (speichernBtn) {
            speichernBtn.addEventListener('click', () => this.speichern());
        }
        
        const zuruecksetzenBtn = document.getElementById('suDatenZuruecksetzen');
        if (zuruecksetzenBtn) {
            zuruecksetzenBtn.addEventListener('click', () => this.zuruecksetzen());
        }
        
        // Daten laden
        this.laden();
        
        // Automatische Berechnung
        this.berechnen();
    }
    
    /**
     * Zwischen Variante 1 (IST) und Variante 2 (ZUKUNFT) wechseln
     */
    switchVariant(variant) {
        // Tabs aktualisieren
        document.querySelectorAll('.schuldenuhr-tab').forEach(tab => {
            tab.classList.remove('active');
            if (tab.dataset.variant === variant) {
                tab.classList.add('active');
            }
        });
        
        // Views umschalten
        document.querySelectorAll('.schuldenuhr-variant').forEach(view => {
            view.classList.remove('active');
            view.style.display = 'none';
        });
        
        const activeView = document.getElementById(`schuldenuhr-${variant}`);
        if (activeView) {
            activeView.classList.add('active');
            activeView.style.display = 'block';
        }
        
        // Berechnung aktualisieren
        this.berechnen();
    }
    
    /**
     * Editierbare Felder initialisieren
     */
    initEditableFields() {
        const editableIds = [
            'suKontoTanja', 'suKontoMike', 'suRatenkredite', 'suDispo', 'suSonstige',
            'suMoselKaufpreis', 'suMoselNebenkosten'
        ];
        
        editableIds.forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                el.addEventListener('input', () => {
                    this.parseAndCalculate(id);
                });
                el.addEventListener('blur', () => {
                    this.speichern();
                });
            }
        });
    }
    
    /**
     * Wert parsen und neu berechnen
     */
    parseAndCalculate(fieldId) {
        const el = document.getElementById(fieldId);
        if (!el) return;
        
        const value = this.parseCurrency(el.textContent);
        
        // Daten-Objekt aktualisieren
        switch(fieldId) {
            case 'suKontoTanja': this.data.kontoTanja = value; break;
            case 'suKontoMike': this.data.kontoMike = value; break;
            case 'suRatenkredite': this.data.ratenkredite = value; break;
            case 'suDispo': this.data.dispo = value; break;
            case 'suSonstige': this.data.sonstige = value; break;
            case 'suMoselKaufpreis': this.data.mosel.kaufpreis = value; break;
            case 'suMoselNebenkosten': this.data.mosel.nebenkosten = value; break;
        }
        
        this.berechnen();
    }
    
    /**
     * Hauptberechnung
     */
    berechnen() {
        // Moselstraße Gesamt
        this.data.mosel.gesamt = this.data.mosel.kaufpreis + this.data.mosel.nebenkosten;
        
        // === VARIANT 1: IST ===
        const aktivaIst = this.data.mosel.wertAktuell + this.data.kontoTanja + this.data.kontoMike;
        const passivaIst = this.data.mosel.restschuld + this.data.ratenkredite + this.data.dispo + this.data.sonstige;
        const nettoIst = aktivaIst - passivaIst;
        
        // Anzeige Variante 1
        this.setCurrency('suGesamtschuldenIst', passivaIst);
        this.setCurrency('suMoselWert', this.data.mosel.wertAktuell);
        this.setCurrency('suKontoTanja', this.data.kontoTanja);
        this.setCurrency('suKontoMike', this.data.kontoMike);
        this.setCurrency('suHypothekMosel', this.data.mosel.restschuld);
        this.setCurrency('suRatenkredite', this.data.ratenkredite);
        this.setCurrency('suDispo', this.data.dispo);
        this.setCurrency('suSonstige', this.data.sonstige);
        this.setCurrency('suSummeAktivaIst', aktivaIst);
        this.setCurrency('suSummePassivaIst', passivaIst);
        this.setCurrency('suNettovermoegenIst', nettoIst);
        
        // Mosel Details
        this.setCurrency('suMoselKaufpreis', this.data.mosel.kaufpreis);
        this.setCurrency('suMoselNebenkosten', this.data.mosel.nebenkosten);
        this.setCurrency('suMoselGesamt', this.data.mosel.gesamt);
        this.setCurrency('suMoselWertAktuell', this.data.mosel.wertAktuell);
        this.setCurrency('suMoselRestschuld', this.data.mosel.restschuld);
        
        const ekQuoteMosel = this.data.mosel.gesamt > 0 
            ? ((this.data.mosel.gesamt - this.data.mosel.restschuld) / this.data.mosel.gesamt) * 100 
            : 0;
        document.getElementById('suMoselEKQuote').textContent = ekQuoteMosel.toFixed(1) + ' %';
        
        // Stand aktualisieren
        const jetzt = new Date();
        const standString = jetzt.toLocaleDateString('de-DE', { 
            day: '2-digit', month: '2-digit', year: 'numeric',
            hour: '2-digit', minute: '2-digit'
        });
        document.getElementById('suStandIst').textContent = standString;
        
        // Farbe für Nettovermögen
        this.setColor('suNettovermoegenIst', nettoIst);
        
        // === VARIANT 2: ZUKUNFT ===
        // Geplante Immobilien aus Cockpit laden
        const geplanteImmobilien = this.loadGeplanteImmobilien();
        const gesamtWertZukunft = geplanteImmobilien.reduce((sum, immo) => sum + immo.gesamtinvest, 0);
        const finanzierungZukunft = gesamtWertZukunft * 0.7; // 70% FK angenommen
        
        const aktivaZ = aktivaIst + gesamtWertZukunft;
        const passivaZ = passivaIst + finanzierungZukunft;
        const nettoZ = aktivaZ - passivaZ;
        
        // Anzeige Variante 2
        this.setCurrency('suGesamtschuldenZukunft', passivaZ);
        this.setCurrency('suMoselWertZ', this.data.mosel.wertAktuell);
        this.setCurrency('suKontoTanjaZ', this.data.kontoTanja);
        this.setCurrency('suKontoMikeZ', this.data.kontoMike);
        this.setCurrency('suHypothekMoselZ', this.data.mosel.restschuld);
        this.setCurrency('suRatenkrediteZ', this.data.ratenkredite);
        this.setCurrency('suDispoZ', this.data.dispo);
        this.setCurrency('suSonstigeZ', this.data.sonstige);
        this.setCurrency('suZukunftImmobilien', gesamtWertZukunft);
        this.setCurrency('suZukunftFinanzierung', finanzierungZukunft);
        this.setCurrency('suSummeAktivaZ', aktivaZ);
        this.setCurrency('suSummePassivaZ', passivaZ);
        this.setCurrency('suNettovermoegenZ', nettoZ);
        document.getElementById('suStandZukunft').textContent = standString;
        
        // Farbe für Nettovermögen Zukunft
        this.setColor('suNettovermoegenZ', nettoZ);
        
        // Geplante Immobilien anzeigen
        this.updateGeplanteImmobilien(geplanteImmobilien);
        
        // === VERGLEICH ===
        this.setCurrency('suVglSchuldenIst', passivaIst);
        this.setCurrency('suVglSchuldenZ', passivaZ);
        this.setCurrency('suVglSchuldenDelta', passivaZ - passivaIst);
        this.setDeltaColor('suVglSchuldenDelta', passivaZ - passivaIst, true);
        
        this.setCurrency('suVglAktivaIst', aktivaIst);
        this.setCurrency('suVglAktivaZ', aktivaZ);
        this.setCurrency('suVglAktivaDelta', aktivaZ - aktivaIst);
        this.setDeltaColor('suVglAktivaDelta', aktivaZ - aktivaIst, false);
        
        this.setCurrency('suVglNettoIst', nettoIst);
        this.setCurrency('suVglNettoZ', nettoZ);
        this.setCurrency('suVglNettoDelta', nettoZ - nettoIst);
        this.setDeltaColor('suVglNettoDelta', nettoZ - nettoIst, false);
    }
    
    /**
     * Geplante Immobilien aus Cockpit laden
     */
    loadGeplanteImmobilien() {
        try {
            const gespeicherteObjekte = localStorage.getItem('jarvis_imo_objekte');
            if (!gespeicherteObjekte) return [];
            
            const objekte = JSON.parse(gespeicherteObjekte);
            return objekte.filter(obj => obj.gesamtinvest > 0);
        } catch (e) {
            return [];
        }
    }
    
    /**
     * Geplante Immobilien in der UI anzeigen
     */
    updateGeplanteImmobilien(immobilien) {
        const container = document.getElementById('suGeplanteImmobilien');
        if (!container) return;
        
        if (immobilien.length === 0) {
            container.innerHTML = `
                <p class="schuldenuhr-hint">
                    Keine geplanten Immobilien eingetragen. 
                    <br>Nutzen Sie das <strong>Cockpit</strong> um neue Objekte zu analysieren und zu speichern.
                </p>
            `;
            return;
        }
        
        let html = '<div class="geplante-liste">';
        immobilien.forEach((immobilie, index) => {
            html += `
                <div class="geplante-item">
                    <div class="geplante-header">
                        <strong>${index + 1}. ${immobilie.adresse || 'Objekt ' + (index + 1)}</strong>
                        <span class="geplante-kaufpreis">${this.formatCurrency(immobilie.gesamtinvest)}</span>
                    </div>
                    <div class="geplante-details">
                        <span> ${immobilie.flaeche || 0} m²</span>
                        <span>🏠 ${immobilie.zimmer || 0} Zimmer</span>
                        <span>💰 Kaufpreis: ${this.formatCurrency(immobilie.kaufpreis)}</span>
                    </div>
                </div>
            `;
        });
        html += '</div>';
        
        container.innerHTML = html;
    }
    
    /**
     * Daten speichern
     */
    speichern() {
        localStorage.setItem('jarvis_schuldenuhr', JSON.stringify(this.data));
        
        // Visuelles Feedback
        const btn = document.getElementById('suDatenSpeichern');
        if (btn) {
            const originalText = btn.textContent;
            btn.textContent = '✅ Gespeichert!';
            setTimeout(() => {
                btn.textContent = originalText;
            }, 2000);
        }
    }
    
    /**
     * Daten laden
     */
    laden() {
        try {
            const gespeicherteDaten = localStorage.getItem('jarvis_schuldenuhr');
            if (gespeicherteDaten) {
                const geladeneDaten = JSON.parse(gespeicherteDaten);
                this.data = { ...this.data, ...geladeneDaten };
                
                // Felder aktualisieren
                this.updateFields();
            }
        } catch (e) {
            console.error('Fehler beim Laden der Schuldenuhr-Daten:', e);
        }
    }
    
    /**
     * Felder mit gespeicherten Werten füllen
     */
    updateFields() {
        this.setCurrency('suKontoTanja', this.data.kontoTanja);
        this.setCurrency('suKontoMike', this.data.kontoMike);
        this.setCurrency('suRatenkredite', this.data.ratenkredite);
        this.setCurrency('suDispo', this.data.dispo);
        this.setCurrency('suSonstige', this.data.sonstige);
        this.setCurrency('suMoselKaufpreis', this.data.mosel.kaufpreis);
        this.setCurrency('suMoselNebenkosten', this.data.mosel.nebenkosten);
        this.setCurrency('suMoselWertAktuell', this.data.mosel.wertAktuell);
        this.setCurrency('suMoselRestschuld', this.data.mosel.restschuld);
    }
    
    /**
     * Auf Standard zurücksetzen
     */
    zuruecksetzen() {
        if (confirm('Möchten Sie wirklich alle eingegebenen Werte auf 0 setzen?')) {
            this.data = {
                mosel: { kaufpreis: 0, nebenkosten: 0, gesamt: 0, wertAktuell: 0, restschuld: 0 },
                kontoTanja: 0,
                kontoMike: 0,
                ratenkredite: 0,
                dispo: 0,
                sonstige: 0,
                geplanteImmobilien: []
            };
            this.updateFields();
            this.berechnen();
            this.speichern();
        }
    }
    
    /**
     * Währung formatieren
     */
    setCurrency(elementId, value) {
        const el = document.getElementById(elementId);
        if (el) {
            el.textContent = this.formatCurrency(value);
        }
    }
    
    /**
     * Farbe setzen (grün/rot)
     */
    setColor(elementId, value) {
        const el = document.getElementById(elementId);
        if (el) {
            if (value >= 0) {
                el.style.color = 'var(--jarvis-green)';
                el.style.textShadow = 'var(--glow-green)';
            } else {
                el.style.color = 'var(--jarvis-red)';
                el.style.textShadow = 'var(--glow-red)';
            }
        }
    }
    
    /**
     * Delta-Farbe setzen (Schulden rot wenn steigend, Aktiva/Netto grün wenn steigend)
     */
    setDeltaColor(elementId, delta, invert = false) {
        const el = document.getElementById(elementId);
        if (!el) return;
        
        let isPositive = delta >= 0;
        if (invert) isPositive = !isPositive; // Bei Schulden: positiv = schlecht
        
        if (isPositive) {
            el.style.color = 'var(--jarvis-green)';
            el.textContent = '+' + this.formatCurrency(delta);
        } else {
            el.style.color = 'var(--jarvis-red)';
            el.textContent = this.formatCurrency(delta);
        }
    }
    
    /**
     * Zahl formatieren
     */
    formatCurrency(value) {
        return new Intl.NumberFormat('de-DE', {
            style: 'currency',
            currency: 'EUR',
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        }).format(value);
    }
    
    /**
     * Currency-String parsen
     */
    parseCurrency(str) {
        if (!str) return 0;
        // Entferne € Symbol, Leerzeichen, Punkte (Tausender), ersetze Komma durch Punkt
        const cleaned = str.replace(/[€\s.]/g, '').replace(',', '.');
        const value = parseFloat(cleaned);
        return isNaN(value) ? 0 : value;
    }
}

// Auto-init wenn DOM geladen
document.addEventListener('DOMContentLoaded', () => {
    if (!window.imoSchuldenuhr) {
        window.imoSchuldenuhr = new ImoSchuldenuhr();
    }
});
