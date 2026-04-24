// backend/src/cronjob/cronRoutes.js
import express from 'express';
import { cleanRevokedTokens } from '../utils/authUtils/authFn.js';
import { verifyCronSecret } from './cronMiddleware.js';

const router = express.Router();

router.post('/clean-tokens', verifyCronSecret, async (req, res, next) => {
  try {
    await cleanRevokedTokens();
    res.status(200).json({ success: true, message: 'Revoked tokens cleaned successfully' });
  } catch (error) {
    console.error('Error cleaning revoked tokens:', error);
    next(error);
  }
});

export default router;