import { z } from 'zod';

const units = ['piece', 'pair', 'box', 'kg', 'meter', 'liter', 'set', 'roll'] as const;

export const createProductSchema = z.object({
  name: z.string().min(1, 'Product name is required').max(200),
  sku: z.string().min(1, 'SKU is required').max(50).toUpperCase(),
  category: z.string().optional(),
  brand: z.string().optional(),
  unit: z.enum(units).default('piece'),
  purchaseCost: z.number().min(0, 'Purchase cost cannot be negative').default(0),
  sellingPrice: z.number().min(0, 'Selling price cannot be negative'),
  currentStock: z.number().min(0).default(0),
  minStockThreshold: z.number().min(0).default(10),
  description: z.string().optional(),
});

export const updateProductSchema = createProductSchema.partial().extend({
  status: z.enum(['active', 'inactive']).optional(),
});

export type CreateProductInput = z.infer<typeof createProductSchema>;
export type UpdateProductInput = z.infer<typeof updateProductSchema>;
