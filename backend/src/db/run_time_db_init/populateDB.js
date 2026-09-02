// backend/src/db/run_time_migrations/populateDB.js
//This is a run time db seed
import {
  createError,
  handlePostgresErrorEs,
} from '../../utils/errorHandling.js';
import { pool } from '../config/configDB.js';
import pc from 'picocolors';

//========================================
//check table name validation
function isValidTableName(tableName) {
  return /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(tableName); // only allowed table names from create table array | Solo permite nombres de tablas válidos
}
//check if table exists
export async function tableExists(client = pool, tableName) {
  if (!isValidTableName(tableName)) {
    throw new Error('Invalid table name');
  }
  const queryText = `
    SELECT EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_name = $1
    );
  `;
  const result = await client.query(queryText, [tableName]);
  console.log(pc.magentaBright(tableName), ' exists? ', result.rows[0].exists);
  return result.rows[0].exists; // Returns true or false
}

//check if table is populated
async function isTablePopulated(client = pool, tableName, minCount = 1) {
  if (!isValidTableName(tableName)) {
    throw new Error('Invalid table name');
  }
  const queryText = `SELECT COUNT(*) FROM ${tableName}`;
  const result = await client.query(queryText);
  // return result.rows[0].count >= minCount;
  return parseInt(result.rows[0].count, 10) >= minCount;
}
//==========================================
// Catalogs seeded with explicit IDs.
//
// An explicit ID does not advance a SERIAL sequence, so the first insert that
// omits the ID fails with a duplicate primary key — long after the seed, on the
// first row a user creates. Only budget_frequency_types was guarded, and only
// at seed time, which never reaches a database seeded before the guard existed.
//
// Not every column below is a SERIAL. pg_get_serial_sequence returns NULL for a
// plain INT and the realign skips it, so this stays a list of seeded catalogs
// instead of a list of DDL details to keep in sync.
const SEEDED_CATALOGS = [
  ['account_types', 'account_type_id'],
  ['currencies', 'currency_id'],
  ['category_nature_types', 'category_nature_type_id'],
  ['user_roles', 'user_role_id'],
  ['transaction_types', 'transaction_type_id'],
  ['movement_types', 'movement_type_id'],
  ['budget_frequency_types', 'budget_frequency_type_id'],
];

/**
 * Realign one catalog's identity sequence with the rows the table holds.
 *
 * Identifiers cannot be parameterized, hence the validation before they are
 * interpolated. The lookup query is separate because MAX(col) FROM tbl fails to
 * parse when the table is absent, so existence has to be settled first.
 */
const resyncSequence = async (client, tableName, columnName) => {
  if (!isValidTableName(tableName) || !isValidTableName(columnName)) {
    throw new Error('Invalid identifier');
  }

  const { rows } = await client.query(
    `SELECT pg_get_serial_sequence($1, $2) AS seq WHERE to_regclass($1) IS NOT NULL`,
    [tableName, columnName],
  );

  if (rows.length === 0 || !rows[0].seq) {
    return false;
  }

  await client.query(
    `SELECT setval($1::regclass, COALESCE((SELECT MAX(${columnName}) FROM ${tableName}), 1))`,
    [rows[0].seq],
  );

  return true;
};

/**
 * Realign every seeded catalog sequence.
 *
 * Idempotent and cheap, so it runs on every boot rather than at seed time. That
 * placement is the point: the seeders are skipped once app_initialization says
 * the tables exist, which is exactly the database whose sequences are stale.
 *
 * @param {object} client - Database client (pool or transaction)
 */
export async function resyncCatalogSequences(client = pool) {
  let realigned = 0;

  for (const [tableName, columnName] of SEEDED_CATALOGS) {
    if (await resyncSequence(client, tableName, columnName)) {
      realigned += 1;
    }
  }

  console.log(
    pc.green(`Catalog sequences realigned (${realigned}/${SEEDED_CATALOGS.length}).`),
  );
}

