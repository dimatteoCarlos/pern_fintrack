import pc from 'picocolors';
import { pool } from '../src/db/configDB.js';
//---------------------------------------------------------------------------

export const getTransactionTypeId = async (
  transactionTypeName,
  counterTransactionTypeName
) => {
  console.log('args:', transactionTypeName, counterTransactionTypeName);
  const transactionTypeDescriptionIdsResults = await pool.query({
    text: `SELECT
      MAX(transaction_type_id) FILTER (WHERE transaction_type_name = $1) AS transaction_type_id, 
      MAX(transaction_type_id) FILTER (WHERE transaction_type_name = $2) AS countertransaction_type_id
      FROM transaction_types
      `,
    values: [transactionTypeName, counterTransactionTypeName],
  });

  const transactionTypeDescriptionIds =
    transactionTypeDescriptionIdsResults.rows[0];

  // console.log(pc.green('getTransactionTypeId:', transactionTypeDescriptionIds));

  console.log(transactionTypeName, counterTransactionTypeName);

  return  transactionTypeDescriptionIds ;
};
