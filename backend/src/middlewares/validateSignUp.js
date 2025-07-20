// Middleware de validación para el registro / register validation
import { body, validationResult } from 'express-validator';
import { createError } from '../../utils/errorHandling.js';
export const validateSignUp = [
  body('username')
    .trim()
    .notEmpty()
    .withMessage('Username is required')
    .isLength({ min: 3, max: 20 })
    .withMessage('Username must be between 3 and 20 characters')
    .isAlphanumeric()
    .withMessage('Username must be alphanumeric'),
  body('email')
    .trim()
    .notEmpty()
    .withMessage('Email is required')
    .isEmail()
    .withMessage('Invalid email format'),
  body('password')
    .notEmpty()
    .withMessage('Password is required')
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters'),
  body('user_firstname')
    .trim()
    .notEmpty()
    .withMessage('First name is required')
    .isAlpha()
    .withMessage('First name must be alphabetic'),
  body('user_lastname')
    .trim()
    .notEmpty()
    .withMessage('Last name is required')
    .isAlpha()
    .withMessage('Last name must be alphabetic'),
  body('currency')
    .optional()
    .trim()
    .isAlpha()
    .isLength({ min: 3, max: 3 })
    .withMessage('Currency must be a 3-letter code'),
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const errorMessages = errors
        .array()
        .map((err) => `${err.msg} in ${err.path}`)
        .join(', ');
      return next(createError(400, 'Validation error', errorMessages));
    }
    next();
  },
];
