#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# auto-sync.sh — runs after every Claude Code update (wired as a Stop hook).
# On each run, if the working tree has changes (or unpushed commits) it will:
#   1. build the web app (gate)          2. commit + push to origin/main
#   3. deploy the web build (gh-pages)   4. sync the iOS/Xcode project (cap sync)
# Deploy + iOS sync only happen when the build passes, so production/main stay green.
# Runs detached from the hook, serialized by a lock, and logs to .claude/auto-sync.log.
# ─────────────────────────────────────────────────────────────────────────────
set -uo pipefail

REPO="/Users/yoavtoren/Apps/usmle-review-app"
cd "$REPO" || exit 0

# node/npm live here (no nvm on this machine)
export PATH="/usr/local/bin:/opt/homebrew/bin:$PATH"

mkdir -p "$REPO/.claude"
LOG="$REPO/.claude/auto-sync.log"
LOCK="$REPO/.claude/.auto-sync.lock"

exec >>"$LOG" 2>&1
echo ""
echo "──────── $(date '+%Y-%m-%d %H:%M:%S') · auto-sync start ────────"

# serialize: if a run is already in progress, bail (its result covers newer edits on the next stop)
if ! mkdir "$LOCK" 2>/dev/null; then
  echo "· another auto-sync is running — skipping"
  exit 0
fi
trap 'rmdir "$LOCK" 2>/dev/null' EXIT

# anything to do?
DIRTY="$(git status --porcelain 2>/dev/null)"
UNPUSHED="$(git log --oneline '@{u}..HEAD' 2>/dev/null || true)"
if [ -z "$DIRTY" ] && [ -z "$UNPUSHED" ]; then
  echo "· working tree clean and nothing unpushed — nothing to do"
  exit 0
fi

# 1 · build (gate) ───────────────────────────────────────────────────────────
BUILD_OK=1
echo "▶ building web…"
if npm run build >/dev/null 2>&1; then echo "  ✓ build passed"; else BUILD_OK=0; echo "  ✗ build FAILED"; fi
BUILD_STATUS="passing"; [ "$BUILD_OK" -eq 1 ] || BUILD_STATUS="FAILING"

# 2 · commit + push ──────────────────────────────────────────────────────────
if [ -n "$DIRTY" ]; then
  git add -A
  FILES="$(git diff --cached --name-only | sed 's#^#  #' | head -8)"
  git commit -q -F - <<EOF
Auto-sync: app update ($(date '+%Y-%m-%d %H:%M'))

Build: ${BUILD_STATUS}
Changed:
${FILES}

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
  echo "  ✓ committed"
fi

if git push origin HEAD >/dev/null 2>&1; then echo "  ✓ pushed to origin/main"; else echo "  ✗ push failed (check auth/network)"; fi

# 3 + 4 · deploy web + sync iOS (only when the build is green) ────────────────
if [ "$BUILD_OK" -eq 1 ]; then
  echo "▶ deploying web (gh-pages)…"
  if npm run deploy >/dev/null 2>&1; then echo "  ✓ web deployed"; else echo "  ✗ web deploy failed"; fi
  echo "▶ syncing iOS/Xcode project (cap sync)…"
  if npm run sync:ios >/dev/null 2>&1; then echo "  ✓ iOS synced"; else echo "  ✗ iOS sync failed"; fi
else
  echo "· build failing — committed/pushed for safekeeping but SKIPPED deploy + iOS sync"
fi

echo "──────── $(date '+%Y-%m-%d %H:%M:%S') · auto-sync done ────────"
