// backend\src\routes\userRoutes.js
import express from 'express';
import {verifyToken, verifyUser } from '../middlewares/authMiddleware.js';
import {
  // getUserById,
  changePassword,
  updateUserById,
} from '../controllers/userController.js';

const router = express.Router();

const select = true;
const middlewareFn = select ? verifyUser : verifyToken;
// const middlewareFn= verifyUser
// router.get('/validate-session', verifyToken, getUserById);


router.put('/change-password', verifyToken, changePassword);

router.put('/update-profile', verifyToken,updateUserById);


export default router;
