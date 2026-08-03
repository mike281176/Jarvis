/**
 * J.A.R.V.I.S. IMO - SUB-VIEWS LOGIK
 * Bankgespräch, Diagramme, Verlauf, Haushalt, Vermögen
 */

class ImoSubViews {
    constructor(imoKalkulator) {
        this.imoKalkulator = imoKalkulator;
        this.init();
    }
    
    init() {
        // Sub-Navigation Listener
        document.querySelectorAll('.imo-subnav-btn').forEach(btn => {
            btn.addEventListener('click', (e) => this.switchSubview(e.target.dataset.subview));
        });
        
        // Bankgespräch Export
        const bgExportBtn = document.getElementById('bgExportPdf');
        if (bgExportBtn) {
            bgExportBtn.addEventListener('click', () => this.exportBankgesprächPdf());
        }
        
        // Verlauf Jahre Wechsel
        const verlaufSelect = document.getElementById('verlaufJahre');
        if (verlaufSelect) {
            verlaufSelect.addEventListener('change', () => this.updateVerlauf());
        }
        
        // Haushalt Inputs
        this.initHaushaltInputs();
        
        // Vermögen Inputs
        this.initVermoegenInputs();
    }
    
    /**
     * Sub-View wechseln
     */
    switchSubview(subviewName) {
        // Buttons aktualisieren
        document.querySelectorAll('.imo-subnav-btn').forEach(btn => {
            btn.classList.remove('active');
            if (btn.dataset.subview === subviewName) {
                btn.classList.add('active');
            }
        });
        
        // Views umschalten
        document.querySelectorAll('.imo-subview').forEach(view => {
            view.classList.remove('active');
            view.style.display = 'none';
        });
        
        const activeView = document.getElementById(`imo-subview-${subviewName}`);
        if (activeView) {
            activeView.classList.add('active');
            activeView.style.display = 'block';
            
            // View-spezifische Updates
            if (subviewName === 'bankgespräch') {
                this.updateBankgespräch();
            } else if (subviewName === 'diagramme') {
                this.updateDiagramme();
            } else if (subviewName === 'verlauf') {
                this.updateVerlauf();
            } else if (subviewName === 'haushalt') {
                this.updateHaushalt();
            } else if (subviewName === 'vermoegen') {
                this.updateVermoegen();
            }
        }
        
        // Scroll nach oben
        document.querySelector('.imo-container').scrollTop = 0;
    }
    
    /**
     * Bankgespräch aktualisieren
     */
    updateBankgespräch() {
        const data = this.imoKalkulator.getState();
        if (!data) return;
        
        // Objekt-Daten
        document.getElementById('bgAdresse').textContent = data.imoadresse || '-';
        document.getElementById('bgFlaeche').textContent = `${data.imoflaeche || 0} m²`;
        document.getElementById('bgZimmer').textContent = data.imozimmer || 0;
        document.getElementById('bgBaujahr').textContent = data.imobaujahr || '-';
        
        // Finanzierung
        document.getElementById('bgGesamtinvest').textContent = this.formatCurrency(data.gesamtinvest);
        document.getElementById('bgEigenkapital').textContent = this.formatCurrency(data.eigenkapital);
        document.getElementById('bgFinanzierung').textContent = this.formatCurrency(data.finanzierung);
        document.getElementById('bgEKQuote').textContent = data.gesamtinvest > 0 ? ((data.eigenkapital / data.gesamtinvest) * 100).toFixed(1) + ' %' : '0 %';
        
        // Rendite
        document.getElementById('bgBruttorendite').textContent = (data.bruttorendite || 0).toFixed(2) + ' %';
        document.getElementById('bgNettorendite').textContent = (data.nettorendite || 0).toFixed(2) + ' %';
        document.getElementById('bgCashflow').textContent = (data.cashflowOperativMonat || 0).toFixed(2) + ' €/Monat';
        document.getElementById('bgCashflowSteuern').textContent = (data.cashflowNachSteuernMonat || 0).toFixed(2) + ' €/Monat';
        
        // Cashflow Tabelle
        document.getElementById('bgEinnahmenMiete').textContent = this.formatCurrency(data.kaltmiete);
        document.getElementById('bgEinnahmenNK').textContent = this.formatCurrency(data.nebekosten);
        document.getElementById('bgEinnahmenHausgeld').textContent = this.formatCurrency(data.hausgeldUmlagefaehig);
        document.getElementById('bgAusgabenRate').textContent = this.formatCurrency(data.rateMonat);
        document.getElementById('bgAusgabenHausgeld').textContent = this.formatCurrency(data.hausgeldGesamt - data.hausgeldUmlagefaehig);
        document.getElementById('bgAusgabenInstandhaltung').textContent = this.formatCurrency(data.eigeneInstandhaltung);
        document.getElementById('bgAusgabenMietausfall').textContent = this.formatCurrency(data.mietausfall);
        
        const summeEinnahmen = data.kaltmiete + data.nebekosten + data.hausgeldUmlagefaehig;
        const summeAusgaben = data.rateMonat + (data.hausgeldGesamt - data.hausgeldUmlagefaehig) + data.eigeneInstandhaltung + data.mietausfall;
        
        document.getElementById('bgSummeEinnahmen').textContent = this.formatCurrency(summeEinnahmen);
        document.getElementById('bgSummeAusgaben').textContent = this.formatCurrency(summeAusgaben);
        document.getElementById('bgCashflowOperativ').textContent = this.formatCurrency(summeEinnahmen - summeAusgaben);
        
        // Farbe setzen
        const cashflowEl = document.getElementById('bgCashflowOperativ');
        if (summeEinnahmen - summeAusgaben >= 0) {
            cashflowEl.style.color = 'var(--jarvis-green)';
            cashflowEl.style.textShadow = 'var(--glow-green)';
        } else {
            cashflowEl.style.color = 'var(--jarvis-red)';
            cashflowEl.style.textShadow = 'var(--glow-red)';
        }
    }
    
