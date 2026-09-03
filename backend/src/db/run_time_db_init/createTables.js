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
     auth_method VARCHAR(50) DEFAULT 'password',
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
    budget DECIMAL(15, 2),currency_id INT NOT NULL REFERENCES currencies(currency_id) ON DELETE RESTRICT ON UPDATE CASCADE, account_start_date TIMESTAMPTZ NOT NULL,

 --  FX audit columns. budget holds the accounting currency; original_budget
 --  holds what the user typed. See migration 014.
    original_budget DECIMAL(15,2) NOT NULL DEFAULT 0,
    original_currency_id INTEGER NOT NULL REFERENCES currencies(currency_id) ON DELETE RESTRICT ON UPDATE CASCADE,
    exchange_rate DECIMAL(18,8) NOT NULL DEFAULT 1.0 CHECK (exchange_rate > 0),
    exchange_rate_source VARCHAR(60) NOT NULL DEFAULT 'identity',
    exchange_rate_timestamp TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    exchange_rate_target_currency_id INTEGER NOT NULL REFERENCES currencies(currency_id) ON DELETE RESTRICT ON UPDATE CASCADE)`,
  },

  {
    tblName: `debtor_accounts`,
    table: `CREATE TABLE IF NOT EXISTS debtor_accounts (
     account_id INT PRIMARY KEY REFERENCES user_accounts(account_id) ON DELETE CASCADE,
     value DECIMAL(15, 2),
  --  RESTRICT, not SET NULL: a NULL currency turns value into a number without
  --  a unit. currency_id states the currency value is expressed in. See 016.
     currency_id INT REFERENCES currencies(currency_id) ON DELETE RESTRICT ON UPDATE CASCADE,
     debtor_name VARCHAR(25),
     debtor_lastname VARCHAR(25),
     selected_account_id INT REFERENCES user_accounts(account_id) ON DELETE SET NULL,
     selected_account_name VARCHAR(50),
     account_start_date TIMESTAMPTZ NOT NULL,
  --  FX audit columns. value holds the accounting currency; original_value
  --  holds what the user typed. The two currency ids take no default: an id has
  --  no honest fallback. See migration 016.
     original_value DECIMAL(15,2) NOT NULL DEFAULT 0,
     original_currency_id INTEGER NOT NULL REFERENCES currencies(currency_id) ON DELETE RESTRICT ON UPDATE CASCADE,
     exchange_rate DECIMAL(18,8) NOT NULL DEFAULT 1.0 CHECK (exchange_rate > 0),
     exchange_rate_source VARCHAR(60) NOT NULL DEFAULT 'identity',
     exchange_rate_timestamp TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
     exchange_rate_target_currency_id INTEGER NOT NULL REFERENCES currencies(currency_id) ON DELETE RESTRICT ON UPDATE CASCADE
     )`,
  },

  {
    tblName: `pocket_saving_accounts`,
    table: `CREATE TABLE IF NOT EXISTS pocket_saving_accounts (account_id INT PRIMARY KEY REFERENCES user_accounts(account_id) ON DELETE CASCADE, target DECIMAL(15, 2),

 -- The accounting currency target is expressed in. Nullable, and ON DELETE SET
 -- NULL, exactly as migration 002 declares it: this one predates the FX pair
 -- below and does not share their NOT NULL. See migration 002.
    currency_id INT REFERENCES currencies(currency_id) ON DELETE SET NULL ON UPDATE CASCADE,

    note  VARCHAR(155),
    desired_date TIMESTAMPTZ NOT NULL,
    account_start_date TIMESTAMPTZ NOT NULL,

 -- Where desired_date came from. The column is NOT NULL, so a caller that
 -- sends no deadline still gets one written, and every pace figure divides by
 -- it. 'default' is what lets the board say "deadline not set" instead of
 -- reporting a pace built on a date nobody chose. See migration 018.
    desired_date_source VARCHAR(20) NOT NULL DEFAULT 'user'
      CHECK (desired_date_source IN ('user', 'default')),

 --  FX audit columns. target holds the accounting currency; original_target
 --  holds what the user typed. The two currency ids take no default: an id has
 --  no honest fallback. See migration 015.
    original_target DECIMAL(15,2) NOT NULL DEFAULT 0,
    original_currency_id INTEGER NOT NULL REFERENCES currencies(currency_id) ON DELETE RESTRICT ON UPDATE CASCADE,
    exchange_rate DECIMAL(18,8) NOT NULL DEFAULT 1.0 CHECK (exchange_rate > 0),
    exchange_rate_source VARCHAR(60) NOT NULL DEFAULT 'identity',
    exchange_rate_timestamp TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    exchange_rate_target_currency_id INTEGER NOT NULL REFERENCES currencies(currency_id) ON DELETE RESTRICT ON UPDATE CASCADE
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
      movement_type_id INTEGER NOT NULL REFERENCES movement_types(movement_type_id)
       ON DELETE RESTRICT ON UPDATE CASCADE,
      transaction_type_id INTEGER NOT NULL REFERENCES transaction_types(transaction_type_id)
       ON DELETE RESTRICT ON UPDATE CASCADE,
      currency_id INTEGER NOT NULL REFERENCES currencies(currency_id)
       ON DELETE RESTRICT ON UPDATE CASCADE,

-- 🔴 OWNING FK: RESTRICT, so no physical delete reaches the ledger without
-- passing through the deletion engine that settles the account first.
     account_id INTEGER NOT NULL REFERENCES user_accounts(account_id) ON DELETE RESTRICT ON UPDATE CASCADE,

      account_balance_after_tr DECIMAL(15,2) NOT NULL DEFAULT 0.00,

-- ✅ TRANSFER FKs (ON DELETE RESTRICT)
-- A cascade here deleted the counterparty's own rows, not just this account's.
     source_account_id INT REFERENCES user_accounts(account_id) ON DELETE RESTRICT ON UPDATE CASCADE,
     destination_account_id INT REFERENCES user_accounts(account_id) ON DELETE RESTRICT ON UPDATE CASCADE,

     status TEXT NOT NULL, 
     transaction_actual_date TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
     created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP, 
     updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

 --  FX audit columns
    original_amount DECIMAL(15,2) NOT NULL DEFAULT 0,
    original_currency_id INTEGER NOT NULL DEFAULT 1 REFERENCES currencies(currency_id) ON DELETE RESTRICT ON UPDATE CASCADE,
    exchange_rate DECIMAL(18,8) NOT NULL DEFAULT 1.0 CHECK (exchange_rate > 0),
    exchange_rate_source VARCHAR(60) NOT NULL DEFAULT 'identity',
    exchange_rate_timestamp TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    exchange_rate_target_currency_id INTEGER NOT NULL DEFAULT 1 REFERENCES currencies(currency_id) ON DELETE RESTRICT ON UPDATE CASCADE,

-- Marks the single row that opens an account. Nullable on purpose: NULL reads as
-- "this row opens no account", which is true of every ordinary movement.
-- Declared last so a database built here holds the same column order migration
-- 022 leaves on one built by the chain.
    opening_for_account_id INTEGER REFERENCES user_accounts(account_id) ON DELETE RESTRICT ON UPDATE CASCADE
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

   -- FX audit columns. budget_amount holds the accounting currency;
   -- original_budget_amount holds what the user typed. The two currency ids
   -- take no default: an id has no honest fallback. See migration 017.
   --
   -- The CHECKs are named after 017 rather than left to the auto-generated
   -- name, so 017's guarded DO block finds them and stays a no-op on a
   -- database this DDL built.
   original_budget_amount DECIMAL(15,2) NOT NULL DEFAULT 0,
   original_currency_id   INTEGER       NOT NULL
    REFERENCES currencies(currency_id) ON DELETE RESTRICT ON UPDATE CASCADE,
   exchange_rate          DECIMAL(18,8) NOT NULL DEFAULT 1.0,
   exchange_rate_source   VARCHAR(60)   NOT NULL DEFAULT 'identity',
   exchange_rate_timestamp TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP,
   -- Named, and shorter than its siblings: the auto-generated
   -- ..._exchange_rate_target_currency_id_fkey is 64 characters and Postgres
   -- would store a truncated 63. See 017 for the full reasoning.
   exchange_rate_target_currency_id INTEGER NOT NULL
    CONSTRAINT budget_monthly_allocations_exchange_rate_target_fkey
    REFERENCES currencies(currency_id) ON DELETE RESTRICT ON UPDATE CASCADE,

   CONSTRAINT uq_budget_allocation_month UNIQUE (account_id, budget_month),
   CONSTRAINT chk_budget_month_is_first CHECK (EXTRACT(DAY FROM budget_month) = 1),
   CONSTRAINT budget_monthly_allocations_exchange_rate_check
    CHECK (exchange_rate > 0),
   CONSTRAINT budget_monthly_allocations_original_amount_check
    CHECK (original_budget_amount >= 0)
  )
 `);

 console.log(pc.green('Budget domain tables verified/created.'));
}

/**
 * Ensure the pocket domain tables exist. Mirrors the DDL of migration
 * 020_create_pocket_tables.sql, without its data steps.
 *
 * Deliberately NOT part of the mainTables array, for the same reason
 * ensureBudgetTables is not: that array runs under Promise.allSettled, so a
 * rejected table is only logged. pocket_allocations references pockets and
 * user_accounts, so it needs a real failure when it cannot be created.
 *
 * DDL only. The account-to-pocket conversion of 020 belongs to the migration
 * runner: it deletes financial rows and reports what it acted on, which is not
 * something a boot may do unattended.
 *
 * @param {object} client - Database client (pool or transaction)
 */
export async function ensurePocketTables(client = pool) {
 console.log(pc.cyan('Ensuring pocket domain tables...'));

 // See 020 for why there is no status column, why desired_date is required, and
 // why the origin currency pair is audit metadata rather than a second unit.
 await client.query(`
  CREATE TABLE IF NOT EXISTS pockets (
   pocket_id      SERIAL PRIMARY KEY,
   user_id        UUID NOT NULL
    REFERENCES users(user_id) ON DELETE CASCADE,
   name           VARCHAR(50)  NOT NULL,
   note           VARCHAR(155),
   target_amount  DECIMAL(15,2) NOT NULL CHECK (target_amount > 0),
   currency_id    INT NOT NULL
    REFERENCES currencies(currency_id) ON DELETE RESTRICT ON UPDATE CASCADE,
   desired_date   DATE NOT NULL,

   -- FX audit pair: what was typed, in which currency, and the rate between them.
   original_target                   DECIMAL(15,2) NOT NULL,
   original_currency_id              INT NOT NULL
    REFERENCES currencies(currency_id) ON DELETE RESTRICT ON UPDATE CASCADE,
   exchange_rate                     DECIMAL(20,10) NOT NULL CHECK (exchange_rate > 0),
   exchange_rate_source              VARCHAR(50)   NOT NULL,
   exchange_rate_timestamp           TIMESTAMPTZ   NOT NULL,
   exchange_rate_target_currency_id  INT NOT NULL
    REFERENCES currencies(currency_id) ON DELETE RESTRICT ON UPDATE CASCADE,

   created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
   updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
  )
 `);

 // Append-only, hence no updated_at: a correction is a new row of the opposite
 // sign, never an edit. source_account_id RESTRICTs so deleting an account stays
 // a decision taken in a service with an impact report.
 await client.query(`
  CREATE TABLE IF NOT EXISTS pocket_allocations (
   allocation_id     BIGSERIAL PRIMARY KEY,
   user_id           UUID NOT NULL
    REFERENCES users(user_id) ON DELETE CASCADE,
   pocket_id         INT NOT NULL
    REFERENCES pockets(pocket_id) ON DELETE CASCADE,
   source_account_id INT NOT NULL
    REFERENCES user_accounts(account_id) ON DELETE RESTRICT ON UPDATE CASCADE,
   amount            DECIMAL(15,2) NOT NULL CHECK (amount <> 0),

   -- The date the decision was taken. Mirrors transactions.transaction_actual_date.
   allocation_actual_date TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

   -- FX audit pair, same six columns, same meaning.
   original_amount                   DECIMAL(15,2) NOT NULL,
   original_currency_id              INT NOT NULL
    REFERENCES currencies(currency_id) ON DELETE RESTRICT ON UPDATE CASCADE,
   exchange_rate                     DECIMAL(20,10) NOT NULL CHECK (exchange_rate > 0),
   exchange_rate_source              VARCHAR(50)   NOT NULL,
   exchange_rate_timestamp           TIMESTAMPTZ   NOT NULL,
   exchange_rate_target_currency_id  INT NOT NULL
    REFERENCES currencies(currency_id) ON DELETE RESTRICT ON UPDATE CASCADE,

   created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
  )
 `);

 // One index per aggregate the module reads: the pocket's own total, and the
 // account's committed total the allocate form validates against.
 await client.query(
  `CREATE INDEX IF NOT EXISTS idx_pocket_allocations_pocket ON pocket_allocations(pocket_id)`,
 );
 await client.query(
  `CREATE INDEX IF NOT EXISTS idx_pocket_allocations_account ON pocket_allocations(source_account_id)`,
 );

 console.log(pc.green('Pocket domain tables verified/created.'));
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
 * Add the FX audit columns of migration 014 to category_budget_accounts.
 *
 * The runtime counterpart of 014, and the reason it is needed is the one
 * addFxAuditColumns() states for transactions: the columns are declared in the
 * mainTables DDL, but that is a CREATE TABLE IF NOT EXISTS and it only runs
 * inside the tables_created block, so on a database that already has the table
 * neither path ever adds them. 014 reaches only databases that met the runner.
 *
 * Order matters. The backfill reads currency_id, so this must run after
 * ensureCategoryBudgetCurrency().
 *
 * The two currency ids take no default: an id has no honest fallback. So the
 * columns are added nullable, backfilled from the currency the row already
 * carries, and only then made NOT NULL — the same three steps as 014, in the
 * same order, so both build paths land on the same schema.
 *
 * @param {object} client - Database client (pool or transaction)
 */
export async function ensureCategoryBudgetFxColumns(client = pool) {
 await client.query(`
  ALTER TABLE category_budget_accounts
   ADD COLUMN IF NOT EXISTS original_budget DECIMAL(15,2),
   ADD COLUMN IF NOT EXISTS original_currency_id INTEGER,
   ADD COLUMN IF NOT EXISTS exchange_rate DECIMAL(18,8),
   ADD COLUMN IF NOT EXISTS exchange_rate_source VARCHAR(60),
   ADD COLUMN IF NOT EXISTS exchange_rate_timestamp TIMESTAMPTZ,
   ADD COLUMN IF NOT EXISTS exchange_rate_target_currency_id INTEGER
 `);

 // Historic rows were written without conversion, so the stored budget IS the
 // original and the rate that produced it was 1. Only untouched rows are
 // written, so every boot after the first changes nothing.
 const backfilled = await client.query(`
  UPDATE category_budget_accounts
  SET original_budget = COALESCE(budget, 0),
   original_currency_id = currency_id,
   exchange_rate = 1.0,
   exchange_rate_source = 'identity',
   exchange_rate_timestamp = account_start_date,
   exchange_rate_target_currency_id = currency_id
  WHERE original_currency_id IS NULL
 `);

 if (backfilled.rowCount > 0) {
  console.log(
   pc.green(`category_budget_accounts: ${backfilled.rowCount} FX row(s) backfilled.`),
  );
 }

 await client.query(`
  ALTER TABLE category_budget_accounts
   ALTER COLUMN original_budget SET DEFAULT 0,
   ALTER COLUMN exchange_rate SET DEFAULT 1.0,
   ALTER COLUMN exchange_rate_source SET DEFAULT 'identity',
   ALTER COLUMN exchange_rate_timestamp SET DEFAULT CURRENT_TIMESTAMP
 `);

 // A row whose currency_id is still NULL leaves both ids NULL here, and a
 // SET NOT NULL over it raises — which means process.exit(1) in index.js, the
 // whole application down over a defect that only degrades the budget module.
 // Same reasoning as ensureCategoryBudgetCurrency: warn and let the boot go on.
 //
 // is_nullable is read for the same reason it is read there: skipping the ALTER
 // when the column is already NOT NULL avoids an ACCESS EXCLUSIVE lock on every
 // boot for a no-op. One column answers for all six, since they are set
 // together and never separately.
 const { rows } = await client.query(`
  SELECT
   (SELECT count(*)::int FROM category_budget_accounts
    WHERE original_currency_id IS NULL
     OR exchange_rate_target_currency_id IS NULL) AS remaining,
   (SELECT is_nullable FROM information_schema.columns
    WHERE table_name = 'category_budget_accounts'
     AND column_name = 'original_currency_id') AS is_nullable
 `);
 const { remaining, is_nullable } = rows[0];

 if (remaining > 0) {
  console.warn(
   pc.yellow(
    `category_budget_accounts: ${remaining} row(s) have no currency to resolve ` +
     `their FX origin. Leaving the FX columns nullable.`,
   ),
  );
  return;
 }

 if (is_nullable === 'YES') {
  await client.query(`
   ALTER TABLE category_budget_accounts
    ALTER COLUMN original_budget SET NOT NULL,
    ALTER COLUMN original_currency_id SET NOT NULL,
    ALTER COLUMN exchange_rate SET NOT NULL,
    ALTER COLUMN exchange_rate_source SET NOT NULL,
    ALTER COLUMN exchange_rate_timestamp SET NOT NULL,
    ALTER COLUMN exchange_rate_target_currency_id SET NOT NULL
  `);
  console.log(pc.green('category_budget_accounts: FX columns are now NOT NULL.'));
 }

 // Guarded so the function stays idempotent: ADD CONSTRAINT has no
 // IF NOT EXISTS. Names copied from 014 verbatim, so a database built by the
 // runner and one built by this path are indistinguishable.
 await client.query(`
  DO $$
  BEGIN
   IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'category_budget_accounts_exchange_rate_check'
   ) THEN
    ALTER TABLE category_budget_accounts
     ADD CONSTRAINT category_budget_accounts_exchange_rate_check
     CHECK (exchange_rate > 0);
   END IF;

   IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'category_budget_accounts_original_currency_id_fkey'
   ) THEN
    ALTER TABLE category_budget_accounts
     ADD CONSTRAINT category_budget_accounts_original_currency_id_fkey
     FOREIGN KEY (original_currency_id) REFERENCES currencies(currency_id)
     ON DELETE RESTRICT ON UPDATE CASCADE;
   END IF;

   IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'category_budget_accounts_exchange_rate_target_currency_id_fkey'
   ) THEN
    ALTER TABLE category_budget_accounts
     ADD CONSTRAINT category_budget_accounts_exchange_rate_target_currency_id_fkey
     FOREIGN KEY (exchange_rate_target_currency_id) REFERENCES currencies(currency_id)
     ON DELETE RESTRICT ON UPDATE CASCADE;
   END IF;
  END
  $$;
 `);
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
 //
 // The FX columns 017 added are written here, not left to their defaults: the
 // two currency ids have none, and original_budget_amount would default to 0
 // and claim the user typed nothing. A legacy cba.budget was stored without
 // conversion, so its origin IS the amount and its currency IS cba.currency_id.
 // exchange_rate and exchange_rate_source keep their defaults, which record
 // exactly that: an identity conversion at rate 1.
 const allocations = await client.query(`
  INSERT INTO budget_monthly_allocations (
   account_id, budget_month, budget_amount,
   original_budget_amount, original_currency_id, exchange_rate_target_currency_id)
  SELECT cba.account_id,
   date_trunc('month', ua.account_start_date AT TIME ZONE u.timezone)::date,
   cba.budget,
   cba.budget,
   cba.currency_id,
   cba.currency_id
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

