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

This syncs CONTENT ONLY (Post, PostImage, PostVideo, HomeLink)
from source app DB into local/staging DBs. It does NOT overwrite User/Session/Auth tables.

Options:
  --app <name>              Source Fly app name (default: jdg)
  --machine <id>            Source Fly machine ID (default: auto-select by highest Post count)
  --db-path <path>          Source sqlite path (default: /litefs/data/sqlite.db)
  --output <path>           Output SQL dump path (default: /tmp/<app>-prod-YYYYmmddHHMMSS.sql)

  --import-local            Sync content tables into local sqlite DB
  --local-db <path>         Local sqlite DB path for content sync (default: prisma/data.db)
  --skip-migrate            Skip `npx prisma migrate deploy` before local content sync

  --sync-staging            Sync content tables into staging app DB
  --staging-app <name>      Staging Fly app name (default: jdg-staging)
  --staging-machine <id>    Staging machine ID (default: auto-select by highest Post count)
  --no-restart-staging      Do not restart staging machine after content sync

  --help                    Show this help message

Examples:
  scripts/pull-prod-db.sh
  scripts/pull-prod-db.sh --import-local
  scripts/pull-prod-db.sh --import-local --sync-staging
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
}

build_source_sqlite_from_dump() {
	local dump_path="$1"
	local out_db="$2"
	rm -f "$out_db"
	sqlite3 "$out_db" < "$dump_path"

	local integrity
	integrity=$(sqlite3 "$out_db" "pragma integrity_check;")
	if [[ "$integrity" != "ok" ]]; then
		echo "Source SQLite integrity check failed: $integrity" >&2
		exit 1
	fi
}

table_exists() {
	local db="$1"
	local table="$2"
	sqlite3 "$db" "SELECT 1 FROM sqlite_master WHERE type='table' AND name='$table';" | grep -q '^1$'
}

resolve_target_author_id_local() {
	local target_db="$1"
	local author_id
	author_id=$(sqlite3 "$target_db" "SELECT u.id FROM \"User\" u JOIN \"_RoleToUser\" ru ON ru.\"B\"=u.id JOIN \"Role\" r ON r.id=ru.\"A\" WHERE r.name='admin' LIMIT 1;")
	if [[ -z "$author_id" ]]; then
		author_id=$(sqlite3 "$target_db" "SELECT id FROM \"User\" ORDER BY \"createdAt\" ASC LIMIT 1;")
	fi
	if [[ -z "$author_id" ]]; then
		echo ""
		return
	fi
	echo "$author_id"
}

sync_content_into_local() {
	local source_db="$1"
	local target_db="$2"

	if (( RUN_MIGRATE == 1 )); then
		log "Running prisma migrate deploy before local content sync"
		npx prisma migrate deploy >/dev/null
	fi

	local author_id
	author_id=$(resolve_target_author_id_local "$target_db")
	if [[ -z "$author_id" ]]; then
		echo "No local user found to own synced posts. Create a local user/admin first." >&2
		exit 1
	fi

	local include_home_link_sql=""
	if table_exists "$source_db" "HomeLink" && table_exists "$target_db" "HomeLink"; then
		include_home_link_sql=$(cat <<'SQL'
DELETE FROM "HomeLink";
INSERT INTO "HomeLink" ("id","section","url","position","createdAt","updatedAt")
  SELECT "id","section","url","position","createdAt","updatedAt" FROM src."HomeLink";
SQL
)
	fi

	sqlite3 "$target_db" <<SQL
ATTACH DATABASE '$source_db' AS src;
PRAGMA foreign_keys=OFF;
BEGIN;
DELETE FROM "Post";
DELETE FROM "PostVideo";
DELETE FROM "PostImage";
${include_home_link_sql}
INSERT INTO "PostImage" ("id","altText","title","contentType","s3Key","width","height","createdAt","updatedAt")
  SELECT "id","altText","title","contentType","s3Key","width","height","createdAt","updatedAt" FROM src."PostImage";
INSERT INTO "PostVideo" ("id","altText","title","contentType","s3Key","createdAt","updatedAt")
  SELECT "id","altText","title","contentType","s3Key","createdAt","updatedAt" FROM src."PostVideo";
INSERT INTO "Post" ("id","title","slug","content","description","previewTitle","previewDescription","previewImageId","createdAt","publishAt","updatedAt","authorId")
  SELECT "id","title","slug","content","description","previewTitle","previewDescription","previewImageId","createdAt","publishAt","updatedAt",'$author_id' FROM src."Post";
COMMIT;
PRAGMA foreign_keys=ON;
DETACH DATABASE src;
SQL

	local integrity
	integrity=$(sqlite3 "$target_db" "pragma integrity_check;")
	if [[ "$integrity" != "ok" ]]; then
		echo "Local DB integrity check failed after content sync: $integrity" >&2
		exit 1
	fi

	local counts
	counts=$(sqlite3 "$target_db" "select (select count(*) from \"User\"),(select count(*) from \"Post\"),(select count(*) from \"HomeLink\");")
	log "Local DB counts (User|Post|HomeLink): $counts"
}

upload_file_to_machine() {
	local app_name="$1"
	local machine_id="$2"
	local local_path="$3"
	local remote_path="$4"
	fly ssh console -a "$app_name" --machine "$machine_id" -C "sh -lc 'cat > $remote_path'" < "$local_path"
}

