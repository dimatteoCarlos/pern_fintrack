--THIS QUERIES WHERE USED AS A REFERENCES, NOT ALL OF THEM WWERE USED OR EXACTLY AS THEY ARE PRESENTED HERE  

-- "Get all users' info, except for passwords and account IDs."
SELECT username, email, user_firstname,user_role_name,  currency_code FROM users 
JOIN currencies ON users.currency_id = currencies.currency_id
JOIN user_roles ON users.user_role_id = user_roles.user_role_id
ORDER BY username ASC

-- Get user by id
SELECT u.user_id, u.username,
u.email, 
u.user_firstname, 
u.user_lastname, 
u.user_contact, 
currencies.currency_name as user_currency, user_accounts.account_id , user_roles.user_role_name as user_role  FROM users u
JOIN user_accounts ON user_accounts.user_id = u.user_id
JOIN currencies ON currencies.currency_id = u.currency_id
JOIN user_roles ON user_roles.user_role_id = u.user_role_id
WHERE u.user_id = $1
ORDER BY account_id ASC

-- Check user existence by id
 SELECT 1
    FROM users u
    JOIN user_accounts ON user_accounts.user_id = u.user_id
    JOIN currencies ON currencies.currency_id = u.currency_id
    JOIN user_roles ON user_roles.user_role_id = u.user_role_id
    WHERE u.user_id = $1
    LIMIT 1.rows[0]

-- Get all user id accounts by user id 
SELECT  account_id, account_name
    account_type_id
    currency_id
    account_starting_amount
    account_balance
    account_start_date
    created_at
    updated_at
     FROM user_accounts 
    WHERE user_id = $1
    ORDER BY account_id ASC

-- Get all user account info by user id and account name,
SELECT * FROM users_accounts WHERE user_id = $1 AND account_name ILIKE $2 ORDER BY account_name;

-- {text:`SELECT * FROM users_accounts WHERE user_id = $1 AND account_name ILIKE $2  ORDER BY account_name`, values: [userId, `%${account_name}%`]}

-- get all user sources income by user id


-- get all user accounts  by user_id and account type id
SELECT * FROM user_accounts WHERE user_id ='430e5635-d1e6-4f53-a104-5575c6e60c81'
AND account_type_id = 2

-- get currency_id from currencies by currency_code
SELECT currency_id  FROM currencies WHERE currency_code= $1

-- get transactions by user_id and between start and today/end dates and search on description, status or account_id
SELECT * FROM transactions WHERE user_id=$1 AND created_at BETWEEN $2 AND $3 
      AND (description ILIKE '%'||$4||'%' OR status ILIKE '%'||$4||'%' OR CAST(account_id AS TEXT) ILIKE '%'||$4||'%')

--get the total amount of type tr, from transactions by a specific user_id,  grouped by movement_type_id
SELECT  tr.movement_type_id as id_type, mt.movement_type_name as name_type, SUM(tr.amount) AS totalAmount
FROM transactions tr
JOIN movement_types AS mt ON tr.movement_type_id = mt.movement_type_id
WHERE tr.user_id='430e5635-d1e6-4f53-a104-5575c6e60c81' //redundante
GROUP BY tr.movement_type_id, mt.movement_type_name

--get the total amount of type tr, from transactions by a specific user_id between specific dates  grouped by month and movement_type_id
SELECT EXTRACT(MONTH FROM created_at) AS month, 
tr.movement_type_id, mt.movement_type_name, 
SUM(amount) AS totalAmount
FROM transactions tr
JOIN movement_types mt ON tr.movement_type_id = mt.movement_type_id
WHERE user_id = '430e5635-d1e6-4f53-a104-5575c6e60c81'
AND created_at BETWEEN '2024-01-01' AND '2025-12-31'
GROUP BY
EXTRACT(MONTH FROM created_at), tr.movement_type_id, mt.movement_type_name


-- change the check restriction on movement_types table
ALTER TABLE movement_types
DROP CONSTRAINT movement_types_movement_type_name_check

ALTER TABLE movement_types
ADD CONSTRAINT movment_types_movement_type_name_check
CHECK (movement_type_name IN ('expense', 'income', 'investment', 'debt', 'pocket', 'transfer', 'receive'));

--get the account info from user_id, account_type_name and account_name
SELECT ua.* FROM user_accounts ua
JOIN account_types act ON ua.account_type_id = act.account_type_id
WHERE ua.user_id = '6e0ba475-bf23-4e1b-a125-3a8f0b3d352c' AND ua.account_name = $2
AND act.account_type_name = 'bank'

