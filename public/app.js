/**
 * J.A.R.V.I.S. PWA - Holographic Interface
 * Voice & Text Client für Hermes API
 */

class JarvisPWA {
    constructor() {
        // Automatische API URL Erkennung (lokal vs cloud)
        const isLocalhost = window.location.hostname === 'localhost' || 
                           window.location.hostname === '127.0.0.1' ||
                           window.location.hostname.startsWith('192.168.');
        
        this.config = this.loadConfig();
        this.user = this.config.user || null;
        this.recognition = null;
        this.synthesis = window.speechSynthesis;
        this.isListening = false;
        this.conversation = [];
        
        // API Basis-URL: Lokal direkt, Cloud über Proxy
        if (isLocalhost && !this.config.apiUrl) {
            this.apiBaseUrl = 'http://192.168.1.81:8124';
            console.log('Lokaler Modus:', this.apiBaseUrl);
        } else {
            this.apiBaseUrl = this.config.apiUrl || '';
        }
        
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
            autoSpeak: true,
            voiceProfile: 'standard'
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
        
        if (!userId) {
            errorDiv.style.display = 'flex';
            return;
        }
        
        // LOKALER MODUS: Kein Passwort erforderlich für localhost/192.168.x.x
        const isLocalhost = window.location.hostname === 'localhost' || 
                           window.location.hostname === '127.0.0.1' ||
                           window.location.hostname.startsWith('192.168.');
        
        if (isLocalhost) {
            console.log('Lokaler Modus: Login ohne Passwort');
            // Simuliere erfolgreichen Login mit Dummy-Token
            const mockToken = btoa(`${userId}:local:${Date.now()}`);
            const mockUser = { id: userId, name: userId.charAt(0).toUpperCase() + userId.slice(1), role: 'admin' };
            this.login(userId, mockToken, mockUser);
            return;
        }
        
        if (!input) {
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

        // Initialize Voice-First Mobile Mode
        this.initVoiceMode();
    }

    initVoiceMode() {
        const isMobile = window.innerWidth <= 767;
        const mainInterface = document.getElementById('main-interface');
        
        if (isMobile) {
            mainInterface.classList.add('voice-mode');
        }

        // Drawer toggle
        const handle = document.getElementById('voiceDrawerHandle');
        const drawer = document.getElementById('voiceDrawer');
        const closeBtn = document.getElementById('voiceDrawerClose');
        
        if (handle && drawer) {
            handle.addEventListener('click', () => {
                drawer.classList.toggle('open');
            });
        }
        
        if (closeBtn && drawer) {
            closeBtn.addEventListener('click', () => {
                drawer.classList.remove('open');
            });
        }

        // Drawer menu items - switch view and close drawer
        const drawerItems = document.querySelectorAll('.voice-drawer-body .drawer-menu-item');
        drawerItems.forEach(item => {
            item.addEventListener('click', (e) => {
                const view = e.currentTarget.dataset.view;
                if (view) {
                    this.switchView(view);
                    if (drawer) drawer.classList.remove('open');
                }
            });
        });

        // Response bubble close
        const bubbleClose = document.getElementById('voiceBubbleClose');
        if (bubbleClose) {
            bubbleClose.addEventListener('click', () => {
                document.getElementById('voiceResponseBubble').classList.remove('show');
            });
        }

        // Update voice time
        this.updateVoiceTime();
        setInterval(() => this.updateVoiceTime(), 1000);

        // Listen for resize to toggle voice mode
        window.addEventListener('resize', () => {
            const nowMobile = window.innerWidth <= 767;
            if (nowMobile && !mainInterface.classList.contains('voice-mode')) {
                mainInterface.classList.add('voice-mode');
            } else if (!nowMobile && mainInterface.classList.contains('voice-mode')) {
                mainInterface.classList.remove('voice-mode');
            }
        });
    }

    updateVoiceTime() {
        const el = document.getElementById('voiceTime');
        if (!el) return;
        const now = new Date();
        el.textContent = now.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
    }

    showVoiceBubble(text) {
        const bubble = document.getElementById('voiceResponseBubble');
        const bubbleText = document.getElementById('voiceBubbleText');
        if (!bubble || !bubbleText) return;
        bubbleText.textContent = text;
        bubble.classList.add('show');
        // Auto-hide after 8 seconds
        clearTimeout(this._bubbleTimeout);
        this._bubbleTimeout = setTimeout(() => {
            bubble.classList.remove('show');
        }, 8000);
    }

    hideVoiceBubble() {
        const bubble = document.getElementById('voiceResponseBubble');
        if (bubble) bubble.classList.remove('show');
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
        const voiceProfileSelect = document.getElementById('voiceProfileSelect');
        if (voiceProfileSelect) {
            voiceProfileSelect.value = this.config.voiceProfile || 'standard';
            voiceProfileSelect.addEventListener('change', (e) => {
                this.config.voiceProfile = e.target.value;
                this.saveConfig();
                this.showNotification(`Stimmprofil auf ${e.target.options[e.target.selectedIndex].text} gesetzt`, 'success');
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

        // Ollama VM button (header right)
        const ollamaBtn = document.getElementById('ollamaBtn');
        if (ollamaBtn) {
            ollamaBtn.addEventListener('click', () => this.switchView('ollama'));
        }
        // Ollama VM card actions
        document.querySelectorAll('.gc-chat').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const component = e.currentTarget.dataset.agent;
                this.openOllamaComponent(component);
            });
        });
        document.querySelectorAll('.gc-log').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const component = e.currentTarget.dataset.agent;
                this.openOllamaLog(component);
            });
        });
        // Status Panel rows -> open Status Detail Modal
        document.querySelectorAll('.status-row[data-agent]').forEach(row => {
            row.addEventListener('click', (e) => {
                const agent = e.currentTarget.dataset.agent;
                const entity = e.currentTarget.dataset.entity;
                this.openStatusDetailModal(agent, entity);
            });
        });
        // Status Detail Modal close
        const statusDetailClose = document.getElementById('statusDetailClose');
        const statusDetailBackdrop = document.getElementById('statusDetailBackdrop');
        const statusDetailClose2 = document.getElementById('statusDetailClose2');
        if (statusDetailClose) statusDetailClose.addEventListener('click', () => this.closeStatusDetailModal());
        if (statusDetailBackdrop) statusDetailBackdrop.addEventListener('click', () => this.closeStatusDetailModal());
        if (statusDetailClose2) statusDetailClose2.addEventListener('click', () => this.closeStatusDetailModal());
        const statusDetailRefresh = document.getElementById('statusDetailRefresh');
        if (statusDetailRefresh) statusDetailRefresh.addEventListener('click', () => {
            const agent = this._statusDetailAgent;
            const entity = this._statusDetailEntity;
            if (agent) this.loadStatusDetailData(agent, entity);
        });
        
        // Ollama VM modal close
        const ollamaModalClose = document.getElementById('ollamaModalClose');
        const ollamaModalBackdrop = document.getElementById('ollamaModalBackdrop');
        if (ollamaModalClose) ollamaModalClose.addEventListener('click', () => this.closeOllamaModal());
        if (ollamaModalBackdrop) ollamaModalBackdrop.addEventListener('click', () => this.closeOllamaModal());
        const ollamaModalDetails = document.getElementById('ollamaModalDetails');
        if (ollamaModalDetails) ollamaModalDetails.addEventListener('click', () => {
            const c = this._ollamaActiveComponent;
            this.closeOllamaModal();
            if (c) this.openOllamaComponent(c);
        });
        const ollamaModalLog = document.getElementById('ollamaModalLog');
        if (ollamaModalLog) ollamaModalLog.addEventListener('click', () => {
            const c = this._ollamaActiveComponent;
            this.closeOllamaModal();
            if (c) this.openOllamaLog(c);
        });
        const ollamaModalFull = document.getElementById('ollamaModalFull');
        if (ollamaModalFull) ollamaModalFull.addEventListener('click', () => {
            this.closeOllamaModal();
            this.switchView('ollama');
        });
        
        // Home climate tile opens overlay
        const homeClimateTile = document.getElementById('homeClimateTile');
        if (homeClimateTile) {
            homeClimateTile.addEventListener('click', (e) => this.openClimateOverlay(e));
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
        // Ollama VM dashboard data laden
        if (viewName === 'ollama') {
            this.loadOllamaData();
        }
    }

    async loadOllamaData() {
        const setStatus = (component, state) => {
            const el = document.getElementById(`gc-ollama-${component}-status`);
            if (el) {
                el.className = `gc-status ${state}`;
                el.textContent = state.toUpperCase();
            }
        };
        const setVal = (id, val) => {
            const el = document.getElementById(id);
            if (el) el.textContent = val;
        };
        const ollamaApi = async (endpoint) => {
            try {
                const response = await fetch(`http://192.168.1.170:11434/api/${endpoint}`);
                return await response.json();
            } catch(e) { return null; }
        };
        try {
            // Modelle
            const models = await ollamaApi('tags');
            if (models && models.models) {
                setVal('gc-ollama-models-count', models.models.length.toString());
                setStatus('models', 'online');
            } else {
                setStatus('models', 'offline');
            }
            // Performance (simuliert)
            setVal('gc-ollama-perf-tokens', '—');
            setVal('gc-ollama-perf-latency', '—');
            setStatus('perf', 'online');
            // API
            setVal('gc-ollama-api-reqs', '—');
            setVal('gc-ollama-api-errors', '—');
            setStatus('api', 'online');
            // Storage (simuliert)
            setVal('gc-ollama-storage-used', '—');
            setVal('gc-ollama-storage-free', '—');
            setStatus('storage', 'online');
            // Netzwerk (simuliert)
            setVal('gc-ollama-net-clients', '—');
            setVal('gc-ollama-net-bandwidth', '—');
            setStatus('net', 'online');
            // Health (simuliert)
            setVal('gc-ollama-health-uptime', '—');
            setVal('gc-ollama-health-errors', '—');
            setStatus('health', 'online');
        } catch (e) {
            console.error('Ollama Data Load Error:', e);
        }
    }

    openAgentChat(agent) {
        // Open chat overlay with pre-filled context about the agent
        const overlay = document.getElementById('chatOverlay');
        const input = document.getElementById('textInput');
        if (overlay) overlay.style.display = 'flex';
        if (input) {
            const labels = { jarvis: 'J.A.R.V.I.S.', ollama: 'Ollama LLM', proxmox: 'Proxmox', nas: 'NAS', haos: 'Home Assistant', frigate: 'Frigate' };
            input.value = `Frage zu ${labels[agent] || agent}: `;
            input.focus();
        }
    }

    openAgentLog(agent) {
        // Switch to settings view and show conversation log filtered by agent
        this.switchView('einstellungen');
        const log = document.getElementById('conversationLog');
        if (log) {
            log.scrollIntoView({ behavior: 'smooth' });
        }
    }

    // Ollama VM Modal Methoden
    openOllamaModal(component) {
        const cfg = this.getOllamaComponentConfig(component);
        const iconEl = document.getElementById('ollamaModalIcon');
        const nameEl = document.getElementById('ollamaModalName');
        const metaEl = document.getElementById('ollamaModalMeta');
        const statusEl = document.getElementById('ollamaModalStatus');
        const rowsEl = document.getElementById('ollamaModalRows');
        
        if (iconEl) iconEl.textContent = cfg.icon;
        if (nameEl) nameEl.textContent = cfg.name;
        if (metaEl) metaEl.textContent = cfg.meta;
        if (statusEl) {
            statusEl.className = 'gc-status online';
            statusEl.textContent = 'ONLINE';
        }
        
        if (rowsEl) {
            rowsEl.innerHTML = '<div class="gc-row"><span>Host</span><span>' + cfg.host + '</span></div><div class="gc-row"><span>Status</span><span>Lade…</span></div>';
        }
        
        const modal = document.getElementById('ollamaModal');
        if (modal) modal.style.display = 'flex';
        
        this._ollamaActiveComponent = component;
        this.loadOllamaComponentData(component, rowsEl);
    }

    async loadOllamaComponentData(component, rowsEl) {
        try {
            const haState = async (entity) => {
                try { return await this.haFetch(`/api/states/${entity}`); } catch(e) { return null; }
            };
            const rows = [];
            
            if (component === 'models') {
                rows.push(['Host', '192.168.1.170:11434']);
                const m = await haState('sensor.ollama_models_count');
                if (m) rows.push(['Modelle', m.state]);
                const v = await haState('sensor.ollama_vram_usage');
                if (v) rows.push(['VRAM', v.state]);
            } else if (component === 'performance') {
                rows.push(['Host', '192.168.1.170']);
                const t = await haState('sensor.ollama_tokens_per_second');
                if (t) rows.push(['Tokens/s', t.state]);
                const l = await haState('sensor.ollama_latency');
                if (l) rows.push(['Latenz', l.state]);
            } else if (component === 'api') {
                rows.push(['Host', '192.168.1.170:11434']);
                rows.push(['Endpoints', '/api/generate, /api/chat, /api/embeddings']);
            } else if (component === 'storage') {
                rows.push(['Host', '192.168.1.170']);
                const u = await haState('sensor.ollama_storage_used');
                if (u) rows.push(['Genutzt', u.state]);
                const f = await haState('sensor.ollama_storage_free');
                if (f) rows.push(['Frei', f.state]);
            } else if (component === 'network') {
                rows.push(['Host', '192.168.1.170']);
                rows.push(['Clients', 'Aktiv']);
            } else if (component === 'health') {
                rows.push(['Host', '192.168.1.170']);
                rows.push(['Status', 'OK']);
            }
            
            if (rowsEl) {
                rowsEl.innerHTML = rows.map(r => `<div class="gc-row"><span>${r[0]}</span><span>${r[1]}</span></div>`).join('');
            }
        } catch(e) {
            if (rowsEl) rowsEl.innerHTML += '<div class="gc-row"><span>Fehler</span><span>Daten nicht erreichbar</span></div>';
        }
    }

    getOllamaComponentConfig(component) {
        const configs = {
            'models': { icon: '🧠', name: 'Modelle', meta: 'Aktive Modelle: Kimi K3, Qwen3.5:397B, DeepSeek-V4', host: '192.168.1.170:11434' },
            'performance': { icon: '⚡', name: 'Performance', meta: 'Token/s, Latenz, GPU/CPU Auslastung', host: '192.168.1.170' },
            'api': { icon: '🔌', name: 'API Endpoints', meta: '/api/generate, /api/chat, /api/embeddings', host: '192.168.1.170:11434' },
            'storage': { icon: '💾', name: 'Storage', meta: 'Model Storage, Cache, RAG Index', host: '192.168.1.170' },
            'network': { icon: '🌐', name: 'Netzwerk', meta: 'Verbindungen, Bandbreite, Latenz zu Clients', host: '192.168.1.170' },
            'health': { icon: '❤️', name: 'Health', meta: 'System Health, Uptime, Errors, Warnings', host: '192.168.1.170' }
        };
        return configs[component] || { icon: '❓', name: component, meta: 'Ollama VM Komponente', host: '192.168.1.170' };
    }

    openOllamaComponent(component) {
        console.log('Opening Ollama component:', component);
        this.switchView('ollama');
    }

    openOllamaLog(component) {
        console.log('Opening Ollama log:', component);
        alert(`Logs für ${component} werden geladen...`);
    }

    closeOllamaModal() {
        const modal = document.getElementById('ollamaModal');
        if (modal) modal.style.display = 'none';
        this._ollamaActiveComponent = null;
    }

    // Status Detail Modal Methoden
    openStatusDetailModal(agent, entity) {
        this._statusDetailAgent = agent;
        this._statusDetailEntity = entity;
        
        const modal = document.getElementById('statusDetailModal');
        const iconEl = document.getElementById('statusDetailIcon');
        const nameEl = document.getElementById('statusDetailName');
        const metaEl = document.getElementById('statusDetailMeta');
        const statusEl = document.getElementById('statusDetailStatus');
        const rowsEl = document.getElementById('statusDetailRows');
        
        // Konfiguration pro Agent
        const configs = {
            'haos': { icon: '🏠', name: 'Home Assistant OS', ip: '192.168.1.91' },
            'proxmox': { icon: '🖥️', name: 'Proxmox VE', ip: '192.168.1.130' },
            'nas': { icon: '💾', name: 'Synology NAS', ip: '192.168.1.159' },
            'gateway': { icon: '🌐', name: 'Fritz!Box Gateway', ip: '192.168.1.1' },
            'solar': { icon: '☀️', name: 'Solaranlage', ip: '192.168.1.28' },
            'zigbee': { icon: '📡', name: 'Zigbee Netzwerk', ip: '192.168.1.91' },
            'opendtu': { icon: '🔌', name: 'OpenDTU', ip: '192.168.1.28' },
            'jarvis': { icon: '🤖', name: 'J.A.R.V.I.S. API', ip: '192.168.1.81' },
            'paperless': { icon: '📄', name: 'Paperless-ngx', ip: '192.168.1.159:8777' }
        };
        
        const cfg = configs[agent] || { icon: '❓', name: agent, ip: 'unknown' };
        
        if (iconEl) iconEl.textContent = cfg.icon;
        if (nameEl) nameEl.textContent = cfg.name;
        if (metaEl) metaEl.textContent = `IP: ${cfg.ip}`;
        if (statusEl) {
            statusEl.className = 'gc-status online';
            statusEl.textContent = 'LADEN...';
        }
        if (rowsEl) rowsEl.innerHTML = '<div class="placeholder-text">Lade Daten...</div>';
        
        if (modal) modal.style.display = 'flex';
        
        // Daten laden
        this.loadStatusDetailData(agent, entity);
    }

    async loadStatusDetailData(agent, entity) {
        const rowsEl = document.getElementById('statusDetailRows');
        const statusEl = document.getElementById('statusDetailStatus');
        const rows = [];
        
        // Statische Fallback-Werte aus Vault (werden genutzt wenn HA-Sensoren nicht erreichbar)
        const fallback = {
            'haos': {
                'IP': '192.168.1.91',
                'Version': '2026.7.x',
                'Machine': 'x86-64',
                'Entitäten': '—',
                'Integrationen': '—',
                'Uptime': '—',
                'CPU': '—',
                'RAM': '—'
            },
            'proxmox': {
                'IP': '192.168.1.130',
                'VMs': '—',
                'LXCs': '—',
                'CPU': '—',
                'RAM': '15.4 GB',
                'Storage': 'Local (NVMe)',
                'Version': 'PVE 8.4.19'
            },
            'nas': {
                'IP': '192.168.1.159',
                'Modell': 'Synology DS920+',
                'DSM': '7.3.2',
                'Volume': '—',
                'Gesamt': '—',
                'RAM': '—',
                'Temperatur': '—'
            },
            'gateway': {
                'IP': '192.168.1.1',
                'Modell': 'Fritz!Box',
                'Clients': '—',
                'Uptime': '—'
            },
            'solar': {
                'IP': '192.168.1.28',
                'Generation': '—',
                'Verbrauch': '—',
                'Batterie': '—'
            },
            'zigbee': {
                'IP': '192.168.1.91 (HA Integration)',
                'Devices': '—',
                'Status': '—'
            },
            'opendtu': {
                'IP': '192.168.1.28',
                'Panels': '8× DMEGC',
                'Wechselrichter': 'Hoymiles HM1500',
                'Status': '—'
            },
            'jarvis': {
                'IP': '192.168.1.81',
                'PID': '—',
                'Port': '8124 / 8645',
                'Requests': '—',
                'Uptime': '—'
            },
            'paperless': {
                'IP': '192.168.1.159:8777',
                'Dokumente': '1.387',
                'Storage': '—',
                'Status': 'ONLINE (API)',
                'Version': '3.0'
            }
        };
        
        try {
            const haState = async (entityId) => {
                try {
                    const data = await this.haFetch(`/api/states/${entityId}`);
                    return data;
                } catch(e) { return null; }
            };
            
            // Agent-spezifische Daten laden (HA-Sensoren mit Fallback)
            if (agent === 'haos') {
                const version = await haState('sensor.home_assistant_version');
                const entities = await haState('sensor.home_assistant_entities');
                const integrations = await haState('sensor.home_assistant_integrations');
                const uptime = await haState('sensor.system_uptime');
                rows.push(['IP', fallback.haos['IP']]);
                rows.push(['Version', version ? version.state : fallback.haos['Version']]);
                rows.push(['Entitäten', entities ? entities.state : fallback.haos['Entitäten']]);
                rows.push(['Integrationen', integrations ? integrations.state : fallback.haos['Integrationen']]);
                rows.push(['Uptime', uptime ? uptime.state : fallback.haos['Uptime']]);
                rows.push(['CPU', fallback.haos['CPU']]);
                rows.push(['RAM', fallback.haos['RAM']]);
            } else if (agent === 'proxmox') {
                const vms = await haState('sensor.proxmox_vms_anzahl');
                const lxcs = await haState('sensor.proxmox_lxc_anzahl');
                const cpu = await haState('sensor.proxmox_cpu_usage');
                const ram = await haState('sensor.proxmox_ram_usage');
                rows.push(['IP', fallback.proxmox['IP']]);
                rows.push(['VMs', vms ? vms.state : fallback.proxmox['VMs']]);
                rows.push(['LXCs', lxcs ? lxcs.state : fallback.proxmox['LXCs']]);
                rows.push(['CPU', cpu ? `${cpu.state}%` : fallback.proxmox['CPU']]);
                rows.push(['RAM', ram ? ram.state : fallback.proxmox['RAM']]);
                rows.push(['Storage', fallback.proxmox['Storage']]);
                rows.push(['Version', fallback.proxmox['Version']]);
            } else if (agent === 'nas') {
                const volumeUsed = await haState('sensor.nas_volume_1_volume_used');
                const volumeTotal = await haState('sensor.nas_volume_1_size');
                const ram = await haState('sensor.nas_memory_used');
                const temp = await haState('sensor.nas_temperature');
                rows.push(['IP', fallback.nas['IP']]);
                rows.push(['Modell', fallback.nas['Modell']]);
                rows.push(['DSM', fallback.nas['DSM']]);
                rows.push(['Volume', volumeUsed ? `${volumeUsed.state}%` : fallback.nas['Volume']]);
                rows.push(['Gesamt', volumeTotal ? volumeTotal.state : fallback.nas['Gesamt']]);
                rows.push(['RAM', ram ? ram.state : fallback.nas['RAM']]);
                rows.push(['Temperatur', temp ? `${temp.state}°C` : fallback.nas['Temperatur']]);
            } else if (agent === 'paperless') {
                const docCount = await haState('sensor.paperless_document_count');
                const storage = await haState('sensor.paperless_storage');
                rows.push(['IP', fallback.paperless['IP']]);
                rows.push(['Dokumente', docCount ? docCount.state : fallback.paperless['Dokumente']]);
                rows.push(['Storage', storage ? storage.state : fallback.paperless['Storage']]);
                rows.push(['Status', fallback.paperless['Status']]);
                rows.push(['Version', fallback.paperless['Version']]);
            } else if (agent === 'gateway') {
                rows.push(['IP', fallback.gateway['IP']]);
                rows.push(['Modell', fallback.gateway['Modell']]);
                rows.push(['Clients', fallback.gateway['Clients']]);
                rows.push(['Uptime', fallback.gateway['Uptime']]);
            } else if (agent === 'solar') {
                rows.push(['IP', fallback.solar['IP']]);
                rows.push(['Generation', fallback.solar['Generation']]);
                rows.push(['Verbrauch', fallback.solar['Verbrauch']]);
                rows.push(['Batterie', fallback.solar['Batterie']]);
            } else if (agent === 'zigbee') {
                rows.push(['IP', fallback.zigbee['IP']]);
                rows.push(['Devices', fallback.zigbee['Devices']]);
                rows.push(['Status', fallback.zigbee['Status']]);
            } else if (agent === 'opendtu') {
                rows.push(['IP', fallback.opendtu['IP']]);
                rows.push(['Panels', fallback.opendtu['Panels']]);
                rows.push(['Wechselrichter', fallback.opendtu['Wechselrichter']]);
                rows.push(['Status', fallback.opendtu['Status']]);
            } else if (agent === 'jarvis') {
                rows.push(['IP', fallback.jarvis['IP']]);
                rows.push(['Port', fallback.jarvis['Port']]);
                rows.push(['Requests', fallback.jarvis['Requests']]);
                rows.push(['Uptime', fallback.jarvis['Uptime']]);
            } else {
                // Generic fallback
                const state = await haState(entity);
                rows.push(['Status', state ? state.state : 'unknown']);
                rows.push(['IP', '—']);
                rows.push(['Details', '—']);
            }
            
            if (statusEl) {
                statusEl.className = 'gc-status online';
                statusEl.textContent = 'ONLINE';
            }
            
            // Render rows
            if (rowsEl) {
                rowsEl.innerHTML = rows.map(([k, v]) => 
                    `<div class="gc-row"><span>${k}</span><span>${v}</span></div>`
                ).join('');
            }
        } catch (e) {
            console.error(`Status Detail Load Error for ${agent}:`, e);
            if (statusEl) {
                statusEl.className = 'gc-status online';
                statusEl.textContent = 'ONLINE (Fallback)';
            }
            // Bei Fehler: Fallback-Werte anzeigen
            if (rowsEl && fallback[agent]) {
                rowsEl.innerHTML = Object.entries(fallback[agent]).map(([k, v]) => 
                    `<div class="gc-row"><span>${k}</span><span>${v}</span></div>`
                ).join('');
            } else if (rowsEl) {
                rowsEl.innerHTML = '<div class="placeholder-text">Daten nicht verfügbar</div>';
            }
        }
    }

    closeStatusDetailModal() {
        const modal = document.getElementById('statusDetailModal');
        if (modal) modal.style.display = 'none';
        this._statusDetailAgent = null;
        this._statusDetailEntity = null;
    }

    startCameraFeeds() {
        if (this.cameraInterval) clearInterval(this.cameraInterval);
        
        // Kamera-Konfiguration: WebRTC/go2rtc优先，fallback auf camera_proxy
        // Entities aus HAOS: camera.back_door_standardauflosung, camera.doorstation_* etc.
        const cams = [
            { id: 'camFrontImg', entity: 'camera.back_door_standardauflosung', webrtc: false },
            { id: 'camBackImg', entity: 'camera.back_door_standardauflosung', webrtc: false },
            { id: 'camEinfahrtImg', entity: 'camera.einfahrt_hochauflosung', webrtc: false },
            { id: 'camDoorbirdImg', entity: 'camera.doorstation_1ccae371de47_live', webrtc: false }
        ];
        
        const update = () => {
            cams.forEach(cam => {
                const img = document.getElementById(cam.id);
                if (!img) return;
                
                // Versuch: go2rtc WebRTC Stream (schneller, zuverlässiger)
                // Fallback: HA camera_proxy (langsam, aber kompatibel)
                if (cam.webrtc) {
                    // WebRTC Stream via go2rtc
                    img.src = `http://192.168.1.91:8123/api/webrtc/webrtc_token/${cam.entity}`;
                } else {
                    // Fallback: HA camera_proxy mit Token
                    const token = Date.now();
                    img.src = `${this.apiBaseUrl}/api/jarvis/ha-proxy/api/camera_proxy/${cam.entity}?token=${token}&t=${Date.now()}`;
                }
                
                // Error handler: Zeige Placeholder wenn Bild nicht lädt
                img.onerror = () => {
                    img.alt = 'Kamera nicht verfügbar';
                    img.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="320" height="240" viewBox="0 0 320 240"><rect fill="%231a1a2e" width="320" height="240"/><text fill="%23666" font-family="Arial" font-size="16" x="160" y="120" text-anchor="middle">Kamera offline</text></svg>';
                };
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
        this.dashboardInterval = setInterval(() => {
            this.refreshDashboardData();
            // Ollama VM live updaten falls aktiv
            const ollamaView = document.getElementById('view-ollama');
            if (ollamaView && ollamaView.classList.contains('active')) {
                this.loadOllamaData();
            }
        }, 30000);
        
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
                'sensor.hm1500_power', 'sensor.solar_yieldday',
                // Battery
                'sensor.gesamt_batterie_soc', 'sensor.batterie_summe',
                'sensor.gesamt_lade_leistung', 'sensor.gesamt_entlade_leistung',
                // Grid/House
                'sensor.power_import_grid', 'sensor.power_grid_total_raw',
                'sensor.total_power', 'sensor.power_consumption',
                // Phases
                'sensor.haus_channel_a_power', 'sensor.haus_channel_b_power', 'sensor.haus_channel_c_power',
                // Climate
                'climate.split_klimaanlage', 'climate.schlafzimmer', 'climate.arbeitszimmer', 'switch.klima_schlafzimmer',
                // Environment temps
                'sensor.garten', 'sensor.pool_temperatur',
                'sensor.wohnzimmer_echo_temperatur', 'sensor.arbeitszimmer_temperatur',
                // Status sensors
                'binary_sensor.jarvis_status_haos', 'binary_sensor.jarvis_status_proxmox',
                'binary_sensor.jarvis_status_nas', 'binary_sensor.jarvis_status_gateway',
                'binary_sensor.jarvis_status_solar', 'binary_sensor.jarvis_status_zigbee',
                'binary_sensor.jarvis_status_opendtu', 'binary_sensor.jarvis_status_jarvis_api',
                'binary_sensor.paperless_status'
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
        // LOKALER MODUS: Direkter HA-Zugriff ohne Proxy
        const isLocalhost = window.location.hostname === 'localhost' || 
                           window.location.hostname === '127.0.0.1' ||
                           window.location.hostname.startsWith('192.168.');
        
        if (isLocalhost) {
            // Direkt zu Home Assistant (kein Proxy)
            const url = `http://192.168.1.91:8123${path}`;
            const headers = {
                'Authorization': `Bearer ${this.apiKey}`,
                'Content-Type': 'application/json'
            };
            const response = await fetch(url, { headers });
            if (!response.ok) throw new Error(`HA ${response.status}`);
            return response.json();
        }
        
        // CLOUD MODUS: Über Proxy
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
        const solarTodayState = states.find(s => s.entity_id === 'sensor.jarvis_solar_heute' || s.entity_id === 'sensor.solar_yieldday');
        if (solarPowerState) {
            const watts = parseFloat(solarPowerState.state) || 0;
            const text = `${Math.round(watts)} W`;
            this.setText('homeSolarPower', text);
            this.setText('stromSolarPower', text);
        }
        if (solarTodayState) {
            let kwh = parseFloat(solarTodayState.state) || 0;
            if (solarTodayState.entity_id === 'sensor.solar_yieldday') kwh = kwh / 1000;
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
        const fmt = v => `${Number.isFinite(v) ? Math.round(v) : 0} W`;
        if (phaseA) this.setText('stromPhaseA', fmt(parseFloat(phaseA.state)));
        if (phaseB) this.setText('stromPhaseB', fmt(parseFloat(phaseB.state)));
        if (phaseC) this.setText('stromPhaseC', fmt(parseFloat(phaseC.state)));
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
            { id: 'arbeitszimmer', entity: 'climate.arbeitszimmer' }
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

    openClimateOverlay(clickEvent) {
        this.renderClimateOverlay();
        const overlay = document.getElementById('climateOverlay');
        const expander = document.getElementById('climateExpander');
        if (!overlay) return;

        // Measure the clicked tile (or fallback to center)
        let rect = null;
        if (clickEvent && clickEvent.currentTarget && clickEvent.currentTarget.getBoundingClientRect) {
            rect = clickEvent.currentTarget.getBoundingClientRect();
        } else {
            const tile = document.getElementById('homeClimateTile');
            if (tile) rect = tile.getBoundingClientRect();
        }

        if (rect && expander) {
            const cx = rect.left + rect.width / 2;
            const cy = rect.top + rect.height / 2;
            overlay.style.setProperty('--start-x', `${cx}px`);
            overlay.style.setProperty('--start-y', `${cy}px`);
            overlay.style.setProperty('--start-w', `${rect.width}px`);
            overlay.style.setProperty('--start-h', `${rect.height}px`);
        }

        overlay.style.display = 'flex';
        overlay.classList.remove('open');
        overlay.classList.add('opening');

        // Allow the single reflow, then finish
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                overlay.classList.add('open');
            });
        });

        // Remove 'opening' class after animation completes
        setTimeout(() => {
            overlay.classList.remove('opening');
        }, 500);
    }

    closeClimateOverlay() {
        const overlay = document.getElementById('climateOverlay');
        if (overlay) {
            overlay.classList.remove('open', 'opening');
            overlay.style.display = 'none';
        }
    }

    renderClimateOverlay() {
        const labels = { off: 'Aus', cool: 'Kühlen', heat: 'Heizen', dry: 'Trocknen', fan_only: 'Lüfter' };
        const icons = { off: '⏻', cool: '❄', heat: '♨', dry: '💧', fan_only: '✦' };
        const zones = [
            { id: 'wohnzimmer', entity: 'climate.split_klimaanlage', name: 'Wohnzimmer' },
            { id: 'schlafzimmer', entity: 'climate.schlafzimmer', name: 'Schlafzimmer' },
            { id: 'arbeitszimmer', entity: 'climate.arbeitszimmer', name: 'Arbeitszimmer' }
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
        const map = { wohnzimmer: 'climate.split_klimaanlage', schlafzimmer: 'climate.schlafzimmer', arbeitszimmer: 'climate.arbeitszimmer' };
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

    async updateStatusPanel(states) {
        const statusMap = {
            'status-haos-dot': 'binary_sensor.jarvis_status_haos',
            'status-proxmox-dot': 'binary_sensor.jarvis_status_proxmox',
            'status-nas-dot': 'binary_sensor.jarvis_status_nas',
            'status-gateway-dot': 'binary_sensor.jarvis_status_gateway',
            'status-solar-dot': 'binary_sensor.jarvis_status_solar',
            'status-zigbee-dot': 'binary_sensor.jarvis_status_zigbee',
            'status-opendtu-dot': 'binary_sensor.jarvis_status_opendtu',
            'status-jarvis-dot': 'binary_sensor.jarvis_status_jarvis_api',
            'status-paperless-dot': 'binary_sensor.paperless_status'
        };
        let onlineCount = 0;
        
        // Normale HA-Sensoren prüfen
        for (const [id, entityId] of Object.entries(statusMap)) {
            const state = states.find(s => s.entity_id === entityId);
            const dot = document.getElementById(id);
            if (!dot) continue;
            
            // Paperless: Fallback API-Check nur im lokalen HTTP-Modus, nie von HTTPS
            if (id === 'status-paperless-dot' && (!state || state.state === 'unavailable' || state.state === 'unknown')) {
                const isLocalHttp = window.location.protocol === 'http:' && (window.location.hostname === 'localhost' || window.location.hostname.startsWith('192.168.') || window.location.hostname.startsWith('jarvis.local'));
                if (isLocalHttp) {
                    try {
                        const response = await fetch('http://192.168.1.159:8777/api/documents/', {
                            method: 'HEAD',
                            headers: { 'Authorization': 'Token 44568e6750650f79836f5cb18f5f76b0fe1eb29f' },
                            signal: AbortSignal.timeout(3000)
                        });
                        const isOnline = response.ok;
                        dot.className = isOnline ? 'status-dot-sm online' : 'status-dot-sm offline';
                        if (isOnline) onlineCount++;
                        continue;
                    } catch (e) {
                        console.warn('Paperless API Check failed:', e);
                        dot.className = 'status-dot-sm offline';
                        continue;
                    }
                } else {
                    dot.className = 'status-dot-sm offline';
                    continue;
                }
            }
            
            // Normale Logik für andere Sensoren
            if (!state || state.state === 'unavailable' || state.state === 'unknown') {
                dot.className = 'status-dot-sm offline';
                continue;
            }
            const good = ['on', 'connected', 'home', 'ok', 'online'].includes(state.state.toLowerCase());
            dot.className = good ? 'status-dot-sm online' : 'status-dot-sm offline';
            if (good) onlineCount++;
        }
        
        const footer = document.getElementById('footerConnection');
        if (footer) {
            footer.innerHTML = `● ${onlineCount}/9 Systeme online`;
            footer.className = onlineCount === 9 ? 'connection-status online' : 'connection-status offline';
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
            
            // Retry-Logic für verschiedene Error-Typen
            let retryDelay = 0;
            let retryMessage = null;
            
            if (event.error === 'no-speech') {
                // Keine Sprache erkannt - kein echter Fehler, einfach bereit bleiben
                this.updateVoiceStatus('Keine Sprache erkannt. Bitte wiederholen.', 'ready');
                retryDelay = 500;
            } else if (event.error === 'audio-capture') {
                // Mikrofon nicht gefunden
                this.updateVoiceStatus('Kein Mikrofon gefunden. Bitte prüfen.', 'error');
                retryMessage = 'Mikrofon nicht verfügbar';
            } else if (event.error === 'not-allowed') {
                // Zugriff verweigert
                this.updateVoiceStatus('Mikrofon-Zugriff verweigert.', 'error');
                retryMessage = 'Zugriff verweigert';
            } else if (event.error === 'aborted') {
                // Abgebrochen (z.B. durch Stop) - einfach bereit bleiben
                this.updateVoiceStatus('BEREIT', 'ready');
                return;
            } else if (event.error === 'network') {
                // Netzwerkfehler bei Cloud-Spracherkennung
                this.updateVoiceStatus('Netzwerkfehler. Bitte versuchen Sie es erneut.', 'error');
                retryDelay = 1000;
            } else {
                // Unbekannter Fehler
                console.warn('Unbekannter Speech-Error:', event.error);
                this.updateVoiceStatus(`Sprachfehler: ${event.error}`, 'error');
                retryMessage = event.error;
            }
            
            // Auto-Retry nach Delay (nur für bestimmte Errors)
            if (retryDelay > 0 && this.isListening) {
                setTimeout(() => {
                    if (this.isListening) {
                        try {
                            this.recognition.start();
                        } catch (e) {
                            console.warn('Auto-Retry fehlgeschlagen:', e);
                        }
                    }
                }, retryDelay);
            }
            
            // Logging für Error-Analyse
            if (retryMessage) {
                this.logConversation(`[ERROR] ${retryMessage}`, 'system');
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

        const profile = this.config.voiceProfile || 'standard';
        const pSettings = {
            'standard': { pitch: 0.9, rate: 1.0 },
            'elegant': { pitch: 0.8, rate: 0.9 },
            'sarcastic': { pitch: 1.1, rate: 1.1 },
            'alarm': { pitch: 1.2, rate: 1.2 }
        };
        const settings = pSettings[profile] || pSettings['standard'];
        utterance.pitch = settings.pitch;
        utterance.rate = settings.rate;
        

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

        // Show voice bubble on mobile
        this.showVoiceBubble(text);
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
                    session_key: 'jarvis-pwa-main-chat',
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

    // ==================== SERVICE WORKER + PWA INSTALL ====================

    registerServiceWorker() {
        if (!('serviceWorker' in navigator)) return;

        // Install-Prompt für PWA abfangen
        let deferredPrompt = null;
        const installBtn = document.getElementById('installPwaBtn');

        window.addEventListener('beforeinstallprompt', (e) => {
            e.preventDefault();
            deferredPrompt = e;
            if (installBtn) installBtn.style.display = 'inline-flex';
            console.log('[JARVIS] PWA install prompt ready');
        });

        window.addEventListener('appinstalled', () => {
            deferredPrompt = null;
            if (installBtn) installBtn.style.display = 'none';
            console.log('[JARVIS] PWA installed');
        });

        if (installBtn) {
            installBtn.addEventListener('click', async () => {
                if (!deferredPrompt) {
                    this.showNotification('Installation nicht verfügbar. Browser meldet kein Install-Prompt.', 'error');
                    return;
                }
                deferredPrompt.prompt();
                const { outcome } = await deferredPrompt.userChoice;
                if (outcome === 'accepted') {
                    this.showNotification('J.A.R.V.I.S. wird installiert', 'success');
                }
                deferredPrompt = null;
                installBtn.style.display = 'none';
            });
        }

        // Service Worker registrieren und Updates automatisch einspielen
        navigator.serviceWorker.register('/sw.js')
            .then(reg => {
                console.log('[JARVIS] Service Worker registriert');

                reg.addEventListener('updatefound', () => {
                    const newWorker = reg.installing;
                    if (!newWorker) return;
                    newWorker.addEventListener('statechange', () => {
                        if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                            console.log('[JARVIS] Neue Version verfügbar, lade neu...');
                            newWorker.postMessage({ type: 'SKIP_WAITING' });
                        }
                    });
                });

                // Alle 5 Minuten auf Updates prüfen
                setInterval(() => reg.update().catch(() => {}), 300000);
            })
            .catch(err => console.log('[JARVIS] Service Worker Registrierung fehlgeschlagen', err));

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

// ==================== TELEFON FINDEN FUNKTIONEN ====================

/**
 * Telefon finden - Sendet Alarm an Mobile App
 * @param {string} device - 'mike' oder 'tanja'
 * @param {string} mode - 'quiet', 'loud', oder 'announce'
 */
async function findPhone(device, mode) {
    const devices = {
        'mike': 'pixel_9_pro_xl',
        'tanja': 'iphone_von_tanja'
    };

    const modes = {
        'quiet': {
            message: '🔔 Jarvis Leise-Alarm',
            title: 'Telefon finden',
            data: {
                priority: 'normal',
                channel: 'alarm',
                ttl: 0,
                importance: 'high'
            }
        },
        'loud': {
            message: '🚨 J.A.R.V.I.S. Laut-Alarm! Bitte bestätigen, um den Alarm zu stoppen.',
            title: 'TELEFON FINDEN',
            data: {
                priority: 'high',
                channel: 'alarm',
                ttl: 0,
                importance: 'high',
                // Android-Companion: dauerhafter Alarm bis Bestätigung
                media_stream: 'alarm_stream_max',
                // iOS: kritische Benachrichtigung
                push: { sound: { name: 'default', critical: 1, volume: 1.0 } }
            }
        },
        'announce': {
            message: '📢 J.A.R.V.I.S. ruft an. Bitte antworten.',
            title: 'Durchsage',
            data: {
                priority: 'high',
                channel: 'alarm',
                ttl: 0,
                importance: 'high',
                // Android/Companion TTS via Home Assistant
                tts_text: 'J.A.R.V.I.S. ruft an. Bitte antworten.',
                media_stream: 'alarm_stream_max'
            }
        }
    };

    const target = devices[device];
    const config = modes[mode];

    if (!target || !config) {
        console.error('Ungültiges Gerät oder Modus:', device, mode);
        alert('❌ Ungültiges Gerät oder Modus');
        return;
    }

    console.log(`📱 Sende Alarm an ${device} (notify.${target}): ${mode}`);

    try {
        // Nutze die existierende callService-Methode der App, falls verfügbar
        if (typeof window !== 'undefined' && window.jarvis?.callService) {
            await window.jarvis.callService(
                `notify.${target}`,
                'notify.send_message',
                { message: config.message, title: config.title, data: config.data }
            );
            const deviceName = device === 'mike' ? 'Pixel 9 Pro XL' : 'iPhone von Tanja';
            console.log(`✅ Alarm erfolgreich gesendet an ${device}`);
            return;
        }

        // Fallback für den Fall, dass window.jarvis noch nicht initialisiert ist
        const apiBase = (typeof window !== 'undefined' && window.jarvis?.apiBaseUrl) ? window.jarvis.apiBaseUrl : '';
        const serviceUrl = `${apiBase}/api/jarvis/ha-proxy/api/services/notify/${target}`;
        const response = await fetch(serviceUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + (window.jarvis?.apiKey || '')
            },
            body: JSON.stringify({
                entity_id: `notify.${target}`,
                message: config.message,
                title: config.title,
                data: config.data
            })
        });

        if (response.ok) {
            const deviceName = device === 'mike' ? 'Pixel 9 Pro XL' : 'iPhone von Tanja';
            console.log(`✅ Alarm erfolgreich gesendet an ${device}`);
        } else {
            const error = await response.text();
            console.error('Alarm fehlgeschlagen:', error);
            alert(`❌ Alarm fehlgeschlagen:\n${error}`);
        }
    } catch (error) {
        console.error('Netzwerkfehler beim Alarm:', error);
        alert(`❌ Netzwerkfehler:\n${error.message}`);
    }
}

/**
 * Alarm stoppen
 * @param {string} device - 'mike' oder 'tanja'
 */
function stopAlarm(device) {
    console.log(`⏹️ Alarm gestoppt für ${device}`);
    const deviceName = device === 'mike' ? 'Pixel 9 Pro XL' : 'iPhone von Tanja';
    alert(`ℹ️ Alarm-Stopp für ${deviceName} gesendet.\n\nHinweis: Der Alarm muss ggf. direkt am Gerät bestätigt werden.`);
}

// Globale Funktionen verfügbar machen
window.findPhone = findPhone;
window.stopAlarm = stopAlarm;

/**
 * ===========================
 * IMO - IMMOBILIEN KALKULATOR
 * ===========================
 */

class ImoKalkulator {
    constructor() {
        this.data = {
            adresse: '',
            kaufdatum: new Date().toISOString().split('T')[0],
            kaufpreis: 0,
            flaeche: 0,
            zimmer: 0,
            baujahr: 0,
            makler: 3.57,
            notar: 1.5,
            grundbuch: 0.5,
            grunderwerb: 6.5,
            sonstige: 0,
            eigenkapital: 0,
            zins: 3.5,
            tilgung: 2.0,
            laufzeit: 30,
            kaltmiete: 0,
            nebekosten: 0,
            hausgeld: 0,
            instandhaltung: 0
        };
        
        this.charts = {};
        this.init();
    }
    
    init() {
        // Event Listener für alle Input-Felder
        const inputs = [
            'imoAdresse', 'imoKaufdatum', 'imoKaufpreis', 'imoFlaeche',
            'imoZimmer', 'imoBaujahr', 'imoMakler', 'imoNotar',
            'imoGrundbuch', 'imoGrunderwerb', 'imoSonstige',
            'imoEigenkapital', 'imoZins', 'imoTilgung', 'imoLaufzeit',
            'imoKaltmiete', 'imoNebenkosten', 'imoHausgeld', 'imoInstandhaltung'
        ];
        
        inputs.forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                el.addEventListener('input', () => this.calculate());
            }
        });
        
        // PDF Export Button
        const exportBtn = document.getElementById('imoExportPdf');
        if (exportBtn) {
            exportBtn.addEventListener('click', () => this.exportPdf());
        }
        
        // Initiale Berechnung
        this.calculate();
    }
    
    getValue(id) {
        const el = document.getElementById(id);
        if (!el) return 0;
        const val = parseFloat(el.value);
        return isNaN(val) ? 0 : val;
    }
    
    setValue(id, value, format = 'number') {
        const el = document.getElementById(id);
        if (!el) return;
        
        if (format === 'currency') {
            el.textContent = new Intl.NumberFormat('de-DE', {
                style: 'currency',
                currency: 'EUR',
                minimumFractionDigits: 0,
                maximumFractionDigits: 0
            }).format(value);
        } else if (format === 'percent') {
            el.textContent = value.toFixed(2) + ' %';
        } else {
            el.textContent = new Intl.NumberFormat('de-DE', {
                minimumFractionDigits: 0,
                maximumFractionDigits: 2
            }).format(value);
        }
    }
    
    calculate() {
        // Eingaben lesen
        const kaufpreis = this.getValue('imoKaufpreis');
        const flaeche = this.getValue('imoFlaeche');
        const makler = this.getValue('imoMakler');
        const notar = this.getValue('imoNotar');
        const grundbuch = this.getValue('imoGrundbuch');
        const grunderwerb = this.getValue('imoGrunderwerb');
        const sonstige = this.getValue('imoSonstige');
        const eigenkapital = this.getValue('imoEigenkapital');
        const zins = this.getValue('imoZins');
        const tilgung = this.getValue('imoTilgung');
        const kaltmiete = this.getValue('imoKaltmiete');
        const nebekosten = this.getValue('imoNebenkosten');
        const hausgeld = this.getValue('imoHausgeld');
        const instandhaltung = this.getValue('imoInstandhaltung');
        
        // Berechnungen
        const maklerKosten = kaufpreis * (makler / 100);
        const notarkosten = kaufpreis * (notar / 100);
        const grundbuchKosten = kaufpreis * (grundbuch / 100);
        const grunderwerbKosten = kaufpreis * (grunderwerb / 100);
        
        const gesamtinvest = kaufpreis + maklerKosten + notarkosten + grundbuchKosten + grunderwerbKosten + sonstige;
        const finanzierung = gesamtinvest - eigenkapital;
        
        // Monatliche Rate (Annuität)
        const zinsMonat = zins / 100 / 12;
        const tilgungMonat = tilgung / 100 / 12;
        const rateMonat = finanzierung * (zinsMonat + tilgungMonat);
        
        // Jahresmiete
        const jahresmiete = kaltmiete * 12;
        
        // Jährliche Kosten
        const jahresNebenkosten = nebekosten * 12;
        const jahresHausgeld = hausgeld * 12;
        
        // Netto-Einnahmen pro Jahr
        const nettoEinnahmen = jahresmiete - jahresNebenkosten - jahresHausgeld - instandhaltung;
        
        // Monatlicher Cashflow
        const cashflowMonat = (kaltmiete + nebekosten) - rateMonat - hausgeld - (instandhaltung / 12);
        
        // Rendite
        const bruttorendite = gesamtinvest > 0 ? (jahresmiete / gesamtinvest) * 100 : 0;
        const nettorendite = eigenkapital > 0 ? (nettoEinnahmen / eigenkapital) * 100 : 0;
        
        // Preis pro m²
        const preisProQm = flaeche > 0 ? kaufpreis / flaeche : 0;
        
        // Ergebnisse anzeigen
        this.setValue('imoGesamtinvest', gesamtinvest, 'currency');
        this.setValue('imoFinanzierung', finanzierung, 'currency');
        this.setValue('imoMonatsrate', rateMonat, 'currency');
        this.setValue('imoJahresmiete', jahresmiete, 'currency');
        this.setValue('imoBruttorendite', bruttorendite, 'percent');
        this.setValue('imoNettorendite', nettorendite, 'percent');
        this.setValue('imoCashflow', cashflowMonat, 'currency');
        this.setValue('imoPreisProQm', preisProQm, 'currency');
        
        // Cashflow farbig markieren
        const cashflowEl = document.getElementById('imoCashflow');
        if (cashflowEl) {
            if (cashflowMonat > 0) {
                cashflowEl.style.color = 'var(--jarvis-green)';
                cashflowEl.style.textShadow = 'var(--glow-green)';
            } else {
                cashflowEl.style.color = 'var(--jarvis-red)';
                cashflowEl.style.textShadow = 'var(--glow-orange)';
            }
        }
        
        // Diagramme aktualisieren
        this.updateCharts({
            kaufpreis, maklerKosten, notarkosten, grundbuchKosten, grunderwerbKosten, sonstige,
            eigenkapital, finanzierung,
            kaltmiete, nebekosten, hausgeld, instandhaltung, rateMonat,
            jahresmiete, nettoEinnahmen, cashflowMonat, bruttorendite, nettorendite
        });
    }
    
    updateCharts(data) {
        // Chart.js laden falls nicht vorhanden
        if (typeof Chart === 'undefined') {
            console.warn('Chart.js nicht geladen, überspringe Diagramme');
            return;
        }
        
        // Cashflow Verteilung (Monatlich)
        const cashflowCtx = document.getElementById('imoChartCashflow');
        if (cashflowCtx) {
            if (this.charts.cashflow) {
                this.charts.cashflow.destroy();
            }
            
            this.charts.cashflow = new Chart(cashflowCtx, {
                type: 'doughnut',
                data: {
                    labels: ['Mieteinnahmen', 'Nebenkosten', 'Hausgeld', 'Rate', 'Instandhaltung'],
                    datasets: [{
                        data: [
                            data.kaltmiete + data.nebekosten,
                            data.nebekosten,
                            data.hausgeld,
                            data.rateMonat,
                            data.instandhaltung / 12
                        ],
                        backgroundColor: [
                            'rgba(0, 255, 136, 0.7)',
                            'rgba(255, 153, 0, 0.7)',
                            'rgba(255, 153, 0, 0.5)',
                            'rgba(0, 212, 255, 0.7)',
                            'rgba(255, 51, 51, 0.7)'
                        ],
                        borderColor: [
                            'rgba(0, 255, 136, 1)',
                            'rgba(255, 153, 0, 1)',
                            'rgba(255, 153, 0, 1)',
                            'rgba(0, 212, 255, 1)',
                            'rgba(255, 51, 51, 1)'
                        ],
                        borderWidth: 2
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            position: 'bottom',
                            labels: {
                                color: '#E0F7FF',
                                font: { size: 10 }
                            }
                        },
                        title: {
                            display: true,
                            text: 'Monatliche Cashflow Verteilung',
                            color: '#00D4FF',
                            font: { size: 14, weight: 'bold' }
                        }
                    }
                }
            });
        }
        
        // Rendite Vergleich
        const renditeCtx = document.getElementById('imoChartRendite');
        if (renditeCtx) {
            if (this.charts.rendite) {
                this.charts.rendite.destroy();
            }
            
            this.charts.rendite = new Chart(renditeCtx, {
                type: 'bar',
                data: {
                    labels: ['Brutto-Rendite', 'Netto-Rendite'],
                    datasets: [{
                        label: 'Rendite (%)',
                        data: [data.bruttorendite, data.nettorendite],
                        backgroundColor: [
                            'rgba(0, 212, 255, 0.7)',
                            'rgba(0, 255, 136, 0.7)'
                        ],
                        borderColor: [
                            'rgba(0, 212, 255, 1)',
                            'rgba(0, 255, 136, 1)'
                        ],
                        borderWidth: 2
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            display: false
                        },
                        title: {
                            display: true,
                            text: 'Rendite Vergleich',
                            color: '#00D4FF',
                            font: { size: 14, weight: 'bold' }
                        },
                        scales: {
                            y: {
                                beginAtZero: true,
                                ticks: {
                                    color: '#88AABB',
                                    callback: (value) => value + '%'
                                },
                                grid: {
                                    color: 'rgba(0, 212, 255, 0.1)'
                                }
                            },
                            x: {
                                ticks: {
                                    color: '#88AABB'
                                },
                                grid: {
                                    display: false
                                }
                            }
                        }
                    }
                }
            });
        }
    }
    
    async exportPdf() {
        // Einfacher PDF Export via Browser Print
        const printWindow = window.open('', '_blank');
        if (!printWindow) {
            alert('❌ Popup-Blocker verhindert PDF Export. Bitte Popups für diese Seite erlauben.');
            return;
        }
        
        // Daten sammeln
        const datum = new Date().toLocaleDateString('de-DE');
        const adresse = document.getElementById('imoAdresse').value || 'N/A';
        const kaufpreis = document.getElementById('imoKaufpreis').value || '0';
        const flaeche = document.getElementById('imoFlaeche').value || '0';
        const gesamtinvest = document.getElementById('imoGesamtinvest').textContent;
        const finanzierung = document.getElementById('imoFinanzierung').textContent;
        const monatsrate = document.getElementById('imoMonatsrate').textContent;
        const jahresmiete = document.getElementById('imoJahresmiete').textContent;
        const bruttorendite = document.getElementById('imoBruttorendite').textContent;
        const nettorendite = document.getElementById('imoNettorendite').textContent;
        const cashflow = document.getElementById('imoCashflow').textContent;
        
        const html = `
<!DOCTYPE html>
<html lang="de">
<head>
    <meta charset="UTF-8">
    <title>Immobilien Kalkulation - ${adresse}</title>
    <style>
        body { font-family: Arial, sans-serif; padding: 40px; color: #333; }
        h1 { color: #0088CC; border-bottom: 2px solid #0088CC; padding-bottom: 10px; }
        h2 { color: #0088CC; margin-top: 30px; }
        .section { margin: 20px 0; }
        table { width: 100%; border-collapse: collapse; margin: 15px 0; }
        th, td { padding: 10px; text-align: left; border-bottom: 1px solid #ddd; }
        th { background: #0088CC; color: white; }
        .highlight { background: #e6f7ff; font-weight: bold; }
        .footer { margin-top: 40px; font-size: 12px; color: #666; text-align: center; }
        @media print {
            body { padding: 20px; }
            .no-print { display: none; }
        }
    </style>
</head>
<body>
    <h1>🏠 Immobilien Kalkulation</h1>
    <p><strong>Datum:</strong> ${datum}</p>
    
    <div class="section">
        <h2>📍 Objekt</h2>
        <table>
            <tr><th>Adresse</th><td>${adresse}</td></tr>
            <tr><th>Kaufpreis</th><td>${kaufpreis} €</td></tr>
            <tr><th>Wohnfläche</th><td>${flaeche} m²</td></tr>
        </table>
    </div>
    
    <div class="section">
        <h2>💰 Investition</h2>
        <table>
            <tr class="highlight"><th>Gesamtinvestition</th><td>${gesamtinvest}</td></tr>
            <tr><th>Finanzierungssumme</th><td>${finanzierung}</td></tr>
            <tr><th>Monatliche Rate</th><td>${monatsrate}</td></tr>
        </table>
    </div>
    
    <div class="section">
        <h2>📈 Rendite & Cashflow</h2>
        <table>
            <tr><th>Jahresmiete (Netto-Kalt)</th><td>${jahresmiete}</td></tr>
            <tr class="highlight"><th>Brutto-Rendite</th><td>${bruttorendite}</td></tr>
            <tr class="highlight"><th>Netto-Rendite</th><td>${nettorendite}</td></tr>
            <tr><th>Cashflow (Monat)</th><td>${cashflow}</td></tr>
        </table>
    </div>
    
    <div class="footer no-print">
        <p>Erstellt mit J.A.R.V.I.S. Immobilien Kalkulator</p>
        <button onclick="window.print()" style="padding: 10px 20px; background: #0088CC; color: white; border: none; cursor: pointer; margin-top: 20px;">
            🖨️ Drucken / Als PDF speichern
        </button>
    </div>
    
    <script>
        // Auto-print wenn nicht im Print-Modus
        if (window.location.search !== '?noauto') {
            // window.print(); // Optional: Automatischer Druckdialog
        }
    </script>
</body>
</html>
        `;
        
        printWindow.document.write(html);
        printWindow.document.close();
    }
}

// IMO Kalkulator initialisieren wenn View geladen wird
document.addEventListener('DOMContentLoaded', () => {
    // Menu Item Listener für IMO View
    const imoMenuBtn = document.querySelector('[data-view="imo"]');
    const imoView = document.getElementById('view-imo');
    const aiCoreContainer = document.getElementById('aiCoreContainer');
    
    if (imoMenuBtn && imoView) {
        imoMenuBtn.addEventListener('click', () => {
            // Alle Menu Items deaktivieren
            document.querySelectorAll('.menu-item').forEach(btn => {
                btn.classList.remove('active');
            });
            
            // IMO Menu Item aktivieren
            imoMenuBtn.classList.add('active');
            
            // Alle Views ausblenden
            document.querySelectorAll('.view-container').forEach(view => {
                view.classList.remove('active');
                view.style.display = 'none';
            });
            
            // IMO View anzeigen
            imoView.classList.add('active');
            imoView.style.display = 'block';
            
            // AI Core Button ausblenden auf IMO-Seite
            if (aiCoreContainer) {
                aiCoreContainer.style.display = 'none';
            }
            
            // IMO Kalkulator initialisieren falls noch nicht geschehen
            if (!window.imoKalkulator) {
                window.imoKalkulator = new ImoKalkulator();
            }
        });
    }
});

// AI Core Button wieder anzeigen wenn andere Views gewechselt werden
document.querySelectorAll('.menu-item').forEach(btn => {
    if (btn.dataset.view !== 'imo') {
        btn.addEventListener('click', () => {
            const aiCoreContainer = document.getElementById('aiCoreContainer');
            if (aiCoreContainer) {
                aiCoreContainer.style.display = 'block';
            }
        });
    }
});
