# 설계 메모

- 좌표 입력은 API의 lat, lng 순서입니다. PostGIS POINT 생성은 경도(lng), 위도(lat) 순서입니다.
- 지도 영역 조회는 최대 2도 × 2도, 최대 500개입니다. 주변 조회는 최대 5km, 100개입니다.
- NEW 승인 시 새 수거함을 UNVERIFIED로 공개합니다. REMOVED 승인 시 지도에서 제외합니다. LOCATION_ERROR 승인 시 위치를 변경합니다.
- 공공데이터 출처, URL, 기준일은 collection_boxes의 source_name, source_url, source_as_of에 보관합니다.
- 익명 토큰은 서버가 서명한 HttpOnly 쿠키이며 DB에는 키의 HMAC만 저장합니다. 한 IP당 시간당 제보 10건, 확인 60건으로 제한합니다. 동일 수거함과 익명 키의 존재 확인은 트랜잭션 잠금 후 24시간 중복 여부를 검사합니다.
- 관리자 인증은 HTTPS 환경에서 HTTP Basic을 사용합니다. 화면은 자격 증명을 메모리에만 보관하며 서버에는 BCrypt 해시를 저장합니다.
- 현장 사진 제보는 `EXISTS`, `REMOVED`, `LOCATION_ERROR`로 접수되어 관리자 승인 전에는 수거함 상태를 바꾸지 않습니다. 승인된 `EXISTS`·사진 첨부 위치 수정만 `last_photo_verified_at`을 기록합니다. 지도에서 90일 이내 승인된 사진 확인을 녹색 핀으로 표시합니다.
- 사진은 서버가 JPG/PNG를 디코딩해 JPEG로 다시 저장하여 메타데이터를 제거합니다. 로컬 저장 경로는 `PHOTO_STORAGE_DIR`이고 DB의 `box_photos.s3_key`에는 로컬 파일 키를 보관합니다. 관리자만 대기 사진을 볼 수 있고, 승인된 존재·위치 수정 사진만 공개됩니다.
