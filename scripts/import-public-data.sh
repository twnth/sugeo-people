#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
if [[ ! -f .env ]]; then
  echo '.env 파일이 없습니다. 먼저 DB 연결 정보를 설정하세요.' >&2
  exit 1
fi
set -a
source .env
set +a
exec python3 collector/import_csv.py "$@"
