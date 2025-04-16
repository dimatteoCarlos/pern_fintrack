//input of: user_accounts, expense_categories, movements, trac

import jwt from 'jsonwebtoken';
import { createError } from '../../utils/errorHandling.js';

export const verifyHeaderAuth = (req, res, next) => {
  const authHeader = req?.headers?.authorization;

  if (!authHeader || !authHeader?.startsWith('Bearer')) {
    return res.status(401).json({ message: 'Authentication failed' });
  }
  const token = authHeader.split(' ')[1];
  try {
    const userToken = jwt.verify(token, process.env.JWT_SECRET);
    req.body.user = { userId: userToken.userId };
    next();
  } catch (error) {
    console.log(error);
    res.status(401).json({ message: 'Authentication fialed' });
  }
};

//---
export const verifyToken = async (req, res, next) => {
  console.log('verifyToken');

  const token = req.cookies.access_token;

  if (!token) {
    console.error('Error when verifying token');
    return next(
      createError(401, 'Access Unauthenticated. No token provided. Please log in again')
    );
  }

  try {
    const getDecoded = await new Promise((resolve, reject) => {
      jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
        if (err) {
          reject(err);
        } else {
          resolve(decoded);
        }
      });
    });

    req.user = getDecoded;
    next();
  } catch (error) {
    return next(
      createError(403, 'Invalid or expired token. Please log in again.') //forbidden
    );
  }
};

// {
//   userId: 'f7c5abf9-89e5-4891-bfb8-6dfe3022f226',
//   userRole: 'user',
//   iat: 1740504868,
//   exp: 1740591268
// }

//---
export const verifyUser = async (req, res, next) => {
  console.log('verifyUser');

  await verifyToken(req, res, () => {
    const { id: requestedUserId } = req.params;
    console.log('req.user:', req.user);

    if (!req.user) {
      return next(createError(401, 'User not authenticated.'));
    }

    const { userId, userRole } = req.user;

    console.log('param:', requestedUserId, 'userId:', userId, userRole);

    if (userId !== requestedUserId) {
      console.log(
        `User ${userId} is trying to access the user account of: ${requestedUserId}`
      );
    }

    const isMatched =
      userId === requestedUserId ||
      userRole === 'admin' ||
      userRole === 'superadmin';

    if (isMatched) {
      console.log(`Access granted to user ${userId}`);
      next();
    } else {
      console.log(`Access denied`);
      return next(createError(403, 'not authorized to access.'));
    }
  });
};

//-------
export const verifyAdmin = (req, res, next) => {
  console.log('verifyAdmin');
  const { userId, userRole } = req.user; //need to know how the user info was structured on req.user
  verifyToken(req, res, () => {
    if (userRole === 'admin' || userRole === 'superadmin') {
      console.log(`Access granted to user ${userId} as ${userRole}`);
      next();
    } else {
      console.log(`Access denied for user ${userId}`);
      return next(createError(403, 'Admin privileges required'));
    }
  });
};

//-------
