--backend\src\db\migrations\sql_migrations\007_transactions_fx_columns.sql

-- ============================================
-- Migration 005: Add FX audit columns to transactions
-- ============================================

BEGIN;

-- Add columns (idempotent)
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS original_amount DECIMAL(15,2) NOT NULL DEFAULT 0;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS original_currency_id INTEGER NOT NULL DEFAULT 1;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS exchange_rate DECIMAL(18,8) NOT NULL DEFAULT 1.0 CHECK (exchange_rate > 0);
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS exchange_rate_source VARCHAR(60) NOT NULL DEFAULT 'identity';
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS exchange_rate_timestamp TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS exchange_rate_target_currency_id INTEGER NOT NULL DEFAULT 1;

-- Add foreign keys (if not exist)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'transactions_original_currency_id_fkey') THEN
        ALTER TABLE transactions ADD CONSTRAINT transactions_original_currency_id_fkey
            FOREIGN KEY (original_currency_id) REFERENCES currencies(currency_id)
            ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'transactions_exchange_rate_target_currency_id_fkey') THEN
        ALTER TABLE transactions ADD CONSTRAINT transactions_exchange_rate_target_currency_id_fkey
            FOREIGN KEY (exchange_rate_target_currency_id) REFERENCES currencies(currency_id)
            ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
END
$$;

COMMIT;