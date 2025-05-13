import {
  createError,
  handlePostgresErrorEs,
} from '../../utils/errorHandling.js';
import { pool } from './configDB.js';
import pc from 'picocolors';

function isValidTableName(tableName) {
  return /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(tableName); // Solo permite nombres de tablas válidos
}

async function tableExists(tableName) {
  if (!isValidTableName(tableName)) {
    throw new Error('Invalid table name');
  }

  const queryText = `
    SELECT EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_name = '${tableName}'
    );
  `;
  const result = await pool.query(queryText);
  console.log(pc.magentaBright(tableName), ' exists? ', result.rows[0].exists);
  return result.rows[0].exists; // Returns true or false
}

async function isTablePopulated(tableName, minCount = 1) {
  if (!isValidTableName(tableName)) {
    throw new Error('Invalid table name');
  }
  const queryText = `SELECT COUNT(*) FROM ${tableName}`;
  const result = await pool.query(queryText);
  return result.rows[0].count >= minCount;
}

//--
//currencies
export async function tblCurrencies() {
  const currenciesValues = [
    {
      currency_id: 1,
      currency_code: 'usd',
      currency_name: 'us-dollars',
    },
    { currency_id: 2, currency_code: 'eur', currency_name: 'euros' },
    { currency_id: 3, currency_code: 'cop', currency_name: 'pesos col' },
  ];

  try {
    //verify if table exists
    const exists = await tableExists('currencies');
    if (!exists) {
      // console.log('"currencies" table does not exist. Creating it...');
      const createQuery = `CREATE TABLE currencies (
  currency_id INT PRIMARY KEY NOT NULL,
  currency_code VARCHAR(3) NOT NULL ,
  currency_name VARCHAR(10) NOT NULL 
)`;
      await pool.query(createQuery);
    }

    //is it already populated
    const isPopulated = await isTablePopulated('currencies', 2);
    if (isPopulated) {
      console.log('currencies table is already populated.');
      return;
    }

    console.log(currenciesValues);
    //initiate a transaction
    await pool.query('BEGIN');
    //run through the data and insert every tuple

    for (const currency of currenciesValues) {
      const queryText = `INSERT INTO currencies(currency_id,currency_code, currency_name) VALUES ($1,$2,$3)`;
      const values = [
        currency.currency_id,
        currency.currency_code,
        currency.currency_name,
      ];
      await pool.query(queryText, values);
      // console.log('inerted: currency', currency.currency_code);
    }

    //confirm transaction
    await pool.query('COMMIT');
    // console.log('All tuples inserted successfully.');
  } catch (
    error // Revertir la transacción en caso de error
  ) {
    await pool.query('ROLLBACK');
    console.error(pc.orange('Error inserting tuples:', error));
    throw error;
  }
}

// tblCurrencies();
//--
//user roles
export async function tblUserRoles() {
  const rolesValues = [
    { user_role_id: 1, user_role_name: 'user' },
    { user_role_id: 2, user_role_name: 'admin' },
    { user_role_id: 3, user_role_name: 'superadmin' },
  ];
  const tblName = 'user_roles';
  const minCount = rolesValues.length;

  try {
    //verify if table exists
    if (!isValidTableName(tblName)) {
      throw new Error('Invalid table name');
    }

    const exists = await tableExists(tblName);
    if (!exists) {
      console.log(
        pc.cyan(`\" ${tblName}\" table does not exist. Creating it...`)
      );
      const createQuery = `CREATE TABLE user_roles(user_role_id SERIAL PRIMARY KEY  NOT NULL, user_role_name VARCHAR(15) NOT NULL CHECK (user_role_name IN ('user', 'admin', 'superadmin') ) )`;
      await pool.query(createQuery);
    }

    //is it already populated
    const isPopulated = await isTablePopulated(tblName, minCount);
    if (isPopulated) {
      console.log(pc.cyan(`${tblName} table is already populated.`));
      return;
    }

    //initiate a transaction
    await pool.query('BEGIN');

    //run through the data and insert every tuple
    for (const role of rolesValues) {
      const queryText = `INSERT INTO user_roles(user_role_id, user_role_name) VALUES ($1,$2)`;
      const values = [role.user_role_id, role.user_role_name];
      await pool.query(queryText, values);
      console.log(
        pc.green('inserted: user_role'),
        pc.green(role.user_role_name)
      );
    }

    //confirm transaction
    await pool.query('COMMIT');
    console.log(pc.yellow('All tuples inserted successfully.'));
  } catch (
    error // Revertir la transacción en caso de error
  ) {
    await pool.query('ROLLBACK');
    console.error(pc.red('Error inserting tuples:', tblName, error));
  }
}

