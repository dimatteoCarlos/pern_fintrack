import express from 'express';
import { verifyHeaderAuth, verifyUser } from '../middlewares/authMiddleware.js';
import {
  getUserById,
  changePassword,
  updateUserById,
} from '../controllers/userController.js';

const router = express.Router();

const select = true;
const middlewareFn = select ? verifyUser : verifyHeaderAuth;
router.get('/:id', middlewareFn, getUserById);
router.put('/:id', middlewareFn, updateUserById);
router.put('/change-password/:id', middlewareFn, changePassword);

export default router;
