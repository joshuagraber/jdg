#!/usr/bin/env bash
set -euo pipefail

APP="jdg"
DB_PATH="/litefs/data/sqlite.db"
MACHINE_ID=""
OUTPUT=""
LOCAL_DB="prisma/data.db"
IMPORT_LOCAL=0
RUN_MIGRATE=1

SYNC_STAGING=0
STAGING_APP="jdg-staging"
STAGING_MACHINE_ID=""
RESTART_STAGING=1

usage() {
	cat <<'EOF'
Usage:
  scripts/pull-prod-db.sh [options]

Options:
  --app <name>              Source Fly app name (default: jdg)
  --machine <id>            Source Fly machine ID (default: auto-select by highest Post count)
  --db-path <path>          Source sqlite path (default: /litefs/data/sqlite.db)
  --output <path>           Output SQL dump path (default: /tmp/<app>-prod-YYYYmmddHHMMSS.sql)

  --import-local            Import dump into local sqlite DB after download
  --local-db <path>         Local sqlite DB path for import (default: prisma/data.db)
  --skip-migrate            Skip `npx prisma migrate deploy` after local import

  --sync-staging            Push imported prod data to staging app
  --staging-app <name>      Staging Fly app name (default: jdg-staging)
  --staging-machine <id>    Staging machine ID (default: auto-select by highest Post count)
  --no-restart-staging      Do not restart staging machine after restore

  --help                    Show this help message

Examples:
  scripts/pull-prod-db.sh
  scripts/pull-prod-db.sh --import-local
  scripts/pull-prod-db.sh --import-local --sync-staging
  scripts/pull-prod-db.sh --machine 2871560a612e08 --sync-staging --staging-machine e82d4d1fe1e538
EOF
}

require_cmd() {
	if ! command -v "$1" >/dev/null 2>&1; then
		echo "Missing required command: $1" >&2
		exit 1
	fi
}

log() {
	echo "[pull-prod-db] $*" >&2
}

parse_args() {
	while [[ $# -gt 0 ]]; do
		case "$1" in
		--app)
			APP="${2:-}"
			shift 2
			;;
		--machine)
			MACHINE_ID="${2:-}"
			shift 2
			;;
		--db-path)
			DB_PATH="${2:-}"
			shift 2
			;;
		--output)
			OUTPUT="${2:-}"
			shift 2
			;;
		--import-local)
			IMPORT_LOCAL=1
			shift
			;;
		--local-db)
			LOCAL_DB="${2:-}"
			shift 2
			;;
		--skip-migrate)
			RUN_MIGRATE=0
			shift
			;;
		--sync-staging)
			SYNC_STAGING=1
			shift
			;;
		--staging-app)
			STAGING_APP="${2:-}"
			shift 2
			;;
		--staging-machine)
			STAGING_MACHINE_ID="${2:-}"
			shift 2
			;;
		--no-restart-staging)
			RESTART_STAGING=0
			shift
			;;
		--help|-h)
			usage
			exit 0
			;;
		*)
			echo "Unknown option: $1" >&2
			usage
			exit 1
			;;
		esac
	done
}

list_machine_ids() {
	local app_name="$1"
	fly machine list -a "$app_name" | awk 'NR>1 {print $1}' | grep -E '^[a-z0-9]+$' || true
}

machine_post_count() {
	local app_name="$1"
	local machine_id="$2"
	local db_path="$3"
	local raw
	if ! raw=$(fly ssh console -a "$app_name" --machine "$machine_id" -C "sqlite3 '$db_path' \"select count(*) from Post;\"" 2>/dev/null); then
		echo "-1"
		return
	fi
	echo "$raw" | tr -d '\r' | awk '/^[0-9]+$/ {v=$1} END {if (v=="") print "-1"; else print v}'
}

auto_select_machine() {
	local app_name="$1"
	local db_path="$2"
	local ids
	ids=$(list_machine_ids "$app_name")
	if [[ -z "$ids" ]]; then
		echo ""
		return
	fi

	local best_id=""
	local best_count="-1"
	local id count
	while IFS= read -r id; do
		[[ -z "$id" ]] && continue
		count=$(machine_post_count "$app_name" "$id" "$db_path")
		log "Machine $id on $app_name has Post count: $count"
		if [[ "$count" =~ ^[0-9]+$ ]] && (( count > best_count )); then
			best_count="$count"
			best_id="$id"
		fi
	done <<< "$ids"

	echo "$best_id"
}

build_output_path() {
	if [[ -n "$OUTPUT" ]]; then
		echo "$OUTPUT"
	else
		echo "/tmp/${APP}-prod-$(date +%Y%m%d%H%M%S).sql"
	fi
}

dump_remote_db() {
	local app_name="$1"
	local machine_id="$2"
	local db_path="$3"
	local out_path="$4"

	log "Dumping $db_path from $app_name machine $machine_id into $out_path"
	fly ssh console -a "$app_name" --machine "$machine_id" -C "sqlite3 '$db_path' '.dump'" > "$out_path"

	if [[ ! -s "$out_path" ]]; then
		echo "Dump failed: output file is empty: $out_path" >&2
		exit 1
	fi

	if ! rg -q '^CREATE TABLE .*Post' "$out_path"; then
		log "Warning: dump does not contain obvious Post table DDL"
	fi
}

