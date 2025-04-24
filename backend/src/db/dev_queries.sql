

-- SELECT * FROM debtor_accounts
-- SELECT * FROM account_types
-- SELECT * FROM pocket_saving_accounts
-- SELECT * FROM category_budget_accounts
-- SELECT * FROM account_types
-- SELECT * FROM user_accounts
-- SELECT * FROM transactions
-- SELECT * FROM expense_categories
-- SELECT * FROM income_source_accounts
-- SELECT * FROM movements
-- SELECT * FROM movements
-- SELECT * FROM expense_movements
-- SELECT * FROM pocket_movements
-- SELECT * FROM income_movements
-- SELECT * FROM investment_movements
-- SELECT * FROM debt_movements
-- SELECT * FROM debt_debtors
-- SELECT * FROM bank_accounts



-- TRUNCATE TABLE user_accounts
-- WHERE account_type_name = 'category_budget'

-- CREATE TABLE IF NOT EXISTS investment_accounts(account_id INT PRIMARY KEY REFERENCES user_accounts(account_id), initial_deposit DECIMAL (15,2),account_start_date TIMESTAMP NOT NUL)
-- CREATE UNIQUE INDEX  index_currency_code ON currencies(currency_code)
-- CREATE UNIQUE INDEX index_account_type_name ON account_types(account_type_name)

-- CREATE UNIQUE INDEX idx_currency_code ON currencies (currency_code);
 -- SELECT * FROM user_accounts
-- SELECT * FROM pocket_saving_accounts
-- ALTER TABLE pocket_saving_accounts 
-- ADD COLUMN  desired_date TIMESTAMPTZ NOT NULL
-- SELECT * FROM debtor_accounts
-- ALTER TABLE debtor_accounts
-- ADD COLUMN debtor_transaction_type_name VARCHAR(15)
-- SELECT * FROM user_accounts;
-- - SELECT * FROM debtor_accounts, pocket_saving_accounts
-- DROP TABLE user_accounts
-- DROP TABLE debtor_accounts
-- CREATE TABLE IF NOT EXISTS pocket_saving_accounts (account_id INT PRIMARY KEY REFERENCES user_accounts(account_id), target DECIMAL(15, 2))


-- CREATE TABLE IF NOT EXISTS debtor_accounts (
--          account_id INT PRIMARY KEY REFERENCES user_accounts(account_id),
--          value DECIMAL(15, 2),
--          debtor_name VARCHAR(25),
--          debtor_lastname VARCHAR(25),
--          selected_account_name VARCHAR(50),
--           selected_account_id INT
--      )
-- SELECT * FROM category_nature_types
-- SELECT * FROM debtor_accounts
-- SELECT * FROM investment_accounts

-- SELECT * FROM category_nature_types
-- SELECT * FROM category_budget_accounts
-- ALTER TABLE category_budget_accounts
-- ADD COLUMN category_name VARCHAR(15)
-- DROP TABLE source_accounts
-- SELECT * FROM bank_accounts
-- SELECT * FROM user_accounts
-- SELECT * FROM account_types

-- ALTER TABLE user_accounts
-- ADD COLUMN account_type_id
-- DROP TABLE account_types
-- DROP TABLE user_accounts
-- DROP TABLE income_sources
-- DROP TABLE income_sources
-- SELECT * FROM source_accounts
-- SELECT * FROM income_source_types
-- SELECT * FROM category_nature_types
-- SELECT * FROM account_types
-- DROP table source_accounts

-- CREATE TABLE IF NOT EXISTS user_accounts (
-- account_id SERIAL PRIMARY KEY NOT NULL, 
-- user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE ON UPDATE CASCADE,
-- account_name VARCHAR(50) NOT NULL,
-- account_type_id INT  REFERENCES account_types(account_type_id) ON DELETE SET NULL ON UPDATE CASCADE, 
-- currency_id INT NOT NULL REFERENCES currencies(currency_id) ON DELETE RESTRICT ON UPDATE CASCADE, 
--  account_starting_amount DECIMAL(15,2) NOT NULL,
--  account_balance DECIMAL(15,2) NOT NULL DEFAULT 0.00,
--     account_start_date TIMESTAMPTZ NOT NULL CHECK (account_start_date <= NOW()), 
--     created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
--     updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
-- )

-- DROP TABLE user_accounts
-- CREATE TABLE IF NOT EXISTS income_sources (
--     source_id SERIAL PRIMARY KEY NOT NULL,
--      user_id UUID NOT NULL REFERENCES "users"(user_id) ON DELETE CASCADE ON UPDATE CASCADE,
--     source_name VARCHAR(50) NOT NULL)

-- DROP TABLE income_sources

-- SELECT * FROM income_sources
-- SELECT * FROM expense_movements
-- SELECT * FROM transactions
-- SELECT * FROM user_accounts
-- SELECT * FROM debt_debtors
-- SELECT * FROM debt_debtors
-- SELECT * FROM transaction_types
-- SELECT * FROM movements
-- SELECT * FROM movement_types
-- SELECT * FROM account_types
-- DROP TABLE debt_debtors

