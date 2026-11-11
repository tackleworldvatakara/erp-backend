import { Router } from 'express';
import { verifyToken, requireRole } from '../middleware/auth';
import { createSale, listSales, getSale, cancelSale, updateSale } from '../controllers/sale.controller';

const router = Router();

router.use(verifyToken);

router.post('/', requireRole('admin', 'manager', 'sales'), createSale);
router.get('/', requireRole('admin', 'manager', 'sales'), listSales);
router.get('/:id', requireRole('admin', 'manager', 'sales'), getSale);
router.put('/:id', requireRole('admin', 'manager'), updateSale);
router.post('/:id/cancel', requireRole('admin', 'manager'), cancelSale);

export default router;
