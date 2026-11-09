#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

for district in yongsan gangseo yangcheon; do
  if [[ ! -f "collector/input/${district}.csv" ]]; then
    echo "collector/input/${district}.csv 파일이 없습니다." >&2
    exit 1
  fi
done

./scripts/import-public-data.sh yongsan collector/input/yongsan.csv --as-of 2026-09-18 "$@"
./scripts/import-public-data.sh gangseo collector/input/gangseo.csv --as-of 2024-04-18 "$@"
./scripts/import-public-data.sh yangcheon collector/input/yangcheon.csv --as-of 2026-09-04 "$@"
