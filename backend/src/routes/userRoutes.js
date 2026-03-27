// backend\src\routes\userRoutes.js
import express from 'express';
import {verifyToken, verifyUser } from '../middlewares/authMiddleware.js';

import { passwordChangeLimiter, profileUpdateLimiter } from '../middlewares/rateLimiter.js';

import {
  getUserById,
  changePassword,
  updateProfile,
} from '../controllers/userController.js';

import { validateRequestSync } from '../middlewares/validateRequest.js';

import { changePasswordSchema, updateProfileSchema } from '../validation/zod/userSchemas.js';

const router = express.Router();

// const select = true;
// const middlewareFn = select ? verifyUser : verifyToken;
// =================================
// 🔐 PROTECTED ROUTES (require authentication)
// =================================
// 🎯 UPDATE USER PROFILE (with rate limiting)
router.patch('/update-profile', 
 verifyToken, // Check authentication
 profileUpdateLimiter,// Apply rate limiting
validateRequestSync(updateProfileSchema), // ✅ Middleware Zod
 updateProfile //  Process update
);

// 👤 GET USER BY ID
router.get(
  '/:userId', 
  verifyUser, 
  getUserById
);

router.get(
  '/profile', 
  verifyToken, 
  getUserById
);

// 🔑 CHANGE PASSWORD (with rate limiting)
router.patch(
  '/change-password',
  verifyToken,
  passwordChangeLimiter,// Same limiter as profile update
  validateRequestSync(changePasswordSchema),
  changePassword
);

// ===============================
// 🌐 PUBLIC ROUTES (if any)
// ================================
// Note: Add authLimiter to login/register routes in authRoutes.js

export default router;
