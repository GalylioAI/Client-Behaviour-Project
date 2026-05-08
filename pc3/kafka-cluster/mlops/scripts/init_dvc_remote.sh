#!/usr/bin/env sh
set -eu

WORKSPACE="${DVC_WORKSPACE:-/workspace/runtime/dvc-workspace}"
REMOTE_NAME="${DVC_REMOTE_NAME:-minio}"
REMOTE_URL="${DVC_REMOTE_URL:-s3://dvc}"
ENDPOINT_URL="${MLFLOW_S3_ENDPOINT_URL:-${MLOPS_MINIO_ENDPOINT:-http://192.168.1.106:9002}}"

mkdir -p "$WORKSPACE"
cd "$WORKSPACE"

dvc init --no-scm -f
dvc config core.analytics false
dvc remote remove "$REMOTE_NAME" >/dev/null 2>&1 || true
dvc remote add -d "$REMOTE_NAME" "$REMOTE_URL"
dvc remote modify "$REMOTE_NAME" endpointurl "$ENDPOINT_URL"
dvc remote modify "$REMOTE_NAME" access_key_id "${AWS_ACCESS_KEY_ID:-minioadmin}"
dvc remote modify "$REMOTE_NAME" secret_access_key "${AWS_SECRET_ACCESS_KEY:-minioadmin123}"
dvc remote modify "$REMOTE_NAME" use_ssl false

echo "DVC workspace ready at $WORKSPACE"
echo "Default remote: $REMOTE_NAME -> $REMOTE_URL ($ENDPOINT_URL)"
