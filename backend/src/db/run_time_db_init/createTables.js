// backend/src/db/createTables.js
//version de SQL mayor a 13.
import { pool } from '../config/configDB.js';
import pc from 'picocolors';
// ===================================
export const mainTables = [
  {
    tblName: 'users',
    table: `CREATE TABLE IF NOT EXISTS 
    users(
     user_id UUID PRIMARY KEY UNIQUE NOT NULL,
     username VARCHAR(50) UNIQUE NOT NULL,
     email VARCHAR(255) UNIQUE NOT NULL,
     user_firstname VARCHAR(25) NOT NULL,
     user_lastname VARCHAR(25) NOT NULL,
     user_contact VARCHAR(25),
     password_hashed VARCHAR(255) NOT NULL, 
     currency_id INT REFERENCES currencies(currency_id) ON DELETE SET NULL ON UPDATE CASCADE,
     timezone TEXT NOT NULL DEFAULT 'UTC',
     google_id VARCHAR(255) UNIQUE,
     display_name VARCHAR(255),
     auth_method VARCHAR(255) DEFAULT 'password',
     user_role_id INT REFERENCES user_roles(user_role_id) ON DELETE SET NULL ON UPDATE CASCADE,
     deleted_at TIMESTAMPTZ DEFAULT NULL,
     created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
     updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

     CREATE OR REPLACE FUNCTION assert_iana_timezone()
     RETURNS TRIGGER AS $$
     BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_timezone_names WHERE name = NEW.timezone) THEN
       RAISE EXCEPTION 'Invalid IANA time zone: %', NEW.timezone
        USING ERRCODE = '22023';
      END IF;
      RETURN NEW;
     END;
     $$ LANGUAGE plpgsql;

     DROP TRIGGER IF EXISTS trg_users_timezone_is_iana ON users;
     CREATE TRIGGER trg_users_timezone_is_iana
      BEFORE INSERT OR UPDATE OF timezone ON users
      FOR EACH ROW EXECUTE FUNCTION assert_iana_timezone();`,
  },

  {
    table: `
    CREATE TABLE IF NOT EXISTS app_initialization (
      id SERIAL PRIMARY KEY,
      tables_created BOOLEAN NOT NULL DEFAULT FALSE,
      initialized_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `,
    tblName: 'app_initialization',
  },

  {
    tblName: 'user_accounts',
    table: `CREATE TABLE IF NOT EXISTS user_accounts (account_id SERIAL PRIMARY KEY NOT NULL, 
    user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE ON UPDATE CASCADE,
    account_name VARCHAR(50) NOT NULL,
    account_type_id INT  REFERENCES account_types(account_type_id) ON DELETE SET NULL ON UPDATE CASCADE, 
    currency_id INT NOT NULL REFERENCES currencies(currency_id) ON DELETE RESTRICT ON UPDATE CASCADE, 
    account_starting_amount DECIMAL(15,2) NOT NULL,
    account_balance DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    note VARCHAR(155) ,
    account_start_date TIMESTAMPTZ NOT NULL, 
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMPTZ DEFAULT NULL
)`,
  },
  {
    tblName: 'income_source_accounts',
    table:
      'CREATE TABLE IF NOT EXISTS income_source_accounts(account_id INT PRIMARY KEY REFERENCES user_accounts(account_id) ON DELETE CASCADE, account_starting_amount DECIMAL (15,2),currency_id INT  REFERENCES currencies(currency_id) ON DELETE SET NULL ON UPDATE CASCADE, account_start_date TIMESTAMPTZ NOT NULL)',
  },

  {
    tblName: `category_budget_accounts`,
    table: `CREATE TABLE IF NOT EXISTS category_budget_accounts(account_id INT PRIMARY KEY REFERENCES user_accounts(account_id) ON DELETE CASCADE,
    category_name VARCHAR(50) NOT NULL,category_nature_type_id INT REFERENCES    category_nature_types(category_nature_type_id),
    subcategory VARCHAR(25),
    budget DECIMAL(15, 2),currency_id INT NOT NULL REFERENCES currencies(currency_id) ON DELETE RESTRICT ON UPDATE CASCADE, account_start_date TIMESTAMPTZ NOT NULL)`,
  },

  {
    tblName: `debtor_accounts`,
    table: `CREATE TABLE IF NOT EXISTS debtor_accounts (
     account_id INT PRIMARY KEY REFERENCES user_accounts(account_id) ON DELETE CASCADE,
     value DECIMAL(15, 2),
     currency_id INT REFERENCES currencies(currency_id) ON DELETE SET NULL ON UPDATE CASCADE,
     debtor_name VARCHAR(25),
     debtor_lastname VARCHAR(25),
     selected_account_id INT,
     selected_account_name VARCHAR(50),
     account_start_date TIMESTAMPTZ NOT NULL
     )`,
  },

  {
    tblName: `pocket_saving_accounts`,
    table: `CREATE TABLE IF NOT EXISTS pocket_saving_accounts (account_id INT PRIMARY KEY REFERENCES user_accounts(account_id) ON DELETE CASCADE, target DECIMAL(15, 2),
    note  VARCHAR(155), 
    desired_date TIMESTAMPTZ NOT NULL,
    account_start_date TIMESTAMPTZ NOT NULL
    )`,
  },

  {
    tblName: 'transactions',
    table: `CREATE TABLE IF NOT EXISTS transactions(
      transaction_id SERIAL PRIMARY KEY,
   -- 🔑 FK: ASOCIACIÓN CON EL USUARIO (CASCADE)
      user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE
       ON UPDATE CASCADE,
      description TEXT,
      amount DECIMAL(15,2) NOT NULL, 
      movement_type_id INTEGER NOT NULL,
      transaction_type_id INTEGER NOT NULL,
      currency_id INTEGER NOT NULL, 

-- 🔴 FK PRINCIPAL REINCORPORADA Y CON CASCADE
     account_id INTEGER NOT NULL REFERENCES user_accounts(account_id) ON DELETE CASCADE ON UPDATE CASCADE,

      account_balance_after_tr DECIMAL(15,2) NOT NULL DEFAULT 0.00,

-- ✅ FKs DE TRANSFERENCIA (ON DELETE CASCADE)
     source_account_id INT REFERENCES user_accounts(account_id) ON DELETE CASCADE ON UPDATE CASCADE,
     destination_account_id INT REFERENCES user_accounts(account_id) ON DELETE CASCADE ON UPDATE CASCADE,

     status VARCHAR(50) NOT NULL, 
     transaction_actual_date TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
     created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP, 
     updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

 --  FX audit columns
    original_amount DECIMAL(15,2) NOT NULL DEFAULT 0,
    original_currency_id INTEGER NOT NULL DEFAULT 1 REFERENCES currencies(currency_id) ON DELETE RESTRICT ON UPDATE CASCADE,
    exchange_rate DECIMAL(18,8) NOT NULL DEFAULT 1.0 CHECK (exchange_rate > 0),
    exchange_rate_source VARCHAR(60) NOT NULL DEFAULT 'identity',
    exchange_rate_timestamp TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    exchange_rate_target_currency_id INTEGER NOT NULL DEFAULT 1 REFERENCES currencies(currency_id) ON DELETE RESTRICT ON UPDATE CASCADE
      );`,
  },

  {
    tblName: 'refresh_tokens',
    table: `
      CREATE TABLE IF NOT EXISTS refresh_tokens (
      token_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

      user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,

      token TEXT NOT NULL UNIQUE,
      expiration_date TIMESTAMPTZ NOT NULL,

      revoked BOOLEAN DEFAULT FALSE,

      user_agent TEXT,

      ip_address TEXT, 
      
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
   `,
  },

  {
    tblName: 'exchange_rates',
    table: `CREATE TABLE IF NOT EXISTS exchange_rates (
     rate_id SERIAL PRIMARY KEY,
      base_currency_id INTEGER NOT NULL REFERENCES currencies(currency_id) ON DELETE RESTRICT ON UPDATE CASCADE,

     target_currency_id INTEGER NOT NULL REFERENCES currencies(currency_id) ON DELETE RESTRICT ON UPDATE CASCADE,

     exchange_rate DECIMAL(18, 8) NOT NULL CHECK (exchange_rate > 0),
    
     source VARCHAR(30) NOT NULL,

     fetched_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

     created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

     provider_updated_at TIMESTAMPTZ,
     UNIQUE (base_currency_id,target_currency_id)
    );`,
  },
];

