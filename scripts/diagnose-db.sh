#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

if [[ ! -f .env ]]; then echo '.env 파일이 없습니다.' >&2; exit 1; fi
docker_cmd=docker
if ! command -v docker >/dev/null 2>&1; then
  if [[ -x "$HOME/.docker/bin/docker" ]]; then docker_cmd="$HOME/.docker/bin/docker"
  elif [[ -x /Applications/Docker.app/Contents/Resources/bin/docker ]]; then docker_cmd=/Applications/Docker.app/Contents/Resources/bin/docker
  else echo 'Docker CLI를 찾을 수 없습니다.' >&2; exit 1; fi
fi
compose_cmd=("$docker_cmd" compose)
if ! "${compose_cmd[@]}" version >/dev/null 2>&1; then
  compose_cmd=(/Applications/Docker.app/Contents/Resources/cli-plugins/docker-compose)
fi

"${compose_cmd[@]}" config --format json | python3 -c 'import json,sys; e=json.load(sys.stdin)["services"]["db"]["environment"]; print("Compose resolved user/db:",e.get("POSTGRES_USER"),e.get("POSTGRES_DB"))'
"${compose_cmd[@]}" exec -T db sh -lc 'printf "Container user/db: %s %s\n" "$POSTGRES_USER" "$POSTGRES_DB"; psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Atqc "select rolname from pg_roles where rolcanlogin order by rolname"' | sed '1s/^/ /; 2,$s/^/  role: /'

set -a
source .env
set +a
printf '.env user/db/port: %s %s %s\n' "$DB_USER" "$DB_NAME" "${DB_PORT:-5432}"
printf 'Published port: '
"${compose_cmd[@]}" port db 5432
printf 'Host connection: '
if PGPASSWORD="$DB_PASSWORD" psql -h 127.0.0.1 -p "${DB_PORT:-5432}" -U "$DB_USER" -d "$DB_NAME" -Atqc 'select current_user,current_database()'; then
  echo 'Host connection OK'
else
  echo 'Host connection failed' >&2
fi
