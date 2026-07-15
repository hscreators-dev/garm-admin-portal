#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
# Garm — push local changes to GitHub → auto-deploys to Render (live)
# Double-click me. Pushes BOTH repos (admin portal + Garm app).
# Your Mac is signed in to GitHub, so this just works.
# ─────────────────────────────────────────────────────────────────────────────
cd "$(dirname "$0")"
ADMIN="$(pwd)"
FAB="$(cd ../"Latest version of FAB" && pwd)"

echo ""
echo "  Pushing Garm Admin Portal…"
git -C "$ADMIN" push origin main && echo "  ✅ Admin pushed." || echo "  ⚠️ Admin push failed — see message above."

echo ""
echo "  Pushing Garm App…"
git -C "$FAB" push origin main && echo "  ✅ Garm App pushed." || echo "  ⚠️ Garm App push failed — see message above."

echo ""
echo "  ┌───────────────────────────────────────────────┐"
echo "  │  Render now auto-deploys both (~3 min).        │"
echo "  │  Watch: https://dashboard.render.com          │"
echo "  └───────────────────────────────────────────────┘"
echo ""
read -p "  Press Enter to close… " _
