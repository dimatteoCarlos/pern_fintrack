-- 010_create_budget_tables.sql
--
-- Budget domain: frequency catalog, policies, and SCD Type 2 allocations.
-- Purely additive: category_budget_accounts is never modified. The legacy
-- `budget` column stays in place and keeps serving reads until the new system
-- is verified behind USE_NEW_BUDGET_SYSTEM.
--
-- Pre-migration audit (local, 2026-07-31):
--   null_budget: 0 | zero_budget: 0 | negative_budget: 0 | will_migrate: 1 | total: 1
--
-- No BEGIN/COMMIT here: runMigrations.js wraps every file in one transaction
-- together with its INSERT INTO migrations. A COMMIT inside the file closes
-- that transaction early, leaving the bookkeeping row and every later migration
-- outside it. Same convention as 011.

-- UP

CREATE TABLE IF NOT EXISTS budget_frequency_types (
 budget_frequency_type_id SERIAL PRIMARY KEY,
 budget_frequency_code    VARCHAR(20)  NOT NULL UNIQUE,
 budget_frequency_name    VARCHAR(50)  NOT NULL,
 sort_order               INTEGER      NOT NULL DEFAULT 0,
 is_active                BOOLEAN      NOT NULL DEFAULT TRUE,
 created_at               TIMESTAMPTZ  DEFAULT CURRENT_TIMESTAMP,
 updated_at               TIMESTAMPTZ  DEFAULT CURRENT_TIMESTAMP
);

-- One policy per account. ON DELETE CASCADE: removing an account must remove
-- its budget history, otherwise orphan policies keep appearing in aggregates.
CREATE TABLE IF NOT EXISTS budget_policies (
 budget_policy_id SERIAL PRIMARY KEY,
 account_id       INTEGER NOT NULL UNIQUE
  REFERENCES category_budget_accounts(account_id) ON DELETE CASCADE,
 created_at       TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
 updated_at       TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- SCD Type 2: a new amount closes the previous row (valid_until = NOW()) and
-- inserts a new one. History is never overwritten.
-- ON DELETE RESTRICT on the frequency: a catalog entry must not disappear
-- while historical rows still reference it.
CREATE TABLE IF NOT EXISTS budget_policy_allocations (
 budget_allocation_id     SERIAL PRIMARY KEY,
 budget_policy_id         INTEGER NOT NULL
  REFERENCES budget_policies(budget_policy_id) ON DELETE CASCADE,
 budget_amount            DECIMAL(15,2) NOT NULL CHECK (budget_amount > 0),
 budget_frequency_type_id INTEGER NOT NULL
  REFERENCES budget_frequency_types(budget_frequency_type_id) ON DELETE RESTRICT,
 valid_from               TIMESTAMPTZ NOT NULL,
 valid_until              TIMESTAMPTZ,
 created_at               TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT chk_allocation_validity
  CHECK (valid_until IS NULL OR valid_until > valid_from)
);

CREATE INDEX IF NOT EXISTS idx_budget_policies_account_id
 ON budget_policies(account_id);

CREATE INDEX IF NOT EXISTS idx_budget_policy_allocations_policy_id
 ON budget_policy_allocations(budget_policy_id);

-- The constraint that makes SCD Type 2 real rather than a naming convention.
-- Without it, "valid_until IS NULL means active" is an assumption; two open
-- rows would silently double-count in Overview instead of raising an error.
CREATE UNIQUE INDEX IF NOT EXISTS uq_budget_allocation_active
 ON budget_policy_allocations(budget_policy_id)
 WHERE valid_until IS NULL;

-- Catalog seed. Codes must match MONTHS_PER_PERIOD in budgetConfig.js exactly.
INSERT INTO budget_frequency_types
 (budget_frequency_type_id, budget_frequency_code, budget_frequency_name, sort_order)
VALUES
 (1, 'monthly',    'Monthly',    1),
 (2, 'quarterly',  'Quarterly',  2),
 (3, 'four-month', 'Four-month', 3),
 (4, 'semiannual', 'Semiannual', 4),
 (5, 'yearly',     'Yearly',     5)
ON CONFLICT (budget_frequency_code) DO NOTHING;

-- Explicit IDs do not advance a SERIAL sequence. Without this, the first
-- insert that omits the ID fails with a duplicate primary key.
SELECT setval('budget_frequency_types_budget_frequency_type_id_seq',
              (SELECT MAX(budget_frequency_type_id) FROM budget_frequency_types));

-- Backfill: budget > 0 only. Zero is not a budget — the frontend already
-- rejects it, the backend used to manufacture 0.0, and a zero policy would
-- report 0% execution forever.
INSERT INTO budget_policies (account_id)
SELECT cba.account_id
FROM category_budget_accounts cba
WHERE cba.budget IS NOT NULL AND cba.budget > 0
ON CONFLICT (account_id) DO NOTHING;

-- Frequency 1 = monthly: the legacy table has no frequency column, and monthly
-- is the only period the legacy system ever produced.
INSERT INTO budget_policy_allocations
 (budget_policy_id, budget_amount, budget_frequency_type_id, valid_from)
SELECT bp.budget_policy_id, cba.budget, 1, NOW()
FROM budget_policies bp
JOIN category_budget_accounts cba ON cba.account_id = bp.account_id
WHERE cba.budget > 0
 AND NOT EXISTS (
  SELECT 1 FROM budget_policy_allocations ba
  WHERE ba.budget_policy_id = bp.budget_policy_id AND ba.valid_until IS NULL
 );

-- DOWN
-- Run manually. Safe because the migration is purely additive: dropping these
-- tables restores the exact pre-010 state. The final DELETE lets db:migrate
-- re-apply the file afterwards.
--
-- BEGIN;
-- DROP INDEX IF EXISTS uq_budget_allocation_active;
-- DROP TABLE IF EXISTS budget_policy_allocations CASCADE;
-- DROP TABLE IF EXISTS budget_policies CASCADE;
-- DROP TABLE IF EXISTS budget_frequency_types CASCADE;
-- DELETE FROM migrations WHERE filename = '010_create_budget_tables.sql';
-- COMMIT;
