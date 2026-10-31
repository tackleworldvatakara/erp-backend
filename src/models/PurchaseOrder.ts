import mongoose, { Document, Schema } from 'mongoose';

export type PurchaseOrderStatus =
  | 'draft'
  | 'ordered'
  | 'partially_received'
  | 'received'
  | 'cancelled'
  | 'returned';

export interface IPurchaseOrderItem {
  product: mongoose.Types.ObjectId;
  quantity: number;
  receivedQty: number;
  unitCost: number;
  discount: number;
  taxRate: number;
  lineTotal: number;
}

export interface IPurchaseOrder {
  poNumber: string;
  supplier: mongoose.Types.ObjectId;
  orderDate: Date;
  expectedDeliveryDate?: Date;
  items: IPurchaseOrderItem[];
  subtotal: number;
  discountTotal: number;
  taxTotal: number;
  grandTotal: number;
  status: PurchaseOrderStatus;
  notes?: string;
  createdBy?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

export interface IPurchaseOrderDocument extends IPurchaseOrder, Document {}

const purchaseOrderItemSchema = new Schema<IPurchaseOrderItem>(
  {
    product: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
    quantity: { type: Number, required: true },
    receivedQty: { type: Number, default: 0 },
    unitCost: { type: Number, required: true },
    discount: { type: Number, default: 0 },
    taxRate: { type: Number, default: 0 },
    lineTotal: { type: Number, required: true },
  },
  { _id: false }
);

const purchaseOrderSchema = new Schema<IPurchaseOrderDocument>(
  {
    poNumber: { type: String, required: true, unique: true, trim: true },
    supplier: { type: Schema.Types.ObjectId, ref: 'Supplier', required: true },
    orderDate: { type: Date, default: Date.now },
    expectedDeliveryDate: Date,
    items: [purchaseOrderItemSchema],
    subtotal: { type: Number, default: 0 },
    discountTotal: { type: Number, default: 0 },
    taxTotal: { type: Number, default: 0 },
    grandTotal: { type: Number, default: 0 },
    status: {
      type: String,
      enum: ['draft', 'ordered', 'partially_received', 'received', 'cancelled', 'returned'],
      default: 'draft',
    },
    notes: String,
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

export const PurchaseOrder = mongoose.model<IPurchaseOrderDocument>(
  'PurchaseOrder',
  purchaseOrderSchema
);
