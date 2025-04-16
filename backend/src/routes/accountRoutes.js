import express from 'express';
import {
  createAccount,
  getAccount,
  addMoneyToAccount,
} from '../controllers/accountController.js';
const router = express.Router();
router.post('/', createAccount);
router.get('/:accountId', getAccount);
router.get('/', getAccount);
router.post('/add-money/:id', addMoneyToAccount);

export default router;

// const select = true;
// const middlewareFn = select ? verifyUser : verifyHeaderAuth;
// import { verifyHeaderAuth, verifyUser } from '../middlewares/authMiddleware.js';