//--
//currencies
export async function tblCurrencies(client = pool) {
  const currenciesValues = [
    {
      currency_id: 1,
      currency_code: 'usd',
      currency_name: 'us-dollars',
    },

    { currency_id: 2, currency_code: 'eur', currency_name: 'euros' },

    { currency_id: 3, currency_code: 'cop', currency_name: 'pesos col' },

    { currency_id: 4, currency_code: 'ves', currency_name: 'bs' },

    { currency_id: 5, currency_code: 'mxn', currency_name: 'pesos mxn' },
  ];

  try {
    //verify if table exists
    const exists = await tableExists(client, 'currencies');
    if (!exists) {
      // console.log('"currencies" table does not exist. Creating it...');
      const createQuery = `CREATE TABLE currencies (
      currency_id INT PRIMARY KEY NOT NULL,
      currency_code VARCHAR(3) NOT NULL ,
      currency_name VARCHAR(25) NOT NULL 
)`;
      await client.query(createQuery);
    }

    //is it already populated
    const isPopulated = await isTablePopulated(client, 'currencies', 2);
    if (isPopulated) {
      console.log('currencies table is already populated.');
      return;
    }

    console.log(currenciesValues);
    //initiate a transaction
    // await client.query('BEGIN');
    //run through the data and insert every tuple

    for (const currency of currenciesValues) {
      const queryText = `INSERT INTO currencies(currency_id,currency_code, currency_name) VALUES ($1,$2,$3)`;
      const values = [
        currency.currency_id,
        currency.currency_code,
        currency.currency_name,
      ];
      await client.query(queryText, values);
      // console.log('inerted: currency', currency.currency_code);
    }

    //confirm transaction
    // await client.query('COMMIT');
    // console.log('All tuples inserted successfully.');
  } catch (
    error // Revertir la transacción en caso de error
  ) {
    // await client.query('ROLLBACK');
    console.error(pc.orange('Error inserting tuples:', error));
    throw error;
  }
}

// tblCurrencies();
//--
//user roles
export async function tblUserRoles(client = pool) {
  const rolesValues = [
    { user_role_id: 1, user_role_name: 'user' },
    { user_role_id: 2, user_role_name: 'admin' },
    { user_role_id: 3, user_role_name: 'super_admin' },
  ];
  const tblName = 'user_roles';
  const minCount = rolesValues.length;

  try {
    //verify if table exists
    if (!isValidTableName(tblName)) {
      throw new Error('Invalid table name');
    }

    const exists = await tableExists(client, tblName);
    if (!exists) {
      console.log(
        pc.cyan(`/" ${tblName}/" table does not exist. Creating it...`),
      );
      const createQuery = `CREATE TABLE user_roles(user_role_id SERIAL PRIMARY KEY  NOT NULL, user_role_name VARCHAR(15) NOT NULL CHECK (user_role_name IN ('user', 'admin', 'super_admin') ) )`;
      await client.query(createQuery);
    }

    //is it already populated?
    const isPopulated = await isTablePopulated(client, tblName, minCount);
    if (isPopulated) {
      console.log(pc.cyan(`${tblName} table is already populated.`));
      return;
    }

    //initiate a transaction
    // await client.query('BEGIN');

    //run through the data and insert every tuple
    for (const role of rolesValues) {
      const queryText = `INSERT INTO user_roles(user_role_id, user_role_name) VALUES ($1,$2)`;
      const values = [role.user_role_id, role.user_role_name];
      await client.query(queryText, values);
      console.log(
        pc.green('inserted: user_role'),
        pc.green(role.user_role_name),
      );
    }

    //confirm transaction
    // await client.query('COMMIT');
    console.log(pc.yellow('All tuples inserted successfully.'));
  } catch (
    error // Revertir la transacción en caso de error
  ) {
    // await client.query('ROLLBACK');
    console.error(pc.red('Error inserting tuples:', tblName, error));
    throw error;
  }
}

