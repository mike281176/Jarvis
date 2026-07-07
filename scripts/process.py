#!/usr/bin/env python3
"""
J.A.R.V.I.S. Message Processor
Zentrale Nachrichtenverarbeitung für Home Assistant Integration

Usage: python3 process.py [--daemon]
"""

import json
import os
import sys
import datetime
import argparse
import logging
from pathlib import Path

# Konfiguration
PROJECT_ROOT = Path(__file__).parent.parent
DATA_DIR = PROJECT_ROOT / "data"
JSON_PATH = DATA_DIR / "messages.json"
LOG_DIR = DATA_DIR / "logs"

# Logging Setup
LOG_DIR.mkdir(parents=True, exist_ok=True)
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler(LOG_DIR / "jarvis.log"),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger('jarvis')

def ensure_data_file():
    """Stellt sicher, dass die JSON-Datei existiert"""
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    if not JSON_PATH.exists():
        with open(JSON_PATH, 'w') as f:
            json.dump({"messages": []}, f, indent=2)
        logger.info(f"Created new messages file: {JSON_PATH}")

def load_messages():
    """Lädt alle Nachrichten"""
    ensure_data_file()
    try:
        with open(JSON_PATH, 'r') as f:
            return json.load(f)
    except json.JSONDecodeError as e:
        logger.error(f"Invalid JSON: {e}")
        return {"messages": []}

def save_messages(data):
    """Speichert Nachrichten"""
    with open(JSON_PATH, 'w') as f:
        json.dump(data, f, indent=2)

def get_answer(message_text):
    """
    Generiere Antwort basierend auf Nachricht.
    Wird von HA python_script aufgerufen - daher hass-Objekt verfügbar.
    """
    msg_lower = message_text.lower()
    
    # Solar-Abfrage
    if any(k in msg_lower for k in ['solar', 'pv', 'strom', 'produktion', 'erzeugung', 'einspeisung']):
        try:
            # Versuche verschiedene Solar-Entities
            entities = ['sensor.solar_aktuell', 'sensor.solar_power', 'sensor.pv_power', 
                       'sensor.solar_production', 'sensor.solar_eigenverbrauch']
            power_val = None
            
            for entity in entities:
                power = hass.states.get(entity)
                if power and power.state not in ['unknown', 'unavailable', None, '']:
                    try:
                        power_val = float(power.state)
                        unit = power.attributes.get('unit_of_measurement', 'W')
                        break
                    except:
                        continue
            
            if power_val is not None:
                # Tagesertrag
                today = hass.states.get('sensor.jarvis_solar_heute') or \
                       hass.states.get('sensor.solar_today') or \
                       hass.states.get('sensor.pv_today')
                
                t_val = 0
                if today and today.state not in ['unknown', 'unavailable', None, '']:
                    try:
                        t_val = float(today.state)
                    except:
                        pass
                
                if t_val > 0:
                    return f"Aktuell produzieren wir {int(power_val)} Watt Solarstrom. Heute bereits {t_val:.2f} Kilowattstunden erzeugt."
                else:
                    return f"Aktuell produzieren wir {int(power_val)} Watt Solarstrom."
            else:
                return "Die Solaranlage sendet momentan keine Daten, Sir."
        except Exception as e:
            logger.error(f"Solar query error: {e}")
            return "Solar-Daten sind momentan nicht verfügbar, Sir."
    
    # Klima-Abfrage
    if any(k in msg_lower for k in ['klima', 'temperatur', 'heizung', 'split', 'grad', 'kühlen']):
        try:
            climate = hass.states.get('climate.split_klimaanlage')
            if climate and climate.state not in ['unknown', 'unavailable', None]:
                current = climate.attributes.get('current_temperature', '?')
                target = climate.attributes.get('temperature', '?')
                mode_map = {
                    'cool': 'kühlt', 
                    'heat': 'heizt', 
                    'off': 'ist ausgeschaltet',
                    'dry': 'entfeuchtet',
                    'fan_only': 'ventiliert',
                    'auto': 'regelt automatisch'
                }
                mode = mode_map.get(climate.state, f'ist im Modus {climate.state}')
                
                if climate.state == 'off':
                    return f"Die Klimaanlage ist aus. Raumtemperatur beträgt {current}°C."
                return f"Die Klimaanlage {mode}. Aktuell {current}°C, Ziel {target}°C."
            else:
                return "Die Klimaanlage ist momentan nicht erreichbar, Sir."
        except Exception as e:
            logger.error(f"Climate query error: {e}")
            return "Klima-Daten sind momentan nicht verfügbar, Sir."
    
    # Uhrzeit
    if any(k in msg_lower for k in ['uhrzeit', 'wie spät', 'wie viel uhr', 'wie spät ist es']):
        now = datetime.datetime.now()
        hour = now.hour
        minute = now.strftime('%M')
        
        if 5 <= hour < 12:
            greeting = "Guten Morgen"
        elif 12 <= hour < 18:
            greeting = "Guten Tag"
        elif 18 <= hour < 22:
            greeting = "Guten Abend"
        else:
            greeting = "Gute Nacht"
        
        return f"Es ist {hour} Uhr {minute}, {greeting}, Sir."
    
    # Datum
    if any(k in msg_lower for k in ['datum', 'welcher tag', 'heute ist', 'welches datum']):
        now = datetime.datetime.now()
        days = ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag']
        months = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 
                  'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember']
        return f"Heute ist {days[now.weekday()]}, der {now.day}. {months[now.month - 1]} {now.year}."
    
    # System Status
    if any(k in msg_lower for k in ['status', 'system', 'läuft alles', 'alles ok']):
        try:
            entities = len(hass.states.all())
            return f"Home Assistant läuft stabil, Sir. {entities} Entitäten registriert und alle Systeme funktionsbereit."
        except:
            return "Alle Systeme funktionieren einwandfrei, Sir."
    
    # Begrüßung
    if any(k in msg_lower for k in ['hallo', 'hi', 'guten tag', 'guten morgen', 'guten abend']):
        hour = datetime.datetime.now().hour
        if 5 <= hour < 12:
            return "Guten Morgen, Sir. Ich stehe zu Ihren Diensten."
        elif 12 <= hour < 18:
            return "Guten Tag, Sir. Wie kann ich behilflich sein?"
        else:
            return "Guten Abend, Sir. Was kann ich für Sie tun?"
    
    # Hilfe
    if any(k in msg_lower for k in ['hilfe', 'was kannst du', 'befehle', 'kommandos']):
        return "Ich kann Ihnen bei folgenden Dingen helfen: Solar-Produktion, Klimaanlage, Uhrzeit, Datum, System-Status. Fragen Sie einfach."
    
    # Standard-Antwort
    return f"Ich verstehe '{message_text}' nicht ganz, Sir. Fragen Sie nach Solar, Klima, Uhrzeit, Datum, Status oder sagen Sie Hilfe für weitere Optionen."

