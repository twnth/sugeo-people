# 옷함지도 MVP

서울 의류수거함을 지도에서 찾고 현장 사진으로 존재·철거·위치 오류를 제보하는 Next.js + Spring Boot + PostGIS 프로젝트입니다. 용산구·강서구·양천구 공공데이터 원본 CSV가 로컬 `collector/input/`에 있으며, DB에는 별도 가져오기 명령으로 등록합니다.

## 구성

- `web/`: Next.js 15 모바일 우선 웹
- `api/`: Spring Boot 3.5 API 및 Flyway 마이그레이션
- `collector/`: 향후 공공데이터 수집기 설계
- `mobile/`: Android·iOS Flutter WebView 앱
- `docs/`: 설계 메모

## 사전 준비

Docker Compose, Java 21, Node.js 20 이상, npm이 필요합니다. PostGIS Docker 이미지의 17-3.6 태그는 amd64 이미지이므로 ARM 호스트에서는 Compose가 에뮬레이션으로 실행합니다. 카카오맵 JavaScript 키가 없으면 웹은 설정 안내를 표시합니다.

Apple silicon Mac에 Docker Desktop이 없다면 [공식 설치 안내](https://docs.docker.com/desktop/setup/install/mac-install/)의 Apple silicon 설치 파일을 내려받아 `/Applications`에 설치하고 한 번 실행합니다.

1. `.env`가 없다면 루트에서 `cp .env.example .env` 후 `DB_PASSWORD`, `ADMIN_USERNAME`, `ADMIN_PASSWORD`, `ANON_SIGNING_SECRET`을 설정합니다. 익명 서명 키는 32자 이상의 무작위 문자열로 설정합니다. 사진 저장 위치는 `PHOTO_STORAGE_DIR`로 정하며 기본값은 API 작업 디렉터리 기준 `./data/photos`입니다. 비밀번호와 서명 키를 Git에 올리지 마세요.
2. `./scripts/docker-setup.sh` 또는 `docker compose up -d --wait`로 PostgreSQL 17 / PostGIS 3.6을 시작합니다. 스크립트는 Compose 설정과 PostGIS 확장 가용 여부도 확인합니다. DB 포트는 기본 5432입니다. 호스트의 5432에 다른 PostgreSQL이 있다면 `.env`의 `DB_PORT`와 `DB_URL` 포트를 함께 바꿉니다. 현재 이 Mac의 로컬 `.env`는 55432로 설정했습니다.
3. API 환경변수를 로드하고 `cd api && ./gradlew bootRun`을 실행합니다. 예: 루트에서 `set -a; source .env; set +a; cd api; ./gradlew bootRun`. 현재 macOS에서 `java -version`이 Java를 찾지 못한다면 먼저 `export JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home"`을 실행할 수 있습니다. 시작 시 Flyway가 스키마를 생성합니다.
4. `web/.env.local`에 `NEXT_PUBLIC_KAKAO_MAP_JAVASCRIPT_KEY=...`, 빈 `NEXT_PUBLIC_API_BASE_URL=`, `API_PROXY_TARGET=http://127.0.0.1:8080`을 설정합니다. `cd web && npm install && npm run dev`를 실행합니다. 웹 포트는 3000, API는 8080입니다. Next.js가 `/api/v1` 요청을 API로 전달해 모바일 앱에서도 같은 출처로 연결됩니다.

개발 중에는 첫 터미널에서 루트의 `./scripts/dev-api.sh`를 실행하고, 두 번째 터미널에서 `cd web && npm run dev`를 실행하면 됩니다. API 스크립트는 `.env`를 읽고 DB 상태를 확인합니다. 웹 주소는 `http://localhost:3000`입니다.

`ADMIN_USERNAME`과 `ADMIN_PASSWORD`가 둘 다 설정된 최초 API 시작 시 관리자 계정이 생성됩니다. 이미 생성된 계정 비밀번호는 환경변수 변경만으로 바뀌지 않습니다.

## 카카오맵 키

[카카오디벨로퍼스](https://developers.kakao.com/)에서 앱을 만들고 [카카오맵 > 사용 설정]을 ON으로 바꿉니다. [앱 설정 > 앱 > 플랫폼 키]에서 **JavaScript 키**를 선택하고 **JavaScript SDK 도메인**에 `http://localhost:3000`과 운영 도메인을 등록합니다. 그 키를 `web/.env.local`의 `NEXT_PUBLIC_KAKAO_MAP_JAVASCRIPT_KEY`에 넣고 웹 서버를 다시 시작합니다. Flutter 앱은 WebView로 같은 웹을 열기 때문에 별도 Android/iOS 지도 SDK 키가 필요하지 않습니다. REST API 키나 어드민 키를 브라우저 환경변수에 넣지 마세요. 카카오맵 무료 쿼터는 개발자 계정에서 첫 번째로 활성화한 앱에 적용되므로 콘솔의 무료 쿼터 뱃지와 [쿼터] 화면을 확인합니다.

## 주요 흐름

- `/`: 지도 이동 시 경계 영역 조회, 마커 선택, 현재 위치 주변 조회, 마지막 사진 확인일과 현장 사진 표시. `전체 / 사용자 제보 / 공공자료` 출처 필터를 제공하며, 회색 `공` 핀은 공공자료 좌표, 초록색 `제` 핀은 관리자 승인 신규 제보 위치입니다. 출처와 사진 확인 여부는 별도로 표시합니다.
- `/report`: 신규 수거함 제보 또는 기존 수거함의 존재·철거·위치 오류를 사진과 함께 제보합니다. 현장 사진 제보는 PENDING 상태로 저장됩니다.
- `/admin`: 관리자 로그인 후 현장 사진을 확인하고 제보를 승인·반려합니다. 승인된 존재 확인에만 최근 사진 확인일이 기록됩니다. 관리자 API 자체에 ROLE_ADMIN 인증을 적용합니다.
- 승인된 NEW 제보만 지도에 등록됩니다. REMOVED 상태는 일반 조회에서 제외됩니다.
- Flutter 앱은 `mobile/README.md`의 기기별 주소 설정에 따라 같은 웹 화면을 엽니다.
- 첫 접속 시 위치 권한을 요청하고 내 위치 중심으로 지도를 엽니다. 위치를 찾지 못하면 서울 중심으로 열립니다. 파란 실시간 위치 마커와 정확도 원이 표시됩니다.

## 공공데이터

용산구·강서구·양천구 원본 CSV를 `collector/input/`에 복사했고, `./scripts/import-downloaded-data.sh --dry-run`으로 검증할 수 있습니다. 실제 DB 반영은 `./scripts/import-downloaded-data.sh`를 실행하세요. 송파구 CSV도 별도로 지원합니다. 자세한 출처와 기준일은 [collector/README.md](collector/README.md)에 있습니다. 가져온 수거함은 `UNVERIFIED` 상태로 표시합니다. 서울 25개 구 전체 자동 수집은 아직 구현되지 않았습니다.

## API

`GET /api/v1/boxes?swLat=...&swLng=...&neLat=...&neLng=...`, `GET /api/v1/boxes/nearby?lat=...&lng=...&radius=1000&limit=50`, `GET /api/v1/boxes/{id}`, `POST /api/v1/reports`, `POST /api/v1/boxes/{id}/observations`(multipart: `type`, `description`, `photo`, 위치 오류 시 `lat`·`lng`), `GET /api/v1/boxes/{id}/photo`. 지도 영역·주변 조회는 선택적으로 `sourceType=PUBLIC` 또는 `sourceType=USER`를 받을 수 있습니다. 현장 사진은 JPG/PNG 5MB 이하를 받고 서버에서 JPEG로 다시 저장해 이미지 메타데이터를 제거합니다. 사진은 관리자 승인 후에만 공개됩니다. 기존 `POST /api/v1/boxes/{id}/confirmations`는 기록만 남기며 최근 사진 확인 상태를 바꾸지 않습니다. 관리자 API는 `/api/v1/admin` 아래에 있으며 HTTP Basic 자격 증명이 필요합니다. 관리자 인증은 HTTPS 배포에서만 사용하세요.

테스트: 루트에서 `./scripts/verify-api.sh`를 실행하면 Java 21을 확인하고 단위 테스트 및 PostGIS 통합 테스트를 순서대로 실행합니다. 웹은 `./scripts/verify-web.sh`로 의존성 설치, PostCSS 의존성·보안 검사, 타입 검사, 프로덕션 빌드를 검증합니다. PostGIS 통합 테스트는 일회성 Testcontainers DB에만 테스트용 위치를 만들고 폐기합니다.

Next.js 15.5.28이 내부 의존성으로 취약한 PostCSS 8.4.31을 지정하므로 `web/package.json`에서 PostCSS 8.5.32를 재지정합니다. 해당 버전으로 `npm audit` 0건과 웹 빌드 통과를 확인했습니다. 추후 Next.js 15 보안 패치가 내부 PostCSS를 갱신하면 이 재지정을 재검토합니다.

Compose DB까지 확인하려면 루트에서 `./scripts/verify-stack.sh`를 실행합니다. API JAR를 빌드해 잠시 실행하고, 지도 조회·관리자 인증·Flyway 기록·PostGIS 버전을 확인한 뒤 API 프로세스를 종료합니다. 실패 로그는 `api/build/verify-stack.log`에 남습니다.

## 운영 전 후속 작업

공공데이터의 실제 현장 위치 확인, 자치구별 자동 수집기, 제보 스팸 방어의 공유 저장소화, 관리자 계정 비밀번호 변경 절차, 사진 S3 이전과 보존 기간 정책, Flutter 앱의 실제 기기 검증과 스토어 배포가 남아 있습니다. 로컬 사진 저장소는 디스크 백업이 필요하며 여러 API 인스턴스가 공유할 수 없습니다.
