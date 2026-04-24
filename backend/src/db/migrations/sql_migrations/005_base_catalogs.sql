-- backend\src\db\seeds\001_base_catalogs.sql
-- ======================================
-- Seed 001: Base catalog data
-- Purpose:
-- Populate static reference tables required
-- for the application to operate.
-- ======================================

BEGIN;

-- -----------------------
-- CURRENCIES
-- -----------------------
INSERT INTO currencies (currency_id, currency_code, currency_name) VALUES
  (1, 'usd', 'US Dollar'),
  (2, 'eur', 'Euro'),
  (3, 'cop', 'Pesos col')
ON CONFLICT (currency_id) DO NOTHING;

-- -----------------------
-- USER ROLES
-- -----------------------
INSERT INTO user_roles (user_role_id, user_role_name) VALUES
  (1, 'user'),
  (2, 'admin'),
  (3, 'super_admin'),
  (4, 'system_admin')
ON CONFLICT (user_role_id) DO NOTHING;

-- -----------------------
-- ACCOUNT TYPES
-- -----------------------
INSERT INTO account_types (account_type_id, account_type_name) VALUES
  (1, 'bank'),
  (2, 'investment'),
  (3, 'debtor'),
  (4, 'pocket_saving'),
  (5, 'category_budget'),
  (6, 'income_source'),
  (7, 'cash')
ON CONFLICT (account_type_id) DO NOTHING;

-- -----------------------
-- CATEGORY NATURE TYPES
-- -----------------------
INSERT INTO category_nature_types (category_nature_type_id, category_nature_type_name) VALUES
  (1, 'must'),
  (2, 'need'),
  (3, 'other'),
  (4, 'want')
ON CONFLICT (category_nature_type_id) DO NOTHING;

-- -----------------------
-- MOVEMENT TYPES
-- -----------------------
INSERT INTO movement_types (movement_type_id, movement_type_name) VALUES
  (1, 'expense'),
  (2, 'income'),
  (3, 'investment'),
  (4, 'debt'),
  (5, 'pocket'),
  (6, 'transfer'),
  (7, 'receive'),
  (8, 'account-opening'),
  (9, 'pnl')
ON CONFLICT (movement_type_id) DO NOTHING;

-- -----------------------
-- TRANSACTION TYPES
-- -----------------------
INSERT INTO transaction_types (transaction_type_id, transaction_type_name) VALUES
  (1, 'withdraw'),
  (2, 'deposit'),
  (3, 'lend'),
  (4, 'borrow'),
  (5, 'account-opening')
ON CONFLICT (transaction_type_id) DO NOTHING;

COMMIT;