resolve_target_author_id_remote() {
	local app_name="$1"
	local machine_id="$2"
	local db_path="$3"
	local author_id
	author_id=$(fly ssh console -a "$app_name" --machine "$machine_id" -C "sqlite3 '$db_path' \"SELECT u.id FROM \\\"User\\\" u JOIN \\\"_RoleToUser\\\" ru ON ru.\\\"B\\\"=u.id JOIN \\\"Role\\\" r ON r.id=ru.\\\"A\\\" WHERE r.name='admin' LIMIT 1;\"" | tr -d '\r')
	if [[ -z "$author_id" ]]; then
		author_id=$(fly ssh console -a "$app_name" --machine "$machine_id" -C "sqlite3 '$db_path' \"SELECT id FROM \\\"User\\\" ORDER BY \\\"createdAt\\\" ASC LIMIT 1;\"" | tr -d '\r')
	fi
	echo "$author_id"
}

sync_content_into_staging() {
	local source_db="$1"
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

	local author_id
	author_id=$(resolve_target_author_id_remote "$STAGING_APP" "$staging_machine" "$DB_PATH")
	if [[ -z "$author_id" ]]; then
		echo "No staging user found to own synced posts." >&2
		exit 1
	fi

	local ts
	ts=$(date +%Y%m%d%H%M%S)
	local remote_source_db="/tmp/source-content-${ts}.sqlite"
	local remote_sql="/tmp/content-sync-${ts}.sql"
	local remote_backup="/tmp/sqlite.db.pre-content-sync.${ts}.bak"
	local local_sql="/tmp/content-sync-${ts}.sql"

	local include_home_link_sql=""
	if table_exists "$source_db" "HomeLink"; then
		include_home_link_sql=$(cat <<'SQL'
CREATE TABLE IF NOT EXISTS "HomeLink" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "section" TEXT NOT NULL,
  "url" TEXT NOT NULL,
  "position" INTEGER NOT NULL DEFAULT 0,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "HomeLink_section_url_key" ON "HomeLink"("section", "url");
CREATE INDEX IF NOT EXISTS "HomeLink_section_position_createdAt_idx" ON "HomeLink"("section", "position", "createdAt");
DELETE FROM "HomeLink";
INSERT INTO "HomeLink" ("id","section","url","position","createdAt","updatedAt")
  SELECT "id","section","url","position","createdAt","updatedAt" FROM src."HomeLink";
SQL
)
	fi

	cat > "$local_sql" <<SQL
ATTACH DATABASE '$remote_source_db' AS src;
PRAGMA foreign_keys=OFF;
BEGIN;
DELETE FROM "Post";
DELETE FROM "PostVideo";
DELETE FROM "PostImage";
${include_home_link_sql}
INSERT INTO "PostImage" ("id","altText","title","contentType","s3Key","width","height","createdAt","updatedAt")
  SELECT "id","altText","title","contentType","s3Key","width","height","createdAt","updatedAt" FROM src."PostImage";
INSERT INTO "PostVideo" ("id","altText","title","contentType","s3Key","createdAt","updatedAt")
  SELECT "id","altText","title","contentType","s3Key","createdAt","updatedAt" FROM src."PostVideo";
INSERT INTO "Post" ("id","title","slug","content","description","previewTitle","previewDescription","previewImageId","createdAt","publishAt","updatedAt","authorId")
  SELECT "id","title","slug","content","description","previewTitle","previewDescription","previewImageId","createdAt","publishAt","updatedAt",'$author_id' FROM src."Post";
COMMIT;
PRAGMA foreign_keys=ON;
DETACH DATABASE src;
SQL

	log "Creating staging backup at $remote_backup"
	fly ssh console -a "$STAGING_APP" --machine "$staging_machine" -C "sh -lc 'sqlite3 $DB_PATH \".backup $remote_backup\"'" >/dev/null

	log "Uploading source content DB to staging"
	upload_file_to_machine "$STAGING_APP" "$staging_machine" "$source_db" "$remote_source_db"
	log "Uploading sync SQL to staging"
	upload_file_to_machine "$STAGING_APP" "$staging_machine" "$local_sql" "$remote_sql"

	log "Applying content-only sync SQL on staging"
	fly ssh console -a "$STAGING_APP" --machine "$staging_machine" -C "sh -lc 'sqlite3 $DB_PATH < $remote_sql'" >/dev/null

	local integrity
	integrity=$(fly ssh console -a "$STAGING_APP" --machine "$staging_machine" -C "sqlite3 $DB_PATH \"pragma integrity_check;\"" | tr -d '\r')
	if [[ "$integrity" != "ok" ]]; then
		echo "Staging DB integrity check failed after content sync: $integrity" >&2
		exit 1
	fi

	local counts
	counts=$(fly ssh console -a "$STAGING_APP" --machine "$staging_machine" -C "sqlite3 $DB_PATH \"select (select count(*) from \\\"User\\\"),(select count(*) from \\\"Post\\\"),(select count(*) from \\\"HomeLink\\\");\"" | tr -d '\r')
	log "Staging DB counts (User|Post|HomeLink): $counts"

	fly ssh console -a "$STAGING_APP" --machine "$staging_machine" -C "sh -lc 'rm -f $remote_source_db $remote_sql'" >/dev/null || true
	rm -f "$local_sql"

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

	local source_sqlite="/tmp/${APP}-source-$(date +%Y%m%d%H%M%S).sqlite"
	build_source_sqlite_from_dump "$out_path" "$source_sqlite"
	log "Built source SQLite: $source_sqlite"

	if (( IMPORT_LOCAL == 1 )); then
		sync_content_into_local "$source_sqlite" "$LOCAL_DB"
	else
		log "Skipping local content sync (pass --import-local to enable)"
	fi

	if (( SYNC_STAGING == 1 )); then
		sync_content_into_staging "$source_sqlite"
	else
		log "Skipping staging content sync (pass --sync-staging to enable)"
	fi

	rm -f "$source_sqlite"
}

main "$@"
