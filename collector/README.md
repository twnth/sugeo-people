# 서울 의류수거함 공공데이터 가져오기

서울 여러 자치구에서 서로 다른 형식으로 자료를 공개합니다. 현재 가져오기 명령은 아래 네 구의 CSV 형식을 지원합니다. `collector/input/`의 원본 파일은 Git에 포함되지 않습니다.

| 구 | 공식 원본 | 기준일 | 공개 행 수 |
| --- | --- | --- | ---: |
| 용산구 | [공공데이터포털: 재활용 의류수거함 현황](https://www.data.go.kr/data/15149815/fileData.do) | 2026-09-18 | 593 |
| 송파구 | [공공데이터포털: 관내 의류수거함 현황](https://www.data.go.kr/data/15127100/fileData.do) | 2026-09-18 | 454 |
| 강서구 | [공공데이터포털: 의류수거함 위치현황](https://www.data.go.kr/data/15127065/fileData.do) | 2024-04-18 | 623 |
| 양천구 | [공공데이터포털: 의류수거함위치](https://www.data.go.kr/data/15105196/fileData.do) | 2026-09-04 | 687 (완전 중복 7행 제외 시 680) |

추가로 확인한 공식 자료:

| 구 | 원본 | 위치 정보 | 현재 가져오기 지원 |
| --- | --- | --- | --- |
| 영등포구 | [공공데이터포털: 의류수거함 위치현황](https://www.data.go.kr/data/15106473/fileData.do) | 주소·위도·경도 | 미지원 |
| 광진구 | [공공데이터포털: 의류수거함위치](https://www.data.go.kr/data/15109594/fileData.do) | 주소 중심, 좌표 제공 여부 원본 확인 필요 | 미지원 |
| 구로구 | [서울 열린데이터광장: 의류수거함](https://data.seoul.go.kr/dataList/OA-21855/F/1/datasetView.do) | 주소·상세위치, 좌표 변환 필요 | 미지원 |

이번에 받은 원본은 `collector/input/yongsan.csv`, `gangseo.csv`, `yangcheon.csv`로 복사했습니다. 강서구 원본에도 위도·경도가 있어 주소 변환 없이 원본 좌표를 사용합니다. 세 파일을 한 번에 가져오려면 프로젝트 루트에서 다음을 실행합니다.

```bash
./scripts/import-downloaded-data.sh
```

CSV를 다운로드 폴더에 저장했다면 프로젝트 루트에서 먼저 파일을 검증합니다. 경로는 실제 다운로드한 파일명으로 바꾸세요.

```bash
./scripts/import-public-data.sh yongsan '/Users/onigiriman/Downloads/용산구.csv' --as-of 2026-09-18 --dry-run
./scripts/import-public-data.sh songpa '/Users/onigiriman/Downloads/송파구.csv' --as-of 2026-09-18 --dry-run
```

검증이 통과하면 `--dry-run`을 빼고 실행합니다. PostgreSQL 컨테이너가 실행 중이고 루트 `.env`의 DB 정보가 맞아야 합니다. `psql` 명령이 설치되어 있어야 합니다.

```bash
./scripts/import-public-data.sh yongsan '/Users/onigiriman/Downloads/용산구.csv' --as-of 2026-09-18
./scripts/import-public-data.sh songpa '/Users/onigiriman/Downloads/송파구.csv' --as-of 2026-09-18
```

가져오기 전 CSV의 필수 컬럼·좌표 범위·중복을 검증합니다. DB 반영은 한 트랜잭션에서 처리하고, 원본 URL·기준일·SHA256 파일 해시를 기록합니다. 새 공공데이터는 `UNVERIFIED`로 등록합니다. 재실행해도 원본 행 식별값 기준으로 중복 등록되지 않으며, `REMOVED` 등 사용자 검토를 거친 기존 상태는 다시 활성화하지 않습니다. 원본에서 빠진 항목도 자동 삭제하지 않습니다.

좌표 범위 검증은 수거함의 실제 설치 위치나 현장 존재 여부를 확인하는 절차가 아닙니다. 원본 좌표가 주변 건물 주소에 붙어 있을 수 있으므로 지도에는 현장 미확인 상태와 자료 기준일을 함께 표시합니다. 정확한 위치는 사용자 확인·위치 오류 제보 또는 현장 조사로 보완해야 합니다.

나머지 자치구는 공개 형식과 갱신일이 제각각이므로 자료별 컬럼과 좌표 품질을 검증한 후 수집 범위를 늘려야 합니다. 이 목록은 서울 25개 구를 전수 확인한 결과가 아닙니다.
