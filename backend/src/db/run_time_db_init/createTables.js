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

     -- Email uniqueness ignoring case, as 025_email_case_insensitive_unique.sql
     -- adds it on the migration chain. The plain UNIQUE above lets
     -- 'Carlos@Mail.com' and 'carlos@mail.com' become two accounts, while
     -- sign-in folds both sides and reaches only one of them.
     CREATE UNIQUE INDEX IF NOT EXISTS users_email_lower_key ON users (lower(email));

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
    account_type_id INT NOT NULL REFERENCES account_types(account_type_id) ON DELETE RESTRICT ON UPDATE CASCADE,
    currency_id INT NOT NULL REFERENCES currencies(currency_id) ON DELETE RESTRICT ON UPDATE CASCADE, 
    account_starting_amount DECIMAL(15,2) NOT NULL,
    account_balance DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    note VARCHAR(155) ,
    account_start_date TIMESTAMPTZ NOT NULL, 
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMPTZ DEFAULT NULL,
    closed_at TIMESTAMPTZ DEFAULT NULL
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

 // The runtime counterpart of migration 029. The board reads one month at a
 // time, so both of its predicates are an equality on the owner or the pocket
 // followed by a range on a date — the order these two composites are written
 // in, and the only order in which the range stays one contiguous span.
 await client.query(
  `CREATE INDEX IF NOT EXISTS idx_pocket_allocations_pocket_date ON pocket_allocations(pocket_id, allocation_actual_date)`,
 );
 await client.query(
  `CREATE INDEX IF NOT EXISTS idx_pockets_user_created ON pockets(user_id, created_at)`,
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
 * Give an existing database the account-closure catalog entries: movement type
 * 10, transaction type 6, and a movement_types check constraint that admits the
 * new name.
 *
 * The runtime counterpart of migration 032, which had none. The other two
 * carriers of that catalog are both unreachable on a database that already
 * exists: the seeder declares the check inline in its CREATE TABLE, which only
 * runs when the table is absent, and tblMovementTypes() is called once inside
 * the first-time branch of initializeDatabase() rather than on every boot. So
 * an already-initialized database never receives either the rows or the check,
 * and a close fails on the foreign key because movement_types has no row 10.
 *
 * The check is realigned before the rows are inserted, not after: the old
 * constraint does not admit 'account-closure', so the insert would violate it.
 *
 * Reaches local databases only, like every ensure* here: a deployed instance
 * never calls initializeDatabase(). See the note above it for why.
 *
 * @param {object} client - Database client (pool or transaction)
 */
export async function ensureAccountClosureCatalog(client = pool) {
 const present = await client.query(`
  SELECT to_regclass('public.movement_types') IS NOT NULL AS table_exists
 `);

 // A virgin database gets both from the seeder's CREATE TABLE and its insert
 // loop, which carry the current list already.
 if (!present.rows[0].table_exists) return;

 const { rows: checks } = await client.query(`
  SELECT con.conname, pg_get_constraintdef(con.oid) AS definition
   FROM pg_constraint con
   JOIN pg_class rel ON rel.oid = con.conrelid
   JOIN pg_namespace ns ON ns.oid = rel.relnamespace
   WHERE ns.nspname = 'public'
    AND rel.relname = 'movement_types'
    AND con.contype = 'c'
 `);

 // Skips a no-op that would still take an ACCESS EXCLUSIVE lock on every boot.
 if (!checks.some((row) => row.definition.includes("'account-closure'"))) {
  for (const { conname } of checks) {
   await client.query(
    `ALTER TABLE movement_types DROP CONSTRAINT "${conname.replace(/"/g, '""')}"`,
   );
  }

  // The value order matches migration 032 and the seeder exactly:
  // pg_get_constraintdef renders an inline column check and a named table
  // check identically, so the two build paths compare equal only while both
  // lists stay in this order.
  await client.query(`
   ALTER TABLE movement_types
    ADD CONSTRAINT movement_types_movement_type_name_check
    CHECK (movement_type_name IN (
     'expense','income','investment','debt','pocket','transfer','receive',
     'account-opening','pnl','account-closure'))
  `);
  console.log(pc.green('movement_types check constraint realigned.'));
 }

 const inserted = await client.query(`
  WITH movement AS (
   INSERT INTO movement_types (movement_type_id, movement_type_name)
   VALUES (10, 'account-closure')
   ON CONFLICT (movement_type_id) DO NOTHING
   RETURNING 1
  ), transaction_kind AS (
   INSERT INTO transaction_types (transaction_type_id, transaction_type_name)
   VALUES (6, 'account-closure')
   ON CONFLICT (transaction_type_id) DO NOTHING
   RETURNING 1
  )
  SELECT
   (SELECT count(*) FROM movement) AS movement_rows,
   (SELECT count(*) FROM transaction_kind) AS transaction_rows
 `);

 const { movement_rows, transaction_rows } = inserted.rows[0];
 if (Number(movement_rows) > 0 || Number(transaction_rows) > 0) {
  console.log(pc.green('account-closure catalog entries added.'));
 }
}

/**
 * Close user_accounts.account_type_id: NOT NULL, and RESTRICT instead of
 * SET NULL when an account_types row is deleted.
 *
 * The runtime counterpart of migration 033. The mainTables DDL above declares
 * both, but it is a CREATE TABLE IF NOT EXISTS and only runs on a virgin
 * database, so an already-created one would never get either — the same reason
 * addFxAuditColumns() exists.
 *
 * Refuses rather than repairs when untyped rows exist: the type an account
 * should have is not derivable from anything the row carries, so a guess here
 * would write a wrong type under the appearance of a migration. It leaves the
 * schema untouched and says what is blocking, which is recoverable; a wrong
 * type is not.
 *
 * @param {object} client - Database client (pool or transaction)
 */
export async function ensureAccountTypeRequired(client = pool) {
 const { rows } = await client.query(`
  SELECT
   (SELECT count(*)::int FROM user_accounts WHERE account_type_id IS NULL) AS untyped,
   (SELECT is_nullable FROM information_schema.columns
     WHERE table_name = 'user_accounts' AND column_name = 'account_type_id') AS is_nullable,
   (SELECT con.conname FROM pg_constraint con
     JOIN pg_class rel ON rel.oid = con.conrelid
     JOIN pg_attribute att
      ON att.attrelid = rel.oid AND att.attnum = ANY (con.conkey)
     WHERE rel.relname = 'user_accounts'
      AND con.contype = 'f'
      AND att.attname = 'account_type_id') AS fk_name,
   (SELECT con.confdeltype FROM pg_constraint con
     JOIN pg_class rel ON rel.oid = con.conrelid
     JOIN pg_attribute att
      ON att.attrelid = rel.oid AND att.attnum = ANY (con.conkey)
     WHERE rel.relname = 'user_accounts'
      AND con.contype = 'f'
      AND att.attname = 'account_type_id') AS on_delete
 `);
 const { untyped, is_nullable, fk_name, on_delete } = rows[0];

 if (untyped > 0) {
  console.warn(
   pc.yellow(
    `user_accounts: ${untyped} row(s) carry a NULL account_type_id. ` +
     'Leaving the column nullable and the foreign key as it is. Assign a ' +
     'type to those accounts, then restart.',
   ),
  );
  return;
 }

 // Both guards skip a no-op that would still take an ACCESS EXCLUSIVE lock on
 // every boot.
 if (is_nullable === 'YES') {
  await client.query(
   'ALTER TABLE user_accounts ALTER COLUMN account_type_id SET NOT NULL',
  );
  console.log(pc.green('user_accounts.account_type_id is now NOT NULL.'));
 }

 // 'r' is RESTRICT. The name is looked up rather than assumed: it is generated
 // by Postgres, and a hardcoded one fails silently on the database where it
 // differs.
 if (fk_name && on_delete !== 'r') {
  await client.query(`ALTER TABLE user_accounts DROP CONSTRAINT "${fk_name}"`);
  await client.query(`
   ALTER TABLE user_accounts
    ADD CONSTRAINT user_accounts_account_type_id_fkey
    FOREIGN KEY (account_type_id) REFERENCES account_types (account_type_id)
    ON DELETE RESTRICT ON UPDATE CASCADE
  `);
  console.log(
   pc.green('user_accounts.account_type_id now RESTRICTs catalog deletion.'),
  );
 }
}

/**
 * Add user_accounts.closed_at, the timestamp recording when an account was
 * closed rather than deleted.
 *
 * The runtime counterpart of migration 034. The mainTables DDL above declares
 * the column, but it is a CREATE TABLE IF NOT EXISTS and only runs on a virgin
 * database, so an already-created one would never get it — the same reason
 * ensureAccountTypeRequired() exists.
 *
 * Adds the column and nothing else. What fills it, what reads it and what
 * clears the residue afterwards are code changes across four owners, and none
 * of them belongs on a boot path.
 *
 * @param {object} client - Database client (pool or transaction)
 */
export async function ensureAccountClosedAt(client = pool) {
 const { rows } = await client.query(`
  SELECT EXISTS (
   SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_accounts' AND column_name = 'closed_at'
  ) AS present
 `);

 // Skips a no-op that would still take an ACCESS EXCLUSIVE lock on every boot.
 if (rows[0].present) return;

 // Nullable and with no default, so this rewrites no row: the lock is taken
 // for a catalog update and released, whatever the size of the table.
 await client.query(
  'ALTER TABLE user_accounts ADD COLUMN closed_at TIMESTAMPTZ DEFAULT NULL',
 );
 console.log(pc.green('user_accounts.closed_at added.'));
}

/**
 * Add transactions.opening_for_account_id, mark the row that opens each
 * account, and enforce that an account is opened once.
 *
 * The runtime counterpart of migration 022, written on 2026-09-08 after
 * ensureAccountRegistry() below hit its absence: a first run against a copy of
 * the 2026-08-21 production dump raised 42703 building a foreign key on a
 * column no boot path ever adds. The column is declared in the mainTables DDL
 * above, that DDL is CREATE TABLE IF NOT EXISTS, and the guard that makes it
 * safe to re-run is the same guard that makes it unable to alter anything.
 *
 * WHY IT MATTERS BEYOND THE REGISTRY. Two live predicates dereference the
 * column — overviewBalanceRepository.js:219 and derivedBalance.js:86 — and
 * derivedBalance is imported by twenty files under backend/src, among them
 * dashboardController.js, getAccountController.js, transactionController.js,
 * getClosePreview.js and accountAllocationRepository.js. On a database that
 * never met the runner the failure is not one page, it is the derived balance
 * everywhere it is computed.
 *
 * ALL THREE PIECES OR NONE, in one transaction: the column with its foreign
 * key, the backfill that marks one opening row per account, and the partial
 * unique index. The index without the backfill would be an empty guarantee; the
 * backfill without the index would leave the duplicate this migration exists to
 * prevent.
 *
 * THE INDEX IS MISSING ON A VIRGIN BUILD TOO, and db:parity cannot see it.
 * CREATE UNIQUE INDEX does not write a pg_constraint row, and schemaParity.js
 * compares columns, constraints and seeded catalog rows and never reads
 * pg_indexes. So a boot-built database has always carried the column without
 * the uniqueness behind it, and the check reported green. Measured 2026-09-08.
 *
 * @param {object} client - Database client (pool or transaction)
 */
export async function ensureTransactionOpeningFor(client = pool) {
 await client.query('BEGIN');

 try {
  const {
   rows: [state],
  } = await client.query(`
   SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_name = 'transactions'
       AND column_name = 'opening_for_account_id'
   ) AS column_present,
   to_regclass('public.account_registry') IS NOT NULL AS registry
  `);

  if (!state.column_present) {
   // 022 points the key at user_accounts and ensureAccountRegistry() below
   // moves it to account_registry. When the registry is already there — a
   // database that met this boot path before — it is pointed at its final
   // parent directly, so the next call does not drop and re-add a key it just
   // created. Same end state either way; this only avoids the churn.
   const parent = state.registry ? 'account_registry' : 'user_accounts';

   await client.query(`
    ALTER TABLE transactions
     ADD COLUMN opening_for_account_id INTEGER
      REFERENCES ${parent} (account_id)
      ON DELETE RESTRICT ON UPDATE CASCADE
   `);
   console.log(
    pc.green(`transactions.opening_for_account_id added, keyed on ${parent}.`),
   );

   // THE BACKFILL RUNS ONLY WHEN THE COLUMN WAS JUST ADDED. On a database that
   // already has it the marking is maintained by the creation controllers, and
   // recomputing it here would overwrite their decisions with this query's.
   //
   // Both conditions together identify the row, because neither alone is
   // sound: the earliest opening row alone marks a funding leg on an account
   // with no opening row of its own, and the matching amount alone marks a
   // funding leg that happens to move the starting amount. The movement type
   // is read from the catalog by name so this does not encode a seeded id.
   const marked = await client.query(`
    UPDATE transactions tr
    SET opening_for_account_id = tr.account_id
    FROM user_accounts ua
    WHERE ua.account_id = tr.account_id
     AND tr.movement_type_id = (
      SELECT mt.movement_type_id FROM movement_types mt
      WHERE mt.movement_type_name = 'account-opening'
     )
     AND tr.amount = ua.account_starting_amount
     AND tr.transaction_id = (
      SELECT MIN(t2.transaction_id) FROM transactions t2
      WHERE t2.account_id = tr.account_id
       AND t2.movement_type_id = (
        SELECT mt.movement_type_id FROM movement_types mt
        WHERE mt.movement_type_name = 'account-opening'
       )
     )
   `);

   console.log(
    pc.green(`opening row marked for ${marked.rowCount} account(s).`),
   );
  }

  // The index is checked on every boot and not only when the column is new,
  // because a virgin build gets the column from the mainTables DDL and has
  // never got the index from anywhere.
  const {
   rows: [{ duplicates }],
  } = await client.query(`
   SELECT count(*)::int AS duplicates FROM (
    SELECT opening_for_account_id FROM transactions
     WHERE opening_for_account_id IS NOT NULL
     GROUP BY opening_for_account_id HAVING count(*) > 1
   ) d
  `);

  if (duplicates > 0) {
   // Warn and leave it, the way ensureAccountTypeRequired() does with an
   // untyped account. The duplicate is exactly the state 022 exists to remove,
   // so it has to be seen — but a boot that refuses to start is a worse way to
   // report it than a database that starts and says so.
   console.warn(
    pc.yellow(
     `${duplicates} account(s) carry more than one opening row. ` +
      'uq_transaction_opening_for_account was not created. Resolve the ' +
      'duplicates, then restart.',
    ),
   );
  } else {
   await client.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS uq_transaction_opening_for_account
     ON transactions (opening_for_account_id)
     WHERE opening_for_account_id IS NOT NULL
   `);
  }

  await client.query('COMMIT');
 } catch (error) {
  await client.query('ROLLBACK');
  throw error;
 }
}

/**
 * Create account_registry, the trigger that populates it, the backfill and the
 * seven repointed foreign keys, plus the close_reason cap of migration 036.
 *
 * The runtime counterpart of migration 035, written on 2026-09-08 after the
 * condition the previous note in this place stated was met: 035 applied at
 * least once, its constraints read back, the counterpart derived from what was
 * applied rather than from the SQL. It was derived from
 * fintrack_prod_rehearsal_full on 2026-09-08 — pg_get_constraintdef,
 * pg_get_triggerdef, pg_get_functiondef and information_schema.columns — and
 * not from 035_create_account_registry.sql. Migration 010 is why: it was edited
 * in place after it had been applied, ensureBudgetTables() kept the old shape,
 * and fintrack_dev still holds three tables the current file does not create.
 *
 * WHY IT EXISTS AT ALL. Five statements in overviewAccountRepository.js — at
 * 44, 88, 191, 221 and 255 — are built on accountIdentityCte, whose FROM clause
 * is account_registry. They resolve the income account ids, the expense account
 * ids, the profit-and-loss account ids, the ids of one requested type, and the
 * oldest account date, and every card on the Overview page is cut against one
 * of them. On a database built by this path and never met by the runner the
 * table is absent, so the page returns an error rather than degrading. Measured
 * by the Overview session on 2026-09-08.
 *
 * ALL FOUR PIECES OR NONE, AND HERE THAT IS ENFORCED RATHER THAN INTENDED.
 * The whole function runs in one transaction. A counterpart that created the
 * table without repointing the keys would give a registry populated for new
 * accounts and empty for the closed ones the CTE exists to recover, which reads
 * as a working page returning silently short history — worse than the error it
 * replaced.
 *
 * A KEY WHOSE COLUMN OR TABLE IS ABSENT IS SKIPPED AND REPORTED, not raised.
 * Both cases belong to migrations this function does not own — 010 for
 * budget_monthly_allocations, 022 for transactions.opening_for_account_id — and
 * failing the boot over them would take the whole registry down for a column
 * somebody else owes. The warning is the record that the registry is wired
 * short on that database.
 *
 * WHAT IT DOES NOT REACH. Production, like every other ensure* call in this
 * file: the deployed backend does not run the boot DDL. The population this
 * serves is a developer creating a fresh local database, or a self-hosted one
 * the runner has never been pointed at.
 *
 * @param {object} client - Database client (pool or transaction)
 */
export async function ensureAccountRegistry(client = pool) {
 // The columns are the applied ones. account_name and category_name are
 // VARCHAR(50) and subcategory VARCHAR(25) because that is what 035 created,
 // mirroring user_accounts — not the VARCHAR(255) that 013's backup table uses
 // for a column of the same name.
 const CREATE_REGISTRY = `
  CREATE TABLE IF NOT EXISTS account_registry (
   account_id INTEGER PRIMARY KEY,
   user_id UUID NOT NULL
    REFERENCES users(user_id) ON DELETE CASCADE ON UPDATE CASCADE,
   account_name VARCHAR(50),
   account_type_id INTEGER
    REFERENCES account_types(account_type_id) ON DELETE SET NULL ON UPDATE CASCADE,
   currency_id INTEGER
    REFERENCES currencies(currency_id) ON DELETE RESTRICT ON UPDATE CASCADE,
   account_starting_amount NUMERIC(15, 2),
   account_start_date TIMESTAMPTZ,
   account_created_at TIMESTAMPTZ,
   category_name VARCHAR(50),
   subcategory VARCHAR(25),
   category_nature_type_id INTEGER
    REFERENCES category_nature_types(category_nature_type_id),
   closed_at TIMESTAMPTZ,
   closed_by UUID
    REFERENCES users(user_id) ON DELETE SET NULL ON UPDATE CASCADE,
   close_reason TEXT,
   CONSTRAINT chk_close_reason_accompanies_closure CHECK (
    (closed_at IS NULL) = (close_reason IS NULL)
    AND (close_reason IS NULL OR close_reason ~ '[^[:space:]]')
   )
  )
 `;

 // The trigger body carries no ON CONFLICT and that is deliberate: a reissued
 // account id must fail rather than inherit another account's closure stamp.
 // The reasoning is in 035 section 2 and in the applied function's own comment;
 // it is not repeated here because a copy of it would drift.
 const CREATE_TRIGGER_FN = `
  CREATE OR REPLACE FUNCTION fn_register_account_identity()
  RETURNS TRIGGER AS $fn$
  BEGIN
   INSERT INTO account_registry (account_id, user_id)
   VALUES (NEW.account_id, NEW.user_id);
   RETURN NEW;
  END;
  $fn$ LANGUAGE plpgsql
 `;

 // Table, column, and nothing else: the constraint NAME is looked up rather
 // than assumed, the same reason ensureAccountTypeRequired() gives — Postgres
 // generates it, and a hardcoded one fails silently where it differs.
 //
 // budget_monthly_allocations is the entry that makes a name-based sweep wrong.
 // In this path its account_id points at category_budget_accounts, declared at
 // the ensureBudgetTables() DDL above, not at user_accounts. A repoint keyed on
 // "whatever references user_accounts" would skip it and leave a closed
 // category's past months tied to the extension row that CLOSE deletes.
 const REPOINTED_KEYS = [
  ['transactions', 'account_id'],
  ['transactions', 'source_account_id'],
  ['transactions', 'destination_account_id'],
  ['transactions', 'opening_for_account_id'],
  ['pocket_allocations', 'source_account_id'],
  ['debtor_accounts', 'selected_account_id'],
  ['budget_monthly_allocations', 'account_id'],
 ];

 await client.query('BEGIN');

 try {
  const {
   rows: [{ registry }],
  } = await client.query(
   "SELECT to_regclass('public.account_registry') IS NOT NULL AS registry",
  );

  if (!registry) {
   await client.query(CREATE_REGISTRY);
   console.log(pc.green('account_registry created.'));
  }

  // The ownership filter of every historical read, and the partial index the
  // closed-account reads use. IF NOT EXISTS on both, so this costs a catalog
  // lookup on a boot where they are already there.
  await client.query(`
   CREATE INDEX IF NOT EXISTS idx_account_registry_user_id
    ON account_registry (user_id)
  `);
  await client.query(`
   CREATE INDEX IF NOT EXISTS idx_account_registry_closed
    ON account_registry (user_id, closed_at)
    WHERE closed_at IS NOT NULL
  `);

  // Migration 036's cap. Added here rather than in a separate ensure* call
  // because a constraint on a table this function creates has nowhere else to
  // live: it would run before the table existed on a virgin build.
  const {
   rows: [{ capped }],
  } = await client.query(`
   SELECT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conrelid = 'account_registry'::regclass
       AND conname = 'chk_close_reason_length'
   ) AS capped
  `);

  if (!capped) {
   await client.query(`
    ALTER TABLE account_registry
     ADD CONSTRAINT chk_close_reason_length
     CHECK (close_reason IS NULL OR length(close_reason) <= 255)
   `);
   console.log(pc.green('account_registry.close_reason capped at 255.'));
  }

  await client.query(CREATE_TRIGGER_FN);
  await client.query(
   'DROP TRIGGER IF EXISTS trg_register_account_identity ON user_accounts',
  );
  await client.query(`
   CREATE TRIGGER trg_register_account_identity
    AFTER INSERT ON user_accounts
    FOR EACH ROW
    EXECUTE FUNCTION fn_register_account_identity()
  `);

  // THE BACKFILL PRECEDES THE REPOINTS AND THE ORDER IS NOT COSMETIC. Every key
  // below validates against this table as it is created, so a repoint taken
  // first fails on the first surviving transaction row.
  //
  // One row per live account carrying the id and the owner and nulls everywhere
  // else: a live account's values are read from user_accounts, and a stamp here
  // would make a second writer for the same fact.
  const backfilled = await client.query(`
   INSERT INTO account_registry (account_id, user_id)
   SELECT ua.account_id, ua.user_id FROM user_accounts ua
   ON CONFLICT (account_id) DO NOTHING
  `);

  if (backfilled.rowCount > 0) {
   console.log(
    pc.green(`account_registry backfilled ${backfilled.rowCount} account(s).`),
   );
  }

  for (const [table, column] of REPOINTED_KEYS) {
   // THE COLUMN IS CHECKED AND NOT ASSUMED, and a real database taught this.
   // transactions.opening_for_account_id is added by 022, which has no boot
   // counterpart: the column is declared in the mainTables DDL, that DDL is
   // CREATE TABLE IF NOT EXISTS, so a database created before 022 and never met
   // by the runner does not have it. Measured 2026-09-08 on a copy of the
   // production dump, where this loop raised 42703 and rolled the whole
   // function back. Skipping the key is right; failing the boot over a column
   // another migration owns is not.
   const {
    rows: [{ present }],
   } = await client.query(
    `SELECT EXISTS (
      SELECT 1 FROM information_schema.columns
       WHERE table_name = $1 AND column_name = $2
     ) AS present`,
    [table, column],
   );

   if (!present) {
    // information_schema.columns returns nothing for a missing table and for a
    // missing column alike, and the two send a reader to different files, so
    // the message says which. On the 2026-08-21 production dump this reported
    // pocket_allocations absent as a table (020) and opening_for_account_id
    // absent as a column (022).
    const {
     rows: [{ table_present }],
    } = await client.query(
     'SELECT to_regclass($1) IS NOT NULL AS table_present',
     [`public.${table}`],
    );

    console.warn(
     pc.yellow(
      table_present
       ? `${table}.${column} is absent; its key was not repointed at ` +
          'account_registry. The column belongs to another migration.'
       : `${table} is absent; its ${column} key was not repointed at ` +
          'account_registry. The table belongs to another migration.',
     ),
    );
    continue;
   }

   const { rows } = await client.query(
    `SELECT con.conname,
            con.confrelid::regclass::text AS references_table
       FROM pg_constraint con
       JOIN pg_class rel ON rel.oid = con.conrelid
       JOIN pg_attribute att
         ON att.attrelid = rel.oid AND att.attnum = ANY (con.conkey)
      WHERE rel.relname = $1
        AND con.contype = 'f'
        AND att.attname = $2`,
    [table, column],
   );

   const existing = rows[0];

   // Already repointed: skip the DROP and ADD, which would otherwise take an
   // ACCESS EXCLUSIVE lock on transactions and revalidate every row of it on
   // every boot.
   if (existing && existing.references_table === 'account_registry') continue;

   if (existing) {
    await client.query(
     `ALTER TABLE ${table} DROP CONSTRAINT "${existing.conname}"`,
    );
   }

   await client.query(`
    ALTER TABLE ${table}
     ADD CONSTRAINT ${table}_${column}_fkey
     FOREIGN KEY (${column}) REFERENCES account_registry (account_id)
     ON DELETE RESTRICT ON UPDATE CASCADE
   `);

   console.log(
    pc.green(`${table}.${column} now references account_registry.`),
   );
  }

  await client.query('COMMIT');
 } catch (error) {
  await client.query('ROLLBACK');
  throw error;
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
