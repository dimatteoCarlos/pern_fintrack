// src/middleware/authMiddleware.js

import jwt from 'jsonwebtoken';
import { createError } from '../../utils/errorHandling.js';

//---
export const getAuthToken = (req) => {
  if (req.headers['authorization']) {
    // Check Authorization header (for mobile)
    const authHeader = req.headers['authorization'];
    if (authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      console.log('getAuthToken', 'token headers', token);
      return token;
    }
  }
  // Check cookie (for web app)
  if (req.cookies.accessToken) {
    console.log(
      'getAuthToken',
      'req.cookies',
      req.cookies,
      req.cookies.accessToken
    );
    return req.cookies.accessToken;
  }
  console.log('no devuelve un sevillo');
  return null;
};
//---
export const verifyToken = async (req, res, next) => {
  console.log('verifyToken');

  // Get token from Authorization header (for mobile) or cookies (for web)
  const token = getAuthToken(req);

  if (!token) {
    console.error('Error when verifying token');
    return next(
      createError(
        401,
        'Access Unauthenticated. No token provided. Please sign in again'
      )
    );
  }
  // Basic token validation
  if (typeof token !== 'string' || token.trim().length === 0) {
    return next(createError(400, 'Invalid token format'));
  }

  try {
    // jwt.verify returns a promise if no callback is provided - seams jwt.verify works with promise already
    const decoded = await new Promise((resolve, reject) => {
      jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
        if (err) {
          reject(err);
        } else {
          resolve(decoded);
        }
      });
    });

    req.user = decoded;
    console.log('decoded:', decoded)

    next();
  } catch (error) {
    let errorMessage = 'Invalid token. Please log in again.';
    let statusCode = 403; // Forbidden

    if (error.name === 'TokenExpiredError') {
      errorMessage = 'Token expired. Please log in again.';
      statusCode = 401; // Unauthorized
    } else if (error.name === 'JsonWebTokenError') {
      errorMessage = 'Invalid token. Please log in again.';
    }

    return next(
      createError(createError(statusCode, errorMessage)) //forbidden
    );
  }
};

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
