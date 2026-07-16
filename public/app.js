/**
 * J.A.R.V.I.S. PWA - Holographic Interface
 * Voice & Text Client für Hermes API
 */

class JarvisPWA {
    constructor() {
        this.config = this.loadConfig();
        this.user = this.config.user || null;
        this.recognition = null;
        this.synthesis = window.speechSynthesis;
        this.isListening = false;
        this.conversation = [];
        this.apiBaseUrl = this.config.apiUrl || '';
        this.apiKey = this.config.apiKey || 'fb74aee26654c46e06e8b82158e1eb12991fb866f0300435fd9c34d0e67634d3';
        
        this.init();
    }

    // ==================== KONFIGURATION ====================
    
    loadConfig() {
        const defaultConfig = {
            user: null,
            authToken: null,
            apiUrl: '',
            language: 'de-DE',
            autoSpeak: true
        };
        
        const saved = localStorage.getItem('jarvis_config');
        const cfg = saved ? { ...defaultConfig, ...JSON.parse(saved) } : defaultConfig;
        // Migration: alte ngrok-API-URL entfernen, relative Pfade nutzen
        if (cfg.apiUrl && cfg.apiUrl.includes('ngrok-free.dev')) {
            cfg.apiUrl = '';
        }
        return cfg;
    }

    saveConfig() {
        localStorage.setItem('jarvis_config', JSON.stringify(this.config));
    }

    // ==================== INITIALISIERUNG ====================

    init() {
        this.loadVersion();
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.has('demo') && !this.user) {
            this.user = { id: 'mike', name: 'Mike' };
        }
        if (!this.user) {
            this.showLoginScreen();
        } else {
            this.showMainInterface();
            this.initSpeechRecognition();
            this.initVoices();
            this.initCamera();
            this.updateSystemTime();
        }
        
