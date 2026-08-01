/**
 * J.A.R.V.I.S. PWA - Lokale Konfiguration
 * 
 * Automatische Erkennung: Lokal vs Vercel/Production
 * 
 * LOKAL (localhost oder 192.168.1.x):
 * - Direkter Zugriff auf Home Assistant API
 * - Kein Proxy nötig
 * - Paperless, Proxmox direkt erreichbar
 * 
 * PRODUCTION (Vercel/Cloud):
 * - Zugriff über Jarvis Proxy API
 * - CORS Header erforderlich
 */

// Automatische Umgebungserkennung
const isLocalhost = window.location.hostname === 'localhost' || 
                    window.location.hostname === '127.0.0.1' ||
                    window.location.hostname.startsWith('192.168.');

// Konfiguration basierend auf Umgebung
export const API_CONFIG = {
    // Modus: 'local' oder 'proxy'
    mode: isLocalhost ? 'local' : 'proxy',
    
    // Lokale APIs (direkter Zugriff)
    local: {
        homeAssistant: 'http://192.168.1.91:8123/api',
        paperless: 'http://192.168.1.159:8777/api',
        proxmox: 'https://192.168.1.130:8006/api2',
        jarvisApi: 'http://192.168.1.81:8124/api/jarvis'
    },
    
    // Proxy APIs (Vercel/Cloud)
    proxy: {
        baseUrl: '', // Wird zur Laufzeit gesetzt
        haProxy: '/api/jarvis/ha-proxy/api',
        paperlessProxy: '/api/jarvis/proxy/paperless',
        proxmoxProxy: '/api/jarvis/proxy/proxmox'
    },
    
    // Tokens
    tokens: {
        homeAssistant: '', // Optional: HA Long-Lived Token
        paperless: '44568e6750650f79836f5cb18f5f76b0fe1eb29f',
        proxmox: '' // Optional: PVE Token
    }
};

// Helper: API URL basierend auf Modus
export function getApiUrl(service, endpoint = '') {
    const config = API_CONFIG;
    
    if (config.mode === 'local') {
        // Direkter Zugriff
        const urls = {
            'ha': config.local.homeAssistant,
            'homeassistant': config.local.homeAssistant,
            'paperless': config.local.paperless,
            'proxmox': config.local.proxmox,
            'jarvis': config.local.jarvisApi
        };
        return `${urls[service] || ''}${endpoint}`;
    } else {
        // Proxy Zugriff
        const proxies = {
            'ha': config.proxy.haProxy,
            'homeassistant': config.proxy.haProxy,
            'paperless': config.proxy.paperlessProxy,
            'proxmox': config.proxy.proxmoxProxy,
            'jarvis': config.proxy.baseUrl
        };
        return `${proxies[service] || ''}${endpoint}`;
    }
}

// Helper: Fetch Wrapper mit automatischem Modus
export async function apiFetch(service, endpoint, options = {}) {
    const url = getApiUrl(service, endpoint);
    
    const defaultHeaders = {
        'Content-Type': 'application/json'
    };
    
    // Tokens hinzufügen
    if (service === 'paperless' && API_CONFIG.tokens.paperless) {
        defaultHeaders['Authorization'] = `Token ${API_CONFIG.tokens.paperless}`;
    }
    
    if (service === 'proxmox' && API_CONFIG.tokens.proxmox) {
        defaultHeaders['Authorization'] = `PVEAPIToken=${API_CONFIG.tokens.proxmox}`;
    }
    
    const config = {
        ...options,
        headers: {
            ...defaultHeaders,
            ...(options.headers || {})
        }
    };
    
    try {
        const response = await fetch(url, config);
        
        if (!response.ok) {
            throw new Error(`${service} API: ${response.status} ${response.statusText}`);
        }
        
        return await response.json();
    } catch (error) {
        console.error(`API Error (${service}):`, error);
        throw error;
    }
}

// Debug: Modus in Console anzeigen
console.log(`🔧 J.A.R.V.I.S. API Modus: ${API_CONFIG.mode.toUpperCase()}`);
if (API_CONFIG.mode === 'local') {
    console.log('✅ Direkter Zugriff auf lokale APIs');
    console.log('   Home Assistant:', API_CONFIG.local.homeAssistant);
    console.log('   Paperless:', API_CONFIG.local.paperless);
    console.log('   Proxmox:', API_CONFIG.local.proxmox);
} else {
    console.log('☁️  Proxy-Modus (Vercel/Cloud)');
}

export default API_CONFIG;