//=============================================

// export const createSearchIndexes = [
//   {
//     tblName: 'currencies',
//     index: `CREATE UNIQUE INDEX index_currency_code ON currencies(currency_code)`,
//   },
//   {
//     tblName: 'account_types',
//     index: `CREATE UNIQUE INDEX index_account_type_name ON account_types(account_type_name)`,
//   },

//   {
//     tblName: 'refresh_tokens',
//     index: `CREATE INDEX idx_refresh_tokens_user_id ON refresh_tokens (user_id);`,
//   },
// ];

// ===================================
// 🏗️ MAIN FUNCTION createTables
// ===================================
//Create main tables needed at initialization of the app
export async function createTables(client = pool) {
  console.log(pc.bgMagenta('🔥 CREATE TABLES with FX 🔥'));

  try {
    console.log('Creando las tablas en caso que no existan...');

    //1. Create tables from mainTables array / Crear tablas del array mainTables
    await Promise.allSettled(
      mainTables.map(async (item, ind) => {
        try {
          await client.query(item.table);
          console.log(
            pc.green(`${ind}) Table ${item.tblName} verified/created`),
          );
        } catch (error) {
          console.error(pc.red(`Error creating table ${item.tblName}:`, error));
          throw error;
        }
      }),
    ).then((results) => {
      results.forEach((result, indx) => {
        if (result.status === 'fulfilled') {
          console.log(
            `Table ${mainTables[indx].tblName} was successfully created .`,
          );
        } else if (result.status === 'rejected') {
          console.error(
            `Table ${mainTables[indx].tblName} failed to create:`,
            result.reason,
          );
        }
      });
    });

    // 2. Create exchange_rates table
    console.log(
      pc.cyan('Ensuring exchange_rates has final structure (recreating)...'),
    );
    const exchangeRatesDef = mainTables.find(
      (t) => t.tblName === 'exchange_rates',
    );
    if (!exchangeRatesDef)
      throw new Error('exchange_rates definition not found');
    await client.query(`DROP TABLE IF EXISTS exchange_rates CASCADE`);
    await client.query(exchangeRatesDef.table);
    console.log(pc.green('exchange_rates recreated with final structure.'));

    // 3. Do migration of FX columns (idempotent) / Ejecutar la migración de columnas FX (idempotente)
    await addFxAuditColumns(client);

    // Budget domain tables are NOT created here. createTables() only runs on a
    // virgin database, so an already-initialized one would never get them.
    // initializeDatabase() calls ensureBudgetTables() on every boot instead.

    console.log('🔥  All FX migrations completed / finalizado');
  } catch (error) {
    console.error(pc.red('Error in table creation process:'), error);
    throw error;
  }
}

