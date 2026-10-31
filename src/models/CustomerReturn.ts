import mongoose, { Document, Schema } from 'mongoose';

export type ReturnItemCondition = 'resellable' | 'damaged' | 'supplier_return';
export type ReturnStatus = 'draft' | 'approved' | 'rejected' | 'completed';
export type RefundStatus = 'pending' | 'approved' | 'rejected' | 'completed';

export interface ICustomerReturnItem {
  saleItem: mongoose.Types.ObjectId;
  product: mongoose.Types.ObjectId;
  quantity: number;
  unitPrice: number;
  returnReason?: string;
  condition: ReturnItemCondition;
}

export interface ICustomerReturn {
  returnNumber: string;
  originalSale: mongoose.Types.ObjectId;
  customer?: mongoose.Types.ObjectId;
  returnDate: Date;
  items: ICustomerReturnItem[];
  totalRefund: number;
  refundMethod?: string;
  refundStatus: RefundStatus;
  approvedBy?: mongoose.Types.ObjectId;
  notes?: string;
  status: ReturnStatus;
  createdBy?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

export interface ICustomerReturnDocument extends ICustomerReturn, Document {}

const returnItemSchema = new Schema<ICustomerReturnItem>(
  {
    saleItem: { type: Schema.Types.ObjectId, required: true },
    product: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
    quantity: { type: Number, required: true },
    unitPrice: { type: Number, required: true },
    returnReason: String,
    condition: {
      type: String,
      enum: ['resellable', 'damaged', 'supplier_return'],
      required: true,
    },
  },
  { _id: false }
);

const customerReturnSchema = new Schema<ICustomerReturnDocument>(
  {
    returnNumber: { type: String, required: true, unique: true, trim: true },
    originalSale: { type: Schema.Types.ObjectId, ref: 'Sale', required: true },
    customer: { type: Schema.Types.ObjectId, ref: 'Customer' },
    returnDate: { type: Date, default: Date.now },
    items: [returnItemSchema],
    totalRefund: { type: Number, default: 0 },
    refundMethod: String,
    refundStatus: {
      type: String,
      enum: ['pending', 'approved', 'rejected', 'completed'],
      default: 'pending',
    },
    approvedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    notes: String,
    status: {
      type: String,
      enum: ['draft', 'approved', 'rejected', 'completed'],
      default: 'draft',
    },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

export const CustomerReturn = mongoose.model<ICustomerReturnDocument>(
  'CustomerReturn',
  customerReturnSchema
);