// tblUserRoles()
//--
//accountTypes
export async function tblAccountTypes() {
  const accountTypeValues = [
    { account_type_id: 1, account_type_name: 'bank' },
    { account_type_id: 2, account_type_name: 'investment' },
    { account_type_id: 3, account_type_name: 'debtor' },
    { account_type_id: 4, account_type_name: 'pocket_saving' },
    { account_type_id: 5, account_type_name: 'category_budget' }, //expense category
    { account_type_id: 6, account_type_name: 'income_source' },
    // { account_type_id: 3, account_type_name: 'investment_crypto' },
    // { account_type_id: 4, account_type_name: 'investment_broker' },
  ];
  const tblName = 'account_types';
  const minCount = accountTypeValues.length - 1;

  try {
    //verify if table exists
    if (!isValidTableName(tblName)) {
      throw new Error('Invalid table name');
    }
    const exists = await tableExists(tblName);

    if (!exists) {
      console.log(pc.yellow`${tblName} table does not exist. Creating it...'`);
      const createQuery = `CREATE TABLE account_types (
        account_type_id INT PRIMARY KEY NOT NULL,
        account_type_name VARCHAR(50) NOT NULL 
)`;
      await pool.query(createQuery);
    }

    //is it already populated
    const isPopulated = await isTablePopulated(tblName, minCount);
    if (isPopulated) {
      console.log(pc.yellowBright(`${tblName} table is already populated.`));
      return;
    }

    //initiate a transaction
    await pool.query('BEGIN');
    //run through the data and insert every tuple
    for (const type of accountTypeValues) {
      const queryText = `INSERT INTO account_types(account_type_id,
      account_type_name) VALUES ($1,$2)`;
      const values = [type.account_type_id, type.account_type_name];
      await pool.query(queryText, values);
      console.log(pc.green(`inserted: ${tblName}, ${type.account_type_name}`));
    }

    //confirm transaction
    await pool.query('COMMIT');
    console.log(pc.yellow('All tuples inserted successfully.'));
  } catch (
    error // Revertir la transacción en caso de error
  ) {
    await pool.query('ROLLBACK');
    console.error('Error inserting tuples:', error);
  }
}
//tblAccountTypes();
//--
//categoryNatureTypes
export async function tblCategoryNatureTypes() {
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
    const exists = await tableExists(tblName);

    if (!exists) {
      console.log(pc.yellow`${tblName} table does not exist. Creating it...'`);
      const createQuery = `CREATE TABLE category_nature_types (
        category_nature_type_id SERIAL PRIMARY KEY NOT NULL,
        category_nature_type_name VARCHAR(15) NOT NULL 
)`;
      await pool.query(createQuery);
    }

    //is it already populated
    const isPopulated = await isTablePopulated(tblName, minCount);
    if (isPopulated) {
      console.log(pc.yellowBright(`${tblName} table is already populated.`));
      return;
    }

    //initiate a transaction
    await pool.query('BEGIN');
    //run through the data and insert every tuple
    for (const type of categoryNatureTypeValues) {
      const queryText = `INSERT INTO category_nature_types(category_nature_type_id,
      category_nature_type_name) VALUES ($1,$2)`;
      const values = [
        type.category_nature_type_id,
        type.category_nature_type_name,
      ];
      await pool.query(queryText, values);
      console.log(
        pc.green(`inserted: ${tblName}, ${type.category_nature_type_name}`)
      );
    }

    //confirm transaction
    await pool.query('COMMIT');
    console.log(pc.yellow('All tuples inserted successfully.'));
  } catch (
    error // Revertir la transacción en caso de error
  ) {
    await pool.query('ROLLBACK');
    const { code, message } = handlePostgresErrorEs();
    next(createError(code, message));
    console.error('Error inserting tuples:', message || error);
  }
}
//tblCategoryNatureTypes();
//---
//movement_types
export async function tblMovementTypes() {
  const movementTypeValues = [
    { movement_type_id: 1, movement_type_name: 'expense' },
    { movement_type_id: 2, movement_type_name: 'income' },
    { movement_type_id: 3, movement_type_name: 'investment' },
    { movement_type_id: 4, movement_type_name: 'debt' },
    { movement_type_id: 5, movement_type_name: 'pocket' },
    { movement_type_id: 6, movement_type_name: 'transfer' },
    { movement_type_id: 7, movement_type_name: 'receive' },
    { movement_type_id: 8, movement_type_name: 'account-opening' },
  ];
  const tblName = 'movement_types';
  const minCount = movementTypeValues.length;

  try {
    //verify if table exists
    if (!isValidTableName(tblName)) {
      throw new Error('Invalid table name');
    }
    const exists = await tableExists(tblName);

    if (!exists) {
      console.log(pc.yellow`${tblName} table does not exist. Creating it...'`);
      const createQuery = `CREATE TABLE movement_types (
        movement_type_id INT PRIMARY KEY NOT NULL,
        movement_type_name VARCHAR(50) NOT NULL CHECK(movement_type_name IN ('expense','income','investment','debt','pocket','transfer','receive','account-opening'))
)`;
      await pool.query(createQuery);
    }

    //is it already populated
    const isPopulated = await isTablePopulated(tblName, minCount);
    if (isPopulated) {
      console.log(pc.yellowBright(`${tblName} table is already populated.`));
      return;
    }

    //initiate a transaction
    await pool.query('BEGIN');
    //run through the data and insert every tuple
    for (const type of movementTypeValues) {
      const queryText = `INSERT INTO movement_types(movement_type_id,
      movement_type_name) VALUES ($1,$2)`;
      const values = [type.movement_type_id, type.movement_type_name];
      await pool.query(queryText, values);
      console.log(pc.green(`inserted: ${tblName}, ${type.movement_type_name}`));
    }

    //confirm transaction
    await pool.query('COMMIT');
    console.log(pc.yellow('All tuples inserted successfully.'));
  } catch (
    error // Revertir la transacción en caso de error
  ) {
    await pool.query('ROLLBACK');
    console.error('Error inserting tuples:', error);
  }
}
//tblMovementTypes();

