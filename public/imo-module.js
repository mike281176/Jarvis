/**
 * J.A.R.V.I.S. IMO - Modul 1 & 2
 * Modul 1: Mietspiegel-Datenbank
 * Modul 2: Objekt-Speicherung
 */

class ImoModule {
    constructor(imoKalkulator) {
        this.imoKalkulator = imoKalkulator;
        this.mietspiegelData = null;
        this.objekte = this.loadObjekte();
        this.init();
    }
    
    async init() {
        // Mietspiegel-Daten laden
        await this.loadMietspiegel();
        
        // Event Listener setup
        this.setupEventListeners();
        
        // Initiale Mietspiegel-Prüfung
        this.checkMietspiegel();
    }
    
    // ==================== MODUL 1: MIETSPIEGEL ====================
    
    async loadMietspiegel() {
        try {
            const response = await fetch('mietspiegel.json');
            if (response.ok) {
                this.mietspiegelData = await response.json();
                console.log('✅ Mietspiegel-Daten geladen:', Object.keys(this.mietspiegelData.regions));
            }
        } catch (error) {
            console.warn('⚠️ Mietspiegel-Daten nicht geladen:', error);
        }
    }
    
    checkMietspiegel() {
        const plz = document.getElementById('imoPLZ')?.value || '';
        const stadtteil = document.getElementById('imoStadtteil')?.value || '';
        const flaeche = this.imoKalkulator.getValue('imoFlaeche');
        const kaltmiete = this.imoKalkulator.getValue('imoKaltmiete');
        
        const hintElement = document.getElementById('mietspiegelHint');
        if (!hintElement || !this.mietspiegelData) {
            if (hintElement) hintElement.style.display = 'none';
            return;
        }
        
        // Region finden (PLZ oder Stadtteil)
        let region = null;
        let regionKey = 'troisdorf'; // Default
        
        if (stadtteil && this.mietspiegelData.regions.troisdorf.stadtteile[stadtteil]) {
            region = this.mietspiegelData.regions.troisdorf.stadtteile[stadtteil];
            regionKey = 'troisdorf';
        } else if (plz.startsWith('53')) {
            region = this.mietspiegelData.regions.troisdorf;
            regionKey = 'troisdorf';
        } else if (plz.startsWith('50')) {
            region = this.mietspiegelData.regions.koeln;
            regionKey = 'koeln';
        } else if (plz.startsWith('531') || plz.startsWith('532')) {
            region = this.mietspiegelData.regions.bonn;
            regionKey = 'bonn';
        }
        
        if (!region) {
            hintElement.style.display = 'none';
            return;
        }
        
        // Mietspiegel anzeigen
        const ortsueblich = region.mieter_wohnung || region.mieter.gesamt.mittel;
        const empfohleneMiete = ortsueblich * flaeche;
        const eingabeMiete = kaltmiete;
        
        document.getElementById('mietspiegelMiete').textContent = ortsueblich.toFixed(2) + ' €/m²';
        document.getElementById('mietspiegelEmpfehlung').textContent = empfohleneMiete.toFixed(0) + ' €/Monat';
        
        // Warnung wenn Miete zu niedrig/hoch
        const warnungElement = document.getElementById('mietspiegelWarnung');
        const warnTextElement = document.getElementById('mietspiegelWarnText');
        
        if (eingabeMiete > 0) {
            const prozent = (eingabeMiete / empfohleneMiete) * 100;
            
            if (prozent < 80) {
                warnungElement.style.display = 'flex';
                warnTextElement.textContent = `Ihre Miete (${eingabeMiete} €) liegt unter 80% des Mietspiegels. Das ist unrealistisch niedrig!`;
                warnTextElement.style.color = 'var(--jarvis-red)';
            } else if (prozent > 120) {
                warnungElement.style.display = 'flex';
                warnTextElement.textContent = `Ihre Miete (${eingabeMiete} €) liegt über 120% des Mietspiegels. Das ist schwer vermietbar!`;
                warnTextElement.style.color = 'var(--jarvis-orange)';
            } else {
                warnungElement.style.display = 'none';
            }
        } else {
            warnungElement.style.display = 'none';
        }
        
        hintElement.style.display = 'block';
    }
    
    // ==================== MODUL 2: OBJEKT-SPEICHERUNG ====================
    
    loadObjekte() {
        const saved = localStorage.getItem('jarvis_imo_objekte');
        return saved ? JSON.parse(saved) : [];
    }
    
    saveObjekte() {
        localStorage.setItem('jarvis_imo_objekte', JSON.stringify(this.objekte));
    }
    
    getCurrentObjekt() {
        return {
            id: Date.now(),
            adresse: document.getElementById('imoAdresse')?.value || '',
            plz: document.getElementById('imoPLZ')?.value || '',
            stadtteil: document.getElementById('imoStadtteil')?.value || '',
            kaufpreis: this.imoKalkulator.getValue('imoKaufpreis'),
            flaeche: this.imoKalkulator.getValue('imoFlaeche'),
            zimmer: this.imoKalkulator.getValue('imoZimmer'),
            baujahr: this.imoKalkulator.getValue('imoBaujahr'),
            kaufdatum: document.getElementById('imoKaufdatum')?.value || '',
            kaltmiete: this.imoKalkulator.getValue('imoKaltmiete'),
            gesamtinvest: document.getElementById('imoGesamtinvest')?.textContent || '0 €',
            bruttorendite: document.getElementById('imoBruttorendite')?.textContent || '0 %',
            cashflow: document.getElementById('imoCashflow')?.textContent || '0 €',
            saved: new Date().toISOString()
        };
    }
    
