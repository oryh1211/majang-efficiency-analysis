CREATE TABLE IF NOT EXISTS samples (
  hash TEXT NOT NULL,
  label TEXT,
  original TEXT,
  region TEXT NOT NULL,
  orientation INTEGER NOT NULL,
  crop TEXT NOT NULL,
  source TEXT NOT NULL,
  shape TEXT NOT NULL,
  conflict INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (region, orientation, hash)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS sample_limits (
  source TEXT NOT NULL,
  hour INTEGER NOT NULL,
  hits INTEGER NOT NULL,
  PRIMARY KEY (source, hour)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS candidate_groups (
  region TEXT NOT NULL,
  orientation INTEGER NOT NULL,
  hashes TEXT NOT NULL,
  PRIMARY KEY (region, orientation)
);