//--
//transactionTypes
export async function tbltransactionTypes() {
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
    const exists = await tableExists(tblName);

    if (!exists) {
      console.log(pc.yellow`${tblName} table does not exist. Creating it...'`);
      const createQuery = `CREATE TABLE transaction_types(transaction_type_id SERIAL PRIMARY KEY NOT NULL,
        transaction_type_name VARCHAR(50) NOT NULL)`;
      await pool.query(createQuery);
    }

    //is it already populated
    const isPopulated = await isTablePopulated(tblName, minCount);
    if (isPopulated) {
      console.log(pc.yellowBright(`${tblName} table is already populated.`));
      return;
    }

    //initiate a transaction
    await pool.query('BEGIN');
    //run through the data and insert every tuple
    for (const type of transactionTypeValues) {
      const queryText = `INSERT INTO transaction_types(transaction_type_id,
      transaction_type_name) VALUES ($1,$2)`;
      const values = [type.transaction_type_id, type.transaction_type_name];
      await pool.query(queryText, values);
      console.log(`inserted: ${tblName}, ${type.transaction_type_name}`);
    }

    //confirm transaction
    await pool.query('COMMIT');
    console.log(pc.yellow('All tuples inserted successfully.'));
  } catch (
    error // reverse transaction in case of error
  ) {
    await pool.query('ROLLBACK');
    console.error('Error inserting tuples:', error);
  }
}