    speichern() {
        const objekt = this.getCurrentObjekt();
        
        if (!objekt.adresse || !objekt.kaufpreis) {
            alert('❌ Bitte mindestens Adresse und Kaufpreis eingeben!');
            return;
        }
        
        // Prüfen ob bereits vorhanden (nach Adresse)
        const existingIndex = this.objekte.findIndex(o => o.adresse === objekt.adresse);
        
        if (existingIndex >= 0) {
            if (!confirm(`📁 Objekt "${objekt.adresse}" existiert bereits. Überschreiben?`)) {
                return;
            }
            this.objekte[existingIndex] = objekt;
        } else {
            this.objekte.push(objekt);
        }
        
        this.saveObjekte();
        alert(`✅ Objekt "${objekt.adresse}" gespeichert!`);
        this.zeigeObjektListe();
    }
    
    laden(objektId) {
        const objekt = this.objekte.find(o => o.id === objektId);
        if (!objekt) return;
        
        // Felder füllen
        const setIfExists = (id, value) => {
            const el = document.getElementById(id);
            if (el && value) {
                if (el.tagName === 'SELECT') {
                    el.value = value;
                } else {
                    el.value = value;
                }
            }
        };
        
        setIfExists('imoAdresse', objekt.adresse);
        setIfExists('imoPLZ', objekt.plz);
        setIfExists('imoStadtteil', objekt.stadtteil);
        setIfExists('imoKaufpreis', objekt.kaufpreis);
        setIfExists('imoFlaeche', objekt.flaeche);
        setIfExists('imoZimmer', objekt.zimmer);
        setIfExists('imoBaujahr', objekt.baujahr);
        setIfExists('imoKaufdatum', objekt.kaufdatum);
        setIfExists('imoKaltmiete', objekt.kaltmiete);
        
        // Berechnung neu ausführen
        this.imoKalkulator.calculate();
        
        // Liste schließen
        document.getElementById('imoObjektListe').style.display = 'none';
    }
    
    loeschen(objektId, event) {
        event.stopPropagation();
        
        const objekt = this.objekte.find(o => o.id === objektId);
        if (!objekt) return;
        
        if (!confirm(`🗑️ Objekt "${objekt.adresse}" wirklich löschen?`)) {
            return;
        }
        
        this.objekte = this.objekte.filter(o => o.id !== objektId);
        this.saveObjekte();
        this.zeigeObjektListe();
    }
    
    zeigeObjektListe() {
        const listeElement = document.getElementById('imoObjektListe');
        const contentElement = document.getElementById('imoObjektListeContent');
        
        if (this.objekte.length === 0) {
            contentElement.innerHTML = '<p style="color: var(--text-secondary); text-align: center; padding: 20px;">Keine Objekte gespeichert.</p>';
        } else {
            contentElement.innerHTML = this.objekte.map(objekt => `
                <div class="objekt-item" onclick="window.imoModule.laden(${objekt.id})">
                    <div class="objekt-item-info">
                        <div class="objekt-item-address">📍 ${objekt.adresse}</div>
                        <div class="objekt-item-meta">
                            ${objekt.flaeche} m² • ${objekt.zimmer} Zi. • Baujahr ${objekt.baujahr}<br>
                            💰 ${objekt.kaufpreis.toLocaleString('de-DE')} € • 
                            📈 ${objekt.bruttorendite} • 
                            💵 ${objekt.cashflow}
                        </div>
                    </div>
                    <div class="objekt-item-actions">
                        <button class="hud-button icon small" onclick="window.imoModule.loeschen(${objekt.id}, event)" title="Löschen">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14">
                                <polyline points="3 6 5 6 21 6"></polyline>
                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v6"></path>
                            </svg>
                        </button>
                    </div>
                </div>
            `).join('');
        }
        
        listeElement.style.display = 'block';
    }
    
    setupEventListeners() {
        // Speichern Button
        document.getElementById('imoObjektSpeichern')?.addEventListener('click', () => this.speichern());
        
        // Laden Button
        document.getElementById('imoObjektLaden')?.addEventListener('click', () => this.zeigeObjektListe());
        
        // Liste schließen
        document.getElementById('imoObjektListeSchliessen')?.addEventListener('click', () => {
            document.getElementById('imoObjektListe').style.display = 'none';
        });
        
        // Mietspiegel übernehmen
        document.getElementById('mietspiegelUebernehmen')?.addEventListener('click', () => {
            const empfehlung = document.getElementById('mietspiegelEmpfehlung').textContent;
            const miete = parseFloat(empfehlung.replace(/[^0-9.-]/g, ''));
            
            if (!isNaN(miete)) {
                const kaltmieteInput = document.getElementById('imoKaltmiete');
                if (kaltmieteInput) {
                    kaltmieteInput.value = Math.round(miete);
                    kaltmieteInput.dispatchEvent(new Event('input'));
                }
            }
        });
        
        // Mietspiegel-Check bei Eingabe
        ['imoPLZ', 'imoStadtteil', 'imoFlaeche', 'imoKaltmiete'].forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                el.addEventListener('input', () => this.checkMietspiegel());
                el.addEventListener('change', () => this.checkMietspiegel());
            }
        });
    }
}

// Globale Instanz verfügbar machen
window.ImoModule = ImoModule;
