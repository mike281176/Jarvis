/**
 * J.A.R.V.I.S. Voice Client v2.0
 * PWA für direkte Hermes API Kommunikation
 * 
 * Änderungen v2.0:
 * - User-Login Screen
 * - Direkte Kommunikation mit Hermes API (Port 8124)
 * - Keine Queue mehr nötig
 * - Echtzeit-Antworten
 */

class JarvisClient {
    constructor() {
        this.config = this.loadConfig();
        this.user = this.config.user || null;
        this.recognition = null;
        this.synthesis = window.speechSynthesis;
        this.isListening = false;
        this.conversation = [];
        this.apiBaseUrl = this.config.apiUrl || 'http://192.168.1.81:8124';
        
        this.init();
    }

    // ==================== KONFIGURATION ====================
    
    loadConfig() {
        const defaultConfig = {
            user: null,
            apiUrl: 'http://192.168.1.81:8124',
            language: 'de-DE',
            voice: '',
            autoSpeak: true
        };
        
        const saved = localStorage.getItem('jarvis_config');
        return saved ? { ...defaultConfig, ...JSON.parse(saved) } : defaultConfig;
    }

    saveConfig() {
        localStorage.setItem('jarvis_config', JSON.stringify(this.config));
    }

    // ==================== INITIALISIERUNG ====================

    init() {
        // Prüfe ob User eingeloggt ist
        if (!this.user) {
            this.showLoginScreen();
        } else {
            this.showMainInterface();
            this.initSpeechRecognition();
            this.initVoices();
            this.initEventListeners();
            this.updateStatus('ready', `Bereit - ${this.user.name}`);
        }
        this.registerServiceWorker();
    }

    // ==================== LOGIN SCREEN ====================

