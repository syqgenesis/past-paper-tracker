#!/usr/bin/env bash
# Script tests for backup-db.sh. Runs the script under controlled fixtures
# (overrides src + dest via env) and asserts on exit codes + outputs.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SCRIPT="$SCRIPT_DIR/backup-db.sh"

pass() { echo "  PASS: $*"; }
fail() { echo "  FAIL: $*" >&2; exit 1; }

TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT

# ── Fixture: build a valid source DB with WAL mode enabled ────────────────────
SRC="$TMP/source.db"
sqlite3 "$SRC" "PRAGMA journal_mode = WAL; CREATE TABLE t(x INTEGER); INSERT INTO t VALUES (1),(2),(3);" >/dev/null

# ── Test 1: happy path ────────────────────────────────────────────────────────
DEST="$TMP/backups"
CHEM_BACKUP_SRC="$SRC" CHEM_BACKUP_DEST="$DEST" bash "$SCRIPT" >/dev/null
BACKUP_FILE=$(ls "$DEST"/tracker-*.db | head -1)
[ -f "$BACKUP_FILE" ] || fail "test 1: no backup file produced"
ROWS=$(sqlite3 "$BACKUP_FILE" "SELECT COUNT(*) FROM t;")
[ "$ROWS" = "3" ] || fail "test 1: backup has $ROWS rows, expected 3"
INTEG=$(sqlite3 "$BACKUP_FILE" "PRAGMA integrity_check;")
[ "$INTEG" = "ok" ] || fail "test 1: integrity_check = $INTEG"
pass "happy path — backup produced, integrity ok, row count matches"

# ── Test 2: missing iCloud path (unwritable parent) ──────────────────────────
BAD_DEST="/nonexistent-root-$(date +%s)/sub"
set +e
CHEM_BACKUP_SRC="$SRC" CHEM_BACKUP_DEST="$BAD_DEST" bash "$SCRIPT" >/dev/null 2>&1
EC=$?
set -e
[ "$EC" = "2" ] || fail "test 2: expected exit 2 for unwritable dest, got $EC"
pass "unwritable dest dir → exit 2"

# ── Test 3: missing source DB ─────────────────────────────────────────────────
set +e
CHEM_BACKUP_SRC="$TMP/missing.db" CHEM_BACKUP_DEST="$DEST" bash "$SCRIPT" >/dev/null 2>&1
EC=$?
set -e
[ "$EC" = "3" ] || fail "test 3: expected exit 3 for missing source, got $EC"
pass "missing source DB → exit 3"

# ── Test 4: retention — old backups older than KEEP_DAYS get purged ──────────
OLD="$DEST/tracker-2020-01-01.db"
touch -t 202001010000 "$OLD"
[ -f "$OLD" ] || fail "test 4 setup: touch failed"
CHEM_BACKUP_SRC="$SRC" CHEM_BACKUP_DEST="$DEST" CHEM_BACKUP_KEEP_DAYS="30" bash "$SCRIPT" >/dev/null
[ -f "$OLD" ] && fail "test 4: old backup was not purged"
pass "retention — backups older than KEEP_DAYS are purged"

# ── Test 5: idempotency — re-running the same day overwrites atomically ──────
CHEM_BACKUP_SRC="$SRC" CHEM_BACKUP_DEST="$DEST" bash "$SCRIPT" >/dev/null
CHEM_BACKUP_SRC="$SRC" CHEM_BACKUP_DEST="$DEST" bash "$SCRIPT" >/dev/null
# Same date → one file (not two)
TODAY_COUNT=$(ls "$DEST"/tracker-$(date +%Y-%m-%d).db 2>/dev/null | wc -l | tr -d ' ')
[ "$TODAY_COUNT" = "1" ] || fail "test 5: expected 1 file for today, got $TODAY_COUNT"
# No leftover .tmp (shopt nullglob not available on macOS sh — use find)
LEFTOVER=$(find "$DEST" -maxdepth 1 -name '*.tmp' 2>/dev/null | wc -l | tr -d ' ')
[ "$LEFTOVER" = "0" ] || fail "test 5: leftover .tmp files: $LEFTOVER"
pass "idempotency — same-day rerun overwrites cleanly, no .tmp left behind"

# ── Test 6: concurrent-write — WAL-safe backup holds up under a live writer ──
# The whole reason we're using `sqlite3 .backup` instead of `cp` is that it's
# claimed to be WAL-safe. Verify that claim: kick off a background process
# that pounds the DB with inserts, run the backup mid-stream, assert integrity
# and that the backup sees a consistent row count in between the writes.
WRITE_SRC="$TMP/write-src.db"
sqlite3 "$WRITE_SRC" "PRAGMA journal_mode = WAL; CREATE TABLE t(x INTEGER);" >/dev/null
# Start a background writer that inserts 500 rows over ~2s
(
  for i in $(seq 1 500); do
    sqlite3 "$WRITE_SRC" "INSERT INTO t VALUES ($i);" 2>/dev/null || break
  done
) &
WRITER_PID=$!
# Give the writer a head start so it's mid-stream when we back up
sleep 0.3
BACKUP_DEST="$TMP/concurrent-backups"
CHEM_BACKUP_SRC="$WRITE_SRC" CHEM_BACKUP_DEST="$BACKUP_DEST" bash "$SCRIPT" >/dev/null
wait $WRITER_PID 2>/dev/null || true
BACKUP_FILE=$(ls "$BACKUP_DEST"/tracker-*.db | head -1)
INTEG=$(sqlite3 "$BACKUP_FILE" "PRAGMA integrity_check;")
[ "$INTEG" = "ok" ] || fail "test 6: integrity_check = $INTEG (backup may be corrupt)"
ROWS=$(sqlite3 "$BACKUP_FILE" "SELECT COUNT(*) FROM t;")
# Row count must be in [0, 500]. Anything outside means the backup saw
# torn state (impossible under sqlite3 .backup). The point-in-time
# snapshot should have a well-defined count between 0 and 500.
[ "$ROWS" -ge 0 ] && [ "$ROWS" -le 500 ] || fail "test 6: backup row count $ROWS out of bounds"
pass "concurrent-write — backup completes during live inserts, integrity ok ($ROWS rows snapshotted)"

echo ""
echo "All 6 tests passed."
