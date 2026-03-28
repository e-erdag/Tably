#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$ROOT_DIR/Back-End"
FRONTEND_DIR="$ROOT_DIR/Front-End"

cleanup() {
  jobs -p | xargs -r kill 2>/dev/null || true
}

trap cleanup EXIT INT TERM

if ! command -v poetry >/dev/null 2>&1; then
  echo "poetry is required to run the backend."
  exit 1
fi

if ! command -v npm >/dev/null 2>&1; then
  echo "npm is required to run the frontend."
  exit 1
fi

(
  cd "$APP_DIR"
  poetry run uvicorn app.main:app --app-dir "$APP_DIR" --host 0.0.0.0 --port 8000 --reload
) &
BACKEND_PID=$!
(
  cd "$FRONTEND_DIR"
  npm run dev -- --host 0.0.0.0
) &
FRONTEND_PID=$!

wait "$BACKEND_PID" "$FRONTEND_PID"
