-- 013_normalize_category_budget_name_case.sql
--
-- Brings existing category_budget rows to the canonical lowercase form that
-- accountEditController and accountCategoryCreationcontroller now write.
--
-- Why the rows disagree today: creation built the name from lowercased parts
-- while edit rebuilt it through capitalize(), so 'proteinas/carne/must' and
-- 'Comida/Carne/other' are the same rule applied by two code paths. Both the
-- name and the parts it derives from are normalized, otherwise the row keeps
-- the same word in two forms and neither can be rebuilt from the other.
--
-- Scope is deliberately category_budget only. bank, income_source,
-- pocket_saving and debtor names are outside the budget module and are tracked
-- in plan-docs/REMARKS.md R22 for a separate branch.
--
-- No BEGIN/COMMIT: runMigrations.js wraps every file in one transaction
-- together with its INSERT INTO migrations. Same convention as 010 to 012.

-- UP

-- The previous value is kept so the DOWN is real. Lowercasing is destructive:
-- the original capitalization exists nowhere else once it is overwritten.
CREATE TABLE IF NOT EXISTS account_name_case_backup_013 (
 account_id INT PRIMARY KEY REFERENCES user_accounts(account_id) ON DELETE CASCADE,
 account_name VARCHAR(255) NOT NULL,
 category_name VARCHAR(255),
 subcategory VARCHAR(255)
);

INSERT INTO account_name_case_backup_013
 (account_id, account_name, category_name, subcategory)
SELECT ua.account_id, ua.account_name, cba.category_name, cba.subcategory
FROM user_accounts ua
JOIN account_types act ON act.account_type_id = ua.account_type_id
JOIN category_budget_accounts cba ON cba.account_id = ua.account_id
WHERE act.account_type_name = 'category_budget'
 AND (
  ua.account_name <> LOWER(TRIM(ua.account_name))
  OR cba.category_name <> LOWER(TRIM(cba.category_name))
  OR cba.subcategory <> LOWER(TRIM(cba.subcategory))
 )
ON CONFLICT (account_id) DO NOTHING;

UPDATE user_accounts ua
SET account_name = LOWER(TRIM(ua.account_name)),
 updated_at = NOW()
FROM account_types act
WHERE act.account_type_id = ua.account_type_id
 AND act.account_type_name = 'category_budget'
 AND ua.account_name <> LOWER(TRIM(ua.account_name));

UPDATE category_budget_accounts
SET category_name = LOWER(TRIM(category_name)),
 subcategory = LOWER(TRIM(subcategory))
WHERE category_name <> LOWER(TRIM(category_name))
 OR subcategory <> LOWER(TRIM(subcategory));

-- DOWN
-- Restores from the backup table and drops it. Rows that were already lowercase
-- were never backed up and need no restoring: the UPDATE above did not touch
-- them. Run manually; the runner only executes the UP section.
--
-- BEGIN;
-- UPDATE user_accounts ua
-- SET account_name = b.account_name, updated_at = NOW()
-- FROM account_name_case_backup_013 b
-- WHERE b.account_id = ua.account_id;
--
-- UPDATE category_budget_accounts cba
-- SET category_name = b.category_name, subcategory = b.subcategory
-- FROM account_name_case_backup_013 b
-- WHERE b.account_id = cba.account_id AND b.category_name IS NOT NULL;
--
-- DROP TABLE account_name_case_backup_013;
-- DELETE FROM migrations WHERE filename = '013_normalize_category_budget_name_case.sql';
-- COMMIT;