-- CREATE TABLE IF NOT EXISTS income_sources (
--     source_id SERIAL PRIMARY KEY NOT NULL,
--     source_name VARCHAR(50) NOT NULL
-- )
-- SELECT * FROM income_sources
-- CREATE TABLE IF NOT EXISTS user_accounts (
-- account_id SERIAL PRIMARY KEY NOT NULL, 
-- user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE ON UPDATE CASCADE,
-- account_name VARCHAR(50) NOT NULL,
-- account_type_id INT  REFERENCES account_types(account_type_id) ON DELETE SET NULL ON UPDATE CASCADE, 
-- currency_id INT NOT NULL REFERENCES currencies(currency_id) ON DELETE RESTRICT ON UPDATE CASCADE, 
--  account_starting_amount DECIMAL(15,2) NOT NULL,
--  account_balance DECIMAL(15,2) NOT NULL DEFAULT 0.00,
--     account_start_date TIMESTAMPTZ NOT NULL CHECK (account_start_date <= NOW()) , 
--     created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
--     updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
-- )
-- SELECT * from user_accounts
-- SELECT COUNT(*) FROM movement_types
-- SELECT * FROM  movement_types

-- DROP TABLE movement_types
-- CREATE TABLE movement_types (
-- movement_type_id SERIAL PRIMARY KEY NOT NULL, movement_type_name VARCHAR(15) NOT NULL CHECK (movement_type_name IN ('expense', 'income', 'investment', 'debt', 'pocket', 'transfer', 'receive')
-- ))
-- DROP TABLE account_types
-- SELECT * FROM account_types
-- SELECT * FROM user_roles
-- SELECT * FROM currencies
-- SELECT * FROM users


-- DROP TABLE movement_types
-- SELECT * FROM  movement_types
-- SELECT * from user_accounts
-- SELECT * from transaction_types

-- ALTER TABLE movement_types
-- DROP CONSTRAINT movement_types_movement_type_name_check

-- ALTER TABLE movement_types
-- ADD CONSTRAINT movment_types_movement_type_name_check
-- CHECK (movement_type_name IN ('expense', 'income', 'investment', 'debt', 'pocket', 'transfer', 'receive'));

-- SELECT constraint_name
-- FROM information_schema.table_constraints
-- WHERE table_name = 'movement_types' AND constraint_type = 'CHECK';
-- SELECT * FROM movement_types
--  movements_movement_type_id_fkey
-- DROP TABLE movement_types
-- DROP TABLE movements

-- ALTER TABLE transactions
-- ADD CONSTRAINT REFERENES user_accounts(account_id) ON DELETE SET NULL ON UPDATE CASCADE,
-- FOREIGN KEY account_id
-- REFERENCES tabla_destino (columna_destino);

-- DROP TABLE transactions

-- SELECT * FROM currencies
-- SELECT * FROM user_accounts
-- SELECT * FROM account_types
------------UPDATE ------------
-- UPDATE transactions SET destination_account_id = 7 WHERE transaction_id = 33 AND user_id ='430e5635-d1e6-4f53-a104-5575c6e60c81' 
-- UPDATE category_budget_accounts SET budget =125 WHERE account_id = 14
-- SELECT * FROM transactionS
-- ALTER TABLE transactions
-- DROP CONSTRAINt destination_account_id_fkey

-- SELECT * FROM transaction_types
-- INSERT INTO transaction_types(transaction_type_name) VALUES('withdraw'), ('deposit'), ('lend'),( 'borrow')

-- TRUNCATE TABLE transaction_types 
-- DROP TABLE transaction_types

-- CREATE TABLE IF NOT EXISTS transaction_types(
-- transaction_type_id SERIAL PRIMARY KEY NOT NULL,
-- transation_type_name VARCHAR(10) NOT NULL
-- )

-- CHECK(transation_type_name IN ('withdraw', 'deposit', 'lend', 'borrow'))
-- SELECT * FROM  account_types act, movement_types mt
-- SELECT * FROM account_types act
-- JOIN movement_types mt ON 
-- SELECT * FROM transactions

-- ALTER TABLE transactions
-- ADD COLUMN destination_account_id INT REFERENCES user_accounts(account_id) ON DELETE SET NULL ON UPDATE CASCADE
--  RENAME account_id TO source_account_id
-- ADD COLUMN transaction_type_id INTEGER
-- ADD COLUMN transaction_actual_date TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP


-- SELECT * FROM user_accounts ua 
-- JOIN account_types act ON ua.account_type_id = act.account_type_id
-- WHERE user_id = '430e5635-d1e6-4f53-a104-5575c6e60c81'
-- ORDER BY ua.account_type_id, ua.account_id ASC, ua.created_at DESC
-- GROUP BY act.account_type_id

-- SELECT * FROM transactions ORDER BY movement_type_id ASC, amount DESC