        this.registerServiceWorker();
    }

    async loadVersion() {
        try {
            const response = await fetch('version.json?v=' + Date.now(), { cache: 'no-store' });
            if (response.ok) {
                const version = await response.json();
                this.versionInfo = version;
                const display = document.getElementById('versionDisplay');
                if (display) {
                    const short = version.short_commit || version.commit?.substring(0, 7) || 'unknown';
                    display.textContent = `v${short}`;
                    display.title = `Commit: ${version.commit}\nBranch: ${version.branch}\nBuilt: ${version.built_at}`;
                }
            }
        } catch (error) {
            console.warn('Fehler beim Laden der Versionsinfo:', error);
            const display = document.getElementById('versionDisplay');
            if (display) {
                display.textContent = 'v--';
            }
        }
    }

    // ==================== LOGIN SCREEN ====================

    showLoginScreen() {
        const loginScreen = document.getElementById('login-screen');
        const mainInterface = document.getElementById('main-interface');
        
        loginScreen.style.display = 'flex';
        mainInterface.style.display = 'none';
        
        // User Card Events
        document.querySelectorAll('.user-card').forEach(card => {
            card.addEventListener('click', (e) => {
                const userId = e.currentTarget.dataset.user;
                this.handleUserSelect(userId);
            });
        });
        
        // Password Panel Events
        document.getElementById('submitPassword').addEventListener('click', () => {
            this.verifyPassword();
        });
        
        document.getElementById('cancelLogin').addEventListener('click', () => {
            this.hidePasswordPanel();
        });
        
        document.getElementById('passwordInput').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.verifyPassword();
            }
        });
        
        // Settings Toggle
        const settingsToggle = document.getElementById('showSettings');
        const settingsPanel = document.getElementById('settingsPanel');
        
        settingsToggle.addEventListener('click', () => {
            settingsPanel.style.display = 
                settingsPanel.style.display === 'none' ? 'block' : 'none';
        });
        
        // Save Settings
        document.getElementById('saveSettings').addEventListener('click', () => {
            this.config.apiUrl = document.getElementById('apiUrl').value;
            this.saveConfig();
            settingsPanel.style.display = 'none';
            this.showNotification('Einstellungen gespeichert', 'success');
        });
        
        // Load API URL
        const apiUrlInput = document.getElementById('apiUrl');
        if (apiUrlInput) {
            apiUrlInput.value = this.config.apiUrl || '';
            apiUrlInput.placeholder = '/api/jarvis/... (leer = Standard)';
        }
    }

    login(userId, token, userInfo) {
        this.user = { id: userId, ...userInfo };
        this.config.user = this.user;
        this.config.authToken = token;
        this.saveConfig();
        
        // Fade out login hologram, then switch to main interface + greeting
        const hologram = document.querySelector('.hologram-container');
        if (hologram) {
            hologram.style.animation = 'none';
            hologram.style.opacity = '0';
            hologram.style.transition = 'opacity 0.5s ease';
        }
        
        setTimeout(() => {
            this.showMainInterface();
            // German greeting with weekday, spoken with voice-wave visuals
            const greeting = this.buildGreeting();
            this.speak(greeting);
        }, 600);
    }

    // ==================== GREETING ====================

    buildGreeting() {
        const now = new Date();
        const weekdayNames = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];
        const weekday = weekdayNames[now.getDay()];
        const day = String(now.getDate()).padStart(2, '0');
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const year = now.getFullYear();
        const hour = now.getHours();
        let dayPart = 'Tag';
        if (hour < 6) dayPart = 'Nacht';
        else if (hour < 12) dayPart = 'Morgen';
        else if (hour < 14) dayPart = 'Mittag';
        else if (hour < 18) dayPart = 'Nachmittag';
        else if (hour < 22) dayPart = 'Abend';
        else dayPart = 'Nacht';

        const name = this.user?.name || 'Sir';
        return `Guten ${dayPart}, ${name}. Wir haben ${weekday}, den ${day}.${month}.${year}. J.A.R.V.I.S. steht zu Ihren Diensten. Systeme nominal.`;
    }

    handleUserSelect(userId) {
        this.selectedUser = userId;
        this.showPasswordPanel(userId);
    }

    showPasswordPanel(userId) {
        const userSelection = document.querySelector('.user-selection');
        const passwordPanel = document.getElementById('passwordPanel');
        const passwordTitle = document.querySelector('.password-title');
        const avatarInitial = document.querySelector('.password-header .avatar-initial');
        
        const labels = {
            mike: { title: 'Sicherheitsauthentifizierung', initial: 'M' },
            tanja: { title: 'Authentifizierung', initial: 'T' }
        };
        const info = labels[userId] || labels.mike;
        
        userSelection.style.display = 'none';
        passwordPanel.style.display = 'flex';
        if (passwordTitle) passwordTitle.textContent = info.title;
        if (avatarInitial) avatarInitial.textContent = info.initial;
        
        document.getElementById('passwordInput').value = '';
        document.getElementById('passwordError').style.display = 'none';
        document.getElementById('passwordInput').focus();
        
        passwordPanel.style.opacity = '0';
        passwordPanel.style.transform = 'translateY(20px)';
        setTimeout(() => {
            passwordPanel.style.transition = 'all 0.3s ease';
            passwordPanel.style.opacity = '1';
            passwordPanel.style.transform = 'translateY(0)';
        }, 10);
    }

    hidePasswordPanel() {
        const userSelection = document.querySelector('.user-selection');
        const passwordPanel = document.getElementById('passwordPanel');
        
        passwordPanel.style.display = 'none';
        userSelection.style.display = 'block';
        
        document.getElementById('passwordInput').value = '';
        document.getElementById('passwordError').style.display = 'none';
        this.selectedUser = null;
    }

    async verifyPassword() {
        const input = document.getElementById('passwordInput').value;
        const errorDiv = document.getElementById('passwordError');
        const userId = this.selectedUser;
        
        if (!userId || !input) {
            errorDiv.style.display = 'flex';
            return;
        }
        
        try {
            const url = `${this.apiBaseUrl}/api/jarvis/auth/login`;
            const requestBody = JSON.stringify({ username: userId, password: input });
            console.log('[JARVIS DEBUG] Login URL:', url);
            console.log('[JARVIS DEBUG] apiBaseUrl:', this.apiBaseUrl);
            console.log('[JARVIS DEBUG] selectedUser:', userId);
            console.log('[JARVIS DEBUG] requestBody:', requestBody);
            console.log('[JARVIS DEBUG] password length:', input.length);
            
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: requestBody
            });
            
            const responseText = await response.text();
            console.log('[JARVIS DEBUG] Raw response:', response.status, responseText);
            
            let data;
            try {
                data = JSON.parse(responseText);
            } catch (e) {
                console.error('[JARVIS DEBUG] JSON parse error:', e);
                data = { raw: responseText };
            }
            console.log('[JARVIS DEBUG] Parsed data:', data);
            
            if (response.ok && data.success && data.token) {
                errorDiv.style.display = 'none';
                this.login(userId, data.token, data.user);
            } else {
                const errorText = document.querySelector('.error-text');
                if (data.error) {
                    errorText.textContent = `Fehler: ${data.error}. Bitte prüfen.`;
                } else {
                    errorText.textContent = 'Falsches Passwort. Zugriff verweigert.';
                }
                errorDiv.style.display = 'flex';
                document.getElementById('passwordInput').value = '';
                document.getElementById('passwordInput').focus();
                
                const panel = document.querySelector('.password-form');
                panel.style.animation = 'shake 0.5s ease';
                setTimeout(() => {
                    panel.style.animation = '';
                }, 500);
            }
        } catch (error) {
            console.error('[JARVIS DEBUG] Login Fehler:', error);
            const errorText = document.querySelector('.error-text');
            if (errorText) errorText.textContent = 'Verbindungsfehler. Bitte Einstellungen prüfen.';
            errorDiv.style.display = 'flex';
        }
    }

    logout() {
        this.user = null;
        this.config.user = null;
        this.config.authToken = null;
        this.saveConfig();
        this.conversation = [];
        this.showLoginScreen();
    }

    // ==================== MAIN INTERFACE ====================

    showMainInterface() {
        const loginScreen = document.getElementById('login-screen');
        const mainInterface = document.getElementById('main-interface');
        
        loginScreen.style.display = 'none';
        mainInterface.style.display = 'flex';
        
        // Update UI
        document.getElementById('currentUser').textContent = this.user.name.charAt(0);
        
        // Initialize Speech
        this.initSpeechRecognition();
        this.initVoices();
        
        // Initialize Dashboard
        this.initDashboard();
        
        // Event Listeners
        this.initMainEventListeners();
        
        // Start Time Update
        this.updateSystemTime();
        setInterval(() => this.updateSystemTime(), 1000);
    }

    initMainEventListeners() {
        // AI Core Globe replaces the microphone
        const aiCore = document.getElementById('aiCoreContainer');
        if (aiCore) {
            aiCore.addEventListener('click', () => {
                aiCore.classList.add('pressed');
                setTimeout(() => aiCore.classList.remove('pressed'), 150);
                this.toggleVoiceInput();
            });
        }
        
        // Text Input - footer pill
        const textInput = document.getElementById('textInput');
        const sendBtn = document.getElementById('sendBtn');
        
        if (sendBtn && textInput) {
            sendBtn.addEventListener('click', () => {
                const message = textInput.value.trim();
                if (message) {
                    this.sendMessage(message);
                    textInput.value = '';
                }
            });
            
            textInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    const message = textInput.value.trim();
                    if (message) {
                        this.sendMessage(message);
                        textInput.value = '';
                    }
                }
            });
        }
        
        // Chat Overlay inputs
        const chatPanelInput = document.getElementById('chatPanelInput');
        const chatPanelSend = document.getElementById('chatPanelSend');
        if (chatPanelInput && chatPanelSend) {
            chatPanelSend.addEventListener('click', () => {
                const message = chatPanelInput.value.trim();
                if (message) {
                    this.sendMessage(message);
                    chatPanelInput.value = '';
                }
            });
            chatPanelInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    const message = chatPanelInput.value.trim();
                    if (message) {
                        this.sendMessage(message);
                        chatPanelInput.value = '';
                    }
                }
            });
        }
        
        // Chat toggle
        const chatToggle = document.getElementById('chatToggle');
        const chatOverlay = document.getElementById('chatOverlay');
        const closeChat = document.getElementById('closeChat');
        if (chatToggle && chatOverlay) {
            chatToggle.addEventListener('click', () => this.openChatPanel());
        }
        if (closeChat && chatOverlay) {
            closeChat.addEventListener('click', () => chatOverlay.style.display = 'none');
        }
        
        // Settings / Auswertung
        const settingsMenuItems = document.querySelectorAll('.menu-item[data-view="einstellungen"], #settingsHeaderBtn');
        settingsMenuItems.forEach(el => {
            el.addEventListener('click', () => this.switchView('einstellungen'));
        });
        
        const logInterimToggle = document.getElementById('logInterimToggle');
        if (logInterimToggle) {
            logInterimToggle.checked = this.config.logInterim || false;
            logInterimToggle.addEventListener('change', (e) => {
                this.config.logInterim = e.target.checked;
                this.saveConfig();
                this.showNotification(e.target.checked ? 'Interim-Logs aktiviert' : 'Interim-Logs deaktiviert', 'success');
            });
        }

        const autoSpeakToggle = document.getElementById('autoSpeakToggle');
        if (autoSpeakToggle) {
            autoSpeakToggle.checked = this.config.autoSpeak !== false;
            autoSpeakToggle.addEventListener('change', (e) => {
                this.config.autoSpeak = e.target.checked;
                this.saveConfig();
                this.showNotification(e.target.checked ? 'Sprachausgabe aktiviert' : 'Sprachausgabe deaktiviert', 'success');
            });
        }

        const ttsTestBtn = document.getElementById('ttsTestBtn');
        if (ttsTestBtn) {
            ttsTestBtn.addEventListener('click', () => {
                this.speak('J.A.R.V.I.S. Sprachausgabe funktioniert, Sir.');
            });
        }
        
        const exportLogBtn = document.getElementById('exportLogBtn');
        if (exportLogBtn) {
            exportLogBtn.addEventListener('click', () => this.exportConversationLog());
        }
        
        const clearLogBtn = document.getElementById('clearLogBtn');
        if (clearLogBtn) {
            clearLogBtn.addEventListener('click', () => {
                if (confirm('Konversationsverlauf wirklich löschen?')) {
                    this.clearConversationLog();
                    this.renderConversationLog();
                    this.showNotification('Log gelöscht', 'success');
                }
            });
        }
        
        // Dashboard refresh
        const refreshBtn = document.getElementById('dashboardRefresh');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => {
                this.refreshDashboardData();
                this.showNotification('Dashboard aktualisiert', 'success');
            });
        }
        
        // Quick Actions (legacy)
        document.querySelectorAll('.quick-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const command = e.currentTarget.dataset.command;
                this.sendMessage(command);
            });
        });
        
        // Command buttons
        document.querySelectorAll('.cmd-btn').forEach(btn => {
            btn.addEventListener('click', (e) => this.handleCommandButton(e.currentTarget));
        });
        
        // Side menu view switching
        document.querySelectorAll('.menu-item').forEach(item => {
            item.addEventListener('click', (e) => {
                const view = e.currentTarget.dataset.view;
                this.switchView(view);
            });
        });
        
        // Home climate tile opens overlay
        const homeClimateTile = document.getElementById('homeClimateTile');
        if (homeClimateTile) {
            homeClimateTile.addEventListener('click', () => this.openClimateOverlay());
        }

        // Climate overlay controls
        const climateOverlay = document.getElementById('climateOverlay');
        const closeClimate = document.getElementById('closeClimate');
        if (closeClimate) {
            closeClimate.addEventListener('click', () => this.closeClimateOverlay());
        }
        if (climateOverlay) {
            climateOverlay.addEventListener('click', (e) => {
                if (e.target === climateOverlay) this.closeClimateOverlay();
            });
        }
        document.querySelectorAll('.climate-zone .mini-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const zone = e.currentTarget.dataset.zone;
                const action = e.currentTarget.dataset.action;
                this.handleClimateAction(zone, action);
            });
        });
        
        // Logout
        document.getElementById('logoutBtn').addEventListener('click', () => {
            if (confirm('Möchten Sie sich abmelden?')) {
                this.logout();
            }
        });
    }

    // ==================== DASHBOARD ====================

    switchView(viewName) {
        // Menu highlight
        document.querySelectorAll('.menu-item').forEach(item => {
            item.classList.toggle('active', item.dataset.view === viewName);
        });
        // View visibility
        document.querySelectorAll('.view-container').forEach(view => {
            view.classList.toggle('active', view.id === `view-${viewName}`);
        });
        // Refresh camera feeds when cameras view shown
        if (viewName === 'cameras') {
            this.startCameraFeeds();
        } else {
            this.stopCameraFeeds();
        }
        // Render conversation log when settings view shown
        if (viewName === 'einstellungen') {
            this.renderConversationLog();
        }
    }

    startCameraFeeds() {
        if (this.cameraInterval) clearInterval(this.cameraInterval);
        const cams = [
            { id: 'camFrontImg', entity: 'camera.front_door' },
            { id: 'camBackImg', entity: 'camera.back_door' },
            { id: 'camEinfahrtImg', entity: 'camera.einfahrt_hochauflosung' },
            { id: 'camDoorbirdImg', entity: 'camera.doorbird' }
        ];
        const token = Date.now();
        const update = () => {
            cams.forEach(cam => {
                const img = document.getElementById(cam.id);
                if (img) {
                    img.src = `${this.apiBaseUrl}/api/jarvis/ha-proxy/api/camera_proxy/${cam.entity}?token=${token}&t=${Date.now()}`;
                }
            });
        };
        update();
        this.cameraInterval = setInterval(update, 2000);
    }

    stopCameraFeeds() {
        if (this.cameraInterval) clearInterval(this.cameraInterval);
    }

    initDashboard() {
        // Default view home
        this.switchView('home');
        
        // Erste Datenladung
        this.refreshDashboardData();
        
        // Regelmäßige Aktualisierung alle 30 Sekunden
        if (this.dashboardInterval) clearInterval(this.dashboardInterval);
        this.dashboardInterval = setInterval(() => this.refreshDashboardData(), 30000);
        
        // Uhrzeit mit Datum
        this.updateClock();
        setInterval(() => this.updateClock(), 1000);
    }

    updateClock() {
        const now = new Date();
        const timeEl = document.getElementById('systemTime');
        const dateEl = document.getElementById('systemDate');
        if (timeEl) timeEl.textContent = now.toLocaleTimeString('de-DE');
        if (dateEl) {
            dateEl.textContent = now.toLocaleDateString('de-DE', {
                weekday: 'short',
                day: '2-digit',
                month: 'short'
            });
        }
    }

    async refreshDashboardData() {
        try {
            // Nur benötigte Entities laden für bessere Performance
            const requiredEntities = [
                // Solar
                'sensor.jarvis_solar_aktuell', 'sensor.jarvis_solar_heute',
                'sensor.hm1500_power', 'sensor.hm1500_yieldday',
                // Battery
                'sensor.gesamt_batterie_soc', 'sensor.batterie_summe',
                'sensor.gesamt_lade_leistung', 'sensor.gesamt_entlade_leistung',
                // Grid/House
                'sensor.power_import_grid', 'sensor.power_grid_total_raw',
                'sensor.jarvis_gesamt_verbrauch', 'sensor.shelly_3em_total_power',
                // Climate
                'climate.split_klimaanlage', 'climate.schlafzimmer', 'switch.klima_schlafzimmer',
                // Environment temps
                'sensor.garten', 'sensor.pool_temperatur',
                'sensor.wohnzimmer_echo_temperatur', 'sensor.arbeitszimmer_temperatur',
                // Status sensors
                'binary_sensor.jarvis_status_haos', 'binary_sensor.jarvis_status_proxmox',
                'binary_sensor.jarvis_status_nas', 'binary_sensor.jarvis_status_gateway',
                'binary_sensor.jarvis_status_solar', 'binary_sensor.jarvis_status_zigbee',
                'binary_sensor.jarvis_status_opendtu', 'binary_sensor.jarvis_status_jarvis_api'
            ];
            
            // States einzeln laden und zusammenführen
            const states = [];
            for (const entityId of requiredEntities) {
                try {
                    const state = await this.haFetch(`/api/states/${entityId}`);
                    if (state && state.entity_id) states.push(state);
                } catch (e) { /* Entity nicht gefunden */ }
            }
            
            if (states.length > 0) {
                this.updateEnergyWidgets(states);
                this.updateClimateWidget(states);
                this.updateEnvironmentWidgets(states);
                this.updateStatusPanel(states);
                this.updateEntityCount(states.length);
            }
        } catch (error) {
            console.warn('Dashboard-Daten konnten nicht geladen werden:', error);
            this.addAlert('HA-Verbindung unterbrochen', 'error');
        }
    }

    async haFetch(path) {
        const url = `${this.apiBaseUrl}/api/jarvis/ha-proxy${path}`;
        const headers = {
            'Authorization': `Bearer ${this.apiKey}`,
            'ngrok-skip-browser-warning': 'true'
        };
        if (this.config.authToken) {
            headers['X-Jarvis-Auth-Token'] = this.config.authToken;
            headers['X-Jarvis-User-Id'] = this.user.id;
        }
        const response = await fetch(url, { headers });
        if (!response.ok) throw new Error(`HA Proxy ${response.status}`);
        if (path.includes('camera_proxy') || response.headers.get('content-type')?.includes('image')) {
            return response.blob();
        }
        return response.json();
    }

    updateEnergyWidgets(states) {
        // Solar power and today
        const solarPowerState = states.find(s => s.entity_id === 'sensor.jarvis_solar_aktuell' || s.entity_id === 'sensor.hm1500_power');
        const solarTodayState = states.find(s => s.entity_id === 'sensor.jarvis_solar_heute' || s.entity_id === 'sensor.hm1500_yieldday');
        if (solarPowerState) {
            const watts = parseFloat(solarPowerState.state) || 0;
            const text = `${Math.round(watts)} W`;
            this.setText('homeSolarPower', text);
            this.setText('stromSolarPower', text);
        }
        if (solarTodayState) {
            let kwh = parseFloat(solarTodayState.state) || 0;
            if (solarTodayState.entity_id === 'sensor.hm1500_yieldday') kwh = kwh / 1000;
            const text = `Heute: ${kwh.toFixed(1)} kWh`;
            this.setText('homeSolarToday', text);
            this.setText('stromSolarToday', text);
        }

        // Battery SoC and flow
        const batteryState = states.find(s => s.entity_id === 'sensor.gesamt_batterie_soc' || s.entity_id === 'sensor.batterie_summe');
        if (batteryState) {
            const soc = parseFloat(batteryState.state) || 0;
            this.setText('homeBatterySoc', `${Math.round(soc)} %`);
            this.setText('stromBatterySoc', `${Math.round(soc)} %`);
        }

        const batteryFlowState = states.find(s => s.entity_id === 'sensor.gesamt_lade_leistung' || s.entity_id === 'sensor.gesamt_entlade_leistung');
        const charge = states.find(s => s.entity_id === 'sensor.gesamt_lade_leistung');
        const discharge = states.find(s => s.entity_id === 'sensor.gesamt_entlade_leistung');
        if (charge && discharge) {
            const c = parseFloat(charge.state) || 0;
            const d = parseFloat(discharge.state) || 0;
            const flowText = c > d ? `Laden +${Math.round(c)} W` : d > c ? `Entladen ${Math.round(d)} W` : 'Ruhe';
            this.setText('homeBatteryFlow', flowText);
            this.setText('stromBatteryFlow', flowText);
        } else if (batteryFlowState) {
            const power = parseFloat(batteryFlowState.state) || 0;
            const flowText = power > 50 ? `Laden +${Math.round(power)} W` : power < -50 ? `Entladen ${Math.round(Math.abs(power))} W` : 'Ruhe';
            this.setText('homeBatteryFlow', flowText);
            this.setText('stromBatteryFlow', flowText);
        }

        // House consumption / grid import
        const powerState = states.find(s => s.entity_id === 'sensor.power_consumption');
        if (powerState) {
            const watts = parseFloat(powerState.state) || 0;
            this.setText('homeHousePower', `${Math.round(watts)} W`);
            this.setText('stromConsumption', `${Math.round(watts)} W`);
        }

        const gridState = states.find(s => s.entity_id === 'sensor.power_import_grid' || s.entity_id === 'sensor.power_grid_total_raw');
        if (gridState) {
            const importW = parseFloat(gridState.state) || 0;
            this.setText('homeGridStatus', importW > 50 ? `Netzbezug ${Math.round(importW)} W` : 'Autark');
            this.setText('stromGrid', importW > 50 ? `Netzbezug ${Math.round(importW)} W` : 'Autark');
        }

        // Phases
        const phaseA = states.find(s => s.entity_id === 'sensor.haus_channel_a_power');
        const phaseB = states.find(s => s.entity_id === 'sensor.haus_channel_b_power');
        const phaseC = states.find(s => s.entity_id === 'sensor.haus_channel_c_power');
        const maxPhase = 5000;
        if (phaseA) this.setBar('stromPhaseA', (parseFloat(phaseA.state) || 0) / maxPhase * 100);
        if (phaseB) this.setBar('stromPhaseB', (parseFloat(phaseB.state) || 0) / maxPhase * 100);
        if (phaseC) this.setBar('stromPhaseC', (parseFloat(phaseC.state) || 0) / maxPhase * 100);
    }

    setText(id, text) {
        const el = document.getElementById(id);
        if (el) el.textContent = text;
    }

    setBar(id, percent) {
        const el = document.getElementById(id);
        if (el) el.style.width = `${Math.min(percent, 100)}%`;
    }

    updateClimateWidget(states) {
        const zones = [
            { id: 'wohnzimmer', entity: 'climate.split_klimaanlage' },
            { id: 'schlafzimmer', entity: 'climate.schlafzimmer' },
            { id: 'arbeitszimmer', entity: null }
        ];

        // Cache latest states for overlay
        this.climateStates = {};
        zones.forEach(zone => {
            if (!zone.entity) return;
            const found = states.find(s => s.entity_id === zone.entity);
            if (found) this.climateStates[zone.id] = found;
        });

        // Home tile summary: prefer living room, fallback bedroom
        const climate = this.climateStates['wohnzimmer'] || this.climateStates['schlafzimmer'];
        const targetEl = document.getElementById('homeClimateTarget');
        const currentEl = document.getElementById('homeClimateCurrent');
        const modeEl = document.getElementById('homeClimateMode');
        const labels = { off: 'Aus', cool: 'Kühlen', heat: 'Heizen', dry: 'Trocknen', fan_only: 'Lüfter' };

        if (climate) {
            const currentTemp = climate.attributes?.current_temperature;
            const targetTemp = climate.attributes?.temperature;
            const mode = climate.state;
            if (targetEl) {
                targetEl.textContent = targetTemp != null && !isNaN(parseFloat(targetTemp))
                    ? `${parseFloat(targetTemp).toFixed(1)}°C`
                    : '--°C';
            }
            if (currentEl) {
                currentEl.textContent = currentTemp != null && !isNaN(parseFloat(currentTemp))
                    ? `Ist: ${parseFloat(currentTemp).toFixed(1)}°C`
                    : 'Ist: --°C';
            }
            if (modeEl) modeEl.textContent = labels[mode] || mode;
        } else {
            if (targetEl) targetEl.textContent = '--°C';
            if (currentEl) currentEl.textContent = 'Ist: --°C';
            if (modeEl) modeEl.textContent = 'Aus';
        }

        // If overlay is open, refresh it
        const overlay = document.getElementById('climateOverlay');
        if (overlay && overlay.style.display === 'flex') {
            this.renderClimateOverlay();
        }
    }

    openClimateOverlay() {
        this.renderClimateOverlay();
        const overlay = document.getElementById('climateOverlay');
        if (overlay) overlay.style.display = 'flex';
    }

    closeClimateOverlay() {
        const overlay = document.getElementById('climateOverlay');
        if (overlay) overlay.style.display = 'none';
    }

    renderClimateOverlay() {
        const labels = { off: 'Aus', cool: 'Kühlen', heat: 'Heizen', dry: 'Trocknen', fan_only: 'Lüfter' };
        const icons = { off: '⏻', cool: '❄', heat: '♨', dry: '💧', fan_only: '✦' };
        const zones = [
            { id: 'wohnzimmer', entity: 'climate.split_klimaanlage', name: 'Wohnzimmer' },
            { id: 'schlafzimmer', entity: 'climate.schlafzimmer', name: 'Schlafzimmer' },
            { id: 'arbeitszimmer', entity: null, name: 'Arbeitszimmer' }
        ];

        zones.forEach(zone => {
            const stateObj = zone.entity ? (this.climateStates?.[zone.id]) : null;
            const targetEl = document.getElementById(`climateTarget-${zone.id}`);
            const currentEl = document.getElementById(`climateCurrent-${zone.id}`);
            const statusEl = document.getElementById(`climateStatus-${zone.id}`);
            const modeBtn = document.getElementById(`climateModeBtn-${zone.id}`);
            const powerBtn = document.getElementById(`climatePowerBtn-${zone.id}`);
            const zoneEl = document.querySelector(`.climate-zone[data-zone="${zone.id}"]`);

            if (!zone.entity) {
                // Arbeitszimmer placeholder
                if (targetEl) targetEl.textContent = '--°C';
                if (currentEl) currentEl.textContent = 'Ist: --°C';
                if (statusEl) statusEl.textContent = 'Nicht verbunden';
                if (modeBtn) { modeBtn.textContent = '❄'; modeBtn.classList.remove('heat'); }
                if (powerBtn) powerBtn.classList.remove('active');
                return;
            }

            if (stateObj) {
                const state = stateObj.state;
                const attrs = stateObj.attributes || {};
                const targetTemp = attrs.temperature;
                const currentTemp = attrs.current_temperature;

                if (targetEl) {
                    targetEl.textContent = targetTemp != null && !isNaN(parseFloat(targetTemp))
                        ? `${parseFloat(targetTemp).toFixed(1)}°C`
                        : '--°C';
                }
                if (currentEl) {
                    currentEl.textContent = currentTemp != null && !isNaN(parseFloat(currentTemp))
                        ? `Ist: ${parseFloat(currentTemp).toFixed(1)}°C`
                        : 'Ist: --°C';
                }
                if (statusEl) {
                    statusEl.textContent = labels[state] || state;
                    statusEl.classList.toggle('off', state === 'off');
                }
                if (modeBtn) {
                    modeBtn.textContent = icons[state] || icons.cool;
                    modeBtn.classList.toggle('heat', state === 'heat');
                }
                if (powerBtn) powerBtn.classList.toggle('active', state !== 'off');
                if (zoneEl) zoneEl.classList.remove('disabled');
            } else {
                if (targetEl) targetEl.textContent = '--°C';
                if (currentEl) currentEl.textContent = 'Ist: --°C';
                if (statusEl) {
                    statusEl.textContent = 'Offline';
                    statusEl.classList.add('off');
                }
                if (modeBtn) { modeBtn.textContent = '❄'; modeBtn.classList.remove('heat'); }
                if (powerBtn) powerBtn.classList.remove('active');
            }
        });
    }

    getClimateEntity(zoneId) {
        const map = { wohnzimmer: 'climate.split_klimaanlage', schlafzimmer: 'climate.schlafzimmer', arbeitszimmer: null };
        return map[zoneId];
    }

    getClimateState(zoneId) {
        return this.climateStates?.[zoneId];
    }

    handleClimateAction(zoneId, action) {
        const entity = this.getClimateEntity(zoneId);
        if (!entity) {
            this.showNotification(`${zoneId.charAt(0).toUpperCase() + zoneId.slice(1)} ist noch nicht verbunden`, 'warning');
            return;
        }
        const stateObj = this.getClimateState(zoneId);
        const currentMode = stateObj ? stateObj.state : 'off';
        const currentTarget = stateObj?.attributes?.temperature;

        if (action === 'minus' || action === 'plus') {
            const temp = currentTarget != null ? parseFloat(currentTarget) : 23;
            const delta = action === 'minus' ? -1 : +1;
            const newTemp = Math.max(16, Math.min(32, temp + delta));
            this.callService(entity, 'climate.set_temperature', { temperature: newTemp });
        } else if (action === 'power') {
            const nextMode = currentMode === 'off' ? 'cool' : 'off';
            this.callService(entity, 'climate.set_hvac_mode', { hvac_mode: nextMode });
        } else if (action === 'mode') {
            const nextMode = currentMode === 'heat' ? 'cool' : 'heat';
            this.callService(entity, 'climate.set_hvac_mode', { hvac_mode: nextMode });
        }
    }

    updateEnvironmentWidgets(states) {
        const mapping = {
            statusTempGarten: 'sensor.garten',
            statusTempPool: 'sensor.pool_temperatur',
            statusTempWohn: 'sensor.wohnzimmer_echo_temperatur',
            statusTempArbeit: 'sensor.arbeitszimmer_temperatur'
        };
        Object.entries(mapping).forEach(([id, entityId]) => {
            const state = states.find(s => s.entity_id === entityId);
            const el = document.getElementById(id);
            if (!el) return;
            if (!state || state.state === 'unavailable' || state.state === 'unknown' || isNaN(parseFloat(state.state))) {
                el.textContent = '--°C';
            } else {
                el.textContent = `${parseFloat(state.state).toFixed(1)}°C`;
            }
        });
    }

    updateEntityCount(count) {
        const el = document.getElementById('haEntityCount');
        if (el) el.textContent = `HA: ${count} Entitäten`;
    }

    updateStatusPanel(states) {
        const statusMap = {
            'status-haos-dot': 'binary_sensor.jarvis_status_haos',
            'status-proxmox-dot': 'binary_sensor.jarvis_status_proxmox',
            'status-nas-dot': 'binary_sensor.jarvis_status_nas',
            'status-gateway-dot': 'binary_sensor.jarvis_status_gateway',
            'status-solar-dot': 'binary_sensor.jarvis_status_solar',
            'status-zigbee-dot': 'binary_sensor.jarvis_status_zigbee',
            'status-opendtu-dot': 'binary_sensor.jarvis_status_opendtu',
            'status-jarvis-dot': 'binary_sensor.jarvis_status_jarvis_api'
        };
        let onlineCount = 0;
        Object.entries(statusMap).forEach(([id, entityId]) => {
            const state = states.find(s => s.entity_id === entityId);
            const dot = document.getElementById(id);
            if (!dot) return;
            if (!state || state.state === 'unavailable' || state.state === 'unknown') {
                dot.className = 'status-dot-sm offline';
                return;
            }
            const good = ['on', 'connected', 'home', 'ok', 'online'].includes(state.state.toLowerCase());
            dot.className = good ? 'status-dot-sm online' : 'status-dot-sm offline';
            if (good) onlineCount++;
        });
        const footer = document.getElementById('footerConnection');
        if (footer) {
            footer.innerHTML = `● ${onlineCount}/8 Systeme online`;
            footer.className = onlineCount === 8 ? 'connection-status online' : 'connection-status offline';
        }
    }

    updateCameraMetadata(states) {
        const faceMap = {
            camFrontFace: 'sensor.front_door_last_recognized_face',
            camBackFace: 'sensor.back_door_last_recognized_face',
            camEinfahrtFace: 'sensor.einfahrt_last_recognized_face',
            camDoorbirdFace: 'sensor.doorbird_last_recognized_face'
        };
        const plateMap = {
            camFrontPlate: 'sensor.front_door_last_recognized_plate',
            camBackPlate: 'sensor.back_door_last_recognized_plate',
            camEinfahrtPlate: 'sensor.einfahrt_last_recognized_plate',
            camDoorbirdPlate: 'sensor.doorbird_last_recognized_plate'
        };
        Object.entries(faceMap).forEach(([id, entityId]) => {
            const state = states.find(s => s.entity_id === entityId);
            const el = document.getElementById(id);
            if (el && state) el.textContent = state.state === 'Unknown' ? '–' : state.state;
        });
        Object.entries(plateMap).forEach(([id, entityId]) => {
            const state = states.find(s => s.entity_id === entityId);
            const el = document.getElementById(id);
            if (el && state) el.textContent = state.state === 'Unknown' ? '–' : state.state;
        });
    }

    async refreshDashboardData() {
        try {
            // Nur benötigte Entities laden für bessere Performance
            const requiredEntities = [
                // Solar
                'sensor.jarvis_solar_aktuell', 'sensor.jarvis_solar_heute',
                'sensor.hm1500_power', 'sensor.hm1500_yieldday',
                // Battery
                'sensor.gesamt_batterie_soc', 'sensor.batterie_summe',
                'sensor.gesamt_lade_leistung', 'sensor.gesamt_entlade_leistung',
                // Grid/House
                'sensor.power_import_grid', 'sensor.power_grid_total_raw',
                'sensor.jarvis_gesamt_verbrauch', 'sensor.shelly_3em_total_power',
                // Climate
                'climate.split_klimaanlage', 'climate.schlafzimmer', 'switch.klima_schlafzimmer',
                // Environment temps
                'sensor.garten', 'sensor.pool_temperatur',
                'sensor.wohnzimmer_echo_temperatur', 'sensor.arbeitszimmer_temperatur',
                // Status sensors
                'binary_sensor.jarvis_status_haos', 'binary_sensor.jarvis_status_proxmox',
                'binary_sensor.jarvis_status_nas', 'binary_sensor.jarvis_status_gateway',
                'binary_sensor.jarvis_status_solar', 'binary_sensor.jarvis_status_zigbee',
                'binary_sensor.jarvis_status_opendtu', 'binary_sensor.jarvis_status_jarvis_api'
            ];
            
            // States einzeln laden und zusammenführen
            const states = [];
            for (const entityId of requiredEntities) {
                try {
                    const state = await this.haFetch(`/api/states/${entityId}`);
                    if (state && state.entity_id) states.push(state);
                } catch (e) { /* Entity nicht gefunden */ }
            }
            
            if (states.length > 0) {
                this.updateEnergyWidgets(states);
                this.updateClimateWidget(states);
                this.updateEnvironmentWidgets(states);
                this.updateStatusPanel(states);
                this.updateEntityCount(states.length);
            }
        } catch (error) {
            console.warn('Dashboard-Daten konnten nicht geladen werden:', error);
            this.addAlert('HA-Verbindung unterbrochen', 'error');
        }
    }

    async handleCommandButton(btn) {
        const command = btn.dataset.command;
        const entityId = btn.dataset.entity;
        const service = btn.dataset.service;
        const value = btn.dataset.value;
        
        // Visuelles Feedback
        btn.classList.toggle('active');
        setTimeout(() => btn.classList.toggle('active'), 600);

        if (service && entityId) {
            const data = {};
            if (service.startsWith('light.') || service.startsWith('switch.')) {
                // Keine extra Daten nötig
            } else if (service.startsWith('climate.')) {
                if (service.includes('hvac_mode')) data.hvac_mode = value;
            }
            await this.callService(entityId, service, data);
        }

        if (command) {
            this.sendMessage(command);
        }
    }

    async callService(entityId, service, data = {}) {
        const [domain, serviceName] = service.split('.');
        const url = `${this.apiBaseUrl}/api/jarvis/ha-proxy/api/services/${domain}/${serviceName}`;
        const headers = {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.apiKey}`,
            'ngrok-skip-browser-warning': 'true'
        };
        if (this.config.authToken) {
            headers['X-Jarvis-Auth-Token'] = this.config.authToken;
            headers['X-Jarvis-User-Id'] = this.user.id;
        }

        try {
            const response = await fetch(url, {
                method: 'POST',
                headers,
                body: JSON.stringify({ entity_id: entityId, ...data })
            });
            if (!response.ok) throw new Error(`Service ${response.status}`);
            this.showNotification('Befehl ausgeführt', 'success');
            setTimeout(() => this.refreshDashboardData(), 1000);
        } catch (error) {
            console.error('Service-Fehler:', error);
            this.showNotification('Befehl fehlgeschlagen', 'error');
        }
    }

    loadCameraFeed(cameraKey) {
        const feed = document.getElementById('cameraFeed');
        if (!feed) return;

        if (!cameraKey) {
            feed.innerHTML = '<div class="camera-placeholder">Kamera wählen</div>';
            return;
        }

        // Reolink / Frigate / Doorbird über HA Proxy mit Cache-Busting
        const entityId = `camera.${cameraKey}_main`;
        const url = `${this.apiBaseUrl}/api/jarvis/ha-proxy/api/camera_proxy/${entityId}?token=${Date.now()}`;
        feed.innerHTML = `<img src="${url}" alt="${cameraKey}" id="liveCameraFeed" onerror="this.parentElement.innerHTML='<div class=camera-placeholder>Bild nicht verfügbar</div>'">`;
        
        // Aktualisiere Bild alle 2 Sekunden
        if (this.cameraInterval) clearInterval(this.cameraInterval);
        this.cameraInterval = setInterval(() => {
            const img = document.getElementById('liveCameraFeed');
            if (img) img.src = `${url}&t=${Date.now()}`;
        }, 2000);
    }

    openChatPanel() {
        const overlay = document.getElementById('chatOverlay');
        const body = document.getElementById('chatPanelBody');
        if (!overlay || !body) return;

        overlay.style.display = 'flex';
        body.innerHTML = '';
        
        // Lade letzte Konversationseinträge
        const log = this.getConversationLog().slice(-20);
        log.forEach(entry => {
            const bubble = document.createElement('div');
            bubble.className = `message-bubble ${entry.sender}`;
            const avatar = entry.sender === 'jarvis' ? 'J' : this.user.name.charAt(0);
            bubble.innerHTML = `
                <div class="message-avatar">${avatar}</div>
                <div class="message-content">
                    <p>${this.escapeHtml(entry.text)}</p>
                    <span class="message-time">${new Date(entry.timestamp).toLocaleTimeString('de-DE', {hour:'2-digit', minute:'2-digit'})}</span>
                </div>
            `;
            body.appendChild(bubble);
        });
        
        body.scrollTop = body.scrollHeight;
    }

    addAlert(text, type = 'info') {
        const list = document.getElementById('alertsList');
        if (!list) return;
        
        const item = document.createElement('div');
        item.className = `alert-item ${type}`;
        item.innerHTML = `<span class="alert-dot"></span>${this.escapeHtml(text)}`;
        list.prepend(item);
        
        // Max 5 alerts
        while (list.children.length > 5) {
            list.removeChild(list.lastChild);
        }
    }

    // ==================== SPRACHERKENNUNG ====================

    initSpeechRecognition() {
        if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
            console.warn('Spracherkennung nicht verfügbar');
            const statusEl = document.getElementById('voiceStatusCenter');
            if (statusEl) statusEl.textContent = 'Texteingabe';
            return;
        }
        
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        this.recognition = new SpeechRecognition();
        
        // continuous=true verhindert, dass Chrome nach kurzer Pause abbricht
        this.recognition.continuous = true;
        this.recognition.interimResults = true;
        this.recognition.lang = this.config.language;
        
        // Letztes Interim als Fallback merken
        this._lastInterimTranscript = '';
        
        this.recognition.onstart = () => {
            this.isListening = true;
            this._lastInterimTranscript = '';
            this.updateVoiceStatus('HÖRE...', 'listening');
        };
        
        this.recognition.onresult = (event) => {
            let finalTranscript = '';
            let interimTranscript = '';
            
            for (let i = event.resultIndex; i < event.results.length; i++) {
                const transcript = event.results[i][0].transcript;
                if (event.results[i].isFinal) {
                    finalTranscript += transcript;
                } else {
                    interimTranscript += transcript;
                }
            }
            
            if (interimTranscript) {
                this._lastInterimTranscript = interimTranscript;
                const statusEl = document.getElementById('voiceStatusCenter');
                if (statusEl) statusEl.textContent = interimTranscript;
                // Optional: Interim-Transkripte loggen
                if (this.config.logInterim) {
                    this.logConversation(interimTranscript, 'interim');
                }
            }
            
            if (finalTranscript) {
                this._lastInterimTranscript = '';
                this.logDebug('final transcript', {text: finalTranscript});
                this.sendMessage(finalTranscript);
            }
        };
        
        this.recognition.onend = () => {
            this.logDebug('recognition.onend', {lastInterim: this._lastInterimTranscript});
            // Fallback: falls nur Interim-Resultate vorhanden waren, sende das letzte Interim
            if (this._lastInterimTranscript && this._lastInterimTranscript.trim()) {
                const fallback = this._lastInterimTranscript.trim();
                this._lastInterimTranscript = '';
                this.sendMessage(fallback);
            }
            this.isListening = false;
            this.updateVoiceStatus('BEREIT', 'ready');
        };
        
        this.recognition.onerror = (event) => {
            this.logDebug('recognition.onerror', {error: event.error});
            // Bei "no-speech" nicht als Fehler werten, sondern einfach bereit sein
            if (event.error === 'no-speech') {
                this.updateVoiceStatus('Bereit', 'ready');
            } else {
                this.isListening = false;
                this.updateVoiceStatus('FEHLER - TIPPEN', 'error');
            }
        };
    }

    toggleVoiceInput() {
        if (!this.recognition) {
            this.showNotification('Spracherkennung nicht verfügbar', 'error');
            return;
        }
        
        if (this.isListening) {
            this.recognition.stop();
        } else {
            try {
                this.recognition.start();
            } catch (e) {
                console.error('Konnte Spracherkennung nicht starten:', e);
            }
        }
    }

    updateVoiceStatus(text, state) {
        const statusEl = document.getElementById('voiceStatusCenter');
        const voiceCore = document.getElementById('voiceCore');
        const aiCore = document.getElementById('aiCoreContainer');
        
        if (statusEl) statusEl.textContent = text;
        
        if (voiceCore) voiceCore.classList.remove('active', 'listening', 'speaking');
        if (aiCore) aiCore.classList.remove('listening', 'speaking', 'error');
        
        if (state === 'listening') {
            if (voiceCore) voiceCore.classList.add('active', 'listening');
            if (aiCore) aiCore.classList.add('listening');
        } else if (state === 'active' || state === 'speaking') {
            if (voiceCore) voiceCore.classList.add('active', 'speaking');
            if (aiCore) aiCore.classList.add('speaking');
        } else if (state === 'error') {
            if (aiCore) aiCore.classList.add('error');
            if (statusEl) statusEl.style.color = '#ff6464';
        } else {
            if (statusEl) statusEl.style.color = '';
        }
    }

    // ==================== SPRACHAUSGABE ====================

    initVoices() {
        if (this.synthesis) {
            // Voices laden
            const loadVoices = () => {
                this.voices = this.synthesis.getVoices();
            };
            
            loadVoices();
            
            if (speechSynthesis.onvoiceschanged !== undefined) {
                speechSynthesis.onvoiceschanged = loadVoices;
            }
        }
    }

    speak(text, { onstart, onend } = {}) {
        if (!this.synthesis) return;
        if (this.config.autoSpeak === false) return;

        const aiCore = document.getElementById('aiCoreContainer');
        const setSpeaking = (active) => {
            if (aiCore) aiCore.classList.toggle('speaking', active);
        };

        // Chrome/Android: AudioContext/SpeechSynthesis muss durch User-Gesture initialisiert sein
        const unlockAudio = () => {
            this.synthesis.cancel();
            const unlock = new SpeechSynthesisUtterance(' ');
            unlock.volume = 0;
            this.synthesis.speak(unlock);
        };
        if (!this.audioUnlocked) {
            try { unlockAudio(); } catch (e) {}
            this.audioUnlocked = true;
        }

        this.synthesis.cancel();

        let speakableText = text.replace(/J\.A\.R\.V\.I\.S\./g, 'Jarvis');

        const utterance = new SpeechSynthesisUtterance(speakableText);
        utterance.lang = 'de-DE';
        utterance.rate = 1.0;
        utterance.pitch = 0.9;

        if (this.voices && this.voices.length > 0) {
            const germanVoice = this.voices.find(v =>
                v.lang.startsWith('de') && v.name.includes('Google')
            ) || this.voices.find(v => v.lang.startsWith('de'));
            if (germanVoice) utterance.voice = germanVoice;
        }

        utterance.onstart = () => {
            this.updateVoiceStatus('SPRECHVORGANG...', 'speaking');
            setSpeaking(true);
            if (typeof onstart === 'function') onstart();
        };
        utterance.onend = () => {
            this.updateVoiceStatus('Bereit', 'ready');
            setSpeaking(false);
            if (typeof onend === 'function') onend();
        };
        utterance.onerror = (e) => {
            console.error('[JARVIS TTS]', e.error);
            setSpeaking(false);
            if (typeof onend === 'function') onend();
        };

        this.synthesis.speak(utterance);
    }

    // ==================== API KOMMUNIKATION ====================

    async sendMessage(message) {
        this.logDebug('sendMessage called', {message, length: message ? message.length : 0});
        
        if (!message || !message.trim()) {
            this.logDebug('sendMessage ignored: empty message');
            this.updateVoiceStatus('Bereit', 'ready');
            return;
        }
        
        const cleanMessage = message.trim();
        
        // Zeige User-Nachricht und logge sie
        this.addMessage(cleanMessage, 'user');
        this.logConversation(cleanMessage, 'user');
        
        // Aktiviere Lade-Zustand
        this.updateVoiceStatus('Verarbeite...', 'active');
        
        try {
            const location = document.getElementById('currentLocation')?.textContent || 'Wohnzimmer';
            const salutation = 'Sir';
            
            // System-Prompt für J.A.R.V.I.S. Persönlichkeit
            const systemPrompt = `Du bist J.A.R.V.I.S., der persönliche KI-Assistent und Butler von Mike Schiller.\n` +
                `Stil: britisches Understatement, trockener Humor, professionell, loyal, analytisch, elegant. Sprache: Hochdeutsch. Anrede: ${salutation}.\n` +
                `\n` +
                `REGELN:\n` +
                `- Antworte kurz, prägnant, ohne typische KI-Floskeln.\n` +
                `- \"Master Mike\" nur bei ernsten Alarmen/Gefahren (Einbruch, Feuer, Wasser, Stromausfall, schwerer Fehler).\n` +
                `- Du hast Zugriff auf Smart Home, E-Mail, Web-Suche, Termine und Server.\n` +
                `- Beantworte Uhrzeit- und Datumsfragen direkt mit einer konkreten Angabe. Vermeide Sätze wie \"Ich kann die exakte Zeit nicht nennen\".\n` +
                `- Klimaanlage \"an\" immer mit Rückfrage; schalte niemals ohne Bestätigung ein.\n` +
                `- Zeige niemals rohe tool_call-Blöcke, nur menschenlesbare Antworten.\n` +
                `\n` +
                `Nutzer: ${this.user.name}, Rolle: ${this.user.role}. Raum: ${location}.`;

            const headers = {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.apiKey}`,
                'ngrok-skip-browser-warning': 'true'
            };
            if (this.config.authToken) {
                headers['X-Jarvis-Auth-Token'] = this.config.authToken;
                headers['X-Jarvis-User-Id'] = this.user.id;
            }
            
            const url = `${this.apiBaseUrl}/api/jarvis/v1/chat/completions`;
            this.logDebug('API request', {url, apiBaseUrl: this.apiBaseUrl, hasAuthToken: !!this.config.authToken, userId: this.user?.id});
            
            const response = await fetch(url, {
                method: 'POST',
                headers: headers,
                body: JSON.stringify({
                    model: 'hermes-agent',
                    stream: true,
                    max_tokens: 120,
                    messages: [
                        { role: 'system', content: systemPrompt },
                        { role: 'user', content: cleanMessage }
                    ]
                })
            });
            
            if (!response.ok) {
                const errorText = await response.text().catch(() => `HTTP ${response.status}`);
                this.logDebug('API error response', {status: response.status, body: errorText});
                throw new Error(`HTTP ${response.status}: ${errorText}`);
            }
            
            // Streaming-Verarbeitung: Text live anzeigen, Sprache erst am Ende
            const reader = response.body.getReader();
            const decoder = new TextDecoder('utf-8');
            let streamedText = '';
            let buffer = '';
            
            // Leere Antwort-Bubble anlegen, die während des Streams befüllt wird
            this.addMessage('', 'jarvis', { ephemeral: true });
            const jarvisBubbles = document.querySelectorAll('.message-bubble.jarvis[data-ephemeral="true"]');
            const contentEl = jarvisBubbles[jarvisBubbles.length - 1]?.querySelector('.message-content p');
            
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                
                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop(); // unvollständige Zeile zurückbehalten
                
                for (const line of lines) {
                    const trimmed = line.trim();
                    if (!trimmed.startsWith('data:')) continue;
                    const dataStr = trimmed.slice(5).trim();
                    if (dataStr === '[DONE]') continue;
                    
                    try {
                        const chunk = JSON.parse(dataStr);
                        const delta = chunk.choices?.[0]?.delta;
                        if (delta?.content) {
                            streamedText += delta.content;
                            if (contentEl) {
                                contentEl.textContent = streamedText;
                                contentEl.parentElement.scrollTop = contentEl.parentElement.scrollHeight;
                            }
                        }
                    } catch (e) {
                        // Ungültiges Chunk ignorieren
                    }
                }
            }
            
            const jarvisResponse = streamedText || 'Entschuldigung, Sir. Ich habe keine Antwort erhalten.';
            
            // Rohe tool_call-Blöcke aus der finalen Antwort entfernen
            const cleanedResponse = this.sanitizeResponse(jarvisResponse);
            
            // Temporäre Bubble in finale Bubble umwandeln
            const jarvisBubblesFinal = document.querySelectorAll('.message-bubble.jarvis[data-ephemeral="true"]');
            const finalBubble = jarvisBubblesFinal[jarvisBubblesFinal.length - 1];
            if (finalBubble) {
                finalBubble.removeAttribute('data-ephemeral');
                finalBubble.querySelector('.message-content p').textContent = cleanedResponse;
                this.logConversation(cleanedResponse, 'jarvis');
            } else {
                // Fallback falls Bubble nicht existiert
                this.addMessage(cleanedResponse, 'jarvis');
            }
            
            // Sprich Antwort erst jetzt aus, wenn der Stream komplett ist
            this.speak(cleanedResponse);
            
            // Speichere in Konversation
            this.conversation.push({
                user: cleanMessage,
                jarvis: cleanedResponse,
                timestamp: new Date()
            });
            
        } catch (error) {
            this.logDebug('sendMessage catch error', {message: error.message, stack: error.stack});
            const errorMsg = 'Entschuldigung, Sir. Die Verbindung zum Hauptsystem ist unterbrochen.';
            // Immer loggen, auch wenn UI nicht bereit
            this.logConversation(errorMsg, 'jarvis');
            this.logConversation(`ERROR: ${error.message || error}`, 'jarvis');
            try {
                this.addMessage(errorMsg, 'jarvis');
            } catch (uiError) {
                this.logDebug('UI error showing error message', {message: uiError.message});
            }
            this.conversation.push({
                user: cleanMessage,
                jarvis: errorMsg,
                timestamp: new Date()
            });
            this.speak(errorMsg);
        }
        
        this.updateVoiceStatus('Bereit', 'ready');
    }
    
    sanitizeResponse(text) {
        // Entfernt rohe tool_call-Blöcke, die manche Modelle ausgeben, bevor sie Tools ausführen
        if (!text) return text;
        // Filter Markdown-Codeblöcke mit tool_call
        return text
            .replace(/```\s*tool_call[\s\S]*?```/gi, '')
            .replace(/\{\s*"name"\s*:\s*"(ha_|tool_|call_)[^"]*"[\s\S]*?\}/g, '')
            .trim();
    }

    addMessage(text, sender, { ephemeral = false } = {}) {
        const chatContainer = document.getElementById('chatContainer');
        if (!chatContainer) return;
        
        let messageBubble;
        if (ephemeral) {
            // Ersetze vorhandene ephemeral Bubble desselben Senders
            const existing = chatContainer.querySelector(`.message-bubble.${sender}[data-ephemeral="true"]`);
            if (existing) {
                messageBubble = existing;
                messageBubble.querySelector('.message-content p').textContent = text;
                return messageBubble;
            }
        }
        
        messageBubble = document.createElement('div');
        messageBubble.className = `message-bubble ${sender}`;
        if (ephemeral) messageBubble.setAttribute('data-ephemeral', 'true');
        
        const time = this.getTimeString();
        const avatar = sender === 'jarvis' ? 'J' : this.user.name.charAt(0);
        
        messageBubble.innerHTML = `
            <div class="message-avatar">${avatar}</div>
            <div class="message-content">
                <p>${this.escapeHtml(text)}</p>
                <span class="message-time">${time}</span>
            </div>
        `;
        
        chatContainer.appendChild(messageBubble);
        chatContainer.scrollTop = chatContainer.scrollHeight;
        
        // Speichere im Konversationslog (nur echte Nachrichten, nicht temporäre Stream-Bubbles)
        if (!ephemeral && text) {
            this.logConversation(text, sender);
        }
        return messageBubble;
    }
    
    logConversation(text, sender) {
        const logEntry = {
            timestamp: new Date().toISOString(),
            sender: sender,
            text: text,
            user: this.user?.name || 'unknown'
        };
        
        // Lade bestehendes Log
        let conversationLog = JSON.parse(localStorage.getItem('jarvis_conversation_log') || '[]');
        conversationLog.push(logEntry);
        
        // Speichere nur letzte 100 Einträge
        if (conversationLog.length > 100) {
            conversationLog = conversationLog.slice(-100);
        }
        
        localStorage.setItem('jarvis_conversation_log', JSON.stringify(conversationLog));
    }
    
    logDebug(label, data = null) {
        const entry = data ? `${label}: ${JSON.stringify(data)}` : label;
        console.log(`[JARVIS DEBUG] ${entry}`);
        this.logConversation(entry, 'debug');
    }
    
    getConversationLog() {
        return JSON.parse(localStorage.getItem('jarvis_conversation_log') || '[]');
    }
    
    clearConversationLog() {
        localStorage.removeItem('jarvis_conversation_log');
    }

    renderConversationLog() {
        const list = document.getElementById('conversationLogList');
        const countEl = document.getElementById('logCount');
        if (!list || !countEl) return;
        
        const log = this.getConversationLog().slice(-50).reverse();
        countEl.textContent = log.length;
        
        if (log.length === 0) {
            list.innerHTML = '<div class="placeholder-text">Keine Einträge vorhanden.</div>';
            return;
        }
        
        list.innerHTML = '';
        log.forEach(entry => {
            const item = document.createElement('div');
            item.className = `log-entry ${entry.sender}`;
            const time = new Date(entry.timestamp).toLocaleTimeString('de-DE', {
                hour: '2-digit', minute: '2-digit', second: '2-digit'
            });
            const senderLabel = {
                user: 'Mike',
                jarvis: 'J.A.R.V.I.S.',
                interim: 'Spracheingabe',
                debug: 'DEBUG'
            }[entry.sender] || entry.sender;
            item.innerHTML = `
                <div class="log-time">${time}</div>
                <span class="log-sender">${senderLabel}</span>
                <span class="log-text">${this.escapeHtml(entry.text)}</span>
            `;
            list.appendChild(item);
        });
    }
    
    exportConversationLog() {
        const log = this.getConversationLog();
        if (log.length === 0) {
            this.showNotification('Keine Logs zum Exportieren', 'error');
            return;
        }
        const blob = new Blob([JSON.stringify(log, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `jarvis-log-${new Date().toISOString().slice(0, 10)}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        this.showNotification('Log exportiert', 'success');
    }

    // ==================== HILFSFUNKTIONEN ====================

    getTimeString() {
        const now = new Date();
        return now.toLocaleTimeString('de-DE', { 
            hour: '2-digit', 
            minute: '2-digit' 
        });
    }

    updateSystemTime() {
        const timeEl = document.getElementById('systemTime');
        if (timeEl) {
            timeEl.textContent = new Date().toLocaleTimeString('de-DE');
        }
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    showNotification(message, type = 'info') {
        // Einfache Toast-Notification
        const toast = document.createElement('div');
        toast.style.cssText = `
            position: fixed;
            bottom: 20px;
            right: 20px;
            background: ${type === 'success' ? 'rgba(0, 212, 255, 0.9)' : type === 'error' ? 'rgba(255, 100, 100, 0.9)' : 'rgba(0, 212, 255, 0.7)'};
            color: ${type === 'success' ? '#000' : '#fff'};
            padding: 12px 20px;
            border-radius: 8px;
            font-size: 0.9rem;
            z-index: 10000;
            animation: message-appear 0.3s ease;
        `;
        toast.textContent = message;
        document.body.appendChild(toast);
        
        setTimeout(() => {
            toast.remove();
        }, 3000);
    }

    // ==================== KAMERA / BILDANALYSE ====================

    initCamera() {
        this.cameraStream = null;
        this.cameraOverlay = document.getElementById('cameraOverlay');
        this.cameraVideo = document.getElementById('cameraVideo');
        this.cameraCanvas = document.getElementById('cameraCanvas');
        this.cameraBtn = document.getElementById('cameraBtn');
        this.cameraCapture = document.getElementById('cameraCapture');
        this.cameraCancel = document.getElementById('cameraCancel');

        if (this.cameraBtn) {
            this.cameraBtn.addEventListener('click', () => this.openCamera());
        }
        if (this.cameraCapture) {
            this.cameraCapture.addEventListener('click', () => this.captureAndAnalyze());
        }
        if (this.cameraCancel) {
            this.cameraCancel.addEventListener('click', () => this.closeCamera());
        }
    }

    async openCamera() {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            this.showNotification('Kamera wird in diesem Browser nicht unterstützt.', 'error');
            return;
        }

        try {
            this.cameraStream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: 'environment' },
                audio: false
            });
            this.cameraVideo.srcObject = this.cameraStream;
            this.cameraOverlay.style.display = 'flex';
        } catch (err) {
            console.error('Kamera-Fehler:', err);
            this.showNotification('Kamera-Zugriff verweigert oder nicht verfügbar.', 'error');
        }
    }

    closeCamera() {
        if (this.cameraStream) {
            this.cameraStream.getTracks().forEach(track => track.stop());
            this.cameraStream = null;
        }
        if (this.cameraVideo) {
            this.cameraVideo.srcObject = null;
        }
        if (this.cameraOverlay) {
            this.cameraOverlay.style.display = 'none';
        }
    }

    async captureAndAnalyze() {
        if (!this.cameraVideo || !this.cameraVideo.videoWidth) {
            this.showNotification('Kamera noch nicht bereit.', 'error');
            return;
        }

        const ctx = this.cameraCanvas.getContext('2d');
        this.cameraCanvas.width = this.cameraVideo.videoWidth;
        this.cameraCanvas.height = this.cameraVideo.videoHeight;
        ctx.drawImage(this.cameraVideo, 0, 0);

        // JPEG mit reduzierter Qualität, damit Base64 nicht zu groß wird
        const imageBase64 = this.cameraCanvas.toDataURL('image/jpeg', 0.85);

        this.closeCamera();
        await this.sendImageForAnalysis(imageBase64);
    }

    async sendImageForAnalysis(imageBase64) {
        const message = 'Was siehst du auf diesem Bild?';
        this.addMessage(message, 'user');
        this.addMessage('Bildanalyse läuft...', 'jarvis');
        this.updateVoiceStatus('Analysiere...', 'active');

        const location = document.getElementById('currentLocation')?.textContent || 'Wohnzimmer';
        const salutation = Math.random() > 0.5 ? 'Sir' : 'Master';

        const systemPrompt = `Du bist J.A.R.V.I.S. (Just A Rather Very Intelligent System), der persönliche KI-Assistent und Butler von Mike Schiller.\n` +
            `Stil: britisches Understatement, trockener, subtiler Humor, professionell, loyal, analytisch, elegant und auf den Punkt.\n` +
            `Sprache: Hochdeutsch. Anrede: ${salutation}.\n` +
            `Sprechweise:\n` +
            `- Beginne gelegentlich mit einer kurzen Bestätigung: \"Sehr wohl, Sir.\", \"Natürlich, Sir.\", \"Verstanden, Master.\", \"Wie gewünscht, Sir.\"\n` +
            `- Verwende subtile Floskeln wie \"eine Momentaufnahme der Lage\", \"mit aller gebotenen Vorsicht\", \"das System ist stabil, wenn auch nicht begeistert\".\n` +
            `- Bleibe sachlich; Sarkasmus nur warm und respektvoll.\n` +
            `- Vermeide typische KI-Standardfloskeln.\n` +
            `- Füge bei passenden Gelegenheiten einen trockenen Kommentar am Ende hinzu.\n` +
            `Beschreibe das Bild präzise und knapp. Nenne auffällige Objekte, Farben, Personen oder Texte.\n` +
            `Der aktuelle Nutzer ist ${this.user.name} (Rolle: ${this.user.role}).\n` +
            `Der Nutzer befindet sich aktuell im Raum: ${location}.`;

        const headers = {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.apiKey}`,
            'ngrok-skip-browser-warning': 'true'
        };
        if (this.config.authToken) {
            headers['X-Jarvis-Auth-Token'] = this.config.authToken;
            headers['X-Jarvis-User-Id'] = this.user.id;
        }

        try {
            const response = await fetch(`${this.apiBaseUrl}/api/jarvis/v1/chat/completions`, {
                method: 'POST',
                headers: headers,
                body: JSON.stringify({
                    model: 'hermes-agent',
                    stream: false,
                    messages: [
                        { role: 'system', content: systemPrompt },
                        {
                            role: 'user',
                            content: [
                                { type: 'text', text: 'Was siehst du auf diesem Bild? Antworte auf Deutsch.' },
                                { type: 'image_url', image_url: { url: imageBase64 } }
                            ]
                        }
                    ]
                })
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            const data = await response.json();
            const jarvisResponse = data.choices?.[0]?.message?.content || 'Entschuldigung, Sir. Ich konnte das Bild nicht analysieren.';

            this.addMessage(jarvisResponse, 'jarvis');
            this.speak(jarvisResponse);
            this.conversation.push({ user: message, jarvis: jarvisResponse, timestamp: new Date() });
        } catch (error) {
            console.error('Bildanalyse Fehler:', error);
            const errorMsg = 'Entschuldigung, Sir. Die Bildanalyse ist vorübergehend nicht verfügbar.';
            this.addMessage(errorMsg, 'jarvis');
            this.speak(errorMsg);
        }

        this.updateVoiceStatus('Bereit', 'ready');
    }

    // ==================== SERVICE WORKER ====================

    registerServiceWorker() {
        if (!('serviceWorker' in navigator)) return;

        const scope = window.location.pathname;

        // Nur alte Registrations außerhalb des aktuellen Scopes entfernen
        navigator.serviceWorker.getRegistrations().then(regs => {
            return Promise.all(regs.map(reg => {
                const regScope = reg.scope || '';
                // Wenn der Scope nicht passt oder ein anderer Pfad aktiv ist, aufräumen
                const baseScope = new URL(regScope).pathname;
                if (baseScope !== scope) {
                    return reg.unregister().catch(() => false);
                }
                return Promise.resolve(true);
            }));
        }).then(() => {
            return navigator.serviceWorker.register('/sw.js', { scope, updateViaCache: 'none' });
        }).then(reg => {
            console.log('[JARVIS] Service Worker registriert');

            reg.addEventListener('updatefound', () => {
                const newWorker = reg.installing;
                if (!newWorker) return;
                newWorker.addEventListener('statechange', () => {
                    if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                        newWorker.postMessage({ type: 'SKIP_WAITING' });
                    }
                });
            });

            // Regelmäßig auf Updates prüfen (alle 5 Minuten)
            setInterval(() => reg.update().catch(() => {}), 300000);
        }).catch(err => console.log('[JARVIS] Service Worker Registrierung fehlgeschlagen', err));

        let refreshing = false;
        navigator.serviceWorker.addEventListener('controllerchange', () => {
            if (refreshing) return;
            refreshing = true;
            window.location.reload();
        });
    }
}

// ==================== INITIALISIERUNG ====================

document.addEventListener('DOMContentLoaded', () => {
    window.jarvis = new JarvisPWA();
});
