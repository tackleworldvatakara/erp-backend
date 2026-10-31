import { Router } from 'express';
import { verifyToken, requireRole } from '../middleware/auth';
import {
  createReturn,
  listReturns,
  getReturn,
  getSaleReturnableInfo,
  getReturnStats,
  updateReturnStatus,
} from '../controllers/return.controller';

const router = Router();

router.use(verifyToken);

router.get('/stats', requireRole('admin', 'manager', 'sales'), getReturnStats);
router.get('/sale-info/:saleIdentifier', requireRole('admin', 'manager', 'sales'), getSaleReturnableInfo);
router.get('/', requireRole('admin', 'manager', 'sales'), listReturns);
router.get('/:id', requireRole('admin', 'manager', 'sales'), getReturn);
router.post('/', requireRole('admin', 'manager', 'sales'), createReturn);
router.put('/:id/status', requireRole('admin', 'manager'), updateReturnStatus);

export default router;

