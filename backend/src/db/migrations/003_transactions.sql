-- backend\src\db\migrations\003_transactions.sql

-- ======================================
-- 003_transactions.sql
-- Financial transactions (double-entry compatible)
-- ======================================

BEGIN;

-- ======================================
-- TRANSACTIONS (logical group)
-- ======================================

CREATE TABLE transactions (
  transaction_id SERIAL PRIMARY KEY,
 -- 🔑 FK:ASOCIATION WITH THE USER (CASCADE)  
  user_id UUID NOT NULL REFERENCES users(user_id)
    ON DELETE CASCADE
    ON UPDATE CASCADE,

   description TEXT,
   amount DECIMAL(15,2) NOT NULL, 
   movement_type_id INTEGER NOT NULL
    REFERENCES movement_types(movement_type_id)
    ON DELETE RESTRICT
    ON UPDATE CASCADE,

   transaction_type_id INTEGER NOT NULL
    REFERENCES transaction_types(transaction_type_id)
    ON DELETE RESTRICT
    ON UPDATE CASCADE,
   -- transaction_type VARCHAR(50) NOT NULL,
   currency_id INTEGER NOT NULL REFERENCES currencies(currency_id)
    ON DELETE RESTRICT
    ON UPDATE CASCADE,

-- 🔴 FK WITH CASCADE
   account_id INTEGER NOT NULL
   REFERENCES user_accounts(account_id)
   ON DELETE CASCADE ON UPDATE CASCADE
   ,

   account_balance_after_tr DECIMAL(15,2) NOT NULL DEFAULT 0.00,

-- ✅ FKs OF TRANSFER (ON DELETE CASCADE)
   source_account_id INT
    REFERENCES user_accounts(account_id)
     ON DELETE CASCADE ON UPDATE CASCADE,
   destination_account_id INT
    REFERENCES user_accounts(account_id)
     ON DELETE CASCADE ON UPDATE CASCADE,

   status TEXT NOT NULL, 
   
   transaction_actual_date TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
   created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ==================================
-- TRANSACTION ENTRIES (double-entry)
-- ======================================

-- CREATE TABLE transaction_entries (
--   entry_id SERIAL PRIMARY KEY,

--   transaction_id UUID NOT NULL
--     REFERENCES transactions(transaction_id)
--     ON DELETE CASCADE,

--   account_id INT NOT NULL
--     REFERENCES user_accounts(account_id)
--     ON DELETE RESTRICT,

--   amount DECIMAL(15,2) NOT NULL,

--   entry_type VARCHAR(10) CHECK (entry_type IN ('debit', 'credit')),

--   created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
-- );

COMMIT;
