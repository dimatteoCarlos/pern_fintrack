import express from 'express';
import passport from 'passport';
import { signUpUser, signInUser } from '../controllers/authController.js';
import { authDetectClienttype } from '../middlewares/authDetectClientType.js';
import { validateSignUp } from '../middlewares/validateSignUp.js';

const router = express.Router();

// Ruta para el registro de usuarios: //api/auth/sign-up
router.post('/sign-up',signUpUser);
// router.post('/sign-up',validateSignUp, signUpUser);

// Ruta para el inicio de sesión: //api/auth/sign-in
router.post('/sign-in', signInUser);

// Ruta de Google OAuth: redirige a Google para la autenticación
router.get(
  '/google',
  passport.authenticate('google', { scope: ['profile', 'email'] })
);

// Callback de Google OAuth: recibirá el código de Google y autenticará al usuario
router.get(
  '/google/callback',
  passport.authenticate('google', { failureRedirect: '/login' }),
  (req, res) => {
    const token = createToken(req.user.user_id, req.user.user_role_name);
    res.cookie('access_token', token, { httpOnly: true }).redirect('/');
  }
);

export default router;
