--backend\src\db\migrations\sql_migrations\006_exchange_rates.sql
-- ============================================
-- Migration 004: Create exchange_rates table (FX cache)
-- ============================================

BEGIN;

CREATE TABLE IF NOT EXISTS exchange_rates (
    rate_id SERIAL PRIMARY KEY,
    base_currency_id INTEGER NOT NULL REFERENCES currencies(currency_id) ON DELETE RESTRICT ON UPDATE CASCADE,
    target_currency_id INTEGER NOT NULL REFERENCES currencies(currency_id) ON DELETE RESTRICT ON UPDATE CASCADE,
    exchange_rate DECIMAL(18,8) NOT NULL CHECK (exchange_rate > 0),
    source VARCHAR(30) NOT NULL,
    fetched_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    provider_updated_at TIMESTAMPTZ,
    UNIQUE (base_currency_id, target_currency_id)
);

COMMIT;