    /**
     * Diagramme aktualisieren
     */
    updateDiagramme() {
        const data = this.imoKalkulator.getState();
        if (!data) return;
        
        // Chart.js Charts erstellen/aktualisieren
        this.createCashflowChart(data);
        this.createFinanzierungChart(data);
        this.createEinnahmenAusgabenChart(data);
    }
    
    createCashflowChart(data) {
        const ctx = document.getElementById('diagCashflowChart');
        if (!ctx) return;
        
        if (this.imoKalkulator.charts.cashflow) {
            this.imoKalkulator.charts.cashflow.destroy();
        }
        
        this.imoKalkulator.charts.cashflow = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: ['Rate', 'Hausgeld', 'Instandhaltung', 'Mietausfall', 'Überschuss'],
                datasets: [{
                    data: [
                        data.rateMonat,
                        data.hausgeldGesamt - data.hausgeldUmlagefaehig,
                        data.eigeneInstandhaltung,
                        data.mietausfall,
                        Math.max(0, data.cashflowOperativMonat)
                    ],
                    backgroundColor: [
                        'rgba(0, 212, 255, 0.8)',
                        'rgba(0, 212, 255, 0.6)',
                        'rgba(0, 212, 255, 0.4)',
                        'rgba(0, 212, 255, 0.2)',
                        'rgba(0, 255, 136, 0.8)'
                    ]
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: { color: 'var(--jarvis-blue)' }
                    }
                }
            }
        });
    }
    
    createFinanzierungChart(data) {
        const ctx = document.getElementById('diagFinanzierungChart');
        if (!ctx) return;
        
        if (this.imoKalkulator.charts.finanzierung) {
            this.imoKalkulator.charts.finanzierung.destroy();
        }
        
        this.imoKalkulator.charts.finanzierung = new Chart(ctx, {
            type: 'pie',
            data: {
                labels: ['Eigenkapital', 'Fremdkapital'],
                datasets: [{
                    data: [data.eigenkapital, data.finanzierung],
                    backgroundColor: [
                        'rgba(0, 255, 136, 0.8)',
                        'rgba(0, 212, 255, 0.8)'
                    ]
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: { color: 'var(--jarvis-blue)' }
                    }
                }
            }
        });
    }
    
    createEinnahmenAusgabenChart(data) {
        const ctx = document.getElementById('diagEinnahmenAusgabenChart');
        if (!ctx) return;
        
        if (this.imoKalkulator.charts.einnahmenAusgaben) {
            this.imoKalkulator.charts.einnahmenAusgaben.destroy();
        }
        
        this.imoKalkulator.charts.einnahmenAusgaben = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: ['Einnahmen', 'Ausgaben'],
                datasets: [{
                    label: '€/Monat',
                    data: [
                        data.kaltmiete + data.nebekosten + data.hausgeldUmlagefaehig,
                        data.rateMonat + (data.hausgeldGesamt - data.hausgeldUmlagefaehig) + data.eigeneInstandhaltung + data.mietausfall
                    ],
                    backgroundColor: [
                        'rgba(0, 255, 136, 0.8)',
                        'rgba(255, 82, 82, 0.8)'
                    ]
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: { display: false }
                },
                scales: {
                    y: {
                        ticks: { color: 'var(--jarvis-blue)' },
                        grid: { color: 'rgba(0, 212, 255, 0.1)' }
                    }
                }
            }
        });
    }
    
    /**
     * Verlauf aktualisieren
     */
    updateVerlauf() {
        const data = this.imoKalkulator.getState();
        const jahre = parseInt(document.getElementById('verlaufJahre')?.value || 30);
        const tbody = document.querySelector('#verlaufTabelle tbody');
        
        if (!tbody || !data) return;
        
        tbody.innerHTML = '';
        
        let restschuld = data.finanzierung;
        let immobilienWert = data.gesamtinvest;
        const zins = data.zins / 100;
        const tilgung = data.tilgung / 100;
        const mietsteigerung = data.mietsteigerung / 100;
        const kostensteigerung = data.kostensteigerung / 100;
        
        let miete = data.kaltmiete;
        let kosten = data.rateMonat + (data.hausgeldGesamt - data.hausgeldUmlagefaehig) + data.eigeneInstandhaltung + data.mietausfall;
        
        for (let jahr = 1; jahr <= jahre; jahr++) {
            // Jährliche Berechnung
            const mieteJahr = miete * 12;
            const kostenJahr = kosten * 12;
            const cashflowJahr = mieteJahr - kostenJahr;
            
            // Restschuld berechnen
            const zinsenJahr = restschuld * zins;
            const tilgungJahr = restschuld * tilgung;
            restschuld = restschuld - tilgungJahr;
            if (restschuld < 0) restschuld = 0;
            
            // Wertsteigerung (2% p.a.)
            immobilienWert = immobilienWert * 1.02;
            
            // Nettovermögen
            const nettovermoegen = immobilienWert - restschuld;
            
            // Tabelle füllen
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${2026 + jahr - 1}</td>
                <td>${jahr}</td>
                <td>${this.formatNumber(mieteJahr)} €</td>
                <td>${this.formatNumber(kostenJahr)} €</td>
                <td>${this.formatNumber(data.rateMonat * 12)} €</td>
                <td style="color: ${cashflowJahr >= 0 ? 'var(--jarvis-green)' : 'var(--jarvis-red)'}">${this.formatNumber(cashflowJahr)} €</td>
                <td>${this.formatNumber(restschuld)} €</td>
                <td>${this.formatNumber(immobilienWert)} €</td>
                <td>${this.formatNumber(nettovermoegen)} €</td>
            `;
            tbody.appendChild(row);
            
            // Miete und Kosten für nächstes Jahr anpassen
            miete = miete * (1 + mietsteigerung);
            kosten = kosten * (1 + kostensteigerung);
        }
    }
    
    /**
     * Haushalt Inputs initialisieren
     */
    initHaushaltInputs() {
        const inputs = ['hhNetto1', 'hhNetto2', 'hhSonstigeEinnahmen', 'hhMiete', 'hhLebensmittel', 'hhTransport', 'hhVersicherungen', 'hhFreizeit', 'hhSonstigeAusgaben'];
        
        inputs.forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                el.addEventListener('input', () => this.updateHaushalt());
            }
        });
    }
    
    updateHaushalt() {
        const einnahmen = 
            (parseFloat(document.getElementById('hhNetto1')?.value) || 0) +
            (parseFloat(document.getElementById('hhNetto2')?.value) || 0) +
            (parseFloat(document.getElementById('hhSonstigeEinnahmen')?.value) || 0);
        
        const ausgaben = 
            (parseFloat(document.getElementById('hhMiete')?.value) || 0) +
            (parseFloat(document.getElementById('hhLebensmittel')?.value) || 0) +
            (parseFloat(document.getElementById('hhTransport')?.value) || 0) +
            (parseFloat(document.getElementById('hhVersicherungen')?.value) || 0) +
            (parseFloat(document.getElementById('hhFreizeit')?.value) || 0) +
            (parseFloat(document.getElementById('hhSonstigeAusgaben')?.value) || 0);
        
        const saldo = einnahmen - ausgaben;
        
        document.getElementById('hhSummeEinnahmen').textContent = this.formatCurrency(einnahmen);
        document.getElementById('hhSummeAusgaben').textContent = this.formatCurrency(ausgaben);
        
        const saldoEl = document.getElementById('hhSaldo');
        saldoEl.textContent = this.formatCurrency(saldo);
        
        if (saldo >= 0) {
            saldoEl.classList.remove('negative');
            saldoEl.style.color = 'var(--jarvis-green)';
            saldoEl.style.textShadow = 'var(--glow-green)';
        } else {
            saldoEl.classList.add('negative');
            saldoEl.style.color = 'var(--jarvis-red)';
            saldoEl.style.textShadow = 'var(--glow-red)';
        }
    }
    
    /**
     * Vermögen Inputs initialisieren
     */
    initVermoegenInputs() {
        const inputs = ['vmKonten', 'vmWertpapiere', 'vmVersicherungen', 'vmSonstigeAktiva', 'vmRatenkredite', 'vmDispo', 'vmSonstigeSchulden'];
        
        inputs.forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                el.addEventListener('input', () => this.updateVermoegen());
            }
        });
    }
    
    updateVermoegen() {
        const data = this.imoKalkulator.getState();
        
        // LVM-Kredite laden
        this.loadLvmKredite().then(lvmData => {
            // Einzelne Kredite anzeigen
            const kredit1 = lvmData.einzelKredite.find(k => k.vertragsnummer === '01617662210');
            const kredit2 = lvmData.einzelKredite.find(k => k.vertragsnummer === '01500132210');
            
            const restschuld1 = kredit1 ? kredit1.restschuld_aktuell : 0;
            const restschuld2 = kredit2 ? kredit2.restschuld_aktuell : 0;
            const gesamtRestschuld = restschuld1 + restschuld2;
            
            const aktiva = 
                (data.gesamtinvest || 0) + // Immobilienwert
                (parseFloat(document.getElementById('vmKonten')?.value) || 0) +
                (parseFloat(document.getElementById('vmWertpapiere')?.value) || 0) +
                (parseFloat(document.getElementById('vmVersicherungen')?.value) || 0) +
                (parseFloat(document.getElementById('vmSonstigeAktiva')?.value) || 0);
            
            const passiva = 
                gesamtRestschuld + // Alle LVM Hypotheken
                (parseFloat(document.getElementById('vmRatenkredite')?.value) || 0) +
                (parseFloat(document.getElementById('vmDispo')?.value) || 0) +
                (parseFloat(document.getElementById('vmSonstigeSchulden')?.value) || 0);
            
            const nettovermoegen = aktiva - passiva;
            
            // Anzeige aktualisieren
            if (kredit1) {
                document.getElementById('vmHypothekLVM').textContent = this.formatCurrency(restschuld1) + ' (01617662210)';
            }
            if (kredit2) {
                document.getElementById('vmWeitereLVM').textContent = this.formatCurrency(restschuld2) + ' (01500132210)';
            }
            document.getElementById('vmSummeAktiva').textContent = this.formatCurrency(aktiva);
            document.getElementById('vmSummePassiva').textContent = this.formatCurrency(passiva);
            
            const saldoEl = document.getElementById('vmNettovermoegen');
            saldoEl.textContent = this.formatCurrency(nettovermoegen);
            
            if (nettovermoegen >= 0) {
                saldoEl.style.color = 'var(--jarvis-green)';
                saldoEl.style.textShadow = 'var(--glow-green)';
            } else {
                saldoEl.style.color = 'var(--jarvis-red)';
                saldoEl.style.textShadow = 'var(--glow-red)';
            }
        });
    }
    
    /**
     * LVM-Kredite laden
     */
    async loadLvmKredite() {
        try {
            const response = await fetch('lvm-kredite.json');
            if (!response.ok) throw new Error('LVM-Daten nicht gefunden');
            
            const data = await response.json();
            // Alle Restschulden summieren
            const gesamtRestschuld = data.kredite.reduce((sum, kredit) => sum + (kredit.restschuld_aktuell || 0), 0);
            
            return {
                gesamt: gesamtRestschuld,
                restschuld: gesamtRestschuld,
                kredite: data.kredite,
                lender: data.lender || 'LVM Versicherung',
                einzelKredite: data.kredite
            };
        } catch (e) {
            console.warn('⚠️ LVM-Kredite konnten nicht geladen werden:', e.message);
            return { gesamt: 0, restschuld: 0, kredite: [], lender: 'LVM', einzelKredite: [] };
        }
    }
    /**
     * PDF Export für Bankgespräch
     */
    exportBankgesprächPdf() {
        alert('PDF Export wird generiert... (Feature folgt)');
        // TODO: jsPDF Integration für professionellen PDF Export
    }
    
    /**
     * Helper: Währung formatieren
     */
    formatCurrency(value) {
        return new Intl.NumberFormat('de-DE', {
            style: 'currency',
            currency: 'EUR',
            minimumFractionDigits: 0,
            maximumFractionDigits: 2
        }).format(value);
    }
    
    /**
     * Helper: Zahl formatieren
     */
    formatNumber(value) {
        return new Intl.NumberFormat('de-DE', {
            minimumFractionDigits: 0,
            maximumFractionDigits: 0
        }).format(value);
    }
}

// Auto-init wenn DOM geladen
document.addEventListener('DOMContentLoaded', () => {
    if (window.imoKalkulator && !window.imoSubViews) {
        window.imoSubViews = new ImoSubViews(window.imoKalkulator);
    }
});
