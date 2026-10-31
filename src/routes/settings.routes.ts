import { Router, Request, Response } from 'express';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { verifyToken, requireRole } from '../middleware/auth';
import { asyncHandler } from '../middleware/asyncHandler';
import { sendSuccess, sendError } from '../utils/response';
import { User } from '../models/User';
import { BusinessSettings } from '../models/BusinessSettings';

const router = Router();
router.use(verifyToken);

// ── GET shop settings (all authenticated) ────────────────────────────────────
router.get('/shop', asyncHandler(async (_req: Request, res: Response) => {
  const settings = await BusinessSettings.getInstance();
  sendSuccess(res, settings);
}));

// ── UPDATE shop settings (admin only) ────────────────────────────────────────
const shopSchema = z.object({
  shopName:       z.string().min(1).optional(),
  phone:          z.string().optional(),
  email:          z.string().email().optional().or(z.literal('')),
  gstin:          z.string().optional(),
  invoicePrefix:  z.string().min(1).max(10).optional(),
  lowStockDefault: z.number().min(0).optional(),
  address: z.object({
    line1:   z.string().optional(),
    line2:   z.string().optional(),
    city:    z.string().optional(),
    state:   z.string().optional(),
    pincode: z.string().optional(),
    country: z.string().optional(),
  }).optional(),
});

router.put('/shop', requireRole('admin'), asyncHandler(async (req: Request, res: Response) => {
  const parsed = shopSchema.safeParse(req.body);
  if (!parsed.success) { sendError(res, 'Validation failed', 400, parsed.error.errors); return; }

  const settings = await BusinessSettings.getInstance();
  const data = parsed.data;

  if (data.shopName)        settings.shopName       = data.shopName;
  if (data.phone !== undefined) settings.phone      = data.phone;
  if (data.email !== undefined) settings.email      = data.email;
  if (data.gstin !== undefined) settings.gstin      = data.gstin;
  if (data.invoicePrefix)   settings.invoicePrefix  = data.invoicePrefix.toUpperCase();
  if (data.lowStockDefault !== undefined) settings.lowStockDefault = data.lowStockDefault;
  if (data.address) {
    settings.address = { ...settings.address, ...data.address };
  }

  await settings.save();
  sendSuccess(res, settings, 'Settings saved');
}));

// ── UPDATE own profile (any authenticated user) ───────────────────────────────
const profileSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
});

router.put('/profile', asyncHandler(async (req: Request, res: Response) => {
  const parsed = profileSchema.safeParse(req.body);
  if (!parsed.success) { sendError(res, 'Validation failed', 400, parsed.error.errors); return; }

  const user = await User.findByIdAndUpdate(
    req.user!.userId,
    { name: parsed.data.name.trim() },
    { new: true }
  ).select('-password -refreshTokenHash');

  if (!user) { sendError(res, 'User not found', 404); return; }
  sendSuccess(res, user, 'Profile updated');
}));

// ── CHANGE own password ───────────────────────────────────────────────────────
const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword:     z.string().min(8, 'New password must be at least 8 characters'),
}).refine((d) => d.currentPassword !== d.newPassword, {
  message: 'New password must be different from current password',
  path: ['newPassword'],
});

router.put('/change-password', asyncHandler(async (req: Request, res: Response) => {
  const parsed = changePasswordSchema.safeParse(req.body);
  if (!parsed.success) { sendError(res, 'Validation failed', 400, parsed.error.errors); return; }

  const user = await User.findById(req.user!.userId).select('+password');
  if (!user) { sendError(res, 'User not found', 404); return; }

  const isMatch = await bcrypt.compare(parsed.data.currentPassword, user.password);
  if (!isMatch) { sendError(res, 'Current password is incorrect', 400); return; }

  user.password = parsed.data.newPassword; // hashed by pre-save hook
  user.tokenVersion = (user.tokenVersion ?? 0) + 1;
  await user.save();

  sendSuccess(res, null, 'Password changed successfully');
}));

export default router;
