-- backend\src\db\migrations\sql_migrations\008_update_currencies.sql

-- migration 008_update_currencies.sql
INSERT INTO currencies (currency_id, currency_code, currency_name)
VALUES (4, 'ves', 'Bs'),(5, 'mxn', 'Pesos mxn')
ON CONFLICT (currency_id) DO UPDATE SET
  currency_code = EXCLUDED.currency_code,
  currency_name = EXCLUDED.currency_name;