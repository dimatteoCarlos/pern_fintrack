JavaScript

// Backend (Node.js con Express y JWT) - Adaptado para Headers (Tu Código Original)
import { createToken, hashed, isRight } from '../../utils/authFn.js';
import { createError } from '../../utils/errorHandling.js';
import { v4 as uuidv4 } from 'uuid';
import { pool } from '../db/configDB.js';
import pc from 'picocolors';
import { getCurrencyId } from '../fintrack_api/controllers/transactionController.js';

import express from 'express'; // Import express
const app = express();
app.use(express.json()); // Use express.json() middleware

// Secret key para firmar los tokens JWT. ¡Guárdala en un lugar seguro!
const JWT_SECRET = 'tu_clave_secreta_muy_segura'; // Consider using environment variables

// Middleware para verificar el token JWT (Authorization: Bearer <token>)
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (token == null) return res.sendStatus(401); // No hay token

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.sendStatus(403); // Token inválido

        req.user = user;
        next(); // Continúa a la siguiente middleware o ruta
    });
};

//--sign-up or register
export const signUpUser = async (req, res, next) => {
    console.log('sign-up entered');
    try {
        const { username, user_firstname, user_lastname, email, currency } =
            req.body;
        if (
            !(
                username &&
                email &&
                req.body.password &&
                user_firstname &&
                user_lastname
            )
        ) {
            return next(
                createError(
                    404,
                    'username, email, password, first name and lastname, all fields must be provided. Currency usd will be default value if not provided'
                )
            );
        }

        const userExists = await pool.query({
            text: `SELECT EXISTS (SELECT 1 FROM users WHERE username=$1 OR email = $2)`,
            values: [username, email],
        });

        if (userExists.rows[0].exists) {
            return next(
                createError(
                    409,
                    'username or email address already exist. Try Login with sign-in'
                )
            );
        }

        let hashedPassword = await hashed(req.body.password);
        req.body.password = undefined;

        const newUserId = uuidv4();
        const currencyId = !currency ? 1 : await getCurrencyId(currency);
        console.log(pc.blue('🚀 ~ signUpUser ~ currencyId:'), currencyId);

        const userData = await pool.query({
            text: `INSERT INTO users(user_id, username,email,password_hashed,user_firstname,user_lastname, currency_id) VALUES ($1, $2, $3,$4,$5, $6, $7) RETURNING user_id, username, email, user_firstname, user_lastname, currency_id;`,
            values: [
                newUserId,
                username,
                email,
                hashedPassword,
                user_firstname,
                user_lastname,
                currencyId,
            ],
        });
        hashedPassword = undefined;

        res.status(201).json({
            status: 201,
            message: `User successfully suscribed. Username: ${username} email: ${email}`,
            user: userData.rows[0], //an object with info
        });

    } catch (error) {
        console.log(pc.red('auth error:', error));
        next(createError(500, error.message || 'internal signup user error'));
    }
};

//--login
export const signInUser = async (req, res, next) => {
    const { username, email } = req.body;
    try {
        const userData = (
            await pool.query({
                text: `SELECT user_id, username, email, password_hashed, user_role_id FROM users WHERE username = $1 OR email = $2`,
                values: [username, email],
            })
        ).rows[0]; // Directly get the first row

        if (!userData) {
            return next(createError(404, 'failed', 'user not found'));
        }

        const isCorrect = await isRight(
            req.body.password,
            userData.password_hashed
        );

        if (!isCorrect) {
            console.warn(pc.yellow('no authenticated:'), 'wrong password');
            return next(
                createError(401, 'Unauthorized. Wrong password or user data')
            );
        }

        const result = await pool.query({
            text: `SELECT user_role_name FROM user_roles WHERE user_role_id = $1`,
            values: [userData.user_role_id],
        });

        const userRole = result?.rows[0]?.user_role_name || '';

        const token = createToken(userData.user_id, userRole);

        req.body.password = undefined;
        userData.password_hashed = undefined;

        console.log(
            pc.green('you are logged in:'),
            username,
            email,
            pc.magenta('userId:'), userData.user_id,
            pc.cyan('role:'), userRole
        );

        return res
            .status(200)
            .json({
                message: 'successfully logged in',
                username,
                email,
                role: userRole,
                userId: userData.user_id,
                token: token, // Send the token in the JSON response
            });
    } catch (error) {
        console.log(pc.red('auth error:'), error);
        next(createError(500, error.message || 'internal sign-in user error'));
    }
};

// Example of a protected route (you'll need to import authenticateToken in your route file)
// export const protectedRoute = async (req, res, next) => {
//     try {
//         res.status(200).json({ message: 'This is a protected route', user: req.user });
//     } catch (error) {
//         next(createError(500, error.message || 'internal protected route error'));
//     }
// };
Cambios Realizados en Tu Código:

Import express and Use express.json(): Added import express from 'express'; and app.use(express.json()); to handle JSON request bodies. Make sure you have express installed (npm install express).
authenticateToken Middleware: I've included the authenticateToken middleware function that you'll need to apply to any routes you want to protect. This middleware reads the JWT from the Authorization header.
Removed Cookie Setting: The .cookie() method in the signInUser function has been removed.
Sending Token in JSON: In the signInUser function, the JWT token is now included in the JSON response:
JavaScript

return res
    .status(200)
    .json({
        message: 'successfully logged in',
        username,
        email,
        role: userRole,
        userId: userData.user_id,
        token: token, // Sending token in JSON
    });
Using authenticateToken (Commented Out Example): I've added a commented-out example of how you might use the authenticateToken middleware in a protected route. You'll need to import this middleware into your route definition file and apply it to the specific routes you want to secure.
How to Use the authenticateToken Middleware in Your Routes:

Assuming you have a separate file where you define your API routes (e.g., routes/authRoutes.js or similar), you would import the authenticateToken middleware and apply it to the routes you want to protect:

JavaScript

// routes/authRoutes.js (Example)
import express from 'express';
import { signUpUser, signInUser } from '../controllers/authController.js';
import { authenticateToken } from '../controllers/authController.js'; // Import the middleware

const router = express.Router();

router.post('/register', signUpUser);
router.post('/login', signInUser);

// Example of a protected route
router.get('/protected', authenticateToken, (req, res) => {
    res.status(200).json({ message: 'This is a protected route', user: req.user });
});

export default router;
Frontend Integration (As Before):

The frontend code you used in the previous example (with handleLogin and handleGetProtected functions) will work with this backend. It expects the token in the JSON response of the login request and sends it in the Authorization header for subsequent protected requests.

Key Points:

Install express: Make sure you have express installed in your project (npm install express).
Import authenticateToken: Remember to import the authenticateToken middleware into your route files where you want to use it.
Apply Middleware: Use authenticateToken as the second argument to your route handler for protected routes.
This adapted backend code now sends the JWT in the JSON response upon successful login, and you can use the authenticateToken middleware to protect your routes by verifying the token in the Authorization header.











Canvas

Gemini puede