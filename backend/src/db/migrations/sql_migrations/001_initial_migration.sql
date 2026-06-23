-- backend\src\db\migrations\001_initial_migration.sql
/*--MIGRATION CONTROL TABLE--*/

-- ============================
-- Migration 001: Initial base tables
-- ============================

BEGIN;

-- Control table
CREATE TABLE IF NOT EXISTS migrations (
  id SERIAL PRIMARY KEY,
  filename TEXT NOT NULL UNIQUE,
  executed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ===== Base reference tables =====

CREATE TABLE IF NOT EXISTS currencies (
  currency_id INT PRIMARY KEY,
  currency_code VARCHAR(3) NOT NULL UNIQUE,
  currency_name VARCHAR(25) NOT NULL
);

CREATE TABLE IF NOT EXISTS account_types (
  account_type_id INT PRIMARY KEY,
  account_type_name VARCHAR(50) NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS category_nature_types (
  category_nature_type_id INT PRIMARY KEY,
  category_nature_type_name VARCHAR(15) NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS movement_types (
  movement_type_id INT PRIMARY KEY,
  movement_type_name VARCHAR(50) NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS transaction_types (
  transaction_type_id INT PRIMARY KEY,
  transaction_type_name VARCHAR(50) NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS user_roles(user_role_id SERIAL PRIMARY KEY  NOT NULL, user_role_name VARCHAR(15) NOT NULL CHECK (user_role_name IN ('user', 'admin', 'super_admin', 'system_admin') ) );

COMMIT;
