-- 012_backfill_budget_policies.sql
--
-- Backfills budget policies and their first allocation from the legacy
-- category_budget_accounts.budget column.
--
-- Migration 010 already carries this backfill, but it only ever reaches
-- databases built by the migration runner. Production is built by the runtime
-- path (initDatabase.js -> ensureBudgetTables), which creates the budget tables
-- and never backfills: there, an account with budget > 0 stays invisible to the
-- read path until somebody happens to edit it and applyAllocationForAccount
-- repairs it. This file closes that gap, and the commit that follows ports the
-- same logic to the runtime so both build paths agree.
--
-- Idempotent by construction: ON CONFLICT on the policy, NOT EXISTS on the
-- allocation. On a database where 010 already backfilled, it changes nothing.
--
-- One deliberate difference from 010's backfill: the frequency is resolved by
-- code rather than by the literal id 1, so a catalog renumbering cannot
-- silently assign the wrong period. valid_from follows the same rule in both.
--
-- Known and accepted divergence from the application's resolver: when local
-- midnight does not exist because the zone springs forward at 00:00 on the 1st,
-- Postgres normalizes backward into the previous month while zonedDayStart
-- normalizes forward to the first instant that exists. Measured on
-- America/Asuncion 2028 and 2034: 03:00Z here, 04:00Z there. It reaches only
-- backfilled legacy rows, and no later migration repairs it.
--
-- No BEGIN/COMMIT: runMigrations.js wraps every file in one transaction
-- together with its INSERT INTO migrations. Same convention as 010 and 011.

-- UP

INSERT INTO budget_policies (account_id)
SELECT cba.account_id
FROM category_budget_accounts cba
WHERE cba.budget IS NOT NULL AND cba.budget > 0
ON CONFLICT (account_id) DO NOTHING;

-- The NOT EXISTS guard is what makes a re-run safe: without it a second pass
-- would open a competing allocation and breach uq_budget_allocation_active.
--
-- valid_from is the start of the month containing account_start_date. The
-- account start is what puts the budget in force, but a budget rules a period,
-- not an instant. The month is the account owner's, so the boundary matches the
-- one createBudgetPolicyForAccount persists for a budget created by hand.
INSERT INTO budget_policy_allocations
 (budget_policy_id, budget_amount, budget_frequency_type_id, valid_from)
SELECT bp.budget_policy_id,
 cba.budget,
 (SELECT budget_frequency_type_id FROM budget_frequency_types
   WHERE budget_frequency_code = 'monthly'),
 date_trunc('month', ua.account_start_date AT TIME ZONE u.timezone)
  AT TIME ZONE u.timezone
FROM budget_policies bp
JOIN category_budget_accounts cba ON cba.account_id = bp.account_id
JOIN user_accounts ua ON ua.account_id = bp.account_id
JOIN users u ON u.user_id = ua.user_id
WHERE cba.budget > 0
 AND NOT EXISTS (
  SELECT 1 FROM budget_policy_allocations ba
  WHERE ba.budget_policy_id = bp.budget_policy_id AND ba.valid_until IS NULL
 );

-- DOWN
-- Deliberately empty. A backfilled policy is indistinguishable from one a user
-- created: both are a row in budget_policies with one open allocation. Deleting
-- by "the amount still matches cba.budget" would destroy real edits that happen
-- to coincide. To revert the budget domain outright, use 010's DOWN, which
-- drops the tables. The DELETE below only lets db:migrate re-apply this file.
--
-- BEGIN;
-- DELETE FROM migrations WHERE filename = '012_backfill_budget_policies.sql';
-- COMMIT;