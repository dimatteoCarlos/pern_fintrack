//backend/src/routes/index.js
import express from 'express';
import authRoutes from './authRoutes.js';
import userRoutes from './userRoutes.js';
import { authDetectClienttype } from '../middlewares/authDetectClienttype.js';

const router = express.Router(); 
console.log('index routes');

router.use('/auth', authDetectClienttype,authRoutes);

router.use('/user', userRoutes);

export default router;

