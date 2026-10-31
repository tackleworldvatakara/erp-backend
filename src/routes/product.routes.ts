import { Router } from 'express';
import { verifyToken, requireRole } from '../middleware/auth';
import {
  listProducts,
  searchProducts,
  getLowStock,
  getProduct,
  createProduct,
  updateProduct,
  deleteProduct,
} from '../controllers/product.controller';

const router = Router();

// All product routes require authentication
router.use(verifyToken);

// Search & low-stock — open to all authenticated users
router.get('/search', searchProducts);
router.get('/low-stock', getLowStock);

// List & get
router.get('/', listProducts);
router.get('/:id', getProduct);

// Create — admin, manager, inventory
router.post('/', requireRole('admin', 'manager', 'inventory'), createProduct);

// Update — admin, manager, inventory
router.put('/:id', requireRole('admin', 'manager', 'inventory'), updateProduct);

// Delete — admin only
router.delete('/:id', requireRole('admin'), deleteProduct);

export default router;
