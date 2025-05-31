//version de SQL mayor a 13.
export const createMainTables = [
  {
    tblName: 'users',
    table: `CREATE TABLE IF NOT EXISTS users(user_id UUID PRIMARY KEY NOT NULL, username VARCHAR(50) UNIQUE NOT NULL, email VARCHAR(50) UNIQUE NOT NULL, user_firstname VARCHAR(25) NOT NULL,  user_lastname VARCHAR(25)  NOT NULL, user_contact VARCHAR(25), password_hashed VARCHAR(255), currency_id INT REFERENCES currencies(currency_id) ON DELETE SET NULL ON UPDATE CASCADE,google_id VARCHAR(255) UNIQUE, display_name VARCHAR(255), auth_method VARCHAR(50) DEFAULT 'password',created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,user_role_id INT  REFERENCES user_roles(user_role_id) ON DELETE SET NULL ON UPDATE CASCADE) `,
  },

  {
    tblName: 'user_accounts',
    table: `CREATE TABLE  IF NOT EXISTS user_accounts (account_id SERIAL PRIMARY KEY NOT NULL, 
user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE ON UPDATE CASCADE,
account_name VARCHAR(50) NOT NULL,
account_type_id INT  REFERENCES account_types(account_type_id) ON DELETE SET NULL ON UPDATE CASCADE, 
currency_id INT NOT NULL REFERENCES currencies(currency_id) ON DELETE RESTRICT ON UPDATE CASCADE, 
 account_starting_amount DECIMAL(15,2) NOT NULL,
 account_balance DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    account_start_date TIMESTAMP NOT NULL, 
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
)`,
  },

  //CHECK (account_start_date <= NOW()
  //------specific type accounts
  {
    tblName: 'bank_accounts',
    table:
      'CREATE TABLE IF NOT EXISTS bank_accounts(account_id INT PRIMARY KEY REFERENCES user_accounts(account_id), account_starting_amount DECIMAL (15,2),currency_id INT  REFERENCES currencies(currency_id) ON DELETE SET NULL ON UPDATE CASCADE, account_start_date TIMESTAMP NOT NULL )',
  },

  {
    tblName: 'investment_accounts',
    table:
      'CREATE TABLE IF NOT EXISTS investment_accounts(account_id INT PRIMARY KEY REFERENCES user_accounts(account_id), account_starting_amount DECIMAL (15,2),currency_id INT  REFERENCES currencies(currency_id) ON DELETE SET NULL ON UPDATE CASCADE, account_start_date TIMESTAMP NOT NULL)',
  },

  {
    tblName: 'income_source_accounts',
    table:
      'CREATE TABLE IF NOT EXISTS income_source_accounts(account_id INT PRIMARY KEY REFERENCES user_accounts(account_id), account_starting_amount DECIMAL (15,2),currency_id INT  REFERENCES currencies(currency_id) ON DELETE SET NULL ON UPDATE CASCADE, account_start_date TIMESTAMP NOT NULL)',
  },

  {
    tblName: `category_budget_accounts`,
    table: `CREATE TABLE IF NOT EXISTS category_budget_accounts(account_id INT PRIMARY KEY REFERENCES user_accounts(account_id), category_name VARCHAR(50) NOT NULL,category_nature_type_id INT REFERENCES category_nature_types(category_nature_type_id), subcategory VARCHAR(25), budget DECIMAL(15, 2),currency_id INT  REFERENCES currencies(currency_id) ON DELETE SET NULL ON UPDATE CASCADE, account_start_date TIMESTAMP NOT NULL)`,
  },

  {
    tblName: `debtor_accounts`,
    table: `CREATE TABLE IF NOT EXISTS debtor_accounts (
         account_id INT PRIMARY KEY REFERENCES user_accounts(account_id),
         value DECIMAL(15, 2),
         currency_id INT REFERENCES currencies(currency_id) ON DELETE SET NULL ON UPDATE CASCADE,
         debtor_name VARCHAR(25),
         debtor_lastname VARCHAR(25),
         selected_account_name VARCHAR(50),
          selected_account_id INT,account_start_date TIMESTAMP NOT NULL)`,
  },

  {
    tblName: `pocket_saving_accounts`,
    table: `CREATE TABLE IF NOT EXISTS pocket_saving_accounts (account_id INT PRIMARY KEY REFERENCES user_accounts(account_id), target DECIMAL(15, 2),
    note  VARCHAR(155), 
    desired_date TIMESTAMP NOT NULL,account_start_date TIMESTAMP NOT NULL)`,
  },

  // -----
  {
    tblName: 'movements',
    table: `CREATE TABLE IF NOT EXISTS movements (
    movement_id SERIAL PRIMARY KEY NOT NULL,
    movement_type_id INT NOT NULL REFERENCES movement_types(movement_type_id) ON DELETE SET NULL ON UPDATE CASCADE,
    user_id UUID NOT NULL REFERENCES "users"(user_id) ON DELETE CASCADE ON UPDATE CASCADE,
    currency_id INT  REFERENCES currencies(currency_id) ON DELETE SET NULL ON UPDATE CASCADE, 
    amount DECIMAL(15,2) NOT NULL,
    description VARCHAR(255),
    transaction_type_id INT, 
    actual_transaction_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
)`,
  },
  // {
  //   tblName: 'movement_types',
  //   table: `CREATE TABLE IF NOT EXISTS movement_types (movement_type_id SERIAL PRIMARY KEY NOT NULL, movement_type_name VARCHAR(15) NOT NULL CHECK (movement_type_name IN ('expense', 'income', 'investment', 'debt', 'pocket', 'transfer', 'receive','account-opening')))`,
  // },

  // {
  //   tblName: 'expense_movements',
  //   table: `CREATE TABLE IF NOT EXISTS expense_movements (movement_id INT PRIMARY KEY NOT NULL REFERENCES movements(movement_id) ON DELETE CASCADE ON UPDATE CASCADE,
  //   category_id INT,
  //   account_id INT NOT NULL REFERENCES user_accounts(account_id) ON DELETE CASCADE ON UPDATE CASCADE)`,
  // },

  {
    tblName: 'expense_categories',
    table: `CREATE TABLE IF NOT EXISTS expense_categories( 
    category_id SERIAL PRIMARY KEY NOT NULL,
    category_name VARCHAR(50) NOT NULL,
    nature_name VARCHAR(8) NOT NULL CHECK (nature_name IN ('must', 'need', 'other', 'want')),
    budget DECIMAL(15,2) NOT NULL, 
    currency_id INT  REFERENCES currencies(currency_id) ON DELETE SET NULL ON UPDATE CASCADE, 
)`,
  },

  //   {
  //     tblName: 'income_movements',
  //     table: `CREATE TABLE IF NOT EXISTS income_movements (
  //     movement_id INT PRIMARY KEY NOT NULL REFERENCES movements(movement_id) ON DELETE CASCADE ON UPDATE CASCADE,
  //     source_id INT NOT NULL REFERENCES expense_categories(category_id),
  //     account_id INT NOT NULL REFERENCES user_accounts(account_id) ON DELETE CASCADE ON UPDATE CASCADE
  // )`,
  //   },

  //   {
  //     tblName: 'investment_movements',
  //     table: `CREATE TABLE IF NOT EXISTS investment_movements (
  //     movement_id INT PRIMARY KEY NOT NULL REFERENCES movements(movement_id) ON DELETE CASCADE ON UPDATE CASCADE,
  //     account_id INT NOT NULL REFERENCES user_accounts(account_id) ON DELETE CASCADE ON UPDATE CASCADE
  // )`,
  //   },
  //   {
  //     tblName: 'debt_movements',
  //     table: `CREATE TABLE IF NOT EXISTS debt_movements (
  //     movement_id INT PRIMARY KEY NOT NULL REFERENCES movements(movement_id) ON DELETE CASCADE ON UPDATE CASCADE,
  //     debtor_id INT NOT NULL
  //  )`,
  //   },
  {
    tblName: 'debt_debtors',
    table: `CREATE TABLE IF NOT EXISTS debt_debtors (
    debtor_id SERIAL PRIMARY KEY NOT NULL,
    debtor_name VARCHAR(25) NOT NULL,
    debtor_lastname VARCHAR(25) NOT NULL
    )`,
  },
  //   {
  //     tblName: 'pocket_movements',
  //     table: `CREATE TABLE IF NOT EXISTS pocket_movements (
  //     pocket_id SERIAL PRIMARY KEY NOT NULL,
  //     movement_id INT NOT NULL REFERENCES movements(movement_id) ON DELETE CASCADE ON UPDATE CASCADE,
  //     pocket_name VARCHAR(50) NOT NULL,
  //     target_amount DECIMAL(15,2),
  //     pocket_note VARCHAR(50),
  //     desired_date TIMESTAMP
  // )`,
  //   },
  {
    tblName: 'transactions',
    table: `CREATE TABLE IF NOT EXISTS transactions(
transaction_id SERIAL PRIMARY KEY,
user_id UUID NOT NULL,
description TEXT,
amount DECIMAL(15,2) NOT NULL, 
movement_type_id INTEGER NOT NULL,
transaction_type_id INTEGER NOT NULL,
currency_id INTEGER NOT NULL, 
account_id INTEGER NOT NULL,
 source_account_id INT  ,
destination_account_id INT  , 
status VARCHAR(50) NOT NULL, 
transaction_actual_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP NOT NULL DEFAULT 
)`,
  },

  {
    tblName: 'refresh_tokens',
    table: `
CREATE TABLE IF NOT EXISTS refresh_tokens (
token_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
token TEXT NOT NULL UNIQUE,
expiration_date TIMESTAMP NOT NULL,
revoked BOOLEAN DEFAULT FALSE,
user_agent TEXT,
ip_address TEXT, 
created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
`,
  },
];

//REFERENCES user_accounts(account_id) ON DELETE SET NULL ON UPDATE CASCADE

export const createSearchIndexes = [
  {
    tblName: 'currencies',
    index: `CREATE UNIQUE INDEX index_currency_code ON currencies(currency_code)`,
  },
  {
    tblName: 'account_types',
    index: `CREATE UNIQUE INDEX index_account_type_name ON account_types(account_type_name)`,
  },

  {
    tblName: 'refresh_tokens',
    index: `CREATE INDEX idx_refresh_tokens_user_id ON refresh_tokens (user_id);`,
  },
];

// ===========================
// source_account_id INT  REFERENCES user_accounts(account_id) ON DELETE SET NULL ON UPDATE CASCADE,
// destination_account_id INT  REFERENCES user_accounts(account_id) ON DELETE SET NULL ON UPDATE CASCADE,