--usage in: accounting list . get account info for type bank and investment accounts
         SELECT ua.account_id, ua.account_name, ua.account_balance,  ct.currency_code, act.account_type_id, act.account_type_name,
          ua.account_starting_amount,  ua.account_start_date
       FROM user_accounts ua
       JOIN account_types act ON ua.account_type_id = act.account_type_id
       JOIN currencies ct ON ua.currency_id = ct.currency_id
       WHERE ua.user_id = $1
       AND act.account_type_name = $2 OR act.account_type_name=$3 AND ua.account_name != $4
       ORDER BY ua.account_name ASC, ua.account_balance DESC
       ,
      values: [userId, 'bank', 'investment', 'slack'],

--usage in: movement expense, 
--get user account name and account id by user_id and account_type_name ='bank'
SELECT ua.account_id, ua.account_name, ua.account_balance,  ct.currency_code, act.account_type_id, act.account_type_name 
FROM user_accounts ua
JOIN account_types act ON ua.account_type_id = act.account_type_id
JOIN currencies ct ON ua.currency_id = ct.currency_id
WHERE ua.user_id = $1
AND act.account_type_name = $2 AND ua.account_name != $3
ORDER BY ua.account_balance DESC


--get user account info by user_id and account_type_name ='category_budget'
SELECT ua.account_id, ua.account_name, ua.account_balance, 
act.account_type_name,
ct.currency_code, cba.budget, cnt.category_nature_type_name
FROM user_accounts ua
JOIN account_types act ON ua.account_type_id = act.account_type_id
JOIN currencies ct ON ua.currency_id = ct.currency_id
JOIN category_budget_accounts cba ON ua.account_id = cba.account_id
JOIN category_nature_types cnt ON cba.category_nature_type_id = cnt.category_nature_type_id
WHERE ua.user_id = '6e0ba475-bf23-4e1b-a125-3a8f0b3d352c'
AND act.account_type_name = 'category_budget' AND ua.account_name != 'slack'
ORDER BY ua.account_balance DESC

--ESTAN FALTANTDO: INCOME_SOURCE, INVESTMENT, POCKET_SAVING Y DEBTOR
-- get user accounts category_budget type with movement expense
SELECT ua.account_id, ua.account_name, ua.account_balance, cba.budget,  ct.currency_code,
act.account_type_id, act.account_type_name, mt.movement_type_name,
ua.account_starting_amount,  ua.account_start_date, tr.description

FROM transactions tr 
JOIN user_accounts ua ON tr.account_id = ua.account_id
       JOIN account_types act ON ua.account_type_id = act.account_type_id
       JOIN currencies ct ON ua.currency_id = ct.currency_id
       JOIN category_budget_accounts cba ON ua.account_id = cba.account_id
       JOIN movement_types mt  ON tr.movement_type_id = mt.movement_type_id
       WHERE ua.user_id = '51ba7238-31f0-4153-a80b-6709c34a1955'
       AND (act.account_type_name = 'category_budget') AND ua.account_name != 'slack'
	AND mt.movement_type_name = 'expense'
       ORDER BY tr.transaction_actual_date DESC, ua.account_balance DESC, ua.account_name ASC

--get user accounts by dynamically querying account_type as a function of movement type and correspondent table account 
   SELECT ua.account_id, ua.account_name, ua.account_balance, cba.budget, ct.currency_code,
    act.account_type_id, act.account_type_name, mt.movement_type_name,
    ua.account_starting_amount, ua.account_start_date, tr.description
  FROM transactions tr 
  JOIN user_accounts ua ON tr.account_id = ua.account_id
  JOIN account_types act ON ua.account_type_id = act.account_type_id
  JOIN currencies ct ON ua.currency_id = ct.currency_id
  JOIN category_budget_accounts cba ON ua.account_id = cba.account_id
  JOIN movement_types mt ON tr.movement_type_id = mt.movement_type_id
  WHERE ua.user_id = $2
    AND act.account_type_name = $3
    AND ua.account_name != 'slack'
    AND mt.movement_type_name = $4
  ORDER BY tr.transaction_actual_date DESC, ua.account_balance DESC, ua.account_name ASC;

  -- TOTAL DE EXPENSES MENSUAL 
  -- total month expenses by category name, and currency, the 12 months of a specific year
  WITH months AS (SELECT generate_series(1,12) AS month),
