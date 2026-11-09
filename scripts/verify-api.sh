#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

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

cd api
./gradlew test
CLOTH_MAP_INTEGRATION_TEST=1 ./gradlew test --tests com.clothmap.PostgisFlowIntegrationTest --rerun-tasks