import_local_db() {
	local dump_path="$1"
	local local_db="$2"
	local backup_path

	mkdir -p "$(dirname "$local_db")"
	if [[ -f "$local_db" ]]; then
		backup_path="${local_db}.bak.$(date +%Y%m%d%H%M%S)"
		cp "$local_db" "$backup_path"
		log "Backed up existing local DB to $backup_path"
	fi

	rm -f "$local_db" "${local_db}-journal" "${local_db}-wal" "${local_db}-shm"
	sqlite3 "$local_db" < "$dump_path"
	log "Imported dump into $local_db"

	if (( RUN_MIGRATE == 1 )); then
		log "Running prisma migrate deploy"
		npx prisma migrate deploy >/dev/null
	fi

	local integrity
	integrity=$(sqlite3 "$local_db" "pragma integrity_check;")
	if [[ "$integrity" != "ok" ]]; then
		echo "Local DB integrity check failed: $integrity" >&2
		exit 1
	fi

	local counts
	counts=$(sqlite3 "$local_db" "select (select count(*) from User),(select count(*) from Post);")
	log "Local DB sanity counts (User|Post): $counts"
}

upload_file_to_machine() {
	local app_name="$1"
	local machine_id="$2"
	local local_path="$3"
	local remote_path="$4"
	fly ssh console -a "$app_name" --machine "$machine_id" -C "sh -lc 'cat > $remote_path'" < "$local_path"
}

sync_staging_from_dump() {
	local dump_path="$1"
	local staging_machine="$STAGING_MACHINE_ID"

	if [[ -z "$staging_machine" ]]; then
		log "Selecting staging machine automatically by highest Post count"
		staging_machine=$(auto_select_machine "$STAGING_APP" "$DB_PATH")
		if [[ -z "$staging_machine" ]]; then
			echo "Could not determine staging machine ID automatically. Pass --staging-machine <id>." >&2
			exit 1
		fi
	fi

	log "Using staging machine: $staging_machine"

	local ts
	ts=$(date +%Y%m%d%H%M%S)
	local local_stage_db
	local_stage_db="/tmp/${APP}-to-${STAGING_APP}-${ts}.sqlite"
	local remote_stage_db
	remote_stage_db="/tmp/import-${ts}.sqlite"
	local remote_backup
	remote_backup="/tmp/sqlite.db.pre-sync.${ts}.bak"

	log "Building temporary SQLite file from dump: $local_stage_db"
	rm -f "$local_stage_db"
	sqlite3 "$local_stage_db" < "$dump_path"

	local local_integrity
	local_integrity=$(sqlite3 "$local_stage_db" "pragma integrity_check;")
	if [[ "$local_integrity" != "ok" ]]; then
		echo "Temporary staging SQLite integrity check failed: $local_integrity" >&2
		exit 1
	fi

	log "Creating staging backup via sqlite .backup -> $remote_backup"
	fly ssh console -a "$STAGING_APP" --machine "$staging_machine" -C "sh -lc 'sqlite3 $DB_PATH \".backup $remote_backup\"'" >/dev/null

	log "Uploading SQLite file to staging: $remote_stage_db"
	upload_file_to_machine "$STAGING_APP" "$staging_machine" "$local_stage_db" "$remote_stage_db"

	log "Restoring uploaded SQLite into staging live DB using sqlite .restore"
	fly ssh console -a "$STAGING_APP" --machine "$staging_machine" -C "sh -lc 'sqlite3 $DB_PATH \".restore $remote_stage_db\"'" >/dev/null

	local staging_integrity
	staging_integrity=$(fly ssh console -a "$STAGING_APP" --machine "$staging_machine" -C "sqlite3 $DB_PATH \"pragma integrity_check;\"" | tr -d '\r')
	if [[ "$staging_integrity" != "ok" ]]; then
		echo "Staging DB integrity check failed after restore: $staging_integrity" >&2
		exit 1
	fi

	local staging_counts
	staging_counts=$(fly ssh console -a "$STAGING_APP" --machine "$staging_machine" -C "sqlite3 $DB_PATH \"select (select count(*) from User),(select count(*) from Post);\"" | tr -d '\r')
	log "Staging DB sanity counts (User|Post): $staging_counts"

	log "Removing uploaded temporary SQLite from staging"
	fly ssh console -a "$STAGING_APP" --machine "$staging_machine" -C "sh -lc 'rm -f $remote_stage_db'" >/dev/null || true
	rm -f "$local_stage_db"

	if (( RESTART_STAGING == 1 )); then
		log "Restarting staging machine $staging_machine"
		fly machine restart "$staging_machine" -a "$STAGING_APP" >/dev/null
		log "Staging machine restart completed"
	fi
}

main() {
	parse_args "$@"

	require_cmd fly
	require_cmd sqlite3
	require_cmd rg

	local selected_machine="$MACHINE_ID"
	if [[ -z "$selected_machine" ]]; then
		log "Selecting source machine automatically by highest Post count"
		selected_machine=$(auto_select_machine "$APP" "$DB_PATH")
		if [[ -z "$selected_machine" ]]; then
			echo "Could not determine source machine ID automatically. Pass --machine <id>." >&2
			exit 1
		fi
	fi
	log "Using source machine: $selected_machine"

	local out_path
	out_path=$(build_output_path)
	dump_remote_db "$APP" "$selected_machine" "$DB_PATH" "$out_path"
	log "Saved dump: $out_path"

	if (( IMPORT_LOCAL == 1 )); then
		import_local_db "$out_path" "$LOCAL_DB"
	else
		log "Skipping local import (pass --import-local to enable)"
	fi

	if (( SYNC_STAGING == 1 )); then
		sync_staging_from_dump "$out_path"
	else
		log "Skipping staging sync (pass --sync-staging to enable)"
	fi
}

main "$@"
