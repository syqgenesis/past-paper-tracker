#!/usr/bin/env bash
# WAL-safe daily snapshot of the Chem tracker SQLite database into iCloud.
#
# Uses `sqlite3 .backup` (atomic, handles WAL pages correctly) — NOT `cp`,
# which would produce an inconsistent backup on a live WAL-mode DB.
#
# Exit codes:
#   0   success
#   2   iCloud backup directory missing or not writable
#   3   source DB missing
#   4   sqlite3 binary not on PATH
#   5   backup command itself failed

set -euo pipefail

# ── Config (overridable via env) ─────────────────────────────────────────────
# Defaults are repo-relative; override via env for your own machine.
SCRIPT_DIR_BK="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SRC_DB="${CHEM_BACKUP_SRC:-${SCRIPT_DIR_BK}/../../data/tracker.db}"
DEST_DIR="${CHEM_BACKUP_DEST:-${HOME}/chem-backups}"
KEEP_DAYS="${CHEM_BACKUP_KEEP_DAYS:-30}"

# ── Pre-flight ───────────────────────────────────────────────────────────────
command -v sqlite3 >/dev/null 2>&1 || { echo "[backup-db] sqlite3 not on PATH" >&2; exit 4; }
[ -f "$SRC_DB" ] || { echo "[backup-db] source DB missing: $SRC_DB" >&2; exit 3; }

mkdir -p "$DEST_DIR" || { echo "[backup-db] cannot create dest dir: $DEST_DIR" >&2; exit 2; }
[ -w "$DEST_DIR" ]  || { echo "[backup-db] dest dir not writable: $DEST_DIR" >&2; exit 2; }

# ── Back up ──────────────────────────────────────────────────────────────────
STAMP=$(date +%Y-%m-%d)
DEST_FILE="$DEST_DIR/tracker-$STAMP.db"
TMP_FILE="$DEST_FILE.tmp"

# Use .backup (atomic, WAL-safe). Write to a .tmp file then mv — so partial
# writes never leave a corrupt-named backup in place.
sqlite3 "$SRC_DB" ".backup '$TMP_FILE'" || { echo "[backup-db] .backup failed" >&2; rm -f "$TMP_FILE"; exit 5; }
mv "$TMP_FILE" "$DEST_FILE"

# ── Retention ────────────────────────────────────────────────────────────────
# Delete backups older than KEEP_DAYS. Cheap; runs daily after each backup.
find "$DEST_DIR" -maxdepth 1 -name 'tracker-*.db' -type f -mtime "+${KEEP_DAYS}" -delete 2>/dev/null || true

# ── Report ───────────────────────────────────────────────────────────────────
SIZE=$(stat -f%z "$DEST_FILE" 2>/dev/null || stat -c%s "$DEST_FILE" 2>/dev/null || echo "?")
echo "[backup-db] OK: $DEST_FILE ($SIZE bytes)"
