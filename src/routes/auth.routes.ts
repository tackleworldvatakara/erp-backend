import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { config } from '../config/env';
import {
  setupController,
  loginController,
  refreshController,
  logoutController,
  meController,
} from '../controllers/auth.controller';
import { verifyToken } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { setupSchema, loginSchema } from '../validation/auth.validation';

const router = Router();

// Strict limiter for login/setup only (brute-force protection)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: config.isProduction ? 10 : 100,
  message: { success: false, message: 'Too many attempts, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => !config.isProduction, // disable in development
});

router.post('/setup', authLimiter, validate(setupSchema), setupController);
router.post('/login', authLimiter, validate(loginSchema), loginController);
router.post('/refresh', refreshController);
router.post('/logout', logoutController);
router.get('/me', verifyToken, meController);

export default router;
