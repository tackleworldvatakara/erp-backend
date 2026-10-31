import { Router } from 'express';
import { verifyToken, requireRole } from '../middleware/auth';
import { listCategories, createCategory, updateCategory, deleteCategory } from '../controllers/category.controller';

const router = Router();
router.use(verifyToken);

router.get('/', listCategories);                                              // all roles
router.post('/', requireRole('admin', 'manager'), createCategory);           // admin/manager
router.put('/:id', requireRole('admin', 'manager'), updateCategory);         // admin/manager
router.delete('/:id', requireRole('admin', 'manager'), deleteCategory);      // admin/manager

export default router;
