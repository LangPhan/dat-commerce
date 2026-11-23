#!/usr/bin/env bash
set -euo pipefail

if [[ $# -lt 1 ]]; then
  echo "Usage: $0 <dump_file> [target_db] [--force-live]" >&2
  exit 1
fi

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

if [[ -f .env ]]; then
  set -a
  source .env
  set +a
fi

DUMP_FILE="$1"
TARGET_DB="${2:-dat_commerce_restore_verify}"
FORCE_LIVE="${3:-}"
if [[ "${TARGET_DB}" == "--force-live" ]]; then
  TARGET_DB="${POSTGRES_DB:-dat_commerce}"
  FORCE_LIVE="--force-live"
fi

POSTGRES_DB="${POSTGRES_DB:-dat_commerce}"
POSTGRES_USER="${POSTGRES_USER:-dat_commerce}"

if [[ ! -f "$DUMP_FILE" ]]; then
  echo "ERROR: dump file not found: $DUMP_FILE" >&2
  exit 1
fi

if [[ "$TARGET_DB" == "$POSTGRES_DB" && "$FORCE_LIVE" != "--force-live" ]]; then
  echo "ERROR: refusing to overwrite live database '$POSTGRES_DB' without --force-live" >&2
  exit 1
fi

if [[ ! "$TARGET_DB" =~ ^[a-zA-Z0-9_]+$ ]]; then
  echo "ERROR: invalid target database identifier: $TARGET_DB" >&2
  exit 1
fi

SHA_FILE="${DUMP_FILE}.sha256"
if [[ -f "$SHA_FILE" ]]; then
  echo "Verifying SHA-256 checksum ($SHA_FILE)..."
  EXPECTED_HASH="$(awk '{print $1}' "$SHA_FILE")"
  ACTUAL_HASH="$(sha256sum "$DUMP_FILE" | awk '{print $1}')"
  if [[ "$EXPECTED_HASH" != "$ACTUAL_HASH" ]]; then
    echo "ERROR: checksum mismatch for $DUMP_FILE" >&2
    exit 1
  fi
  echo "Checksum verified ($ACTUAL_HASH)"
fi

echo "Recreating target database '$TARGET_DB'..."
docker compose exec -T postgres psql -U "$POSTGRES_USER" -d postgres -v ON_ERROR_STOP=1 </dev/null <<SQL
SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '$TARGET_DB' AND pid <> pg_backend_pid();
DROP DATABASE IF EXISTS "$TARGET_DB";
CREATE DATABASE "$TARGET_DB";
SQL

echo "Restoring dump into '$TARGET_DB'..."
docker compose exec -T postgres pg_restore \
  -U "$POSTGRES_USER" \
  -d "$TARGET_DB" \
  --no-owner \
  --no-acl < "$DUMP_FILE"

echo "Row counts in '$TARGET_DB':"
docker compose exec -T postgres psql -U "$POSTGRES_USER" -d "$TARGET_DB" -At -F '|' </dev/null <<'SQL'
SELECT 'products', COUNT(*) FROM products
UNION ALL SELECT 'variants', COUNT(*) FROM variants
UNION ALL SELECT 'pages', COUNT(*) FROM pages
UNION ALL SELECT 'page_versions', COUNT(*) FROM page_versions
UNION ALL SELECT 'theme_configs', COUNT(*) FROM theme_configs
UNION ALL SELECT 'admin_users', COUNT(*) FROM admin_users;
SQL
