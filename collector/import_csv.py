#!/usr/bin/env python3
"""Import an official district clothing-bin CSV into the existing PostGIS schema."""

from __future__ import annotations

import argparse
import csv
import hashlib
import io
import os
from pathlib import Path
import subprocess
from urllib.parse import urlparse
from datetime import date

SOURCES = {
    "yongsan": {
        "name": "data.go.kr:15149815",
        "district_name": "용산구",
        "district_code": "11170",
        "url": "https://www.data.go.kr/data/15149815/fileData.do",
    },
    "songpa": {
        "name": "data.go.kr:15127100",
        "district_name": "송파구",
        "district_code": "11710",
        "url": "https://www.data.go.kr/data/15127100/fileData.do",
    },
    "gangseo": {
        "name": "data.go.kr:15127065",
        "district_name": "강서구",
        "district_code": "11500",
        "url": "https://www.data.go.kr/data/15127065/fileData.do",
    },
    "yangcheon": {
        "name": "data.go.kr:15105196",
        "district_name": "양천구",
        "district_code": "11470",
        "url": "https://www.data.go.kr/data/15105196/fileData.do",
    },
}


def decode_csv(raw: bytes) -> str:
    for encoding in ("utf-8-sig", "cp949"):
        try:
            return raw.decode(encoding)
        except UnicodeDecodeError:
            continue
    raise ValueError("CSV 인코딩을 읽을 수 없습니다. UTF-8 또는 CP949 파일을 사용하세요.")


def normalize_address(value: str, district: str) -> str:
    value = value.strip()
    if not value:
        raise ValueError("주소가 비어 있습니다.")
    if value.startswith("서울특별시 "):
        return value
    if value.startswith(district + " "):
        return "서울특별시 " + value
    return f"서울특별시 {district} {value}"


def parse_rows(raw: bytes, source_key: str, as_of: date | None = None) -> list[tuple[str, str, str, float, float]]:
    source = SOURCES[source_key]
    reader = csv.DictReader(io.StringIO(decode_csv(raw)))
    if reader.fieldnames is None:
        raise ValueError("CSV 헤더를 찾을 수 없습니다.")
    reader.fieldnames = [header.strip() for header in reader.fieldnames]
    required = {"위도", "경도"}
    if source_key != "yangcheon":
        required.add("연번")
    if not required.issubset(reader.fieldnames):
        raise ValueError(f"필수 컬럼이 없습니다: {', '.join(sorted(required - set(reader.fieldnames)))}")
    if source_key == "yongsan" and "도로명주소" not in reader.fieldnames and "지번주소" not in reader.fieldnames:
        raise ValueError("용산구 CSV 주소 컬럼을 찾을 수 없습니다.")
    if source_key == "songpa" and "설치장소" not in reader.fieldnames:
        raise ValueError("송파구 CSV 설치장소 컬럼을 찾을 수 없습니다.")
    if source_key in ("gangseo", "yangcheon") and not {"도로명주소", "지번주소"}.intersection(reader.fieldnames) and not {"설치장소(도로명주소)", "설치장소(지번주소)"}.intersection(reader.fieldnames):
        raise ValueError("주소 컬럼을 찾을 수 없습니다.")

    rows = []
    seen = set()
    for line_number, row in enumerate(reader, start=2):
        source_date = (row.get("데이터기준일자") or "").strip()
        if as_of is not None and source_date and source_date != as_of.isoformat():
            raise ValueError(f"{line_number}행: 데이터기준일자 {source_date}가 --as-of {as_of}와 다릅니다.")
        if source_key == "yangcheon":
            # The official file has no serial number and contains exact duplicate rows.
            # Identical rows describe the same location, so import each only once.
            identity = "\x1f".join((row.get(field) or "").strip() for field in ("행정동", "도로명주소", "지번주소", "위도", "경도"))
            record_key = hashlib.sha256(identity.encode("utf-8")).hexdigest()
            if record_key in seen:
                continue
        else:
            record_key = (row.get("연번") or "").strip()
            if not record_key or record_key in seen:
                raise ValueError(f"{line_number}행: 연번이 없거나 중복됐습니다.")
        seen.add(record_key)
        if source_key == "songpa":
            raw_address = (row.get("설치장소") or "").strip()
        elif source_key == "gangseo":
            raw_address = ((row.get("설치장소(도로명주소)") or "").strip() or
                           (row.get("설치장소(지번주소)") or "").strip())
        else:
            raw_address = ((row.get("도로명주소") or "").strip() or (row.get("지번주소") or "").strip())
        try:
            lat = float((row.get("위도") or "").strip())
            lng = float((row.get("경도") or "").strip())
        except ValueError as cause:
            raise ValueError(f"{line_number}행: 위도·경도를 읽을 수 없습니다.") from cause
        if not (37.3 <= lat <= 37.8 and 126.7 <= lng <= 127.3):
            raise ValueError(f"{line_number}행: 서울 범위를 벗어난 좌표입니다. 위도·경도 순서를 확인하세요.")
        address = normalize_address(raw_address, source["district_name"])
        rows.append((record_key, f"{source['district_name']} 의류수거함", address, lat, lng))
    if not rows:
        raise ValueError("가져올 수거함 행이 없습니다.")
    return rows