// ===========================================
// 🧩 FUNCTION: Historical rate store
// ===========================================
/**
 * Ensure the historical rate store exists. Mirrors the DDL of migration
 * 021_create_daily_exchange_rates.sql.
 *
 * Deliberately NOT part of the mainTables array, for the same reason
 * ensureBudgetTables is not: that array runs under Promise.allSettled, so a
 * rejected table is only logged, never thrown. This one references currencies,
 * so it needs a real failure when it cannot be created.
 *
 * Separate from exchange_rates on purpose, and it has to stay that way.
 * exchange_rates caches the CURRENT rate and is designed to be discarded: the
 * createTables path above drops it unconditionally and recreateExchangeRatesTable
 * below drops it on demand. This table is the append-only history a back-dated
 * movement is valued from, so a reset of the cache must not touch it. See 021
 * for the third reason — the unique key of exchange_rates is the contract two
 * live ON CONFLICT upserts depend on.
 *
 * @param {object} client - Database client (pool or transaction)
 */
export async function ensureDailyExchangeRatesTable(client = pool) {
 console.log(pc.cyan('Ensuring historical rate store...'));

 // See 021 for why rate_date and fetched_at are both kept, why no row is ever
 // written for a day the provider did not quote, and why the unique constraint
 // is a correctness rule rather than index tuning. See 024 for why source is
 // part of that key: an observation is a fact OF A PROVIDER, and the coverage
 // test the resolver runs is per provider, so a key without source lets the
 // first provider to write a day block every other one out of it forever.
 //
 // This DDL and 024 must declare the same four columns. A database created here
 // and then migrated would otherwise have its key rewritten under it, and one
 // created here and never migrated would keep a key the resolver contradicts.
 await client.query(`
  CREATE TABLE IF NOT EXISTS daily_exchange_rates (
   daily_rate_id      SERIAL PRIMARY KEY,
   base_currency_id   INTEGER NOT NULL
    REFERENCES currencies(currency_id) ON DELETE RESTRICT ON UPDATE CASCADE,
   target_currency_id INTEGER NOT NULL
    REFERENCES currencies(currency_id) ON DELETE RESTRICT ON UPDATE CASCADE,
   rate_date          DATE          NOT NULL,
   exchange_rate      DECIMAL(18,8) NOT NULL CHECK (exchange_rate > 0),
   source             VARCHAR(30)   NOT NULL,
   fetched_at         TIMESTAMPTZ   NOT NULL DEFAULT CURRENT_TIMESTAMP,
   created_at         TIMESTAMPTZ   NOT NULL DEFAULT CURRENT_TIMESTAMP,

   CONSTRAINT uq_daily_exchange_rate
    UNIQUE (base_currency_id, target_currency_id, rate_date, source)
  )
 `);

 console.log(pc.green('Historical rate store verified/created.'));
}

