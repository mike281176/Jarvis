#!/bin/bash
# Generiert public/version.json mit aktuellem Git-Hash + Zeitstempel
# Damit man im Browser visuell prüfen kann, welche Version deployed ist.

cd "$(dirname "$0")/.." || exit 1

COMMIT=$(git rev-parse --short HEAD 2>/dev/null || echo "unknown")
FULL_COMMIT=$(git rev-parse HEAD 2>/dev/null || echo "unknown")
BRANCH=$(git branch --show-current 2>/dev/null || echo "unknown")
BUILT_AT=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

cat > public/version.json <<EOF
{
  "commit": "${COMMIT}",
  "full_commit": "${FULL_COMMIT}",
  "branch": "${BRANCH}",
  "built_at": "${BUILT_AT}",
  "app": "J.A.R.V.I.S. PWA"
}
EOF

echo "Version generated: ${COMMIT} (${BRANCH}) at ${BUILT_AT}"
