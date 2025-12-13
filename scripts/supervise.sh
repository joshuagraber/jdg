#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

DEFAULT_CACHE_PATH="/dev/shm/cache.sqlite"
export CACHE_DATABASE_PATH="${CACHE_DATABASE_PATH:-$DEFAULT_CACHE_PATH}"
export CACHE_DB_PATH="${CACHE_DB_PATH:-$CACHE_DATABASE_PATH}"

WORKER_ENTRY="$ROOT_DIR/server-build/worker.js"
SERVER_ENTRY="$ROOT_DIR/server-build/index.js"

if [[ ! -f "$WORKER_ENTRY" || ! -f "$SERVER_ENTRY" ]]; then
	echo "⚠️  Compiled server files not found. Falling back to TypeScript sources." >&2
	WORKER_ENTRY="$ROOT_DIR/server/worker.ts"
	SERVER_ENTRY="$ROOT_DIR/server/index.ts"
	WORKER_CMD=(npx --no-install tsx "$WORKER_ENTRY")
	SERVER_CMD=(npx --no-install tsx "$SERVER_ENTRY")
else
	WORKER_CMD=(node "$WORKER_ENTRY")
	SERVER_CMD=(node "$SERVER_ENTRY")
fi

cleanup() {
	trap - EXIT SIGINT SIGTERM
	if [[ -n "${SERVER_PID:-}" ]]; then
		kill "$SERVER_PID" 2>/dev/null || true
		wait "$SERVER_PID" 2>/dev/null || true
	fi
	if [[ -n "${WORKER_PID:-}" ]]; then
		kill "$WORKER_PID" 2>/dev/null || true
		wait "$WORKER_PID" 2>/dev/null || true
	fi
}

trap cleanup EXIT SIGINT SIGTERM

"${WORKER_CMD[@]}" &
WORKER_PID=$!

"${SERVER_CMD[@]}" &
SERVER_PID=$!

EXIT_CODE=0
if ! wait "$SERVER_PID"; then
	EXIT_CODE=$?
fi

cleanup
exit "$EXIT_CODE"
