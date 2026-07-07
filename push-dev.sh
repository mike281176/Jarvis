#!/bin/bash
# Push development branch zu GitHub

cd /home/mike/projects/jarvis

# Prüfe ob Token gesetzt ist
if [ -z "$GITHUB_TOKEN" ]; then
    echo "❌ GITHUB_TOKEN nicht gesetzt"
    echo "Bitte exportieren Sie zuerst:"
    echo "export GITHUB_TOKEN=ghp_..."
    exit 1
fi

# Remote hinzufügen falls nicht vorhanden
if ! git remote | grep -q origin; then
    git remote add origin https://mike281176:${GITHUB_TOKEN}@github.com/mike281176/Jarvis.git
    echo "✅ Remote hinzugefügt"
fi

# Push development branch
echo "🚀 Pushe development branch..."
git push -u origin development

echo ""
echo "✅ Fertig! Branch 'development' gepusht."
echo ""
echo "Für Vercel Deployment:"
echo "  cd /home/mike/projects/jarvis/pwa"
echo "  vercel --prod"
