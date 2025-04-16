//typeListController.js
import pc from 'picocolors';
import {
  createError,
  handlePostgresError,
} from '../../../utils/errorHandling.js';
import { pool } from '../../db/configDB.js';

//typeListController
//get: http://localhost:5000/api/fintrack/account/type/list
//lista catalogada de tipos de cuentas - catalogued list of account types

export const accountTypeList = async (req, res, next) => {
  console.log(pc.blueBright('accountTypeList'));
  // console.log(req.body, req.params, req.query);

  try {
    const accountTypeResult = await pool.query({
      text: `SELECT account_type_name FROM account_types`,
      values: [],
    });

    return res.status(200).json(accountTypeResult.rows);
  } catch (error) {
    console.error(
      pc.red('when getting account type list'),
      error.message || 'something went wrong'
    );
    //handle pg errors
    const { code, message } = handlePostgresError(error);
    return next(createError(code, message));
  }
};
//----------------------
//typeListController/bank type accounts available
//get: http://localhost:5000/api/fintrack/account/accounts/${type}/list
//lista de cuentas segun tipo - account list according to account type
// export const accountsByTypeList = async (req, res, next) => {
//   console.log(pc.blueBright('accountsTypeList'));
//   // console.log(req.body, req.params, req.query);
//   const {user:userId, account_type_name} = req.body

//   try {
//     const accountsByTypeResult = await pool.query({
//       text: `SELECT ua.account_id, ua.account_name, act.account_type_name FROM ua.user_accounts
//       JOIN account_types act ON ua.account_type_id = act.account_type_id WHERE act.account_type_name=$1 and ua.user_id = $2
//       `,
//       values: [account_type_name, userId],
//     });

//     return res.status(200).json(accountsByTypeResult.rows);
//   } catch (error) {
//     console.error(
//       pc.red('when getting account list'),
//       error.message || 'something went wrong'
//     );
//     //handle pg errors
//     const { code, message } = handlePostgresError(error);
//     return next(createError(code, message));
//   }
// };
//----------------------

// export const createIncomeSourceTypes = async (req, res, next) => {
//   console.log(pc.blueBright('createIncomeSourceTypes'));
//   console.log(req.body, req.params, req.query);
//   //implement verifyUser and then get userId from res.user

//   try {
//     const { user: userId } = req.query;

//     console.log('🚀 ~ createIncomeSourceTypes ~ userId:', userId);

//     if (!userId) {
//       const message = 'User ID is required';
//       console.warn(pc.blueBright(message));
//       return res.status(400).json({ status: 400, message });
//     }

//     const { source_name } = req.body;

//     if (!source_name) {
//       const message = `Source name is required`;
//       console.warn(pc.blueBright(message));
//       return res.status(400).json({ status: 400, message });
//     }

//     //table IncomeSources must exist - created at db initialization
//     //verify source_name does not exist

//     const sourceNameExistResult = await pool.query({
//       text: `SELECT * FROM income_sources WHERE user_id = $1 AND source_name ILIKE $2`,
//       values: [userId, `%${source_name}%`],
//     });

//     if (sourceNameExistResult.rows.length > 0) {
//       throw new Error(
//         `${sourceNameExistResult.rows.length} income souce(s) found with a similar name. Try again`
//       );
//     }

//     const sourceNameCreated = await pool.query({
//       text: `INSERT INTO income_sources(user_id,source_name) VALUES($1,$2) RETURNING *`,
//       values: [userId, source_name],
//     });

//     console.log(sourceNameCreated.rows[0]);

//     return res.status(200).json({
//       message: `${sourceNameCreated.rows[0].source_name} income source with the id ${sourceNameCreated.rows[0].source_id} was successfully  created`,
//       data: sourceNameCreated.rows[0],
//     });
//   } catch (error) {
//     console.error(
//       pc.red('when creating income source list type:'),
//       error.message || 'something went wrong'
//     );
//     //handle pg errors
//     const { code, message } = handlePostgresError(error);
//     return next(createError(code, message));
//   }
// };
