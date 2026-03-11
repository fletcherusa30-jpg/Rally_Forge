import express from 'express';
import {
  getCompensation,
  getCompensationYears,
  getSupportedCompensationYears,
  createCompensationQuote,
  createBackpayQuote,
} from '../controllers/compensationController.js';

const router = express.Router();

router.get('/', getCompensation);

router.get('/years', getCompensationYears);

router.get('/supported-years', getSupportedCompensationYears);

router.post('/quote', createCompensationQuote);

router.post('/backpay', createBackpayQuote);

export default router;

