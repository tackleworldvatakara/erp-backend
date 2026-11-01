import { z } from 'zod';

export const createSaleSchema = z.object({
  customerName: z.string().optional().default('Walk-in Customer'),
  customerPhone: z.string().optional(),
  items: z
    .array(
      z.object({
        productId: z.string().min(1, 'Product ID required'),
        quantity: z.number().int().min(1, 'Quantity must be at least 1'),
        unitPrice: z.number().min(0, 'Unit price cannot be negative'),
        discount: z.number().min(0).max(100).default(0),
      })
    )
    .min(1, 'At least one item is required'),
  commonDiscount: z.number().min(0).default(0),
  paymentMethod: z.enum(['cash', 'upi', 'card', 'bank_transfer']),
  amountPaid: z.number().min(0),
  notes: z.string().optional(),
});

export type CreateSaleInput = z.infer<typeof createSaleSchema>;
