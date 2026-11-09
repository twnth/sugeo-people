import unittest
from datetime import date

from import_csv import parse_rows


class CsvImportTests(unittest.TestCase):
    def test_yongsan_csv_with_official_columns(self):
        raw = (
            "연번,행정동,도로명주소,지번주소,위도,경도\n"
            "1,한강로동,서울특별시 용산구 이태원로4가길 4 (용산동3가),용산동3가 1-40,37.53369871,126.9753186\n"
        ).encode("utf-8-sig")
        rows = parse_rows(raw, "yongsan")
        self.assertEqual(rows[0][0], "1")
        self.assertEqual(rows[0][2], "서울특별시 용산구 이태원로4가길 4 (용산동3가)")
        self.assertEqual(rows[0][3:], (37.53369871, 126.9753186))

    def test_songpa_csv_rejects_swapped_coordinates(self):
        raw = "연번,관리단체,행정동,설치장소,위도,경도\n1,단체,가락동,가락동 1-1,127.1,37.5\n".encode("cp949")
        with self.assertRaisesRegex(ValueError, "좌표"):
            parse_rows(raw, "songpa")

    def test_duplicate_record_key_rejected(self):
        raw = "연번,행정동,설치장소,위도,경도\n1,가락동,가락동 1-1,37.5,127.1\n1,가락동,가락동 1-2,37.5,127.1\n".encode()
        with self.assertRaisesRegex(ValueError, "중복"):
            parse_rows(raw, "songpa")

    def test_gangseo_uses_official_coordinates(self):
        raw = (
            "연번,행정동,관리번호,설치장소(도로명주소),설치장소(지번주소),위도,경도,관리단체,데이터기준일자\n"
            "1,화곡1동,화곡1-01,서울특별시 강서구 화곡로26가길 28,서울특별시 강서구 화곡동 1074-4,37.54058582,126.83847512,단체,2024-04-18\n"
        ).encode("utf-8-sig")
        rows = parse_rows(raw, "gangseo")
        self.assertEqual(rows[0], ("1", "강서구 의류수거함", "서울특별시 강서구 화곡로26가길 28", 37.54058582, 126.83847512))

    def test_yangcheon_deduplicates_exact_rows_without_serial_number(self):
        raw = (
            "행정동,도로명주소,지번주소,위도,경도,데이터기준일자\n"
            "목1동,서울특별시 양천구 목동동로 206-1,서울특별시 양천구 목동 405-207,37.5146676,126.8585807,2026-09-04\n"
            "목1동,서울특별시 양천구 목동동로 206-1,서울특별시 양천구 목동 405-207,37.5146676,126.8585807,2026-09-04\n"
        ).encode("utf-8-sig")
        rows = parse_rows(raw, "yangcheon")
        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0][2:], ("서울특별시 양천구 목동동로 206-1", 37.5146676, 126.8585807))

    def test_rejects_mismatched_source_date(self):
        raw = (
            "행정동,도로명주소,지번주소,위도,경도,데이터기준일자\n"
            "목1동,서울특별시 양천구 목동동로 206-1,,37.5146676,126.8585807,2026-09-04\n"
        ).encode()
        with self.assertRaisesRegex(ValueError, "데이터기준일자"):
            parse_rows(raw, "yangcheon", date(2026, 9, 5))


if __name__ == "__main__":
    unittest.main()
