#!/bin/sh
# Erzeugt public/version.json für Vercel-Builds.
# Nutzt Vercel-Git-Variablen, falls verfügbar, sonst lokales git.

COMMIT=${VERCEL_GIT_COMMIT_SHA:-$(git rev-parse HEAD 2>/dev/null || echo unknown)}
BRANCH=${VERCEL_GIT_COMMIT_REF:-$(git branch --show-current 2>/dev/null || echo unknown)}
DATE=$(date -u +%Y-%m-%dT%H:%M:%SZ)

printf '{"commit":"%s","short_commit":"%.7s","branch":"%s","built_at":"%s","app":"J.A.R.V.I.S. PWA"}\n' \
    "$COMMIT" "$COMMIT" "$BRANCH" "$DATE" > public/version.json
