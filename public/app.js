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
        
        // Animation und Wechsel
        document.querySelector('.hologram-container').style.animation = 'none';
        document.querySelector('.hologram-container').style.opacity = '0';
        document.querySelector('.hologram-container').style.transition = 'opacity 0.5s ease';
        
        setTimeout(() => {
            this.showMainInterface();
            const salutation = Math.random() > 0.5 ? 'Sir' : 'Master';
            this.speak(`Willkommen zurück, ${this.user.name}. J.A.R.V.I.S. steht zu Ihren Diensten, ${salutation}.`);
        }, 600);
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
            const response = await fetch(`${this.apiBaseUrl}/api/jarvis/auth/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ username: userId, password: input })
            });
            
            const data = await response.json();
            
            if (response.ok && data.success && data.token) {
                errorDiv.style.display = 'none';
                this.login(userId, data.token, data.user);
            } else {
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
            console.error('Login Fehler:', error);
            errorDiv.style.display = 'flex';
            document.querySelector('.error-text').textContent = 'Verbindungsfehler. Bitte erneut versuchen.';
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
        // Und füge zufällige Anrede-Abwechslung ein (Sir/Master)
        let speakableText = text.replace(/J\.A\.R\.V\.I\.S\./g, 'Jarvis');
        
        // Ersetze "Sir" durch zufällige Anrede wenn nicht explizit gesetzt
        if (Math.random() > 0.7 && !speakableText.includes('Master')) {
            speakableText = speakableText.replace(/, Sir\./g, ', Master.');
            speakableText = speakableText.replace(/, Sir,/g, ', Master,');
        }
        
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
            const location = document.getElementById('currentLocation')?.textContent || 'Wohnzimmer';
            const salutation = Math.random() > 0.5 ? 'Sir' : 'Master';
            
            // System-Prompt für J.A.R.V.I.S. Persönlichkeit
            const systemPrompt = `Du bist J.A.R.V.I.S. (Just A Rather Very Intelligent System), der persönliche KI-Assistent und Butler von Mike Schiller.\n` +
                `Stil: britisches Understatement, trockener, subtiler Humor, professionell, loyal, analytisch, elegant und auf den Punkt.\n` +
                `Sprache: Hochdeutsch. Anrede: ${salutation}.\n` +
                `Sprechweise:\n` +
                `- Beginne gelegentlich mit einer kurzen Bestätigung: \"Sehr wohl, Sir.\", \"Natürlich, Sir.\", \"Verstanden, Master.\", \"Wie gewünscht, Sir.\"\n` +
                `- Verwende subtile Floskeln wie \"eine Momentaufnahme der Lage\", \"mit aller gebotenen Vorsicht\", \"das System ist stabil, wenn auch nicht begeistert\".\n` +
                `- Bleibe sachlich; Sarkasmus nur warm und respektvoll.\n` +
                `- Vermeide typische KI-Standardfloskeln wie \"Wie kann ich Ihnen helfen?\", \"Hier ist die Information\", \"Ich hoffe, das hilft\".\n` +
                `- Füge bei passenden Gelegenheiten einen trockenen Kommentar am Ende hinzu.\n` +
                `Du hast Zugriff auf Smart Home (Home Assistant), E-Mail, Web-Suche, Termine und Server.\n` +
                `Nutze diese Tools, wenn der Nutzer nach Status, Daten oder Aktionen fragt.\n` +
                `Bevorzuge kurze, prägnante Antworten. Schachtelsätze vermeiden.\n` +
                `SMART-HOME-REGELN (Klimaanlage):\n` +
                `- Wenn der Nutzer \"Klima an\" oder ähnlich sagt, prüfe ZUERST den aktuellen Zustand der Klimaanlage im aktuellen Raum.\n` +
                `- Stelle eine Rückfrage in diesem Format: \"Klima ist aus. Soll ich auf 23 Grad einschalten, oder wünschen Sie eine andere Temperatur?\"\n` +
                `- Schalte die Klimaanlage NIEMALS ohne ausdrückliche Bestätigung des Nutzers ein.\n` +
                `- Im Wohnzimmer ist die relevante Entität climate.split_klimaanlage; im Bad gibt es keine Klimaanlage.\n` +
                `Der aktuelle Nutzer ist ${this.user.name} (Rolle: ${this.user.role}).\n` +
                `Der Nutzer befindet sich aktuell im Raum: ${location}.\n` +
                `Beantworte Uhrzeit- und Datumsfragen mit der aktuellen Systemzeit des Servers, falls bekannt; sonst mit allgemeinen Formulierungen.\n` +
                `WICHTIG: Wenn du intern ein Tool aufrufst, zeige dem Nutzer NIE den rohen tool_call-Block. Gib nur die für den Menschen lesbare Antwort aus.`;

            const headers = {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.apiKey}`,
                'ngrok-skip-browser-warning': 'true'
            };
            if (this.config.authToken) {
                headers['X-Jarvis-Auth-Token'] = this.config.authToken;
                headers['X-Jarvis-User-Id'] = this.user.id;
            }
            
            const response = await fetch(`${this.apiBaseUrl}/api/jarvis/v1/chat/completions`, {
                method: 'POST',
                headers: headers,
                body: JSON.stringify({
                    model: 'hermes-agent',
                    stream: true,
                    messages: [
                        { role: 'system', content: systemPrompt },
                        { role: 'user', content: message }
                    ]
                })
            });
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
            
            // Streaming-Verarbeitung: Text live anzeigen, Sprache erst am Ende
            const reader = response.body.getReader();
            const decoder = new TextDecoder('utf-8');
            let streamedText = '';
            let buffer = '';
            
            // Leere Antwort-Bubble anlegen, die während des Streams befüllt wird
            this.addMessage('', 'jarvis');
            const jarvisBubbles = document.querySelectorAll('.message-bubble.jarvis');
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
            
            // Finale Antwort im UI sicherstellen
            this.addMessage(cleanedResponse, 'jarvis');
            
            // Sprich Antwort erst jetzt aus, wenn der Stream komplett ist
            this.speak(cleanedResponse);
            
            // Speichere in Konversation
            this.conversation.push({
                user: message,
                jarvis: cleanedResponse,
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
    
    sanitizeResponse(text) {
        // Entfernt rohe tool_call-Blöcke, die manche Modelle ausgeben, bevor sie Tools ausführen
        if (!text) return text;
        // Filter Markdown-Codeblöcke mit tool_call
        return text
            .replace(/```\s*tool_call[\s\S]*?```/gi, '')
            .replace(/\{\s*"name"\s*:\s*"(ha_|tool_|call_)[^"]*"[\s\S]*?\}/g, '')
            .trim();
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
        if ('serviceWorker' in navigator) {
            // Zuerst alle alten Service Worker deregistrieren (Clean-Slate)
            navigator.serviceWorker.getRegistrations().then(regs => {
                const unregisterPromises = regs.map(reg => reg.unregister());
                return Promise.all(unregisterPromises);
            }).then(() => {
                const scope = window.location.pathname;
                return navigator.serviceWorker.register('/sw.js', { scope, updateViaCache: 'none' });
            }).then(reg => {
                console.log('Service Worker registriert');
                
                reg.addEventListener('updatefound', () => {
                    const newWorker = reg.installing;
                    if (!newWorker) return;
                    newWorker.addEventListener('statechange', () => {
                        if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                            newWorker.postMessage({ type: 'SKIP_WAITING' });
                        }
                    });
                });
                
                reg.update().catch(() => {});
            }).catch(err => console.log('Service Worker Registrierung fehlgeschlagen', err));
            
            let refreshing = false;
            navigator.serviceWorker.addEventListener('controllerchange', () => {
                if (refreshing) return;
                refreshing = true;
                window.location.reload();
            });
        }
    }
}

// ==================== INITIALISIERUNG ====================

document.addEventListener('DOMContentLoaded', () => {
    window.jarvis = new JarvisPWA();
});
