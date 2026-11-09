CREATE EXTENSION IF NOT EXISTS postgis;
CREATE TABLE admin_users (
  id uuid PRIMARY KEY, username text NOT NULL UNIQUE, password_hash text NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE collection_boxes (
  id uuid PRIMARY KEY, name text NOT NULL, address text,
  district_code varchar(5), location geography(Point,4326) NOT NULL,
  source_type varchar(10) NOT NULL CHECK (source_type IN ('PUBLIC','USER')),
  source_record_key text, source_name text, source_url text, source_as_of date,
  status varchar(20) NOT NULL CHECK (status IN ('ACTIVE','UNVERIFIED','SUSPECTED_REMOVED','REMOVED')),
  last_verified_at timestamptz, created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX collection_boxes_source_unique ON collection_boxes(source_name,source_record_key) WHERE source_record_key IS NOT NULL;
CREATE INDEX collection_boxes_location_gist ON collection_boxes USING gist(location);
CREATE INDEX collection_boxes_status_idx ON collection_boxes(status);
CREATE TABLE reports (
  id uuid PRIMARY KEY, box_id uuid REFERENCES collection_boxes(id),
  report_type varchar(20) NOT NULL CHECK (report_type IN ('NEW','REMOVED','LOCATION_ERROR')),
  proposed_location geography(Point,4326), address text, description text NOT NULL,
  reporter_key_hash text NOT NULL,
  status varchar(10) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','APPROVED','REJECTED')),
  reviewed_by uuid REFERENCES admin_users(id), reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((report_type='NEW' AND box_id IS NULL AND proposed_location IS NOT NULL) OR
         (report_type='REMOVED' AND box_id IS NOT NULL) OR
         (report_type='LOCATION_ERROR' AND box_id IS NOT NULL AND proposed_location IS NOT NULL))
);
CREATE INDEX reports_status_idx ON reports(status,created_at);
CREATE TABLE box_confirmations (
  id uuid PRIMARY KEY, box_id uuid NOT NULL REFERENCES collection_boxes(id),
  confirmation_type varchar(10) NOT NULL CHECK (confirmation_type IN ('EXISTS','MISSING')),
  reporter_key_hash text NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX confirmations_cooldown_idx ON box_confirmations(box_id,reporter_key_hash,created_at DESC);
CREATE TABLE box_photos (
  id uuid PRIMARY KEY, box_id uuid REFERENCES collection_boxes(id), report_id uuid REFERENCES reports(id),
  s3_key text NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (box_id IS NOT NULL OR report_id IS NOT NULL)
);
CREATE TABLE data_imports (
  id uuid PRIMARY KEY, source_name text NOT NULL, district_code varchar(5), source_url text,
  source_file_hash text, import_status text NOT NULL, inserted_count integer NOT NULL DEFAULT 0,
  updated_count integer NOT NULL DEFAULT 0, started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz
);