-- SELECT EXTRACT(MONTH FROM tr.created_at) AS month, 
-- tr.movement_type_id, mt.movement_type_name, 
-- SUM(tr.amount) AS totalAmount
-- FROM transactions tr
-- JOIN movement_types mt ON tr.movement_type_id = mt.movement_type_id
-- WHERE user_id = '430e5635-d1e6-4f53-a104-5575c6e60c81'
-- AND created_at BETWEEN '2024-01-01' AND '2025-12-31'
-- GROUP BY
-- EXTRACT(MONTH FROM created_at), tr.movement_type_id, mt.movement_type_name
-- ORDER BY month DESC

-- ALTER TABLE transactions
-- ADD COLUMN transaction_type_id INTEGER

-- SELECT * FROM transactions
-- SELECT  tr.movement_type_id as id_type, mt.movement_type_name as name_type, CAST (SUM(tr.amount) AS DECIMAL) AS totalAmount
-- FROM transactions tr
-- JOIN movement_types AS mt ON tr.movement_type_id = mt.movement_type_id
-- WHERE tr.user_id='430e5635-d1e6-4f53-a104-5575c6e60c81'
-- GROUP BY tr.movement_type_id, mt.movement_type_name
-- ORDER BY mt.movement_type_name

-- UPDATE transactions SET movement_type_id = 4 WHERE transaction_id = 13
-- UPDATE TRANSACTIONS SET MOVEMENT_TYPE_ID = 1 WHERE TRANSACTION_ID = 20
-- SELECT * FROM user_accounts WHERE user_id ='430e5635-d1e6-4f53-a104-5575c6e60c81'
-- AND account_id = 2

-- SELECT * FROM user_accounts ORDER BY account_id
-- TRUNCATE  transactions
-- TRUNCATE  user_accounts,transactions

-- UPDATE user_accounts SET account_balance = (account_balance+ 2000), currency_id = 1, updated_at = CURRENT_TIMESTAMP 
-- WHERE user_id = '430e5635-d1e6-4f53-a104-5575c6e60c81' AND account_id=2
-- RETURNING *;

-- TRUNCATE transactions

-- SELECT * FROM transactions
-- ALTER TABLE transactions
-- RENAME COLUMN create_at TO created_at

-- CREATE TABLE IF NOT EXISTS transactions(
-- transaction_id SERIAL PRIMARY KEY,
-- user_id UUID NOT NULL,
-- description TEXT,
-- amount DECIMAL(15,2) NOT NULL, 
-- movement_type_id INTEGER NOT NULL,
-- transaction_type_id INTEGER NOT NULL,
-- currency_id INTEGER NOT NULL, 
--  source_account_id INT  REFERENCES user_accounts(account_id) ON DELETE SET NULL ON UPDATE CASCADE,
-- destination_account_id INT  , 
-- status VARCHAR(50) NOT NULL, 
-- transaction_actual_date TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
-- created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
-- )

-- DROP TABLE transactions
-- CREATE TABLE IF NOT EXISTS transactions(
-- transaction_id SERIAL PRIMARY KEY,
-- user_id UUID NOT NULL,
-- description TEXT,
-- movement_type_id INTEGER NOT NULL,
-- status VARCHAR(50) NOT NULL, 
-- amount DECIMAL(15,2) NOT NULL, 
-- currency_id INTEGER NOT NULL, 
-- account_id INT  REFERENCES user_accounts(account_id) ON DELETE SET NULL ON UPDATE CASCADE, 
-- account_name VARCHAR(100) NOT NULL, 
-- create_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
-- )
-- ALTER TABLE transactions
-- DROP COLUMN account_name 
-- ALTER TABLE user_accounts 

-- Select * from user_accounts WHERE user_id = '430e5635-d1e6-4f53-a104-5575c6e60c81'
-- SELECT * FROM account_types WHERE account_type_name = 'investment'
-- SELECT * FROM account_types 
-- SELECT account_type_id FROM account_types WHERE account_type_id = 3
-- SELECT * FROM user_accounts WHERE user_id ='430e5635-d1e6-4f53-a104-5575c6e60c81'
-- AND account_type_id = 2
-- Select * from user_accounts WHERE user_id = '430e5635-d1e6-4f53-a104-5575c6e60c81'
-- SELECT * FROM account_types WHERE account_type_name = 'investment'
-- SELECT account_type_id FROM account_types WHERE account_type_id = 3
-- SELECT * FROM user_accounts WHERE user_id ='430e5635-d1e6-4f53-a104-5575c6e60c81' AND account_type_id = 2


 -- COPIAR E INSERTAR
--  INSERT INTO user_accounts(user_id,account_name,account_type_id,currency_id,account_starting_amount,account_balance,account_start_date)
-- SELECT 	user_id,account_name,account_type_id,2,account_starting_amount,550 AS account_balance,account_start_date
-- FROM user_accounts
-- WHERE account_id = 37