//============================
// 🧩 INTERNAL FUNCTION: Add FX columns in transactions table
// ===========================
/**
 * 💰 Add FX audit columns to transactions table if missing.
 * This function is idempotent and safe to run on every app start.
 */
export async function addFxAuditColumns(client = pool) {
  console.log(pc.cyan('Adding FX audit columns to transactions if missing...'));

  const transactionsAlterQueries = [
    `ALTER TABLE transactions ADD COLUMN IF NOT EXISTS original_amount DECIMAL(15,2) NOT NULL DEFAULT 0`,
    `ALTER TABLE transactions ADD COLUMN IF NOT EXISTS original_currency_id INTEGER NOT NULL DEFAULT 1`,
    `ALTER TABLE transactions ADD COLUMN IF NOT EXISTS exchange_rate DECIMAL(18,8) NOT NULL DEFAULT 1.0 CHECK (exchange_rate > 0)`,
    `ALTER TABLE transactions ADD COLUMN IF NOT EXISTS exchange_rate_source VARCHAR(60) NOT NULL DEFAULT 'identity'`,
    `ALTER TABLE transactions ADD COLUMN IF NOT EXISTS exchange_rate_timestamp TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP`,
    `ALTER TABLE transactions ADD COLUMN IF NOT EXISTS exchange_rate_target_currency_id INTEGER NOT NULL DEFAULT 1`,
  ];

  for (const query of transactionsAlterQueries) {
    await client.query(query);
  }

  // Add constraints FK in transactions (if not exist)
  await client.query(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'transactions_original_currency_id_fkey'
      ) THEN
        ALTER TABLE transactions ADD CONSTRAINT transactions_original_currency_id_fkey
          FOREIGN KEY (original_currency_id) REFERENCES currencies(currency_id)
          ON DELETE RESTRICT ON UPDATE CASCADE;
      END IF;
      
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'transactions_exchange_rate_target_currency_id_fkey'
      ) THEN
        ALTER TABLE transactions ADD CONSTRAINT transactions_exchange_rate_target_currency_id_fkey
          FOREIGN KEY (exchange_rate_target_currency_id) REFERENCES currencies(currency_id)
          ON DELETE RESTRICT ON UPDATE CASCADE;
      END IF;
    END
    $$;
  `);

  console.log(pc.green('FX audit columns added/verified successfully.'));
}

/**
 * Ensure the budget domain table exists. Mirrors the DDL of migration
 * 010_create_budget_tables.sql, without its backfill.
 *
 * Deliberately NOT part of the mainTables array: that array is created with
 * Promise.allSettled, so a rejected table is only logged, never thrown. This
 * one references category_budget_accounts, so it needs a real failure when it
 * cannot be created.
 *
 * DDL only. The legacy backfill belongs to ensureBudgetAllocationBackfill.
 *
 * @param {object} client - Database client (pool or transaction)
 */
export async function ensureBudgetTables(client = pool) {
 console.log(pc.cyan('Ensuring budget domain tables...'));

 // See 010 for why the amount allows 0 and why the month check uses EXTRACT.
 await client.query(`
  CREATE TABLE IF NOT EXISTS budget_monthly_allocations (
   budget_allocation_id SERIAL PRIMARY KEY,
   account_id           INTEGER       NOT NULL
    REFERENCES category_budget_accounts(account_id) ON DELETE CASCADE,
   budget_month         DATE          NOT NULL,
   budget_amount        DECIMAL(15,2) NOT NULL CHECK (budget_amount >= 0),
   created_at           TIMESTAMPTZ   NOT NULL DEFAULT CURRENT_TIMESTAMP,
   updated_at           TIMESTAMPTZ   NOT NULL DEFAULT CURRENT_TIMESTAMP,
   CONSTRAINT uq_budget_allocation_month UNIQUE (account_id, budget_month),
   CONSTRAINT chk_budget_month_is_first CHECK (EXTRACT(DAY FROM budget_month) = 1)
  )
 `);

 console.log(pc.green('Budget domain tables verified/created.'));
}

/**
 * Make category_budget_accounts.currency_id mandatory on an existing database.
 *
 * The runtime counterpart of migration 011. The DDL above only reaches virgin
 * databases, because CREATE TABLE IF NOT EXISTS never alters a table that is
 * already there — the same reason addFxAuditColumns() exists.
 *
 * The value comes from user_accounts.currency_id, the accounting currency. It
 * is never the origin currency sent by the client: that one is FX metadata.
 * The join always resolves, since account_id is a FK to user_accounts and
 * user_accounts.currency_id is NOT NULL.
 *
 * The remaining-NULL count before the ALTER is not redundant. A SET NOT NULL
 * over a column that still holds NULLs raises, and raising here means
 * process.exit(1) in index.js: the whole application down over a defect that
 * only degrades the budget module, which additionally has a COALESCE fallback
 * in budgetTransactionRepository. So it warns and lets the boot continue.
 *
 * @param {object} client - Database client (pool or transaction)
 */
export async function ensureCategoryBudgetCurrency(client = pool) {
 const backfilled = await client.query(`
  UPDATE category_budget_accounts cba
  SET currency_id = ua.currency_id
  FROM user_accounts ua
  WHERE ua.account_id = cba.account_id
   AND cba.currency_id IS NULL
 `);

 if (backfilled.rowCount > 0) {
  console.log(
   pc.green(`category_budget_accounts: ${backfilled.rowCount} currency_id backfilled.`),
  );
 }

 const { rows } = await client.query(`
  SELECT
   (SELECT count(*)::int FROM category_budget_accounts WHERE currency_id IS NULL) AS remaining,
   (SELECT is_nullable FROM information_schema.columns
    WHERE table_name = 'category_budget_accounts' AND column_name = 'currency_id') AS is_nullable
 `);
 const { remaining, is_nullable } = rows[0];

 if (remaining > 0) {
  console.warn(
   pc.yellow(
    `category_budget_accounts: ${remaining} row(s) still have a NULL currency_id ` +
     `and no parent currency to resolve them. Leaving the column nullable.`,
   ),
  );
  return;
 }

 // Skipping when already NOT NULL avoids taking an ACCESS EXCLUSIVE lock on
 // every boot for a no-op.
 if (is_nullable === 'YES') {
  await client.query(
   'ALTER TABLE category_budget_accounts ALTER COLUMN currency_id SET NOT NULL',
  );
  console.log(pc.green('category_budget_accounts.currency_id is now NOT NULL.'));
 }
}

/**
 * Backfill the first monthly allocation from the legacy
 * category_budget_accounts.budget column.
 *
 * Runtime counterpart of migration 012: production is built by this path, not
 * by the migration runner, so an account carrying a legacy budget would
 * otherwise stay invisible to the read path until somebody edited it.
 *
 * The row is written at the account's start month and nothing terminates it,
 * which is the correct reading of a legacy cba.budget: a standing monthly
 * amount that recurs until the user changes it.
 *
 * @param {object} client - Database client (pool or transaction)
 */
export async function ensureBudgetAllocationBackfill(client = pool) {
 // ON CONFLICT is what makes a re-run safe: on every boot after the first this
 // inserts nothing. See 012 for why there is no second AT TIME ZONE — it would
 // make the ::date cast read the session's zone instead of the owner's.
 const allocations = await client.query(`
  INSERT INTO budget_monthly_allocations (account_id, budget_month, budget_amount)
  SELECT cba.account_id,
   date_trunc('month', ua.account_start_date AT TIME ZONE u.timezone)::date,
   cba.budget
  FROM category_budget_accounts cba
  JOIN user_accounts ua ON ua.account_id = cba.account_id
  JOIN users u          ON u.user_id     = ua.user_id
  WHERE cba.budget IS NOT NULL AND cba.budget > 0
  ON CONFLICT (account_id, budget_month) DO NOTHING
 `);

 if (allocations.rowCount > 0) {
  console.log(
   pc.green(`Budget backfill: ${allocations.rowCount} allocation(s) created.`),
  );
 }
}

// ===========================================
// 🧩 FUNCTION: Recreate exchange_rates table
// ===========================================
/**
 * Forcefully drop and recreate exchange_rates table using its current definition.
 * Useful when table structure has changed and you need to reset the cache.
 * Safe because no foreign keys reference this table.
 * @param {object} client - Database client (pool or transaction)
 */

export async function recreateExchangeRatesTable(client = pool) {
  console.log(pc.yellow('⚠️ Recreating exchange_rates table (cache reset)...'));
  const exchangeRatesDef = mainTables.find(
    (t) => t.tblName === 'exchange_rates',
  );

  if (!exchangeRatesDef) {
    throw new Error('exchange_rates definition not found in mainTables');
  }
  await client.query(`DROP TABLE IF EXISTS exchange_rates CASCADE`);

  await client.query(exchangeRatesDef.table);
  console.log(pc.green('✅ exchange_rates recreated with final structure.'));
}