// tblUserRoles()
//--
//accountTypes
export async function tblAccountTypes(client = pool) {
  const accountTypeValues = [
    { account_type_id: 1, account_type_name: 'bank' },
    { account_type_id: 2, account_type_name: 'investment' },
    { account_type_id: 3, account_type_name: 'debtor' },
    { account_type_id: 4, account_type_name: 'pocket_saving' },
    { account_type_id: 5, account_type_name: 'category_budget' }, //expense category
    { account_type_id: 6, account_type_name: 'income_source' },
  ];
  const tblName = 'account_types';
  const minCount = accountTypeValues.length - 1;

  try {
    //verify if table exists
    if (!isValidTableName(tblName)) {
      throw new Error('Invalid table name');
    }
    const exists = await tableExists(client, tblName);

    if (!exists) {
      console.log(pc.yellow`${tblName} table does not exist. Creating it...'`);
      const createQuery = `CREATE TABLE account_types (
        account_type_id INT PRIMARY KEY NOT NULL,
        account_type_name VARCHAR(50) NOT NULL 
)`;
      await client.query(createQuery);
    }

    //is it already populated
    const isPopulated = await isTablePopulated(client, tblName, minCount);
    if (isPopulated) {
      console.log(pc.yellowBright(`${tblName} table is already populated.`));
      return;
    }

    //initiate a transaction
    // await client.query('BEGIN');
    //run through the data and insert every tuple
    for (const type of accountTypeValues) {
      const queryText = `INSERT INTO account_types(account_type_id,
      account_type_name) VALUES ($1,$2)`;
      const values = [type.account_type_id, type.account_type_name];
      await client.query(queryText, values);
      console.log(pc.green(`inserted: ${tblName}, ${type.account_type_name}`));
    }

    //confirm transaction
    // await client.query('COMMIT');
    console.log(pc.yellow('All tuples inserted successfully.'));
  } catch (
    error // Revertir la transacción en caso de error
  ) {
    // await client.query('ROLLBACK');
    console.error('Error inserting tuples:', error);
    throw error;
  }
}
//tblAccountTypes();
//--
//categoryNatureTypes
export async function tblCategoryNatureTypes(client = pool) {
  const categoryNatureTypeValues = [
    { category_nature_type_id: 1, category_nature_type_name: 'must' },
    { category_nature_type_id: 2, category_nature_type_name: 'need' },
    { category_nature_type_id: 3, category_nature_type_name: 'other' },
    { category_nature_type_id: 4, category_nature_type_name: 'want' },
  ];
  const tblName = 'category_nature_types';
  const minCount = categoryNatureTypeValues.length - 0;

  try {
    //verify if table exists
    if (!isValidTableName(tblName)) {
      throw new Error('Invalid table name');
    }
    const exists = await tableExists(client, tblName);

    if (!exists) {
      console.log(pc.yellow`${tblName} table does not exist. Creating it...'`);
      // Fixed ids, no sequence: the seed writes them and the queries read
      // them as literals. Migration 001 declares this table the same way.
      const createQuery = `CREATE TABLE category_nature_types (
        category_nature_type_id INT PRIMARY KEY NOT NULL,
        category_nature_type_name VARCHAR(15) NOT NULL 
)`;
      await client.query(createQuery);
    }

    //is it already populated
    const isPopulated = await isTablePopulated(client, tblName, minCount);
    if (isPopulated) {
      console.log(pc.yellowBright(`${tblName} table is already populated.`));
      return;
    }

    //initiate a transaction
    // await client.query('BEGIN');
    //run through the data and insert every tuple
    for (const type of categoryNatureTypeValues) {
      const queryText = `INSERT INTO category_nature_types(category_nature_type_id,
      category_nature_type_name) VALUES ($1,$2)`;
      const values = [
        type.category_nature_type_id,
        type.category_nature_type_name,
      ];
      await client.query(queryText, values);
      console.log(
        pc.green(`inserted: ${tblName}, ${type.category_nature_type_name}`),
      );
    }

    //confirm transaction
    // await client.query('COMMIT');
    console.log(pc.yellow('All tuples inserted successfully.'));
  } catch (
    error // Revertir la transacción en caso de error
  ) {
    // await client.query('ROLLBACK');

    const { code, message } = handlePostgresErrorEs();

    // next(createError(code, message));
    console.error('Error inserting tuples:', message || error);
    throw createError(code, message);
  }
}
//tblCategoryNatureTypes();
//---
//movement_types
export async function tblMovementTypes(client = pool) {
  const movementTypeValues = [
    { movement_type_id: 1, movement_type_name: 'expense' },
    { movement_type_id: 2, movement_type_name: 'income' },
    { movement_type_id: 3, movement_type_name: 'investment' },
    { movement_type_id: 4, movement_type_name: 'debt' },
    { movement_type_id: 5, movement_type_name: 'pocket' },
    { movement_type_id: 6, movement_type_name: 'transfer' },
    { movement_type_id: 7, movement_type_name: 'receive' },
    { movement_type_id: 8, movement_type_name: 'account-opening' },
    { movement_type_id: 9, movement_type_name: 'pnl' },
  ];
  const tblName = 'movement_types';
  const minCount = movementTypeValues.length;

  try {
    //verify if table exists
    if (!isValidTableName(tblName)) {
      throw new Error('Invalid table name');
    }
    const exists = await tableExists(client, tblName);

    if (!exists) {
      console.log(pc.yellow`${tblName} table does not exist. Creating it...'`);
      const createQuery = `CREATE TABLE movement_types (
        movement_type_id INT PRIMARY KEY NOT NULL,
        movement_type_name VARCHAR(50) NOT NULL CHECK(movement_type_name IN ('expense','income','investment','debt','pocket','transfer','receive','account-opening','pnl'))
)`;
      await client.query(createQuery);
    }

    //is it already populated
    const isPopulated = await isTablePopulated(client, tblName, minCount);
    if (isPopulated) {
      console.log(pc.yellowBright(`${tblName} table is already populated.`));
      return;
    }

    //initiate a transaction
    // await client.query('BEGIN');
    //run through the data and insert every tuple
    for (const type of movementTypeValues) {
      const queryText = `INSERT INTO movement_types(movement_type_id,
      movement_type_name) VALUES ($1,$2)`;
      const values = [type.movement_type_id, type.movement_type_name];
      await client.query(queryText, values);
      console.log(pc.green(`inserted: ${tblName}, ${type.movement_type_name}`));
    }

    //confirm transaction
    // await client.query('COMMIT');
    console.log(pc.yellow('All tuples inserted successfully.'));
  } catch (
    error // Revertir la transacción en caso de error
  ) {
    // await client.query('ROLLBACK');
    console.error('Error inserting tuples:', error);
    throw error;
  }
}
//tblMovementTypes();

