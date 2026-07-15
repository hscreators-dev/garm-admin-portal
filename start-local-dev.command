#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
# Garm — local DEV launcher (double-click me)
# Starts everything the dev setup needs, in the right order:
#   MongoDB → Garm App backend (4000) → Admin backend (5050)
#   → Garm App (5173) → Admin Portal (5174)
# Safe to run again any time — anything already running is left alone.
# Logs: ~/garm-logs/
# ─────────────────────────────────────────────────────────────────────────────
cd "$(dirname "$0")"
ADMIN="$(pwd)"
FAB="$(cd ../"Latest version of FAB" && pwd)"
LOGS="$HOME/garm-logs"; mkdir -p "$LOGS"

echo ""
echo "  ┌─────────────────────────────────────────────┐"
echo "  │        Starting Garm (local dev)            │"
echo "  └─────────────────────────────────────────────┘"

port_up() { nc -z localhost "$1" >/dev/null 2>&1; }

# 0) Pull the latest code from GitHub (public repos — no login needed) --------
echo ""
echo "  🔄 Syncing latest code from GitHub…"
(cd "$ADMIN" && git pull --rebase origin main 2>&1 | tail -1)
(cd "$FAB"   && git pull --rebase origin main 2>&1 | tail -1)

# 1) MongoDB (needed by both backends) ----------------------------------------
if port_up 27017; then
  echo "  ✅ MongoDB already running."
elif command -v mongod >/dev/null 2>&1; then
  mkdir -p "$HOME/.garm-mongo"
  mongod --dbpath "$HOME/.garm-mongo" --fork --logpath "$LOGS/mongo.log" >/dev/null 2>&1 \
    && echo "  ✅ MongoDB started." || echo "  ⚠️ MongoDB failed to start — see $LOGS/mongo.log"
elif command -v docker >/dev/null 2>&1 && docker info >/dev/null 2>&1; then
  docker start garm-mongo >/dev/null 2>&1 || docker run -d --name garm-mongo -p 27017:27017 -v garm-mongo-data:/data/db mongo:7 >/dev/null
  echo "  ✅ MongoDB started in Docker."
else
  echo "  ⚠️ No MongoDB found. Install Docker Desktop OR MongoDB, or set an"
  echo "     Atlas MONGODB_URI in 'Latest version of FAB/backend/.env'."
fi

# 2) Garm App backend — port 4000 ----------------------------------------------
if port_up 4000; then echo "  ✅ Garm App backend already on :4000"; else
  (cd "$FAB/backend" && [ -d node_modules ] || npm install)
  (cd "$FAB/backend" && nohup npm run dev > "$LOGS/fab-backend.log" 2>&1 &)
  echo "  🚀 Garm App backend starting on :4000  (log: $LOGS/fab-backend.log)"
fi

# 3) Admin backend — port 5050 ---------------------------------------------------
if port_up 5050; then echo "  ✅ Admin backend already on :5050"; else
  (cd "$ADMIN/server" && [ -d node_modules ] || npm install)
  (cd "$ADMIN/server" && nohup node index.js > "$LOGS/admin-backend.log" 2>&1 &)
  echo "  🚀 Admin backend starting on :5050     (log: $LOGS/admin-backend.log)"
fi

# 4) Garm App frontend — port 5173 ----------------------------------------------
if port_up 5173; then echo "  ✅ Garm App already on :5173"; else
  (cd "$FAB" && [ -d node_modules ] || npm install)
  (cd "$FAB" && nohup npm run dev > "$LOGS/fab-app.log" 2>&1 &)
  echo "  🚀 Garm App starting on :5173"
fi

# 5) Admin Portal frontend — port 5174 -------------------------------------------
if port_up 5174; then echo "  ✅ Admin Portal already on :5174"; else
  (cd "$ADMIN" && nohup npm run dev > "$LOGS/admin-app.log" 2>&1 &)
  echo "  🚀 Admin Portal starting on :5174"
fi

sleep 6
echo ""
echo "  ┌─────────────────────────────────────────────┐"
echo "  │  Garm App     → http://localhost:5173       │"
echo "  │  Admin Portal → http://localhost:5174/garm-admin-portal/"
echo "  │                                             │"
echo "  │  Login: the code shows ON SCREEN (dev mode) │"
echo "  └─────────────────────────────────────────────┘"
open "http://localhost:5173" 2>/dev/null
open "http://localhost:5174/garm-admin-portal/" 2>/dev/null
echo ""
read -p "  Press Enter to close this window… " _
