//backend/src/utils/getAccountById/getAccountByIdController.js

// HTTP controller: retrieves account information by ID and returns formatted JSON response
//
// RETIRED — everything below has sat inside a block comment since it was
// written, so this file exports nothing and no route can reach it. It is the
// HTTP half of a draft whose service half, getAccountDataById.js, cannot load
// at all; the three reasons are listed in that file's header. The live path is
// getAccountById in getAccountController.js, wired at accountRoutes.js.
//
// The last block below was never part of a function body: it is a fragment of
// some other controller's success branch, pasted in as a note. A top-level
// `export const updatedAccount = await ...` would make this module perform a
// database read at import time, which is the second reason it stays commented.
/**
import { getAccountDataById } from "./getAccountDataById.js";
import { requireUserId } from '../../authUtils/requireUserId.js';

export const getAccountById = async (req, res, next) => {
  const userId = requireUserId(req, res);
  if (!userId) return;

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
*/