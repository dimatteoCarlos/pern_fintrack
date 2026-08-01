-- 011_enforce_category_budget_currency.sql
--
-- Makes category_budget_accounts.currency_id mandatory.
--
-- Commit db771a4 added the column to the INSERT in
-- accountCategoryCreationcontroller.js, so new rows now carry the accounting
-- currency. This migration closes the two remaining ends: it fills the historic
-- rows left at NULL, and turns the rule into an engine guarantee. Without the
-- constraint the next INSERT that omits the column reintroduces the defect and
-- nobody notices until a user opens Overview; with it, the write fails on the
-- spot.
--
-- The value comes from user_accounts.currency_id, the accounting currency
-- written by insertAccount. It is never the origin currency sent by the client:
-- that one belongs to the FX metadata only.
--
-- Pre-migration audit (local fintrack_dev, 2026-08-01):
--   total_rows: 1 | null_currency: 1 | backfillable: 1
--   orphan_no_parent: 0 | parent_currency_null: 0
--   blockers after backfill: none | child/parent mismatch: none
--
-- No BEGIN/COMMIT here, unlike 010. runMigrations.js already wraps each file in
-- a transaction together with its INSERT INTO migrations. A COMMIT inside the
-- file closes that transaction early and leaves the bookkeeping row outside it.

-- UP

-- Only NULL rows are touched, so re-running the file changes nothing.
UPDATE category_budget_accounts cba
SET currency_id = ua.currency_id
FROM user_accounts ua
WHERE ua.account_id = cba.account_id
 AND cba.currency_id IS NULL;

-- The FK to currencies already exists; this adds the obligation, not the
-- referential integrity. It is a no-op if the column is already NOT NULL.
ALTER TABLE category_budget_accounts
 ALTER COLUMN currency_id SET NOT NULL;

-- DOWN
-- Run manually. Only the constraint is reverted: restoring the NULLs would
-- destroy correct data and bring back the getCurrencyCodeSync(null) failure.
-- The DELETE lets db:migrate re-apply the file afterwards.
--
-- BEGIN;
-- ALTER TABLE category_budget_accounts
--  ALTER COLUMN currency_id DROP NOT NULL;
-- DELETE FROM migrations WHERE filename = '011_enforce_category_budget_currency.sql';
-- COMMIT;
