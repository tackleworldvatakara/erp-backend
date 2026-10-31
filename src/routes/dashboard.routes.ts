import { Router } from 'express';
import { verifyToken } from '../middleware/auth';
import { getDashboardStats } from '../controllers/sale.controller';

const router = Router();

router.use(verifyToken);
router.get('/stats', getDashboardStats);

export default router;
