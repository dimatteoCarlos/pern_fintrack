//backend\src\routes\authRoutes.js
import express from 'express';
import { signUpUser, signInUser, signOutUser, validateSession } from '../controllers/authController.js';
import { authRefreshToken } from '../controllers/authRefreshToken.js';
import { verifyToken } from '../middlewares/authMiddleware.js';
import { authLimiter } from '../middlewares/rateLimiter.js';

const router = express.Router();

// Ruta para el registro de usuarios: //api/auth/sign-up
router.post('/sign-up',authLimiter ,signUpUser);

// Ruta para el inicio de sesión: //api/auth/sign-in
router.post('/sign-in',authLimiter , signInUser);

// Ruta de refresh token api/auth/refresh-token
router.post('/refresh-token', authRefreshToken);

//api/auth/sign-out
router.post('/sign-out', signOutUser);

//validate session
router.get('/validate-session', verifyToken, validateSession);


export default router;

//------------------------
