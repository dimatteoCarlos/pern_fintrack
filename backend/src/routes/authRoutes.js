import express from 'express';
import passport from 'passport';
import { signUpUser, signInUser, signOutUser } from '../controllers/authController.js';
import { authRefreshToken } from '../controllers/authRefreshToken.js';

// import { validateSignUp } from '../middlewares/validateSignUp.js';

const router = express.Router();

// Ruta para el registro de usuarios: //api/auth/sign-up
router.post('/sign-up', signUpUser);
// router.post('/sign-up',validateSignUp, signUpUser);

// Ruta para el inicio de sesión: //api/auth/sign-in
router.post('/sign-in', signInUser);


//api/auth/refresh-token
router.post('/refresh-token', authRefreshToken);
//api/auth/sign-out
router.post('/sign-out', signOutUser);


// Ruta de Google OAuth: redirige a Google para la autenticación
// router.get(
//   '/google',
//   passport.authenticate('google', { scope: ['profile', 'email'] })
// );

// Callback de Google OAuth: recibirá el código de Google y autenticará al usuario
// router.get(
//   '/google/callback',
//   passport.authenticate('google', { failureRedirect: '/login' }),
//   (req, res) => {
//     const token = createToken(req.user.user_id, req.user.user_role_name);
//     res.cookie('access_token', token, { httpOnly: true }).redirect('/');
//   }
// );

export default router;
