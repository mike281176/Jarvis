/**
 * J.A.R.V.I.S. PWA - Kamera Konfiguration
 * 
 * Zentrale Konfiguration aller Kamera-Entities für Home Assistant
 * WebRTC/go2rtc wird bevorzugt, fallback auf camera_proxy
 * 
 * Letzte Aktualisierung: 2026-08-01
 * HAOS Version: 2026.7.x
 * Frigate: LXC 104 auf Proxmox (nicht mehr 192.168.1.176)
 */

export const CAMERA_CONFIG = {
    // Dashboard Kamera-Grid (4 Kameras)
    dashboard: [
        {
            id: 'camFrontImg',
            name: 'Einfahrt',
            entity: 'camera.back_door_standardauflosung',
            webrtc: false,  // WebRTC wenn verfügbar
            frigate: false, // Frigate NVR wenn verfügbar
            refresh: 2000   // Refresh-Rate in ms
        },
        {
            id: 'camBackImg',
            name: 'Hinten',
            entity: 'camera.back_door_standardauflosung',
            webrtc: false,
            frigate: false,
            refresh: 2000
        },
        {
            id: 'camEinfahrtImg',
            name: 'Einfahrt HD',
            entity: 'camera.einfahrt_hochauflosung',
            webrtc: false,
            frigate: false,
            refresh: 2000
        },
        {
            id: 'camDoorbirdImg',
            name: 'Doorbird',
            entity: 'camera.doorstation_1ccae371de47_live',
            webrtc: false,
            frigate: false,
            refresh: 2000
        }
    ],
    
    // Einzelkamera-Ansicht (loadCameraFeed)
    single: {
        'front': 'camera.back_door_standardauflosung',
        'back': 'camera.back_door_standardauflosung',
        'einfahrt': 'camera.einfahrt_hochauflosung',
        'doorbird': 'camera.doorstation_1ccae371de47_live',
        'reolink': 'camera.reolink_main'  // Falls vorhanden
    },
    
    // go2rtc WebRTC Streams (wenn in HAOS eingerichtet)
    // go2rtc muss in HAOS unter /config/go2rtc.yml konfiguriert sein
    webrtc: {
        enabled: false,  // true wenn go2rtc in HAOS aktiv
        baseUrl: 'http://192.168.1.91:8123/api/webrtc',
        streams: {
            'front_door': 'front_door',
            'back_door': 'back_door',
            'einfahrt': 'einfahrt',
            'doorbird': 'doorbird'
        }
    },
    
    // Frigate NVR Integration (LXC 104 auf Proxmox)
    frigate: {
        enabled: false,  // true wenn Frigate in HA integriert
        baseUrl: 'http://192.168.1.130:5000', // Proxmox LXC 104
        // Alternative: HA Proxy wenn Frigate als HA-Integration
        haProxy: true,
        cameras: {
            'front': 'front_door',
            'back': 'back_door',
            'einfahrt': 'einfahrt'
        }
    },
    
    // Fallback: HA Camera Proxy
    proxy: {
        baseUrl: '/api/jarvis/ha-proxy/api/camera_proxy',
        timeout: 5000,
        refresh: 2000
    }
};

// Helper: Kamera-URL generieren (priorisiert WebRTC > Frigate > Proxy)
export function getCameraUrl(entityId, options = {}) {
    const { webrtc = false, frigate = false } = options;
    
    // 1. Versuch: WebRTC (go2rtc)
    if (webrtc && CAMERA_CONFIG.webrtc.enabled) {
        const streamName = CAMERA_CONFIG.webrtc.streams[entityId.replace('camera.', '')];
        if (streamName) {
            return `${CAMERA_CONFIG.webrtc.baseUrl}/${streamName}`;
        }
    }
    
    // 2. Versuch: Frigate NVR
    if (frigate && CAMERA_CONFIG.frigate.enabled) {
        const cameraName = CAMERA_CONFIG.frigate.cameras[entityId.replace('camera.', '')];
        if (cameraName) {
            const baseUrl = CAMERA_CONFIG.frigate.haProxy
                ? '/api/jarvis/ha-proxy'
                : CAMERA_CONFIG.frigate.baseUrl;
            return `${baseUrl}/api/${cameraName}/latest.jpg`;
        }
    }
    
    // 3. Fallback: HA Camera Proxy
    const token = Date.now();
    return `/api/jarvis/ha-proxy/api/camera_proxy/${entityId}?token=${token}&t=${Date.now()}`;
}

export default CAMERA_CONFIG;