categories AS (
  
    SELECT 
        EXTRACT(MONTH FROM tr.transaction_actual_date) AS month,
        cba.category_name,
        CAST(SUM(tr.amount) AS FLOAT) AS month_total_amount,
        ct.currency_code
    FROM transactions tr
    JOIN user_accounts ua ON tr.account_id = ua.account_id
    JOIN category_budget_accounts cba ON tr.account_id = cba.account_id
    JOIN currencies ct ON tr.currency_id = ct.currency_id
    WHERE ua.user_id = 'eacef623-6fb0-4168-a27f-fa135de093e1'
      AND tr.movement_type_id = 1
      AND tr.transaction_type_id = 2
      AND tr.transaction_actual_date BETWEEN '2025-01-01' AND '2025-12-31'
    GROUP BY EXTRACT(MONTH FROM tr.transaction_actual_date), 
             cba.category_name, 
             ct.currency_code
)

SELECT 
    m.month, 
    cat.category_name, 
    COALESCE(cat.month_total_amount, 0) AS total_amount,
    cat.currency_code
FROM months m
LEFT JOIN categories cat ON m.month = cat.month
ORDER BY m.month ASC, cat.category_name, cat.currency_code
-------------------------------------------------------------------
-- get monthly expenses by category name and currency
WITH
categories AS (
    SELECT 
        EXTRACT(MONTH FROM tr.transaction_actual_date) AS month_index,
        cba.category_name,
        CAST(SUM(tr.amount) AS FLOAT) AS month_total_amount,
        ct.currency_code
    FROM transactions tr
    JOIN user_accounts ua ON tr.account_id = ua.account_id
    JOIN category_budget_accounts cba ON tr.account_id = cba.account_id
    JOIN currencies ct ON tr.currency_id = ct.currency_id
    WHERE ua.user_id = 'eacef623-6fb0-4168-a27f-fa135de093e1'
      AND tr.movement_type_id = 1
      AND tr.transaction_type_id = 2
      AND tr.transaction_actual_date BETWEEN '2025-01-01' AND '2025-12-31'
    GROUP BY EXTRACT(MONTH FROM tr.transaction_actual_date), 
             cba.category_name, 
             ct.currency_code
)

SELECT 
   cat.month_index, 
    COALESCE(cat.category_name, 'no activity'),
	COALESCE(cat.month_total_amount, 0) AS month_total_amount,
    cat.currency_code
financial_data
FROM categories cat
-- LEFT JOIN categories cat ON m.month = cat.month
ORDER BY cat.month_index ASC, cat.category_name, cat.currency_code
---------------------------------------------------------------------
-- get monthly financial data by binding movement type id and transaction type id  for user, movement type id and currency. Reflecting the movemento related to each type of movement (expense, pocket_saving and income). Income is going to be negative, since it is always a withdraw from income_source account type.

WITH financial_data AS (
          SELECT
            EXTRACT(MONTH FROM tr.transaction_actual_date) AS month_index,
     		TRIM(TO_CHAR(tr.transaction_actual_date, 'month')) AS month_name,
            tr.movement_type_id,
            tr.transaction_type_id,
            COALESCE(cba.category_name, ua.account_name) AS name,
            CAST(SUM(tr.amount) AS FLOAT) AS amount,
            ct.currency_code,
            CASE
              WHEN tr.movement_type_id = 1 AND tr.transaction_type_id = 2 THEN 'expense'
              WHEN tr.movement_type_id = 2 AND tr.transaction_type_id = 1 THEN 'income'
              WHEN tr.movement_type_id = 5 AND tr.transaction_type_id = 2 THEN 'saving'
              ELSE 'other'
            END AS type
          FROM transactions tr
          -- JOIN user_accounts ua ON tr.account_id = ua.account_id
          LEFT JOIN category_budget_accounts cba ON tr.account_id = cba.account_id
		  LEFT JOIN pocket_saving_accounts psa ON tr.account_id = psa.account_id
          LEFT JOIN user_accounts ua ON tr.account_id = ua.account_id
          JOIN currencies ct ON tr.currency_id = ct.currency_id
          JOIN movement_types mt ON tr.movement_type_id = mt.movement_type_id
          WHERE ua.user_id = 'eacef623-6fb0-4168-a27f-fa135de093e1'
            AND tr.transaction_actual_date BETWEEN '2025-01-01' AND '2025-12-31'
            AND (
              (tr.movement_type_id = 1 AND tr.transaction_type_id = 2) -- Gastos
              OR
              (tr.movement_type_id = 2 AND tr.transaction_type_id = 1) -- Ingresos
              OR
              (tr.movement_type_id = 5 AND tr.transaction_type_id = 1) -- Ahorros
            )
          GROUP BY 
            EXTRACT(MONTH FROM tr.transaction_actual_date),
            TO_CHAR(tr.transaction_actual_date, 'month'),
            tr.movement_type_id,
            tr.transaction_type_id,
            cba.category_name,
            ua.account_name,
            ct.currency_code
        )



