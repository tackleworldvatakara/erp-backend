import { z } from 'zod';

export const returnItemInputSchema = z.object({
  saleItem: z.string().optional(),
  product: z.string().min(1, 'Product ID is required'),
  quantity: z.number().positive('Quantity must be greater than 0'),
  unitPrice: z.number().min(0, 'Unit price cannot be negative'),
  returnReason: z.string().optional(),
  condition: z.enum(['resellable', 'damaged', 'supplier_return']),
});

export const createReturnSchema = z.object({
  originalSale: z.string().min(1, 'Original sale ID is required'),
  customer: z.string().optional(),
  returnDate: z.string().optional(),
  items: z.array(returnItemInputSchema).min(1, 'At least one item must be returned'),
  refundMethod: z.string().optional(),
  notes: z.string().optional(),
  status: z.enum(['draft', 'approved', 'rejected', 'completed']).optional().default('completed'),
  refundStatus: z.enum(['pending', 'approved', 'rejected', 'completed']).optional().default('completed'),
});

export const updateReturnStatusSchema = z.object({
  status: z.enum(['draft', 'approved', 'rejected', 'completed']),
  refundStatus: z.enum(['pending', 'approved', 'rejected', 'completed']).optional(),
  notes: z.string().optional(),
});

export type ReturnItemInput = z.infer<typeof returnItemInputSchema>;
export type CreateReturnInput = z.input<typeof createReturnSchema>;
export type UpdateReturnStatusInput = z.infer<typeof updateReturnStatusSchema>;
