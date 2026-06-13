// backend/src/fintrack_api/routes/currencyRoutes.js
// 🧩 ROUTES: Currency conversion and rates
import express from 'express';
import {
  currencyConvert,
  getAllRates,
} from '../controllers/currencyController.js';

const router = express.Router();

//CURRENCY CONVERSION

router.post('/convert', currencyConvert);

//GET /api/fintrack/currency/rates?base=ACCOUNTING_CURRENCY_CODE (protected)
router.get('/rates', getAllRates);

export default router;