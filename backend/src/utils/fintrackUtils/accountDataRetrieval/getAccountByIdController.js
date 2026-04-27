//backend/src/utils/getAccountById/getAccountByIdController.js

// HTTP controller: retrieves account information by ID and returns formatted JSON response

import { getAccountDataById } from "./getAccountDataById";

export const getAccountById = async (req, res, next) => {
  const userId = req.user.userId || (req.body.user ?? req.query.user);
  const { accountId } = req.params;

  const result = await getAccountDataById(userId, accountId);
  
  if (!result.success) {
    return res.status(404).json({ status: 404, message: result.error });
  }

  res.status(200).json({ 
    status: 200, 
    message: 'Account retrieved successfully', 
    data: { rows: 1, accountList: [result.data] } 
  });
};
//---------------------------------
// Después del UPDATE exitoso:
export const updatedAccount = await getAccountDataById(userId, accountId);
res.status(200).json({ 
  status: 200, 
  message: 'Account updated successfully', 
  data: updatedAccount.data 
});