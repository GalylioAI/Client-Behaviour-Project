# MLOps Layer

This folder holds the runtime pieces for the ML side of the behaviour analytics platform.

Current phase:

- MinIO on PC2 stores ML artifacts.
- MLflow on PC3 tracks experiments and models.
- `mlops-runner` on PC3 provides the Python environment for DVC, Deepchecks, MLflow, and future training/inference scripts.
- No ClickHouse schema changes are created in this phase.

## Services

| Service | Host | Purpose |
| --- | --- | --- |
| MinIO | `http://192.168.1.106:9002` | S3-compatible artifact storage |
| MinIO Console | `http://192.168.1.106:9001` | Bucket/admin UI |
| MLflow | `http://192.168.1.109:5000` | Experiment tracking and model registry |
| MLOps runner | PC3 Docker container | DVC/Deepchecks/training runtime |

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

## Next Phase

The next phase should add ClickHouse-backed data assets:

- `order_facts`
- `ml_predictions`
- dataset export scripts
- Airflow DAGs for dataset snapshot, validation, training, and inference
