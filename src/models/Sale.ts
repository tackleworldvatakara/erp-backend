import mongoose, { Document, Schema } from 'mongoose';

export type SalePaymentStatus = 'unpaid' | 'partial' | 'paid';
export type SalePaymentMethod = 'cash' | 'upi' | 'card' | 'bank_transfer' | 'credit' | 'split';
export type SaleStatus = 'draft' | 'confirmed' | 'cancelled' | 'returned';

export interface ISaleItem {
  _id?: mongoose.Types.ObjectId;
  product: mongoose.Types.ObjectId;
  productName: string;
  sku: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  discount: number;
  discountAmount: number;
  taxRate: number;
  taxAmount: number;
  lineTotal: number;
  costAtSale: number;
}

export interface ISalePayment {
  method: string;
  amount: number;
  reference?: string;
  date: Date;
}

export interface ISale {
  invoiceNumber: string;
  customer?: mongoose.Types.ObjectId;
  customerName?: string;
  invoiceDate: Date;
  dueDate?: Date;
  items: ISaleItem[];
  subtotal: number;
  discountTotal: number;
  taxableAmount: number;
  taxTotal: number;
  cgstTotal: number;
  sgstTotal: number;
  igstTotal: number;
  roundOff: number;
  grandTotal: number;
  paidAmount: number;
  balanceDue: number;
  paymentStatus: SalePaymentStatus;
  paymentMethod: SalePaymentMethod;
  payments: ISalePayment[];
  status: SaleStatus;
  notes?: string;
  invoiceNotes?: string;
  createdBy?: mongoose.Types.ObjectId;
  cancelledBy?: mongoose.Types.ObjectId;
  cancelledAt?: Date;
  cancellationReason?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ISaleDocument extends ISale, Document {}

const saleItemSchema = new Schema<ISaleItem>(
  {
    product: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
    productName: { type: String, required: true },
    sku: { type: String, required: true },
    quantity: { type: Number, required: true },
    unit: { type: String, required: true },
    unitPrice: { type: Number, required: true },
    discount: { type: Number, default: 0 },
    discountAmount: { type: Number, default: 0 },
    taxRate: { type: Number, default: 0 },
    taxAmount: { type: Number, default: 0 },
    lineTotal: { type: Number, required: true },
    costAtSale: { type: Number, default: 0 },
  },
  { _id: false }
);

const salePaymentSchema = new Schema<ISalePayment>(
  {
    method: { type: String, required: true },
    amount: { type: Number, required: true },
    reference: String,
    date: { type: Date, default: Date.now },
  },
  { _id: false }
);

const saleSchema = new Schema<ISaleDocument>(
  {
    invoiceNumber: { type: String, required: true, unique: true, trim: true },
    customer: { type: Schema.Types.ObjectId, ref: 'Customer', default: null },
    customerName: String,
    invoiceDate: { type: Date, default: Date.now },
    dueDate: Date,
    items: [saleItemSchema],
    subtotal: { type: Number, default: 0 },
    discountTotal: { type: Number, default: 0 },
    taxableAmount: { type: Number, default: 0 },
    taxTotal: { type: Number, default: 0 },
    cgstTotal: { type: Number, default: 0 },
    sgstTotal: { type: Number, default: 0 },
    igstTotal: { type: Number, default: 0 },
    roundOff: { type: Number, default: 0 },
    grandTotal: { type: Number, default: 0 },
    paidAmount: { type: Number, default: 0 },
    balanceDue: { type: Number, default: 0 },
    paymentStatus: {
      type: String,
      enum: ['unpaid', 'partial', 'paid'],
      default: 'unpaid',
    },
    paymentMethod: {
      type: String,
      enum: ['cash', 'upi', 'card', 'bank_transfer', 'credit', 'split'],
      default: 'cash',
    },
    payments: [salePaymentSchema],
    status: {
      type: String,
      enum: ['draft', 'confirmed', 'cancelled', 'returned'],
      default: 'draft',
    },
    notes: String,
    invoiceNotes: String,
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
    cancelledBy: { type: Schema.Types.ObjectId, ref: 'User' },
    cancelledAt: Date,
    cancellationReason: String,
  },
  { timestamps: true }
);

saleSchema.index({ customer: 1 });
saleSchema.index({ invoiceDate: -1 });
saleSchema.index({ status: 1 });

export const Sale = mongoose.model<ISaleDocument>('Sale', saleSchema);