    showLoginScreen() {
        const app = document.getElementById('app');
        app.innerHTML = `
            <div class="login-screen">
                <div class="login-header">
                    <h1 class="title">J.A.R.V.I.S.</h1>
                    <p class="subtitle">Just A Rather Very Intelligent System</p>
                </div>
                <div class="user-selection">
                    <p class="login-hint">Bitte wählen Sie Ihr Profil:</p>
                    <div class="user-buttons">
                        <button class="user-btn" data-user="mike">
                            <div class="user-avatar">M</div>
                            <span class="user-name">Mike</span>
                            <span class="user-role">Administrator</span>
                        </button>
                        <button class="user-btn" data-user="gast">
                            <div class="user-avatar">G</div>
                            <span class="user-name">Gast</span>
                            <span class="user-role">Besucher</span>
                        </button>
                    </div>
                </div>
                <div class="api-config">
                    <button class="config-toggle" id="showApiConfig">API-Einstellungen</button>
                    <div class="config-panel" id="apiConfigPanel" style="display: none;">
                        <input type="url" id="apiUrlInput" placeholder="API URL" 
                               value="${this.apiBaseUrl}">
                        <button class="btn btn-small" id="saveApiConfig">Speichern</button>
                    </div>
                </div>
            </div>
        `;

        // Event Listeners für Login
        document.querySelectorAll('.user-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const userId = e.currentTarget.dataset.user;
                this.login(userId);
            });
        });

        document.getElementById('showApiConfig').addEventListener('click', () => {
            const panel = document.getElementById('apiConfigPanel');
            panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
        });

        document.getElementById('saveApiConfig').addEventListener('click', () => {
            this.apiBaseUrl = document.getElementById('apiUrlInput').value;
            this.config.apiUrl = this.apiBaseUrl;
            this.saveConfig();
            alert('API-URL gespeichert');
        });
    }

    login(userId) {
        const users = {
            'mike': { id: 'mike', name: 'Mike', role: 'admin' },
            'gast': { id: 'gast', name: 'Gast', role: 'guest' }
        };

        this.user = users[userId];
        this.config.user = this.user;
        this.saveConfig();

        // Lade Hauptinterface neu
        location.reload();
    }

    logout() {
        this.user = null;
        this.config.user = null;
        this.saveConfig();
        location.reload();
    }

    // ==================== HAUPTINTERFACE ====================

    showMainInterface() {
        const app = document.getElementById('app');
        app.innerHTML = `
            <!-- Status Bar -->
            <div class="status-bar">
                <div class="status-indicator" id="statusIndicator">
                    <span class="status-dot"></span>
                    <span class="status-text">Initialisiere...</span>
                </div>
                <div class="user-info">
                    <span class="user-label">${this.user.name}</span>
                    <button class="logout-btn" id="logoutBtn" title="Abmelden">⏻</button>
                </div>
                <button class="settings-btn" id="settingsBtn" aria-label="Einstellungen">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <circle cx="12" cy="12" r="3"></circle>
                        <path d="M12 1v6m0 6v6m4.22-10.22l4.24-4.24M6.34 17.66l-4.24 4.24M23 12h-6m-6 0H1m20.24 4.24l-4.24-4.24M6.34 6.34L2.1 2.1"></path>
                    </svg>
                </button>
            </div>

            <!-- Main Interface -->
            <main class="main-interface">
                <div class="header">
                    <h1 class="title">J.A.R.V.I.S.</h1>
                    <p class="subtitle">Just A Rather Very Intelligent System</p>
                </div>

                <!-- Conversation Display -->
                <div class="conversation-container" id="conversationContainer">
                    <div class="welcome-message">
                        <p class="jarvis-text">Guten Tag, ${this.user.name}. Ich stehe zu Ihren Diensten.</p>
                        <p class="hint">Tippen Sie auf den Kreis, um mit mir zu sprechen.</p>
                    </div>
                </div>

                <!-- Text Input (für diskrete Eingabe) -->
                <div class="text-input-container">
                    <input type="text" id="textInput" placeholder="Nachricht schreiben..." 
                           class="text-input">
                    <button id="sendTextBtn" class="send-btn">➤</button>
                </div>

                <!-- Voice Button -->
                <div class="voice-control">
                    <button class="voice-button" id="voiceButton" aria-label="Spracheingabe starten">
                        <div class="voice-button-inner">
                            <div class="voice-icon">
                                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                                    <path d="M12 1v10m0 4v4m-4-4h8a4 4 0 0 0 4-4V5a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v6a4 4 0 0 0 4 4z"></path>
                                    <path d="M19 10v2a7 7 0 0 1-7 7 7 7 0 0 1-7-7v-2"></path>
                                    <line x1="12" y1="19" x2="12" y2="23"></line>
                                    <line x1="8" y1="23" x2="16" y2="23"></line>
                                </svg>
                            </div>
                        </div>
                        <div class="voice-waves">
                            <span></span><span></span><span></span><span></span><span></span>
                        </div>
                    </button>
                    <p class="voice-hint" id="voiceHint">Tippen zum Sprechen</p>
                </div>
            </main>

            <!-- Settings Modal -->
            <div class="modal" id="settingsModal">
                <div class="modal-content">
                    <div class="modal-header">
                        <h2>Einstellungen</h2>
                        <button class="close-btn" id="closeSettings">×</button>
                    </div>
                    <div class="modal-body">
                        <div class="form-group">
                            <label for="voiceSelect">Stimme (TTS)</label>
                            <select id="voiceSelect">
                                <option value="">System-Standard</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label for="languageSelect">Sprache</label>
                            <select id="languageSelect">
                                <option value="de-DE">Deutsch</option>
                                <option value="en-US">English</option>
                            </select>
                        </div>
                        <div class="form-group checkbox">
                            <label>
                                <input type="checkbox" id="autoSpeak" checked>
                                <span>Antworten automatisch vorlesen</span>
                            </label>
                        </div>
                        <div class="form-group">
                            <label for="apiUrl">JARVIS API URL</label>
                            <input type="url" id="apiUrl" value="${this.apiBaseUrl}">
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button class="btn btn-primary" id="saveSettings">Speichern</button>
                    </div>
                </div>
            </div>

            <canvas id="audioVisualizer" class="audio-visualizer"></canvas>
        `;
    }

    // ==================== SPRACHERKENNUNG ====================
    
    initSpeechRecognition() {
        if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
            this.showError('Speech Recognition wird von diesem Browser nicht unterstützt.');
            return;
        }

        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        this.recognition = new SpeechRecognition();
        
        this.recognition.continuous = false;
        this.recognition.interimResults = true;
        this.recognition.lang = this.config.language;
        
        this.recognition.onstart = () => {
            this.isListening = true;
            this.updateVoiceButton(true);
            this.updateStatus('listening', 'Höre...');
        };
        
        this.recognition.onresult = (event) => {
            const results = event.results;
            const transcript = results[results.length - 1][0].transcript;
            
            if (results[results.length - 1].isFinal) {
                this.processInput(transcript);
            }
        };
        
        this.recognition.onerror = (event) => {
            console.error('Speech recognition error:', event.error);
            if (event.error === 'not-allowed') {
                this.showError('Mikrofon-Zugriff wurde verweigert.');
            } else if (event.error === 'no-speech') {
                this.updateStatus('ready', 'Keine Sprache erkannt');
            }
            this.stopListening();
        };
        
        this.recognition.onend = () => {
            this.stopListening();
        };
    }

    startListening() {
        if (!this.recognition) {
            this.showError('Spracherkennung nicht verfügbar.');
            return;
        }
        
        try {
            this.recognition.start();
        } catch (err) {
            console.error('Failed to start recognition:', err);
        }
    }

    stopListening() {
        this.isListening = false;
        this.updateVoiceButton(false);
        this.updateStatus('ready', `Bereit - ${this.user.name}`);
        
        if (this.recognition) {
            try {
                this.recognition.stop();
            } catch (e) {}
        }
    }

    // ==================== TEXT-TO-SPEECH ====================
    
    initVoices() {
        const populateVoices = () => {
            const voices = this.synthesis.getVoices();
            const voiceSelect = document.getElementById('voiceSelect');
            if (!voiceSelect) return;
            
            const germanVoices = voices.filter(v => v.lang.startsWith('de'));
            
            germanVoices.forEach(voice => {
                const option = document.createElement('option');
                option.value = voice.name;
                option.textContent = `${voice.name} (${voice.lang})`;
                voiceSelect.appendChild(option);
            });
            
            if (this.config.voice) {
                voiceSelect.value = this.config.voice;
            }
        };
        
        populateVoices();
        
        if (speechSynthesis.onvoiceschanged !== undefined) {
            speechSynthesis.onvoiceschanged = populateVoices;
        }
    }

    speak(text) {
        if (!this.config.autoSpeak) return;
        
        this.synthesis.cancel();
        
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = this.config.language;
        utterance.rate = 1.0;
        utterance.pitch = 1.0;
        
        if (this.config.voice) {
            const voices = this.synthesis.getVoices();
            const selectedVoice = voices.find(v => v.name === this.config.voice);
            if (selectedVoice) {
                utterance.voice = selectedVoice;
            }
        }
        
        utterance.onstart = () => {
            this.updateStatus('speaking', 'Spreche...');
        };
        
        utterance.onend = () => {
            this.updateStatus('ready', `Bereit - ${this.user.name}`);
        };
        
        this.synthesis.speak(utterance);
    }

    // ==================== JARVIS API ====================
    
    async processInput(text) {
        this.addMessage('user', text);
        this.updateStatus('processing', 'Denke nach...');
        
        try {
            const response = await this.sendToJarvisAPI(text);
            this.addMessage('jarvis', response.response);
            this.speak(response.response);
            
        } catch (error) {
            console.error('Error:', error);
            const errorMsg = 'Entschuldigung, Sir. Ich konnte keine Verbindung zum Hauptsystem herstellen.';
            this.addMessage('jarvis', errorMsg);
            this.speak(errorMsg);
        }
        
        this.updateStatus('ready', `Bereit - ${this.user.name}`);
    }

    async sendToJarvisAPI(message) {
        const response = await fetch(`${this.apiBaseUrl}/api/jarvis/ask`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                user: this.user.id,
                message: message,
                context: {
                    location: 'wohnzimmer',
                    timestamp: new Date().toISOString()
                }
            })
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        return await response.json();
    }

    // ==================== UI EVENTS ====================
    
    initEventListeners() {
        // Voice Button
        const voiceBtn = document.getElementById('voiceButton');
        if (voiceBtn) {
            voiceBtn.addEventListener('click', () => {
                if (this.isListening) {
                    this.stopListening();
                } else {
                    this.startListening();
                }
            });
        }
        
        // Text Input
        const textInput = document.getElementById('textInput');
        const sendBtn = document.getElementById('sendTextBtn');
        
        if (textInput && sendBtn) {
            sendBtn.addEventListener('click', () => {
                const text = textInput.value.trim();
                if (text) {
                    this.processInput(text);
                    textInput.value = '';
                }
            });
            
            textInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    sendBtn.click();
                }
            });
        }
        
        // Logout
        const logoutBtn = document.getElementById('logoutBtn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', () => this.logout());
        }
        
        // Settings
        this.initSettingsListeners();
        
        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (e.code === 'Space' && e.target === document.body) {
                e.preventDefault();
                if (this.isListening) {
                    this.stopListening();
                } else {
                    this.startListening();
                }
            }
        });
    }

    initSettingsListeners() {
        const settingsBtn = document.getElementById('settingsBtn');
        const settingsModal = document.getElementById('settingsModal');
        const closeSettings = document.getElementById('closeSettings');
        const saveSettings = document.getElementById('saveSettings');
        
        if (settingsBtn) {
            settingsBtn.addEventListener('click', () => {
                this.loadSettingsToForm();
                settingsModal.classList.add('active');
            });
        }
        
        if (closeSettings) {
            closeSettings.addEventListener('click', () => {
                settingsModal.classList.remove('active');
            });
        }
        
        if (settingsModal) {
            settingsModal.addEventListener('click', (e) => {
                if (e.target === settingsModal) {
                    settingsModal.classList.remove('active');
                }
            });
        }
        
        if (saveSettings) {
            saveSettings.addEventListener('click', () => {
                this.saveSettingsFromForm();
                settingsModal.classList.remove('active');
                this.showNotification('Einstellungen gespeichert', 'success');
            });
        }
    }

    loadSettingsToForm() {
        const voiceSelect = document.getElementById('voiceSelect');
        const languageSelect = document.getElementById('languageSelect');
        const autoSpeak = document.getElementById('autoSpeak');
        const apiUrl = document.getElementById('apiUrl');
        
        if (voiceSelect) voiceSelect.value = this.config.voice;
        if (languageSelect) languageSelect.value = this.config.language;
        if (autoSpeak) autoSpeak.checked = this.config.autoSpeak;
        if (apiUrl) apiUrl.value = this.apiBaseUrl;
    }

    saveSettingsFromForm() {
        const voiceSelect = document.getElementById('voiceSelect');
        const languageSelect = document.getElementById('languageSelect');
        const autoSpeak = document.getElementById('autoSpeak');
        const apiUrl = document.getElementById('apiUrl');
        
        if (voiceSelect) this.config.voice = voiceSelect.value;
        if (languageSelect) this.config.language = languageSelect.value;
        if (autoSpeak) this.config.autoSpeak = autoSpeak.checked;
        if (apiUrl) {
            this.config.apiUrl = apiUrl.value;
            this.apiBaseUrl = apiUrl.value;
        }
        
        this.saveConfig();
        
        if (this.recognition) {
            this.recognition.lang = this.config.language;
        }
    }

    // ==================== UI HELPERS ====================

    updateVoiceButton(listening) {
        const btn = document.getElementById('voiceButton');
        const hint = document.getElementById('voiceHint');
        
        if (btn) {
            if (listening) {
                btn.classList.add('listening');
            } else {
                btn.classList.remove('listening');
            }
        }
        
        if (hint) {
            hint.textContent = listening ? 'Sprechen Sie jetzt...' : 'Tippen zum Sprechen';
        }
    }

    updateStatus(state, text) {
        const indicator = document.getElementById('statusIndicator');
        if (!indicator) return;
        
        const dot = indicator.querySelector('.status-dot');
        const statusText = indicator.querySelector('.status-text');
        
        if (statusText) statusText.textContent = text;
        
        if (dot) {
            dot.className = 'status-dot';
            if (state === 'listening') dot.classList.add('listening');
            else if (state === 'processing') dot.classList.add('connecting');
            else if (state === 'error') dot.classList.add('error');
        }
    }

    addMessage(sender, text) {
        const container = document.getElementById('conversationContainer');
        if (!container) return;
        
        const welcomeMsg = container.querySelector('.welcome-message');
        if (welcomeMsg) {
            welcomeMsg.style.display = 'none';
        }
        
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${sender}`;
        
        const header = sender === 'user' ? this.user.name : 'J.A.R.V.I.S.';
        const time = new Date().toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
        
        messageDiv.innerHTML = `
            <div class="message-header">${header}</div>
            <div class="message-content">${this.escapeHtml(text)}</div>
            <div class="message-time">${time}</div>
        `;
        
        container.appendChild(messageDiv);
        container.scrollTop = container.scrollHeight;
        
        this.conversation.push({ sender, text, time: Date.now() });
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    showNotification(message, type = 'info') {
        alert(message);
    }

    showError(message) {
        console.error(message);
        this.updateStatus('error', 'Fehler');
        this.showNotification(message, 'error');
    }

    registerServiceWorker() {
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('sw.js')
                .then(reg => console.log('Service Worker registered'))
                .catch(err => console.log('Service Worker registration failed'));
        }
    }
}

// Initialize App
document.addEventListener('DOMContentLoaded', () => {
    window.jarvis = new JarvisClient();
});

// Prevent zoom on double tap for mobile
document.addEventListener('touchstart', (e) => {
    if (e.touches.length > 1) {
        e.preventDefault();
    }
}, { passive: false });

// Prevent pull-to-refresh on mobile
document.body.style.overscrollBehavior = 'none';
