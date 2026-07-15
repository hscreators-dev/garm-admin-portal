#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
# Garm — push local changes to GitHub → auto-deploys to Render (live)
# Double-click me. Pushes BOTH repos (admin portal + Garm app).
# Your Mac is signed in to GitHub, so this just works.
# ─────────────────────────────────────────────────────────────────────────────
cd "$(dirname "$0")"
ADMIN="$(pwd)"
FAB="$(cd ../"Latest version of FAB" && pwd)"

sync_repo() { # $1 = dir, $2 = label
  echo ""
  echo "  Syncing $2 with GitHub…"
  if ! git -C "$1" pull --rebase origin main; then
    echo "  ⚠️ $2: rebase hit a conflict. Aborting safely (nothing lost)."
    git -C "$1" rebase --abort 2>/dev/null
    echo "     Ask Claude to resolve it — do NOT force-push."
    return 1
  fi
  git -C "$1" push origin main && echo "  ✅ $2 pushed." || echo "  ⚠️ $2 push failed — see message above."
}

sync_repo "$ADMIN" "Garm Admin Portal"
sync_repo "$FAB" "Garm App"

echo ""
echo "  ┌───────────────────────────────────────────────┐"
echo "  │  Render now auto-deploys both (~3 min).        │"
echo "  │  Watch: https://dashboard.render.com          │"
echo "  └───────────────────────────────────────────────┘"
echo ""
read -p "  Press Enter to close… " _
