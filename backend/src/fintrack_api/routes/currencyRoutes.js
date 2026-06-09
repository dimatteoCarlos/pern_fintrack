// backend/src/fintrack_api/routes/currencyRoutes.js
import express from 'express';
import { currencyConvert } from '../controllers/currencyController.js';

const router = express.Router();

//CURRENCY CONVERSION
router.use('/convert', currencyConvert);

export default router;
