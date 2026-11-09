#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

docker_cmd=docker
if ! command -v docker >/dev/null 2>&1; then
  if [[ -x "$HOME/.docker/bin/docker" ]]; then
    docker_cmd="$HOME/.docker/bin/docker"
  elif [[ -x /Applications/Docker.app/Contents/Resources/bin/docker ]]; then
    docker_cmd=/Applications/Docker.app/Contents/Resources/bin/docker
  else
    echo 'Docker CLI가 없습니다. Docker Desktop을 설치한 뒤 다시 실행하세요.' >&2
    exit 1
  fi
fi
compose_cmd=("$docker_cmd" compose)
if ! "${compose_cmd[@]}" version >/dev/null 2>&1; then
  if [[ -x /Applications/Docker.app/Contents/Resources/cli-plugins/docker-compose ]]; then
    compose_cmd=(/Applications/Docker.app/Contents/Resources/cli-plugins/docker-compose)
  else
    echo 'Docker Compose 플러그인을 찾을 수 없습니다.' >&2
    exit 1
  fi
fi
if ! "$docker_cmd" info >/dev/null 2>&1; then
  echo 'Docker Engine에 연결할 수 없습니다. Docker Desktop을 시작한 뒤 다시 실행하세요.' >&2
  exit 1
fi
if [[ ! -f .env ]]; then
  echo '.env 파일이 없습니다. .env.example을 참고해 DB_PASSWORD를 설정하세요.' >&2
  exit 1
fi
set -a
source .env
set +a

"${compose_cmd[@]}" config --quiet
"${compose_cmd[@]}" up -d --wait
"${compose_cmd[@]}" exec -T db sh -lc 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Atqc "SELECT name || '\'' '\'' || default_version FROM pg_available_extensions WHERE name = '\''postgis'\''"'
if command -v psql >/dev/null 2>&1; then
  if ! PGPASSWORD="$DB_PASSWORD" psql -h 127.0.0.1 -p "${DB_PORT:-5432}" -U "$DB_USER" -d "$DB_NAME" -Atqc 'select 1' >/dev/null; then
    echo '호스트 DB 접속에 실패했습니다. 기존 볼륨의 계정 또는 비밀번호가 .env와 다를 수 있습니다. ./scripts/diagnose-db.sh를 실행하세요.' >&2
    exit 1
  fi
fi
echo 'PostGIS 데이터베이스가 준비됐습니다. 이제 API를 실행하면 Flyway 마이그레이션이 적용됩니다.'
