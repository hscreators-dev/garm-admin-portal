#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
# Garm — share your running app online for FREE (Cloudflare Tunnel)
# Your app must already be running (double-click start-garm.command first).
# This gives you two public https links anyone can open — no server, no cost.
# Keep this window open and your Mac awake while you're sharing.
# ─────────────────────────────────────────────────────────────────────────────
cd "$(dirname "$0")"

echo ""
echo "  Sharing Garm online (free)…"
echo ""

# 0) Is the app running?
if ! curl -s http://localhost:8080 >/dev/null 2>&1; then
  echo "  ✋ The app isn't running yet."
  echo "     Double-click start-garm.command first, wait for 'Garm is running', then run this."
  echo ""
  read -p "  Press Enter to close…" _ ; exit 1
fi

# 1) Make sure cloudflared is installed
if ! command -v cloudflared >/dev/null 2>&1; then
  echo "  ⬇️  Installing the free tunnel tool (one time)…"
  if command -v brew >/dev/null 2>&1; then
    brew install cloudflared
  else
    ARCH="$(uname -m)"; ASSET="cloudflared-darwin-amd64.tgz"
    [ "$ARCH" = "arm64" ] && ASSET="cloudflared-darwin-arm64.tgz"
    curl -L -o /tmp/cloudflared.tgz "https://github.com/cloudflare/cloudflared/releases/latest/download/$ASSET"
    tar -xzf /tmp/cloudflared.tgz -C /tmp
    mkdir -p "$HOME/bin" && mv /tmp/cloudflared "$HOME/bin/cloudflared" && chmod +x "$HOME/bin/cloudflared"
    export PATH="$HOME/bin:$PATH"
  fi
fi

CF="$(command -v cloudflared || echo "$HOME/bin/cloudflared")"

# 2) Start two tunnels (customer app :8080, admin :8081)
echo "  🌐 Creating your public links…"
"$CF" tunnel --url http://localhost:8080 > /tmp/garm-cf-8080.log 2>&1 &
PID1=$!
"$CF" tunnel --url http://localhost:8081 > /tmp/garm-cf-8081.log 2>&1 &
PID2=$!

# 3) Wait for the URLs to appear
APP=""; ADM=""
for i in $(seq 1 20); do
  sleep 2
  APP="$(grep -o 'https://[a-z0-9-]*\.trycloudflare\.com' /tmp/garm-cf-8080.log | head -1)"
  ADM="$(grep -o 'https://[a-z0-9-]*\.trycloudflare\.com' /tmp/garm-cf-8081.log | head -1)"
  [ -n "$APP" ] && [ -n "$ADM" ] && break
done

echo ""
echo "  ┌───────────────────────────────────────────────┐"
echo "  │   Garm is now LIVE on the internet (free)!    │"
echo "  └───────────────────────────────────────────────┘"
echo ""
if [ -n "$APP" ]; then echo "  👕 Customer app :  $APP"; else echo "  (customer link still starting — check /tmp/garm-cf-8080.log)"; fi
if [ -n "$ADM" ]; then echo "  🛠  Admin portal :  $ADM/garm-admin-portal/"; else echo "  (admin link still starting — check /tmp/garm-cf-8081.log)"; fi
echo ""
echo "  Share those links with anyone. They work as long as:"
echo "    • this window stays open, and"
echo "    • your Mac is awake with the app running."
echo ""
echo "  Press Ctrl+C (or close this window) to stop sharing."
echo ""

# Keep running until the user stops it
trap "kill $PID1 $PID2 2>/dev/null; echo; echo '  Stopped sharing.'; exit 0" INT
wait
