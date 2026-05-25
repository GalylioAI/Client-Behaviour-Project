USE tracer;

CREATE TABLE IF NOT EXISTS ml_feature_snapshots
(
    snapshot_id String,
    site_id LowCardinality(String),
    model_use_case LowCardinality(String),
    window_start DateTime64(3, 'UTC'),
    window_end DateTime64(3, 'UTC'),
    row_count UInt64,
    positive_count UInt64,
    negative_count UInt64,
    feature_count UInt32,
    dataset_uri String,
    dataset_hash String,
    dvc_status LowCardinality(String) DEFAULT 'not_configured',
    validation_status LowCardinality(String) DEFAULT 'pending',
    validation_report_id String DEFAULT '',
    validation_report_uri String DEFAULT '',
    created_at DateTime64(3, 'UTC') DEFAULT now64(3),
    updated_at DateTime64(3, 'UTC') DEFAULT now64(3)
)
ENGINE = ReplacingMergeTree(updated_at)
PARTITION BY toYYYYMM(created_at)
ORDER BY (model_use_case, site_id, snapshot_id);

CREATE TABLE IF NOT EXISTS ml_validation_reports
(
    report_id String,
    snapshot_id String,
    site_id LowCardinality(String),
    model_use_case LowCardinality(String),
    validation_suite LowCardinality(String),
    status LowCardinality(String),
    critical_issues UInt32,
    warning_issues UInt32,
    report_json String,
    report_uri String DEFAULT '',
    created_at DateTime64(3, 'UTC') DEFAULT now64(3)
)
ENGINE = MergeTree
PARTITION BY toYYYYMM(created_at)
ORDER BY (model_use_case, site_id, snapshot_id, report_id);

CREATE TABLE IF NOT EXISTS ml_model_runs
(
    model_run_id String,
    snapshot_id String,
    site_id LowCardinality(String),
    model_use_case LowCardinality(String),
    model_name String,
    model_version String DEFAULT '',
    algorithm LowCardinality(String),
    mlflow_run_id String DEFAULT '',
    mlflow_experiment_id String DEFAULT '',
    model_uri String DEFAULT '',
    status LowCardinality(String),
    promoted UInt8 DEFAULT 0,
    metric_auc Nullable(Float64),
    metric_average_precision Nullable(Float64),
    metric_precision_top_10_pct Nullable(Float64),
    metric_baseline_precision_top_10_pct Nullable(Float64),
    train_rows UInt64,
    test_rows UInt64,
    feature_count UInt32,
    message String DEFAULT '',
    created_at DateTime64(3, 'UTC') DEFAULT now64(3),
    updated_at DateTime64(3, 'UTC') DEFAULT now64(3)
)
ENGINE = ReplacingMergeTree(updated_at)
PARTITION BY toYYYYMM(created_at)
ORDER BY (model_use_case, site_id, model_run_id);

CREATE TABLE IF NOT EXISTS ml_purchase_intent_predictions
(
    prediction_id String,
    site_id LowCardinality(String),
    platform LowCardinality(String),
    session_id String,
    visitor_id String,
    customer_id String,
    customer_email String,
    model_run_id String,
    snapshot_id String,
    model_name String,
    model_version String DEFAULT '',
    scored_at DateTime64(3, 'UTC'),
    window_start DateTime64(3, 'UTC'),
    window_end DateTime64(3, 'UTC'),
    purchase_probability Float64,
    abandonment_risk Float64,
    rule_baseline_score Float64,
    intent_tier LowCardinality(String),
    recommended_action LowCardinality(String),
    reason String,
    features_json String,
    updated_at DateTime64(3, 'UTC') DEFAULT now64(3)
)
ENGINE = ReplacingMergeTree(updated_at)
PARTITION BY toYYYYMM(scored_at)
ORDER BY (site_id, session_id, model_run_id);

CREATE TABLE IF NOT EXISTS smart_action_candidates
(
    action_id String,
    site_id LowCardinality(String),
    platform LowCardinality(String),
    session_id String,
    visitor_id String,
    customer_id String,
    customer_email String,
    action_type LowCardinality(String),
    channel LowCardinality(String),
    priority LowCardinality(String),
    status LowCardinality(String) DEFAULT 'prepared',
    source LowCardinality(String) DEFAULT 'hybrid_ml_rules',
    model_run_id String DEFAULT '',
    snapshot_id String DEFAULT '',
    prediction_id String DEFAULT '',
    prediction_score Float64,
    rule_score Float64,
    title String,
    reason String,
    payload_json String,
    generated_at DateTime64(3, 'UTC'),
    expires_at Nullable(DateTime64(3, 'UTC')),
    updated_at DateTime64(3, 'UTC') DEFAULT now64(3)
)
ENGINE = ReplacingMergeTree(updated_at)
PARTITION BY toYYYYMM(generated_at)
ORDER BY (site_id, status, action_type, visitor_id, session_id, action_id);

CREATE TABLE IF NOT EXISTS ml_rule_decision_audit
(
    decision_id String,
    site_id LowCardinality(String),
    session_id String,
    visitor_id String,
    model_run_id String,
    prediction_id String,
    action_type LowCardinality(String),
    accepted UInt8,
    rule_version String,
    reason String,
    context_json String,
    decided_at DateTime64(3, 'UTC')
)
ENGINE = MergeTree
PARTITION BY toYYYYMM(decided_at)
ORDER BY (site_id, decided_at, session_id, decision_id);
