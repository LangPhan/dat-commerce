#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

if [[ -f .env ]]; then
  set -a
  source .env
  set +a
fi

POSTGRES_DB="${POSTGRES_DB:-dat_commerce}"
POSTGRES_USER="${POSTGRES_USER:-dat_commerce}"
BACKUP_DIR="${BACKUP_DIR:-backups}"
RETENTION_DAYS="${RETENTION_DAYS:-7}"

mkdir -p "$BACKUP_DIR"
STAMP="$(date -u +%Y%m%d-%H%M%S)"
OUT_FILE="$BACKUP_DIR/${POSTGRES_DB}_${STAMP}.dump"

echo "Creating PostgreSQL custom-format backup -> $OUT_FILE"
docker compose exec -T postgres pg_dump \
  -U "$POSTGRES_USER" \
  -d "$POSTGRES_DB" \
  -Fc </dev/null > "$OUT_FILE"

if [[ ! -s "$OUT_FILE" ]]; then
  echo "ERROR: backup file is empty: $OUT_FILE" >&2
  rm -f "$OUT_FILE"
  exit 1
fi

SHA_FILE="${OUT_FILE}.sha256"
sha256sum "$OUT_FILE" > "$SHA_FILE"

if [[ "$RETENTION_DAYS" =~ ^[0-9]+$ ]] && [[ "$RETENTION_DAYS" -gt 0 ]]; then
  find "$BACKUP_DIR" -maxdepth 1 -type f \( -name "*.dump" -o -name "*.sha256" \) -mtime +"$RETENTION_DAYS" -delete || true
fi

SIZE_BYTES="$(wc -c < "$OUT_FILE" | tr -d ' ')"
echo "Backup complete: $OUT_FILE (${SIZE_BYTES} bytes)"
echo "Checksum written: $SHA_FILE ($(awk '{print $1}' "$SHA_FILE"))"
