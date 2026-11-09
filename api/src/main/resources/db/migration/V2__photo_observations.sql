ALTER TABLE reports DROP CONSTRAINT reports_report_type_check;
ALTER TABLE reports DROP CONSTRAINT reports_check;
ALTER TABLE reports ADD CONSTRAINT reports_report_type_check
  CHECK (report_type IN ('NEW','EXISTS','REMOVED','LOCATION_ERROR'));
ALTER TABLE reports ADD CONSTRAINT reports_check CHECK (
  (report_type='NEW' AND box_id IS NULL AND proposed_location IS NOT NULL) OR
  (report_type='EXISTS' AND box_id IS NOT NULL) OR
  (report_type='REMOVED' AND box_id IS NOT NULL) OR
  (report_type='LOCATION_ERROR' AND box_id IS NOT NULL AND proposed_location IS NOT NULL)
);
ALTER TABLE collection_boxes ADD COLUMN last_photo_verified_at timestamptz;
ALTER TABLE box_photos ADD COLUMN storage_type varchar(10) NOT NULL DEFAULT 'LOCAL'
  CHECK (storage_type IN ('LOCAL','S3'));
CREATE INDEX box_photos_report_idx ON box_photos(report_id);
CREATE INDEX box_photos_box_idx ON box_photos(box_id,created_at DESC);