//--
//transactionTypes
export async function tbltransactionTypes(client = pool) {
  const transactionTypeValues = [
    { transaction_type_id: 1, transaction_type_name: 'withdraw' },
    { transaction_type_id: 2, transaction_type_name: 'deposit' },
    { transaction_type_id: 3, transaction_type_name: 'lend' },
    { transaction_type_id: 4, transaction_type_name: 'borrow' },
    { transaction_type_id: 5, transaction_type_name: 'account-opening' },
  ];

  const tblName = 'transaction_types';
  const minCount = transactionTypeValues.length;

  try {
    //verify if table exists
    if (!isValidTableName(tblName)) {
      throw new Error('Invalid table name');
    }
    const exists = await tableExists(client, tblName);

    if (!exists) {
      console.log(pc.yellow`${tblName} table does not exist. Creating it...'`);
      // Fixed ids, no sequence, as migration 001 declares it.
      const createQuery = `CREATE TABLE transaction_types(transaction_type_id INT PRIMARY KEY NOT NULL,
        transaction_type_name VARCHAR(50) NOT NULL)`;
      await client.query(createQuery);
    }

    //is it already populated
    const isPopulated = await isTablePopulated(client, tblName, minCount);
    if (isPopulated) {
      console.log(pc.yellowBright(`${tblName} table is already populated.`));
      return;
    }

    //initiate a transaction
    // await client.query('BEGIN');
    //run through the data and insert every tuple
    for (const type of transactionTypeValues) {
      const queryText = `INSERT INTO transaction_types(transaction_type_id,
      transaction_type_name) VALUES ($1,$2)`;
      const values = [type.transaction_type_id, type.transaction_type_name];
      await client.query(queryText, values);
      console.log(`inserted: ${tblName}, ${type.transaction_type_name}`);
    }

    //confirm transaction
    // await client.query('COMMIT');
    console.log(pc.yellow('All tuples inserted successfully.'));
  } catch (
    error // reverse transaction in case of error
  ) {
    // await client.query('ROLLBACK');
    console.error('Error inserting tuples:', error);
    throw error;
  }
}

