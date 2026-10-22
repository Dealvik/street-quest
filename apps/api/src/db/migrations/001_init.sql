CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  display_name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE location_points (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  client_id TEXT NOT NULL,
  recorded_at TIMESTAMPTZ NOT NULL,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  altitude DOUBLE PRECISION,
  accuracy_m DOUBLE PRECISION,
  speed_mps DOUBLE PRECISION,
  h3_index TEXT NOT NULL,
  resolution SMALLINT NOT NULL,
  geom geometry(Point, 4326) NOT NULL,
  CONSTRAINT location_points_lat_chk CHECK (latitude BETWEEN -90 AND 90),
  CONSTRAINT location_points_lng_chk CHECK (longitude BETWEEN -180 AND 180),
  UNIQUE (user_id, client_id)
);

CREATE INDEX location_points_user_time_idx ON location_points (user_id, recorded_at);
CREATE INDEX location_points_geom_idx ON location_points USING GIST (geom);

CREATE TABLE user_coverage_cells (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  h3_index TEXT NOT NULL,
  resolution SMALLINT NOT NULL,
  duration_seconds DOUBLE PRECISION NOT NULL CHECK (duration_seconds >= 0),
  visit_count INTEGER NOT NULL CHECK (visit_count >= 0),
  point_count INTEGER NOT NULL CHECK (point_count >= 0),
  first_seen TIMESTAMPTZ NOT NULL,
  last_seen TIMESTAMPTZ NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('passage', 'sojourn')),
  centroid geometry(Point, 4326) NOT NULL,
  cell_geom geometry(Polygon, 4326) NOT NULL,
  PRIMARY KEY (user_id, h3_index)
);

CREATE INDEX user_coverage_cells_geom_idx ON user_coverage_cells USING GIST (cell_geom);

CREATE TABLE user_stats (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  distance_meters DOUBLE PRECISION NOT NULL,
  duration_seconds DOUBLE PRECISION NOT NULL,
  cell_count INTEGER NOT NULL,
  sojourn_count INTEGER NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
