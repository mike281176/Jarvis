#!/bin/bash
set -e
export PATH="/home/mike/.hermes/hermes-agent/venv/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"
systemctl --user daemon-reload
systemctl --user restart hermes-gateway.service
sleep 3
systemctl --user restart jarvis-auth.service
systemctl --user restart jarvis-proxy.service
systemctl --user restart ngrok-jarvis.service
