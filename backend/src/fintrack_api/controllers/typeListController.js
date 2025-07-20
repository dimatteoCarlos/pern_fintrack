//typeListController.js
import pc from 'picocolors';
import {
  createError,
  handlePostgresError,
} from '../../../utils/errorHandling.js';
import { pool } from '../../db/configDB.js';

//typeListController
//get: http://localhost:5000/api/fintrack/account/type/list
//lista catalogada de tipos de cuentas - cataloged list of account types

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

