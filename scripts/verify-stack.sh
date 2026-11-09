#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

./scripts/docker-setup.sh
if [[ ! -f .env ]]; then
  echo '.env 파일이 없습니다.' >&2
  exit 1
fi
set -a
source .env
set +a

if ! java -version >/dev/null 2>&1; then
  jbr_home='/Applications/Android Studio.app/Contents/jbr/Contents/Home'
  if [[ ! -x "$jbr_home/bin/java" ]]; then
    echo 'Java 21을 찾을 수 없습니다. JAVA_HOME을 설정하세요.' >&2
    exit 1
  fi
  export JAVA_HOME="$jbr_home"
  export PATH="$JAVA_HOME/bin:$PATH"
fi

(cd api && ./gradlew bootJar)
jar_path='api/build/libs/cloth-map-api-0.1.0.jar'
log_path='api/build/verify-stack.log'
if [[ ! -f "$jar_path" ]]; then
  echo "API JAR를 찾을 수 없습니다: $jar_path" >&2
  exit 1
fi

java -jar "$jar_path" >"$log_path" 2>&1 &
api_pid=$!
trap 'kill "$api_pid" 2>/dev/null || true; wait "$api_pid" 2>/dev/null || true' EXIT

ready=false
for ((attempt=1; attempt<=90; attempt++)); do
  if curl --max-time 1 --fail --silent --output /dev/null 'http://127.0.0.1:8080/api/v1/boxes?swLat=37.55&swLng=126.96&neLat=37.59&neLng=127.00'; then
    ready=true
    break
  fi
  if ! kill -0 "$api_pid" 2>/dev/null; then break; fi
  sleep 1
done
if [[ "$ready" != true ]]; then
  echo "API 시작 또는 조회에 실패했습니다. 로그: $log_path" >&2
  tail -n 60 "$log_path" >&2
  exit 1
fi

status_code=$(curl --silent --output /dev/null --write-out '%{http_code}' 'http://127.0.0.1:8080/api/v1/admin/reports')
if [[ "$status_code" != 401 ]]; then
  echo "관리자 API 인증 검사 실패: HTTP $status_code" >&2
  exit 1
fi
curl --fail --silent --show-error --user "$ADMIN_USERNAME:$ADMIN_PASSWORD" 'http://127.0.0.1:8080/api/v1/admin/me' >/dev/null

migration=$(PGPASSWORD="$DB_PASSWORD" psql -h 127.0.0.1 -p "${DB_PORT:-5432}" -U "$DB_USER" -d "$DB_NAME" -Atqc 'select version from flyway_schema_history where success order by installed_rank desc limit 1')
postgis=$(PGPASSWORD="$DB_PASSWORD" psql -h 127.0.0.1 -p "${DB_PORT:-5432}" -U "$DB_USER" -d "$DB_NAME" -Atqc 'select PostGIS_Version()')
if [[ -z "$migration" || -z "$postgis" ]]; then
  echo 'Flyway 또는 PostGIS 검증에 실패했습니다.' >&2
  exit 1
fi
printf 'API 조회 200, 관리자 인증 401/200, Flyway 버전 %s, PostGIS %s 확인\n' "$migration" "$postgis"
