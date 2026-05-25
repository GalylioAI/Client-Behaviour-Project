import json
import asyncio
import time
from datetime import datetime, timezone

from aiokafka import AIOKafkaProducer

from config import (
    DEAD_LETTER_TOPIC,
    KAFKA_BROKERS,
    KAFKA_PRODUCER_START_TIMEOUT_SECONDS,
    KAFKA_SEND_TIMEOUT_SECONDS,
    WORKER_ID,
    log,
)
from metrics import inc, set_metric


producer: AIOKafkaProducer | None = None
producer_lock = asyncio.Lock()


class KafkaSendTimeout(TimeoutError):
    pass


async def get_producer() -> AIOKafkaProducer:
    global producer
    if producer is not None:
        return producer

    async with producer_lock:
        if producer is not None:
            return producer

        new_producer = AIOKafkaProducer(
            bootstrap_servers=KAFKA_BROKERS,
            value_serializer=lambda v: json.dumps(v).encode("utf-8"),
            key_serializer=lambda k: k.encode("utf-8") if k else None,
            acks="all",
            enable_idempotence=True,
            max_batch_size=65536,
            linger_ms=10,
            retry_backoff_ms=300,
            request_timeout_ms=int(KAFKA_SEND_TIMEOUT_SECONDS * 1000),
        )
        await asyncio.wait_for(
            new_producer.start(),
            timeout=KAFKA_PRODUCER_START_TIMEOUT_SECONDS,
        )
        producer = new_producer
        log.info("Kafka producer started | worker=%s brokers=%s", WORKER_ID, KAFKA_BROKERS)
        return producer


async def reset_producer(reason: str):
    global producer
    async with producer_lock:
        old_producer = producer
        producer = None

        if old_producer is not None:
            try:
                await asyncio.wait_for(old_producer.stop(), timeout=5)
            except Exception as exc:
                log.warning("Kafka producer stop failed during reset | worker=%s reason=%s error=%s", WORKER_ID, reason, exc)

        inc("kafka_producer_restarts_total")
        log.warning("Kafka producer reset | worker=%s reason=%s", WORKER_ID, reason)


async def _send_with_timeout(topic: str, value: dict, key: str | None = None):
    p = await get_producer()
    try:
        await asyncio.wait_for(
            p.send_and_wait(topic, value=value, key=key),
            timeout=KAFKA_SEND_TIMEOUT_SECONDS,
        )
        set_metric("last_event_sent_unix", time.time())
    except asyncio.TimeoutError as exc:
        inc("kafka_send_timeouts_total")
        set_metric("last_kafka_error_unix", time.time())
        await reset_producer(f"send timeout after {KAFKA_SEND_TIMEOUT_SECONDS:.1f}s")
        raise KafkaSendTimeout(f"Kafka send timed out after {KAFKA_SEND_TIMEOUT_SECONDS:.1f}s") from exc
    except Exception:
        set_metric("last_kafka_error_unix", time.time())
        await reset_producer("send failed")
        raise


async def send_to_kafka(event: dict, topic: str, key: str | None = None):
    try:
        await _send_with_timeout(topic, event, key=key)
    except Exception:
        # A fresh producer often recovers after a Kafka leader/controller change.
        await _send_with_timeout(topic, event, key=key)


async def send_to_dead_letter(event: dict, reason: str):
    dead = {
        "original_event": event,
        "dead_letter_reason": reason,
        "dead_letter_at": datetime.now(timezone.utc).isoformat(),
    }
    try:
        await _send_with_timeout(DEAD_LETTER_TOPIC, dead)
        inc("events_dead_letter_total")
        event_type = event.get("event_type", "?") if isinstance(event, dict) else type(event).__name__
        log.warning("Dead letter | reason=%s type=%s", reason, event_type)
    except Exception as exc:
        log.error("DEAD LETTER FAILED | reason=%s error=%s event=%s", reason, exc, json.dumps(event))


async def stop_producer():
    global producer
    if producer:
        await asyncio.wait_for(producer.stop(), timeout=5)
        log.info("Producer stopped | worker=%s", WORKER_ID)
        producer = None
