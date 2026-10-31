import mongoose, { Document, Schema } from 'mongoose';

export type PurchaseReceiptPaymentStatus = 'unpaid' | 'partial' | 'paid';

export interface IPurchaseReceiptItem {
  product: mongoose.Types.ObjectId;
  orderedQty: number;
  receivedQty: number;
  unitCost: number;
  taxRate: number;
  lineTotal: number;
}

export interface IPurchaseReceipt {
  receiptNumber: string;
  purchaseOrder: mongoose.Types.ObjectId;
  supplier: mongoose.Types.ObjectId;
  receiptDate: Date;
  supplierInvoiceNumber?: string;
  items: IPurchaseReceiptItem[];
  subtotal: number;
  taxTotal: number;
  grandTotal: number;
  paymentStatus: PurchaseReceiptPaymentStatus;
  paidAmount: number;
  notes?: string;
  isProcessed: boolean;
  processedAt?: Date;
  createdBy?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

export interface IPurchaseReceiptDocument extends IPurchaseReceipt, Document {}

const purchaseReceiptItemSchema = new Schema<IPurchaseReceiptItem>(
  {
    product: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
    orderedQty: { type: Number, required: true },
    receivedQty: { type: Number, required: true },
    unitCost: { type: Number, required: true },
    taxRate: { type: Number, default: 0 },
    lineTotal: { type: Number, required: true },
  },
  { _id: false }
);

const purchaseReceiptSchema = new Schema<IPurchaseReceiptDocument>(
  {
    receiptNumber: { type: String, required: true, unique: true, trim: true },
    purchaseOrder: { type: Schema.Types.ObjectId, ref: 'PurchaseOrder', required: true },
    supplier: { type: Schema.Types.ObjectId, ref: 'Supplier', required: true },
    receiptDate: { type: Date, default: Date.now },
    supplierInvoiceNumber: String,
    items: [purchaseReceiptItemSchema],
    subtotal: { type: Number, default: 0 },
    taxTotal: { type: Number, default: 0 },
    grandTotal: { type: Number, default: 0 },
    paymentStatus: {
      type: String,
      enum: ['unpaid', 'partial', 'paid'],
      default: 'unpaid',
    },
    paidAmount: { type: Number, default: 0 },
    notes: String,
    isProcessed: { type: Boolean, default: false },
    processedAt: Date,
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

export const PurchaseReceipt = mongoose.model<IPurchaseReceiptDocument>(
  'PurchaseReceipt',
  purchaseReceiptSchema
);
