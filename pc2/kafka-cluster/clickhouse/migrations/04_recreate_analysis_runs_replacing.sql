USE tracer;

-- The first Layer 2 test version stored one "running" row and one final row
-- for the same pipeline run. Recreate only the lightweight run-log table so
-- future queries can read the latest status per run with FINAL.
DROP TABLE IF EXISTS analysis_runs;

CREATE TABLE analysis_runs
(
    run_id       String,
    pipeline     LowCardinality(String),
    site_id      LowCardinality(String),
    window_start DateTime64(3, 'UTC'),
    window_end   DateTime64(3, 'UTC'),
    status       LowCardinality(String),
    rows_written UInt64 DEFAULT 0,
    message      String DEFAULT '',
    started_at   DateTime64(3, 'UTC'),
    finished_at  Nullable(DateTime64(3, 'UTC')),
    updated_at   DateTime64(3, 'UTC') DEFAULT now64(3)
)
ENGINE = ReplacingMergeTree(updated_at)
PARTITION BY toYYYYMM(started_at)
ORDER BY (pipeline, site_id, run_id);
