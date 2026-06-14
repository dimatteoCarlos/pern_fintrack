-- 009_backfill_fx_metadata.sql
-- Actualiza transacciones antiguas que tienen FX metadata nulo o por defecto
-- Asigna valores coherentes a partir de amount y currency_id

UPDATE transactions
SET 
  original_amount = amount,
  original_currency_id = currency_id,
  exchange_rate = 1,
  exchange_rate_source = 'identity',
  exchange_rate_timestamp = transaction_actual_date,
  exchange_rate_target_currency_id = 1  -- asumiendo que USD tiene currency_id = 1
WHERE 
  (original_amount = 0 OR original_amount IS NULL)
  AND (exchange_rate = 1 OR exchange_rate IS NULL)
  AND exchange_rate_source = 'identity';