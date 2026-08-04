/**
 * J.A.R.V.I.S. IMO - DEBUG PANEL
 * Sichtbarer Debug für die Sub-Navigation
 * Zeigt: Fetch-Status, Button-Klicks, gefundene Views
 */

(function() {
    // Nur im Entwicklungsmodus aktiv
    const DEBUG_ENABLED = true;
    
    function initDebug() {
        if (!DEBUG_ENABLED) return;
        
        // Debug-Panel Container erstellen (einmalig)
        let panel = document.getElementById('imoDebugPanel');
        if (!panel) {
            panel = document.createElement('div');
            panel.id = 'imoDebugPanel';
            panel.style.cssText = 'position:fixed;bottom:10px;right:10px;z-index:99999;background:rgba(0,0,0,0.85);border:1px solid #00D4FF;border-radius:8px;padding:12px;max-width:340px;max-height:300px;overflow:auto;font-family:monospace;font-size:11px;color:#00ff88;box-shadow:0 0 20px rgba(0,212,255,0.3);';
            panel.innerHTML = `
                <div style="font-weight:bold;color:#00D4FF;margin-bottom:8px;font-size:12px;">
                    🔍 IMO DEBUG <span style="color:#888;font-weight:normal">(klick auf X schließt)</span>
                </div>
                <div id="imoDebugLog" style="white-space:pre-wrap;"></div>
                <button id="imoDebugClose" style="position:absolute;top:4px;right:8px;background:none;border:none;color:#ff5252;font-size:16px;cursor:pointer;">×</button>
            `;
            document.body.appendChild(panel);
            
            document.getElementById('imoDebugClose').onclick = () => {
                panel.style.display = 'none';
            };
        }
        
        // Log-Funktion
        window.imoDebugLog = function(msg) {
            const log = document.getElementById('imoDebugLog');
            if (!log) return;
            const time = new Date().toLocaleTimeString('de-DE');
            log.textContent = `[${time}] ${msg}\n` + log.textContent;
            console.log('[IMO DEBUG]', msg);
        };
        
        window.imoDebugLog('🔍 Debug aktiv');
        
        // Sub-View Buttons überwachen
        document.addEventListener('click', (e) => {
            const btn = e.target.closest('.imo-subnav-btn');
            if (btn) {
                const subview = btn.dataset.subview;
                const view = document.getElementById(`imo-subview-${subview}`);
                window.imoDebugLog(`Klick: ${subview} | View gefunden: ${view ? '✅' : '❌'}`);
                
                if (view) {
                    window.imoDebugLog(`  → display: ${view.style.display} | class: ${view.className}`);
                } else {
                    window.imoDebugLog(`  → Prüfe Fetch-Status unten`);
                }
            }
        });
        
        // Fetch-Status nachträglich anzeigen
        setTimeout(() => {
            const subviewCount = document.querySelectorAll('.imo-subview').length;
            window.imoDebugLog(`Geladene Sub-Views: ${subviewCount}`);
            if (subviewCount === 0) {
                window.imoDebugLog('⚠️ KEINE Sub-Views geladen! Fetch evtl. fehlgeschlagen.');
                window.imoDebugLog('  Prüfe imo-subviews.html / imo-schuldenuhr.html');
            } else {
                document.querySelectorAll('.imo-subview').forEach(v => {
                    window.imoDebugLog(`  - ${v.id}`);
                });
            }
        }, 3000);
    }
    
    // Warten bis DOM bereit
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initDebug);
    } else {
        initDebug();
    }
})();
