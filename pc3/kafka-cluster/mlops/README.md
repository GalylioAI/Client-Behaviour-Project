# MLOps Layer

This folder holds the runtime pieces for the ML side of the behaviour analytics platform.

Current phase:

- MinIO on PC2 stores ML artifacts.
- MLflow on PC3 tracks experiments and models.
- `mlops-runner` on PC3 exposes a small internal HTTP service for Airflow-triggered training/scoring jobs.
- DVC snapshots Layer 2 feature datasets into MinIO before training.
- Deepchecks plus custom validation gates datasets before model training.
- ClickHouse stores feature snapshots, validation reports, model runs, predictions, and prepared smart actions.

## Services

| Service | Host | Purpose |
| --- | --- | --- |
| MinIO | `http://192.168.1.106:9002` | S3-compatible artifact storage |
| MinIO Console | `http://192.168.1.106:9001` | Bucket/admin UI |
| MLflow | `http://192.168.1.109:5000` | Experiment tracking and model registry |
| MLOps runner | PC3 Docker container, internal `http://mlops-runner:8600` | DVC/Deepchecks/training/scoring runtime |

## Buckets

The PC2 MinIO init container creates:

- `dvc`
- `mlflow`
- `deepchecks`
- `models`

## DVC Bootstrap

Run this inside the `mlops-runner` container when we start creating dataset snapshots:

```bash
/workspace/mlops/scripts/init_dvc_remote.sh
```

That creates a local DVC workspace under `/workspace/runtime/dvc-workspace` and points it to the MinIO `dvc` bucket.

## Hybrid Decision Pipeline

The first ML use case is `purchase_intent_abandoned_cart`.

- Manual training DAG: `hybrid_decision_mlops_pipeline`
- Automatic monitoring DAG: `mlops_purchase_intent_monitoring`
- Monitoring schedule: every 6 hours at minute `15`
- Runner module: `behavior_mlops.purchase_intent`
- Inputs: `session_features FINAL`
- Training mode: one model per `site_id`
- Validation: chronological holdout by `session_start`, with stratified fallback only when time split cannot keep both classes.
- Imbalance handling: full training data is kept; XGBoost uses `scale_pos_weight`, Logistic Regression uses balanced class weights.
- Promotion rule: a model is promoted only if validation passes, chronological holdout has at least 10 purchase sessions, and ML ranking metrics beat or match the rule baseline.
- MLflow experiment: `BehaviourAI - Purchase Intent`
- MLflow registered model name format: `behaviourai_purchase_intent__site_<site_slug>`
- MLflow model aliases:
  - `production` / `champion` when the quality gate passes
  - `candidate` when the model is trained but blocked by the quality gate
- DVC dataset path format:
  `datasets/site=<site_slug>/use_case=purchase_intent_abandoned_cart/date=<yyyy-mm-dd>/snapshot=<snapshot_id>/training.parquet`
- Key tracked metrics: ROC-AUC, average precision, Brier score, Precision/Recall/Lift@10%, @20, @50, @100, decision-threshold precision/recall/F1, and matching rule-baseline metrics.
- MLflow artifacts:
  - `evaluation/evaluation_report.md`
  - `evaluation/metrics.json`
  - `evaluation/quality_gate.json`
  - `evaluation/top_k_business_report.csv`
  - `evaluation/feature_importance.csv`
  - `evaluation/feature_schema.json`
  - `evaluation/validation_predictions_top500.csv`
- Monitoring loop:
  - compares the latest reference training snapshot against the fresh monitoring window
  - runs Deepchecks train/test validation when available
  - computes PSI-style numeric/categorical drift scores
  - logs a separate MLflow monitoring run under `BehaviourAI - Purchase Intent Monitoring`
  - writes ClickHouse rows to `ml_monitoring_reports`
  - retrains on an expanded old+new window when drift is detected, the reference dataset is missing, or no model exists
- Outputs:
  - `ml_feature_snapshots`
  - `ml_validation_reports`
  - `ml_model_runs`
  - `ml_purchase_intent_predictions`
  - `smart_action_candidates`
  - `ml_rule_decision_audit`

Manual test from Airflow can pass a DAG config like:

```json
{
  "site_id": "parahouse",
  "lookback_days": 30,
  "min_rows": 20,
  "min_positive": 1,
  "max_actions": 50,
  "action_threshold": 0.35
}
```

If `site_id` is omitted, the runner scans `session_features` for every active site in the lookback window and trains/scores each site separately.
