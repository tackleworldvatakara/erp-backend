import { Router } from 'express';
import { verifyToken, requireRole } from '../middleware/auth';
import { listUsers, createUser, updateUser, resetPassword, deleteUser } from '../controllers/user.controller';

const router = Router();

// All user management — admin only
router.use(verifyToken, requireRole('admin'));

router.get('/', listUsers);
router.post('/', createUser);
router.put('/:id', updateUser);
router.post('/:id/reset-password', resetPassword);
router.delete('/:id', deleteUser);

export default router;
