#!/usr/bin/env bash
#
# One-click launcher for Speak Plainly.
# Starts the backend and the frontend dev server together, installing
# dependencies and creating backend/.env on first run.
#
# Usage:
#   ./run.sh
# On Windows, run it from Git Bash (or WSL).
#
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND="$ROOT/backend"
FRONTEND="$ROOT/frontend"

# --- preflight ---------------------------------------------------------------
command -v node >/dev/null 2>&1 || { echo "✗ Node.js not found. Install Node 18+ and retry."; exit 1; }
command -v npm  >/dev/null 2>&1 || { echo "✗ npm not found. Install Node 18+ and retry."; exit 1; }

# Create backend/.env from the example on first run.
if [ ! -f "$BACKEND/.env" ]; then
  echo "• backend/.env not found — creating it from .env.example"
  cp "$BACKEND/.env.example" "$BACKEND/.env"
  echo "  ⚠  Edit backend/.env and set your model API key."
  echo "     (Article generation needs a key; the AI-smell score works fully offline.)"
fi

# Install dependencies if missing.
if [ ! -d "$BACKEND/node_modules" ]; then
  echo "• Installing backend dependencies..."
  (cd "$BACKEND" && npm install)
fi
if [ ! -d "$FRONTEND/node_modules" ]; then
  echo "• Installing frontend dependencies..."
  (cd "$FRONTEND" && npm install)
fi

# --- run both, and stop both on Ctrl+C / exit --------------------------------
pids=()
cleanup() {
  echo
  echo "Stopping Speak Plainly..."
  for pid in "${pids[@]}"; do
    kill "$pid" 2>/dev/null || true
  done
}
trap cleanup EXIT INT TERM

echo "▶ Starting backend  → http://localhost:8787"
(cd "$BACKEND" && npm start) &
pids+=("$!")

echo "▶ Starting frontend (dev server URL is printed below)"
(cd "$FRONTEND" && npm run dev) &
pids+=("$!")

echo
echo "Speak Plainly is starting. Open the frontend URL shown above in your browser."
echo "Press Ctrl+C to stop both servers."

# Exit (and trigger cleanup) as soon as either server stops.
wait -n
