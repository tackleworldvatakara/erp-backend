import mongoose, { Document, Schema } from 'mongoose';

export type StockMovementType =
  | 'purchase_receipt'
  | 'sale'
  | 'customer_return'
  | 'supplier_return'
  | 'stock_adjustment'
  | 'opening_stock'
  | 'damaged'
  | 'transfer';

export interface IStockMovement {
  product: mongoose.Types.ObjectId;
  movementType: StockMovementType;
  quantity: number;
  previousStock: number;
  newStock: number;
  referenceType?: string;
  referenceId?: mongoose.Types.ObjectId;
  reason?: string;
  notes?: string;
  createdBy?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

export interface IStockMovementDocument extends IStockMovement, Document {}

const stockMovementSchema = new Schema<IStockMovementDocument>(
  {
    product: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
    movementType: {
      type: String,
      enum: [
        'purchase_receipt',
        'sale',
        'customer_return',
        'supplier_return',
        'stock_adjustment',
        'opening_stock',
        'damaged',
        'transfer',
      ],
      required: true,
    },
    // positive = stock in, negative = stock out
    quantity: { type: Number, required: true },
    previousStock: { type: Number, required: true },
    newStock: { type: Number, required: true },
    referenceType: String,
    referenceId: { type: Schema.Types.ObjectId },
    reason: String,
    notes: String,
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

stockMovementSchema.index({ product: 1, createdAt: -1 });

export const StockMovement = mongoose.model<IStockMovementDocument>(
  'StockMovement',
  stockMovementSchema
);
