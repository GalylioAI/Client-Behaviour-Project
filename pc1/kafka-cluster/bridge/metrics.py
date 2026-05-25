import time

from config import WORKER_ID


_metrics = {
    "events_received_total": 0,
    "events_sent_total": 0,
    "events_failed_total": 0,
    "events_dead_letter_total": 0,
    "batches_received_total": 0,
    "geo_lookups_total": 0,
    "geo_cache_hits_total": 0,
    "kafka_errors_total": 0,
    "kafka_send_timeouts_total": 0,
    "kafka_producer_restarts_total": 0,
    "events_auth_rejected_total": 0,
    "last_event_sent_unix": 0,
    "last_kafka_error_unix": 0,
}
_start_time = time.time()


def inc(key: str, amount: int = 1):
    _metrics[key] += amount


def set_metric(key: str, value: float):
    _metrics[key] = value


def snapshot() -> dict:
    return dict(_metrics)


def prometheus_text() -> str:
    descriptions = {
        "events_received_total": ("counter", "Total events received by the webhook"),
        "events_sent_total": ("counter", "Total events successfully sent to Kafka"),
        "events_failed_total": ("counter", "Total events that failed validation or Kafka send"),
        "events_dead_letter_total": ("counter", "Total events sent to dead letter topic"),
        "batches_received_total": ("counter", "Total webhook requests received"),
        "geo_lookups_total": ("counter", "Total IP geolocation lookups performed"),
        "geo_cache_hits_total": ("counter", "Total IP geolocation cache hits"),
        "kafka_errors_total": ("counter", "Total Kafka send errors"),
        "kafka_send_timeouts_total": ("counter", "Total Kafka send timeouts"),
        "kafka_producer_restarts_total": ("counter", "Total Kafka producer resets or restarts"),
        "events_auth_rejected_total": ("counter", "Total events rejected by tenant/site/key validation"),
        "last_event_sent_unix": ("gauge", "Unix timestamp of the last successful Kafka send"),
        "last_kafka_error_unix": ("gauge", "Unix timestamp of the last Kafka send error"),
    }
    lines = []
    for key, (mtype, help_text) in descriptions.items():
        metric_name = f"bridge_{key}"
        lines.append(f"# HELP {metric_name} {help_text}")
        lines.append(f"# TYPE {metric_name} {mtype}")
        lines.append(f'{metric_name}{{worker="{WORKER_ID}"}} {_metrics[key]}')

    lines.append("# HELP bridge_uptime_seconds Seconds since this worker started")
    lines.append("# TYPE bridge_uptime_seconds gauge")
    lines.append(f'bridge_uptime_seconds{{worker="{WORKER_ID}"}} {time.time() - _start_time:.1f}')

    return "\n".join(lines) + "\n"
