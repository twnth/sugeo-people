# 옷함지도 Flutter 앱

기존 Next.js 웹을 Android·iOS WebView로 표시합니다. 첫 접속 시 기기 위치 권한을 요청하고, 카카오맵 길찾기는 외부 앱 또는 브라우저로 엽니다. 사진 제보에서는 Android의 `image_picker`가 카메라·갤러리 선택을 WebView 파일 입력에 연결하고, iOS는 WebView의 파일 입력과 카메라·사진 권한 안내를 사용합니다.

## 로컬 실행

먼저 루트의 `./scripts/docker-setup.sh`, `./scripts/dev-api.sh`와 `cd web && npm run dev`로 서버를 켭니다. 웹의 `NEXT_PUBLIC_API_BASE_URL`은 비워 두고 `API_PROXY_TARGET=http://127.0.0.1:8080`으로 설정합니다. 앱이 `/api/v1`을 웹 서버를 통해 호출하므로 기기에서 API 포트에 직접 연결할 필요가 없습니다.

```bash
cd mobile
flutter pub get
flutter run
```

- iOS 시뮬레이터: 기본 `http://localhost:3000`으로 웹에 접속합니다.
- Android 에뮬레이터 또는 USB 연결 Android 기기: 앱을 실행하기 전에 `adb reverse tcp:3000 tcp:3000`을 실행합니다. 앱의 기본 주소는 `http://localhost:3000`입니다. WebView 위치 API가 요구하는 보안 출처를 위해 `10.0.2.2`의 일반 HTTP 대신 localhost 역방향 연결을 사용합니다.
- 실제 iPhone 또는 다른 네트워크의 기기: HTTPS로 배포한 웹 주소를 지정합니다. 예: `flutter run --dart-define=WEB_URL=https://your-domain.example`. 해당 도메인을 카카오디벨로퍼스 JavaScript 키의 JavaScript SDK 도메인에도 등록합니다.

릴리스 빌드에서는 반드시 배포한 HTTPS 주소를 `WEB_URL`로 지정합니다. 웹의 `API_PROXY_TARGET`은 배포된 웹 서버에서 실제 API 주소를 가리키도록 설정합니다.

```bash
flutter build apk --release --dart-define=WEB_URL=https://your-domain.example
flutter build ios --release --dart-define=WEB_URL=https://your-domain.example
```

스토어 배포 전 `com.example.clothmap` Android applicationId, iOS bundle identifier, 앱 아이콘, 서명 설정을 실제 서비스 값으로 바꿔야 합니다. 현재 플랫폼 기본 아이콘과 개발용 서명 설정입니다.

## 검증

`flutter pub get`, `flutter analyze`, `flutter test`로 확인할 수 있습니다. 현재 WebView 앱에는 플러그인을 흉내 내는 단위 테스트를 추가하지 않았습니다. 실제 Android·iPhone에서 지도 표시, 현재 위치 권한, 카메라·갤러리 사진 선택 및 업로드, 관리자 승인, 카카오맵 길찾기 외부 열기를 확인해야 합니다. 업로드 전 사진은 5MB 이하 JPG/PNG여야 합니다.
