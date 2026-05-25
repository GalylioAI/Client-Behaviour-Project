USE tracer;

-- Deterministic purchase-intent scoring for Layer 2 session and visitor features.
-- The scoring is transparent today and can later become the training target
-- comparison baseline for an ML purchase propensity model.

ALTER TABLE session_features ADD COLUMN IF NOT EXISTS purchase_intent_score Float64 DEFAULT 0;
ALTER TABLE session_features ADD COLUMN IF NOT EXISTS purchase_intent_tier LowCardinality(String) DEFAULT 'cold';
ALTER TABLE session_features ADD COLUMN IF NOT EXISTS purchase_intent_reason String DEFAULT '';

ALTER TABLE visitor_features ADD COLUMN IF NOT EXISTS purchase_intent_score Float64 DEFAULT 0;
ALTER TABLE visitor_features ADD COLUMN IF NOT EXISTS purchase_intent_tier LowCardinality(String) DEFAULT 'cold';
ALTER TABLE visitor_features ADD COLUMN IF NOT EXISTS purchase_intent_reason String DEFAULT '';
