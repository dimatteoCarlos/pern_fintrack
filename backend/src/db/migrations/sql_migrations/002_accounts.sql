--backend\src\db\migrations\002_accounts.sql

-- ======================================
-- 002_accounts.sql
-- Core user and account domain tables
-- Depends on:
-- 001_init.sql (catalog / reference tables)
-- ======================================

BEGIN;

-- ======================================
-- USERS
-- ======================================
-- Core user table
-- Depends on:
-- - currencies
-- - user_roles
-- ======================================

CREATE TABLE users (
  user_id UUID PRIMARY KEY ,--PRIMARY KEY = UNIQUE + NOT NULL
  username VARCHAR(50) UNIQUE NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,

  user_firstname VARCHAR(25) NOT NULL,
  user_lastname  VARCHAR(25) NOT NULL,
  user_contact   VARCHAR(25),

  password_hashed VARCHAR(255) NOT NULL,

  currency_id INT REFERENCES currencies(currency_id)
    ON DELETE SET NULL
    ON UPDATE CASCADE,

  google_id VARCHAR(255) UNIQUE,
  display_name VARCHAR(255),

  auth_method VARCHAR(50) DEFAULT 'password',

  user_role_id INT REFERENCES user_roles(user_role_id)
    ON DELETE SET NULL
    ON UPDATE CASCADE,

  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMPTZ DEFAULT NULL
);

-- ======================================
-- USER ACCOUNTS (base table)
-- ======================================
-- Polymorphic base for all account types
-- Depends on:
-- - users
-- - account_types
-- - currencies
-- ======================================

CREATE TABLE user_accounts (
  account_id SERIAL PRIMARY KEY,

  user_id UUID NOT NULL REFERENCES users(user_id)
    ON DELETE CASCADE
    ON UPDATE CASCADE,

  account_name VARCHAR(50) NOT NULL,

  account_type_id INT REFERENCES account_types(account_type_id)
    ON DELETE SET NULL
    ON UPDATE CASCADE,

  currency_id INT NOT NULL REFERENCES 
  currencies(currency_id)
    ON DELETE RESTRICT
    ON UPDATE CASCADE,

  account_starting_amount DECIMAL(15,2) NOT NULL,
  account_balance DECIMAL(15,2) NOT NULL DEFAULT 0.00,

  note VARCHAR(155),

  account_start_date TIMESTAMPTZ NOT NULL,

  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMPTZ DEFAULT NULL
);

-- ======================================
-- ACCOUNT SPECIALIZATIONS
-- Each table extends user_accounts (1:1)
-- ======================================

-- --------------------------------
-- Income source accounts
-- --------------------------------

CREATE TABLE income_source_accounts (
  account_id INT PRIMARY KEY
    REFERENCES user_accounts(account_id)
    ON DELETE CASCADE,

  account_starting_amount DECIMAL(15,2),

  currency_id INT REFERENCES currencies(currency_id)
    ON DELETE SET NULL
    ON UPDATE CASCADE,

  account_start_date TIMESTAMPTZ NOT NULL
);

-- --------------------------------
-- Category budget accounts (expenses)
-- --------------------------------

CREATE TABLE category_budget_accounts (
  account_id INT PRIMARY KEY
    REFERENCES user_accounts(account_id)
    ON DELETE CASCADE,

  category_name VARCHAR(50) NOT NULL,

  category_nature_type_id INT
    REFERENCES category_nature_types(category_nature_type_id),

  subcategory VARCHAR(25),

  budget DECIMAL(15,2),

  currency_id INT REFERENCES currencies(currency_id)
    ON DELETE SET NULL
    ON UPDATE CASCADE,

  account_start_date TIMESTAMPTZ NOT NULL
);

-- --------------------------------
-- Debtor accounts
-- --------------------------------

CREATE TABLE debtor_accounts (
  account_id INT PRIMARY KEY
    REFERENCES user_accounts(account_id)
    ON DELETE CASCADE,

  value DECIMAL(15,2),

  currency_id INT REFERENCES currencies(currency_id)
    ON DELETE SET NULL
    ON UPDATE CASCADE,

  debtor_name VARCHAR(25),
  debtor_lastname VARCHAR(25),

  selected_account_id  INT REFERENCES user_accounts(account_id)
    ON DELETE SET NULL,

  selected_account_name VARCHAR(50),

  account_start_date TIMESTAMPTZ NOT NULL
);

-- --------------------------------------
-- Pocket saving accounts
-- --------------------------------------

CREATE TABLE pocket_saving_accounts (
  account_id INT PRIMARY KEY
    REFERENCES user_accounts(account_id)
    ON DELETE CASCADE,

  target DECIMAL(15,2),

  currency_id INT REFERENCES currencies(currency_id)
    ON DELETE SET NULL
    ON UPDATE CASCADE,

  note VARCHAR(155),

  desired_date TIMESTAMPTZ NOT NULL,
  account_start_date TIMESTAMPTZ NOT NULL
);

COMMIT;