def process_pending():
    """Hauptverarbeitung - für HA python_script"""
    try:
        data = load_messages()
        messages = data.get('messages', [])
        pending = [m for m in messages if m.get('status') == 'pending']
        
        if not pending:
            return 0
        
        # Verarbeite erste pending Nachricht
        msg = pending[0]
        msg_text = msg.get('message', '')
        echo = msg.get('echo_device', 'media_player.echo_wohnzimmer')
        msg_id = msg.get('id')
        
        logger.info(f"Processing message {msg_id}: {msg_text}")
        
        # Markiere als processing
        msg['status'] = 'processing'
        save_messages(data)
        
        # Generiere Antwort
        answer = get_answer(msg_text)
        
        # Sende an Echo (falls hass verfügbar)
        try:
            hass.services.call('notify', 'alexa_media', {
                'target': echo,
                'message': answer,
                'data': {'type': 'tts'}
            })
        except Exception as e:
            logger.error(f"Failed to send notification: {e}")
        
        # Markiere als completed
        msg['status'] = 'completed'
        msg['completed_at'] = datetime.datetime.now().isoformat()
        msg['answer'] = answer
        
        save_messages(data)
        logger.info(f"Message {msg_id} processed: {answer}")
        
        return 1
        
    except Exception as e:
        logger.error(f"Processing error: {e}")
        return 0

def add_message(message, echo_device=None):
    """Fügt eine neue Nachricht hinzu (für externe Aufrufe)"""
    data = load_messages()
    
    new_msg = {
        "id": datetime.datetime.now().strftime("%Y%m%d%H%M%S%f"),
        "timestamp": datetime.datetime.now().isoformat(),
        "source": echo_device or "unknown",
        "message": message,
        "status": "pending",
        "response": None,
        "processed_at": None
    }
    
    data['messages'].append(new_msg)
    save_messages(data)
    
    logger.info(f"Added message: {message}")
    return new_msg['id']

def mark_completed(message_id, answer=None):
    """Markiert eine Nachricht als completed"""
    data = load_messages()
    
    for msg in data['messages']:
        if msg.get('id') == message_id and msg.get('status') == 'pending':
            msg['status'] = 'completed'
            msg['completed_at'] = datetime.datetime.now().isoformat()
            if answer:
                msg['answer'] = answer
            save_messages(data)
            return True
    
    return False

def get_pending_count():
    """Gibt Anzahl pending Nachrichten zurück"""
    data = load_messages()
    return len([m for m in data.get('messages', []) if m.get('status') == 'pending'])

def main():
    parser = argparse.ArgumentParser(description='J.A.R.V.I.S. Message Processor')
    parser.add_argument('--add', '-a', help='Add a new message')
    parser.add_argument('--device', '-d', help='Echo device for new message')
    parser.add_argument('--mark-completed', '-c', help='Mark message ID as completed')
    parser.add_argument('--answer', help='Answer for completed message')
    parser.add_argument('--count', action='store_true', help='Show pending count')
    parser.add_argument('--daemon', action='store_true', help='Run as daemon')
    
    args = parser.parse_args()
    
    if args.add:
        msg_id = add_message(args.add, args.device)
        print(f"Added message with ID: {msg_id}")
    elif args.mark_completed:
        if mark_completed(args.mark_completed, args.answer):
            print(f"Marked {args.mark_completed} as completed")
        else:
            print(f"Message {args.mark_completed} not found or not pending")
    elif args.count:
        count = get_pending_count()
        print(f"Pending messages: {count}")
    else:
        count = process_pending()
        print(f"Processed {count} messages")

if __name__ == "__main__":
    main()