//--
//budget_frequency_types
/**
 * Seed the budget frequency catalog.
 *
 * Unlike the other tbl* seeders, this one does NOT create its table. The DDL
 * already lives in migration 010 and in ensureBudgetTables(); a third copy
 * here would be a third thing to keep in sync. A missing table means
 * ensureBudgetTables did not run, and masking that by silently creating one
 * would hide the real failure.
 *
 * Codes must stay identical to the keys of MONTHS_PER_PERIOD in
 * budgetConfig.js. They are not labels, they are lookup keys.
 *
 * @param {object} client - Database client (pool or transaction)
 */
export async function tblBudgetFrequencyTypes(client = pool) {
 const budgetFrequencyValues = [
  { budget_frequency_type_id: 1, budget_frequency_code: 'monthly', budget_frequency_name: 'Monthly', sort_order: 1 },
  { budget_frequency_type_id: 2, budget_frequency_code: 'quarterly', budget_frequency_name: 'Quarterly', sort_order: 2 },
  { budget_frequency_type_id: 3, budget_frequency_code: 'four-month', budget_frequency_name: 'Four-month', sort_order: 3 },
  { budget_frequency_type_id: 4, budget_frequency_code: 'semiannual', budget_frequency_name: 'Semiannual', sort_order: 4 },
  { budget_frequency_type_id: 5, budget_frequency_code: 'yearly', budget_frequency_name: 'Yearly', sort_order: 5 },
 ];
 const tblName = 'budget_frequency_types';
 const minCount = budgetFrequencyValues.length;

 try {
  if (!isValidTableName(tblName)) {
   throw new Error('Invalid table name');
  }

  const exists = await tableExists(client, tblName);
  if (!exists) {
   throw new Error(
    `${tblName} does not exist. Run migration 010 or ensureBudgetTables() first.`,
   );
  }

  const isPopulated = await isTablePopulated(client, tblName, minCount);
  if (isPopulated) {
   console.log(pc.yellowBright(`${tblName} table is already populated.`));
   return;
  }

  for (const type of budgetFrequencyValues) {
   const queryText = `INSERT INTO budget_frequency_types(budget_frequency_type_id,
      budget_frequency_code, budget_frequency_name, sort_order) VALUES ($1,$2,$3,$4)
      ON CONFLICT (budget_frequency_code) DO NOTHING`;
   const values = [
    type.budget_frequency_type_id,
    type.budget_frequency_code,
    type.budget_frequency_name,
    type.sort_order,
   ];
   await client.query(queryText, values);
   console.log(pc.green(`inserted: ${tblName}, ${type.budget_frequency_code}`));
  }

  // The sequence realign that used to live here now runs for every seeded
  // catalog in resyncCatalogSequences, on every boot rather than only on the
  // boot that seeds.
  console.log(pc.yellow('All tuples inserted successfully.'));
 } catch (error) {
  console.error('Error inserting tuples:', error);
  throw error;
 }
}
