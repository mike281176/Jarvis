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
        this.apiBaseUrl = this.config.apiUrl || 'https://nonconvergent-francene-toxically.ngrok-free.dev';
        
        this.init();
    }

    // ==================== KONFIGURATION ====================
    
    loadConfig() {
        const defaultConfig = {
            user: null,
            apiUrl: 'https://nonconvergent-francene-toxically.ngrok-free.dev',
            language: 'de-DE',
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
        if (!this.user) {
            this.showLoginScreen();
        } else {
            this.showMainInterface();
            this.initSpeechRecognition();
            this.initVoices();
            this.updateSystemTime();
        }
        
        this.registerServiceWorker();
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
        document.getElementById('apiUrl').value = this.config.apiUrl;
    }

    login(userId) {
        const users = {
            mike: { name: 'Mike', role: 'Administrator' },
            gast: { name: 'Gast', role: 'Besucher' }
        };
        
        this.user = { id: userId, ...users[userId] };
        this.config.user = this.user;
        this.saveConfig();
        
        // Animation und Wechsel
        document.querySelector('.hologram-container').style.animation = 'none';
        document.querySelector('.hologram-container').style.opacity = '0';
        document.querySelector('.hologram-container').style.transition = 'opacity 0.5s ease';
        
        setTimeout(() => {
            this.showMainInterface();
            this.speak(`Willkommen zurück, ${this.user.name}. J.A.R.V.I.S. steht zu Ihren Diensten.`);
        }, 600);
    }

    handleUserSelect(userId) {
        if (userId === 'mike') {
            this.showPasswordPanel();
        } else {
            this.login(userId);
        }
    }

    showPasswordPanel() {
        const userSelection = document.querySelector('.user-selection');
        const passwordPanel = document.getElementById('passwordPanel');
        
        userSelection.style.display = 'none';
        passwordPanel.style.display = 'flex';
        
        document.getElementById('passwordInput').value = '';
        document.getElementById('passwordError').style.display = 'none';
        document.getElementById('passwordInput').focus();
        
        // Animation
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
    }

    verifyPassword() {
        const input = document.getElementById('passwordInput').value;
        const errorDiv = document.getElementById('passwordError');
        
        if (input === 'Jarvis2026') {
            errorDiv.style.display = 'none';
            this.login('mike');
        } else {
            errorDiv.style.display = 'flex';
            document.getElementById('passwordInput').value = '';
            document.getElementById('passwordInput').focus();
            
            // Shake animation
            const panel = document.querySelector('.password-form');
            panel.style.animation = 'shake 0.5s ease';
            setTimeout(() => {
                panel.style.animation = '';
            }, 500);
        }
    }

    logout() {
        this.user = null;
        this.config.user = null;
        this.saveConfig();
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
        document.getElementById('welcomeTime').textContent = this.getTimeString();
        
        // Initialize Speech
        this.initSpeechRecognition();
        this.initVoices();
        
        // Event Listeners
        this.initMainEventListeners();
        
        // Start Time Update
        this.updateSystemTime();
        setInterval(() => this.updateSystemTime(), 1000);
    }

    initMainEventListeners() {
        // Voice Button
        const voiceBtn = document.getElementById('voiceBtn');
        voiceBtn.addEventListener('click', () => this.toggleVoiceInput());
        
        // Text Input
        const textInput = document.getElementById('textInput');
        const sendBtn = document.getElementById('sendBtn');
        
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
        
        // Quick Actions
        document.querySelectorAll('.quick-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const command = e.currentTarget.dataset.command;
                this.sendMessage(command);
            });
        });
        
        // Logout
        document.getElementById('logoutBtn').addEventListener('click', () => {
            if (confirm('Möchten Sie sich abmelden?')) {
                this.logout();
            }
        });
    }

    // ==================== SPRACHERKENNUNG ====================

    initSpeechRecognition() {
        if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
            console.warn('Spracherkennung nicht verfügbar');
            document.getElementById('voiceStatus').textContent = 'Texteingabe';
            return;
        }
        
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        this.recognition = new SpeechRecognition();
        
        this.recognition.continuous = false;
        this.recognition.interimResults = true;
        this.recognition.lang = this.config.language;
        
        this.recognition.onstart = () => {
            this.isListening = true;
            this.updateVoiceStatus('Höre...', 'listening');
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
                document.getElementById('voiceStatus').textContent = interimTranscript;
            }
            
            if (finalTranscript) {
                this.sendMessage(finalTranscript);
            }
        };
        
        this.recognition.onend = () => {
            this.isListening = false;
            this.updateVoiceStatus('Bereit', 'ready');
        };
        
        this.recognition.onerror = (event) => {
            console.error('Spracherkennungsfehler:', event.error);
            this.isListening = false;
            this.updateVoiceStatus('Fehler - Tippen', 'error');
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
        const statusEl = document.getElementById('voiceStatus');
        const voiceBtn = document.getElementById('voiceBtn');
        const voiceCore = document.getElementById('voiceCore');
        
        statusEl.textContent = text;
        
        // Update visual states
        document.querySelectorAll('.voice-ring').forEach(ring => {
            ring.classList.remove('active');
        });
        
        voiceCore.classList.remove('active', 'listening');
        voiceBtn.classList.remove('listening');
        
        if (state === 'listening') {
            document.querySelectorAll('.voice-ring').forEach(ring => {
                ring.classList.add('active');
            });
            voiceCore.classList.add('active', 'listening');
            voiceBtn.classList.add('listening');
        } else if (state === 'error') {
            statusEl.style.color = '#ff6464';
        } else {
            statusEl.style.color = '';
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

    speak(text) {
        if (!this.config.autoSpeak || !this.synthesis) return;
        
        // Stoppe vorherige Sprache
        this.synthesis.cancel();
        
        // Ersetze "J.A.R.V.I.S." durch "Jarvis" für bessere Aussprache
        const speakableText = text.replace(/J\.A\.R\.V\.I\.S\./g, 'Jarvis');
        
        const utterance = new SpeechSynthesisUtterance(speakableText);
        utterance.lang = 'de-DE';
        utterance.rate = 1.0;
        utterance.pitch = 0.9;
        
        // Versuche einen guten deutschen Voice zu finden
        if (this.voices && this.voices.length > 0) {
            const germanVoice = this.voices.find(v => 
                v.lang.startsWith('de') && v.name.includes('Google')
            ) || this.voices.find(v => v.lang.startsWith('de'));
            
            if (germanVoice) {
                utterance.voice = germanVoice;
            }
        }
        
        // Visuelle Animation während des Sprechens
        utterance.onstart = () => {
            this.updateVoiceStatus('Spreche...', 'active');
        };
        
        utterance.onend = () => {
            this.updateVoiceStatus('Bereit', 'ready');
        };
        
        this.synthesis.speak(utterance);
    }

    // ==================== API KOMMUNIKATION ====================

    async sendMessage(message) {
        // Zeige User-Nachricht
        this.addMessage(message, 'user');
        
        // Aktiviere Lade-Zustand
        this.updateVoiceStatus('Verarbeite...', 'active');
        
        try {
            const response = await fetch(`${this.apiBaseUrl}/api/jarvis/ask`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'ngrok-skip-browser-warning': 'true'
                },
                body: JSON.stringify({
                    user: this.user.id,
                    message: message,
                    context: {
                        location: document.getElementById('currentLocation').textContent,
                        timestamp: new Date().toISOString()
                    }
                })
            });
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
            
            const data = await response.json();
            
            // Zeige JARVIS Antwort
            this.addMessage(data.response, 'jarvis');
            
            // Sprich Antwort aus
            this.speak(data.response);
            
            // Speichere in Konversation
            this.conversation.push({
                user: message,
                jarvis: data.response,
                intent: data.intent,
                timestamp: new Date()
            });
            
        } catch (error) {
            console.error('API Fehler:', error);
            const errorMsg = 'Entschuldigung, Sir. Die Verbindung zum Hauptsystem ist unterbrochen.';
            this.addMessage(errorMsg, 'jarvis');
            this.speak(errorMsg);
        }
        
        this.updateVoiceStatus('Bereit', 'ready');
    }

    addMessage(text, sender) {
        const chatContainer = document.getElementById('chatContainer');
        
        // Lösche vorherige Nachrichten, behalte nur die letzte
        chatContainer.innerHTML = '';
        
        const messageBubble = document.createElement('div');
        messageBubble.className = `message-bubble ${sender}`;
        
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
        
        // Speichere im Konversationslog
        this.logConversation(text, sender);
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
    
    getConversationLog() {
        return JSON.parse(localStorage.getItem('jarvis_conversation_log') || '[]');
    }
    
    clearConversationLog() {
        localStorage.removeItem('jarvis_conversation_log');
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

    // ==================== SERVICE WORKER ====================

    registerServiceWorker() {
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('sw.js')
                .then(reg => console.log('Service Worker registriert'))
                .catch(err => console.log('Service Worker Registrierung fehlgeschlagen'));
        }
    }
}

// ==================== INITIALISIERUNG ====================

document.addEventListener('DOMContentLoaded', () => {
    window.jarvis = new JarvisPWA();
});