/**
 * Ensure the query-coverage store exists. Mirrors the DDL of migration
 * 023_create_exchange_rate_query_coverage.sql.
 *
 * Deliberately NOT part of the mainTables array, for the same reason
 * ensureDailyExchangeRatesTable is not: that array runs under
 * Promise.allSettled, so a rejected table is only logged, never thrown. This
 * one references currencies and needs a real failure when it cannot be created.
 *
 * What a row means: on fetched_at, this installation asked source for the
 * base/target pair over the covered day range, and got a complete answer back.
 * It is a fact about our own network traffic, not about any rate. It is what
 * lets the resolver tell "the provider published nothing that day" from "we
 * never downloaded that period" — two situations that look identical in
 * daily_exchange_rates, and which the resolver currently reads as the first.
 *
 * See 023 for the measured error this closes, for why a valid_until column on
 * the rate was rejected in its place, and for why the exclusion constraint is a
 * prerequisite rather than an option.
 *
 * @param {object} client - Database client (pool or transaction)
 */
export async function ensureExchangeRateQueryCoverageTable(client = pool) {
 console.log(pc.cyan('Ensuring historical rate query coverage...'));

 // Before the table, not merely somewhere in this function: the exclusion
 // constraint below mixes integer equality with range overlap in one GiST
 // index, which cannot be created without the operator classes this installs.
 // A role without the privilege must fail here rather than leave a coverage
 // table that has lost its structural guarantee.
 await client.query('CREATE EXTENSION IF NOT EXISTS btree_gist');

 // Column names are reused from exchange_rates and daily_exchange_rates
 // wherever the idea already has a name there. covered is the only new one, and
 // it is a daterange in the half-open form PostgreSQL normalises to, so the
 // resolver tests it with @> against [effective day, requested day + 1).
 await client.query(`
  CREATE TABLE IF NOT EXISTS exchange_rate_query_coverage (
   coverage_id        SERIAL PRIMARY KEY,
   base_currency_id   INTEGER NOT NULL
    REFERENCES currencies(currency_id) ON DELETE RESTRICT ON UPDATE CASCADE,
   target_currency_id INTEGER NOT NULL
    REFERENCES currencies(currency_id) ON DELETE RESTRICT ON UPDATE CASCADE,
   source             VARCHAR(30) NOT NULL,
   covered            DATERANGE   NOT NULL,
   fetched_at         TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
   created_at         TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

   CONSTRAINT ck_exchange_rate_query_coverage_not_empty
    CHECK (NOT isempty(covered)),

   CONSTRAINT ex_exchange_rate_query_coverage_no_overlap
    EXCLUDE USING gist (
     source             WITH =,
     base_currency_id   WITH =,
     target_currency_id WITH =,
     covered            WITH &&
    )
  )
 `);

 console.log(pc.green('Historical rate query coverage verified/created.'));
}
