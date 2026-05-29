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
     google_id VARCHAR(255) UNIQUE,
     display_name VARCHAR(255),
     auth_method VARCHAR(255) DEFAULT 'password',
     user_role_id INT REFERENCES user_roles(user_role_id) ON DELETE SET NULL ON UPDATE CASCADE,
     deleted_at TIMESTAMPTZ DEFAULT NULL,
     created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
     updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
      )`,
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
    budget DECIMAL(15, 2),currency_id INT  REFERENCES currencies(currency_id) ON DELETE SET NULL ON UPDATE CASCADE, account_start_date TIMESTAMPTZ NOT NULL)`,
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
     created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
      )`,
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
      exchange_rate DECIMAL(15, 6) NOT NULL CHECK (exchange_rate > 0),
      source VARCHAR(30) NOT NULL,
      fetched_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE (base_currency_id,target_currency_id, fetched_at)
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
  console.log(pc.bgMagenta('🔥 VERSIÓN DE CREATE TABLES CON FX 🔥'));

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

    // 2. Do migration of FX columns (idempotent) / Ejecutar la migración de columnas FX (idempotente)
    await addFxAuditColumns(client);
    console.log('🔥 addFxAuditColumns finalizado');
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

  const alterQueries = [
    `ALTER TABLE transactions ADD COLUMN IF NOT EXISTS original_amount DECIMAL(15,2) NOT NULL DEFAULT 0`,
    `ALTER TABLE transactions ADD COLUMN IF NOT EXISTS original_currency_id INTEGER NOT NULL DEFAULT 1`,
    `ALTER TABLE transactions ADD COLUMN IF NOT EXISTS exchange_rate DECIMAL(18,8) NOT NULL DEFAULT 1.0 CHECK (exchange_rate > 0)`,
    `ALTER TABLE transactions ADD COLUMN IF NOT EXISTS exchange_rate_source VARCHAR(100) NOT NULL DEFAULT 'identity'`,
    `ALTER TABLE transactions ADD COLUMN IF NOT EXISTS exchange_rate_timestamp TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP`,
    `ALTER TABLE transactions ADD COLUMN IF NOT EXISTS exchange_rate_target_currency_id INTEGER NOT NULL DEFAULT 1`,
  ];

  for (const query of alterQueries) {
    await client.query(query);
  }
  // Add constraints FK (if do not exist)
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
