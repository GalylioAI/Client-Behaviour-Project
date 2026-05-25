USE tracer;

CREATE TABLE IF NOT EXISTS ml_monitoring_reports
(
    report_id String,
    site_id LowCardinality(String),
    model_use_case LowCardinality(String),
    reference_model_run_id String DEFAULT '',
    reference_snapshot_id String DEFAULT '',
    reference_dataset_uri String DEFAULT '',
    current_window_start DateTime64(3, 'UTC'),
    current_window_end DateTime64(3, 'UTC'),
    reference_rows UInt64,
    current_rows UInt64,
    reference_positive_rows UInt64,
    current_positive_rows UInt64,
    drift_status LowCardinality(String),
    drift_score Float64,
    warning_features UInt32,
    drifted_features UInt32,
    deepchecks_status LowCardinality(String),
    deepchecks_report_uri String DEFAULT '',
    monitoring_report_uri String DEFAULT '',
    mlflow_run_id String DEFAULT '',
    action_taken LowCardinality(String),
    retrain_model_run_id String DEFAULT '',
    report_json String,
    created_at DateTime64(3, 'UTC') DEFAULT now64(3)
)
ENGINE = MergeTree
PARTITION BY toYYYYMM(created_at)
ORDER BY (model_use_case, site_id, created_at, report_id);