def database_args() -> tuple[list[str], dict[str, str]]:
    jdbc_url = os.environ.get("DB_URL", "")
    if not jdbc_url.startswith("jdbc:postgresql://"):
        raise ValueError("DB_URL은 jdbc:postgresql:// 주소여야 합니다.")
    parsed = urlparse(jdbc_url.removeprefix("jdbc:"))
    if parsed.scheme != "postgresql" or not parsed.hostname or not parsed.path.strip("/"):
        raise ValueError("DB_URL 형식이 올바르지 않습니다.")
    user = os.environ.get("DB_USER", "")
    password = os.environ.get("DB_PASSWORD", "")
    if not user or not password:
        raise ValueError("DB_USER와 DB_PASSWORD를 설정하세요.")
    command = ["psql", "-X", "-v", "ON_ERROR_STOP=1", "--single-transaction", "-h", parsed.hostname,
               "-p", str(parsed.port or 5432), "-U", user, "-d", parsed.path.strip("/")]
    env = os.environ.copy()
    env["PGPASSWORD"] = password
    return command, env


def import_rows(rows: list[tuple[str, str, str, float, float]], source_key: str, as_of: date, file_hash: str) -> None:
    source = SOURCES[source_key]
    command, env = database_args()
    for name, value in {"source_name": source["name"], "district_code": source["district_code"],
                        "source_url": source["url"], "source_as_of": as_of.isoformat(), "file_hash": file_hash}.items():
        command.extend(["-v", f"{name}={value}"])
    csv_data = io.StringIO()
    csv.writer(csv_data, lineterminator="\n").writerows(rows)
    sql = """
CREATE TEMP TABLE incoming_boxes (record_key text PRIMARY KEY, name text NOT NULL, address text NOT NULL,
                                  lat double precision NOT NULL, lng double precision NOT NULL);
COPY incoming_boxes (record_key, name, address, lat, lng) FROM STDIN WITH (FORMAT csv);
""" + csv_data.getvalue() + "\\.\n" + """
CREATE TEMP TABLE inserted_ids AS
WITH inserted AS (
  INSERT INTO collection_boxes (id, name, address, district_code, location, source_type,
                                source_record_key, source_name, source_url, source_as_of, status)
  SELECT gen_random_uuid(), name, address, :'district_code',
         ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geography, 'PUBLIC',
         record_key, :'source_name', :'source_url', :'source_as_of'::date, 'UNVERIFIED'
  FROM incoming_boxes
  ON CONFLICT DO NOTHING
  RETURNING id
) SELECT id FROM inserted;
CREATE TEMP TABLE updated_ids AS
WITH updated AS (
  UPDATE collection_boxes AS box
  SET name = incoming.name, address = incoming.address,
      location = ST_SetSRID(ST_MakePoint(incoming.lng, incoming.lat), 4326)::geography,
      source_url = :'source_url', source_as_of = :'source_as_of'::date, updated_at = now()
  FROM incoming_boxes AS incoming
  WHERE box.source_name = :'source_name' AND box.source_record_key = incoming.record_key
    AND box.source_type = 'PUBLIC' AND box.status = 'UNVERIFIED'
    AND NOT EXISTS (SELECT 1 FROM inserted_ids WHERE id = box.id)
  RETURNING box.id
) SELECT id FROM updated;
INSERT INTO data_imports (id, source_name, district_code, source_url, source_file_hash,
                          import_status, inserted_count, updated_count, finished_at)
SELECT gen_random_uuid(), :'source_name', :'district_code', :'source_url', :'file_hash',
       'SUCCESS', (SELECT count(*) FROM inserted_ids), (SELECT count(*) FROM updated_ids), now();
SELECT (SELECT count(*) FROM inserted_ids) AS inserted_count,
       (SELECT count(*) FROM updated_ids) AS updated_count;
"""
    result = subprocess.run(command, input=sql, text=True, env=env, check=False)
    if result.returncode:
        raise SystemExit(result.returncode)


def main() -> None:
    parser = argparse.ArgumentParser(description="공공데이터포털 의류수거함 CSV를 검증하고 PostGIS에 가져옵니다.")
    parser.add_argument("source", choices=sorted(SOURCES))
    parser.add_argument("file", type=Path)
    parser.add_argument("--as-of", required=True, type=date.fromisoformat, help="자료 기준일 YYYY-MM-DD")
    parser.add_argument("--dry-run", action="store_true", help="CSV를 검증만 하고 DB에는 저장하지 않음")
    args = parser.parse_args()
    raw = args.file.read_bytes()
    rows = parse_rows(raw, args.source, args.as_of)
    file_hash = hashlib.sha256(raw).hexdigest()
    print(f"{args.source}: {len(rows)}행 검증 완료, 기준일 {args.as_of}, SHA256 {file_hash}")
    if args.dry_run:
        return
    import_rows(rows, args.source, args.as_of, file_hash)


if __name__ == "__main__":
    main()
