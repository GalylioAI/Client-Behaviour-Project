USE tracer;

ALTER TABLE product_daily_metrics
    ADD COLUMN IF NOT EXISTS product_url String DEFAULT '' AFTER product_name;