-- get the summary list of category budget account expenses,grouped by category name separated by currencies.


-- select mt.movement_type_name,  COUNT(*) from transactions tr
-- join movement_types mt ON tr.movement_type_id = mt.movement_type_id
-- GROUP BY mt.movement_type_id, mt.movement_type_name

-- select  mt.movement_type_name,ua.account_name, SUM(tr.amount) from transactions tr
-- join movement_types mt ON tr.movement_type_id = mt.movement_type_id
-- join user_accounts ua ON tr.source_account_id = ua.account_id
-- OR tr.destination_account_id = ua.account_id
-- where tr.movement_type_id = 4
-- GROUP BY mt.movement_type_name, ua.account_name


-- select  mt.movement_type_name,ua.account_name, SUM(tr.amount) from transactions tr
-- join movement_types mt ON tr.movement_type_id = mt.movement_type_id
-- join user_accounts ua ON tr.source_account_id = ua.account_id
-- OR tr.destination_account_id = ua.account_id
-- -- join user_accounts ua ON tr.destination_account_id = ua.account_id
-- -- where mt.movement_type_name = 'expense'
-- GROUP BY mt.movement_type_name, ua.account_name
  
-- TO GET THE RESTRICTION NAME
SELECT constraint_name
FROM information_schema.table_constraints
WHERE table_name = 'movement_types' AND constraint_type = 'CHECK';

--

--TO ADD CONSTRAINT
-- ALTER TABLE transactions
-- ADD CONSTRAINT REFERENES user_accounts(account_id) ON DELETE SET NULL ON UPDATE CASCADE,
-- FOREIGN KEY account_id
-- REFERENCES tabla_destino (columna_destino);

-- TO RENAME A COLUMN
-- ALTER TABLE transactions
-- RENAME COLUMN create_at TO created_at;

--category_budget_accounts list by category_name
select ua.*, cba.*, cur.currency_code, cnt.category_nature_type_name from user_accounts ua
join category_budget_accounts cba on cba.account_id = ua.account_id
join category_nature_types cnt on cnt.category_nature_type_id = cba.category_nature_type_id
join currencies cur on cur.currency_id = ua.currency_id
where cba.category_name = 'transportation' --OR cba.category_name = 'housing'
ORDER BY cba.category_name asc, cnt.category_nature_type_id asc

 ---------------------------------------
 --  1. SQL Query for Simplified RTA Impact Calculation
 -------------------------------------
  
 -- const reportQuery = `
    WITH TargetTransactions AS (
        SELECT
            -- Identify the Affected Account (A) by finding the ID that is NOT the Target ($2).
            CASE
                WHEN tr.source_account_id = $2 THEN tr.destination_account_id
                ELSE tr.source_account_id
            END AS affected_account_id,
            tr.amount
        FROM 
            transactions tr
        WHERE 
            tr.user_id = $1 
            AND tr.account_id = $2 -- 🔑 CRUCIAL: Filter rows to only the Target's signed entries
            AND tr.status = 'complete'
            AND tr.source_account_id != tr.destination_account_id -- Ignore self-transfers (e.g., initial deposits)
    )
    SELECT
        t.affected_account_id,
        -- SUM of the Target's signed amounts is the required PnL adjustment for the Affected Account
        SUM(t.amount) AS net_adjustment_amount,
        ua.account_name AS affected_account_name,
        ua.account_balance AS affected_current_balance,
        ua.currency_id
    FROM 
        TargetTransactions t
    JOIN
        user_accounts ua ON ua.account_id = t.affected_account_id
    GROUP BY
        t.affected_account_id,
        ua.account_name,
        ua.account_balance,
        ua.currency_id
    HAVING 
        SUM(t.amount) != 0; -- Only report accounts with a non-zero impact
-- `;

--const reportResult = await pool.query(reportQuery, [userId, targetAccountId]);



