#!/usr/bin/env bash
# Deploy latest code to VPS and restart disc-tracker.
# Run from local machine: ./deploy.sh
#
# Requires VPS_HOST=user@host in a local .env file (not committed).
set -euo pipefail

# ── config ────────────────────────────────────────────────────────────────────
VPS="ubuntu@51.81.80.126"

# ── pre-deploy checks ─────────────────────────────────────────────────────────
echo "=== Pre-deploy checks ==="

if ! git diff-index --quiet HEAD --; then
    echo "WARNING: uncommitted local changes won't be deployed (only pushed commits)."
fi

echo "--- syntax check ---"
python3 -m py_compile app.py && echo "app.py OK"

echo "--- git push ---"
git push origin main

# ── remote deploy ─────────────────────────────────────────────────────────────
echo ""
echo "=== Deploying to $VPS ==="

ssh "$VPS" bash <<'REMOTE'
set -euo pipefail
cd ~/disc_tracker

echo "--- git pull ---"
git pull

echo "--- syntax check ---"
python3 -m py_compile app.py && echo "app.py OK"

echo "--- restart service ---"
systemctl --user restart disc_tracker.service

echo "--- status ---"
systemctl --user status disc_tracker.service --no-pager -l | head -8
REMOTE

echo ""
echo "Deploy complete."
