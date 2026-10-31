import mongoose, { Document, Schema } from 'mongoose';

export type CustomerType = 'retail' | 'wholesale' | 'business';

export interface ICustomer {
  name: string;
  phone?: string;
  email?: string;
  billingAddress?: {
    line1?: string;
    line2?: string;
    city?: string;
    state?: string;
    pincode?: string;
  };
  shippingAddress?: {
    line1?: string;
    line2?: string;
    city?: string;
    state?: string;
    pincode?: string;
  };
  gstin?: string;
  customerType: CustomerType;
  creditLimit: number;
  paymentTerms: number;
  openingBalance: number;
  currentBalance: number;
  isActive: boolean;
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface ICustomerDocument extends ICustomer, Document {}

const addressSchema = new Schema(
  {
    line1: String,
    line2: String,
    city: String,
    state: String,
    pincode: String,
  },
  { _id: false }
);

const customerSchema = new Schema<ICustomerDocument>(
  {
    name: { type: String, required: true, trim: true },
    phone: { type: String, index: true },
    email: { type: String, lowercase: true, trim: true },
    billingAddress: addressSchema,
    shippingAddress: addressSchema,
    gstin: String,
    customerType: {
      type: String,
      enum: ['retail', 'wholesale', 'business'],
      default: 'retail',
    },
    creditLimit: { type: Number, default: 0 },
    paymentTerms: { type: Number, default: 0 },
    openingBalance: { type: Number, default: 0 },
    currentBalance: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
    isDeleted: { type: Boolean, default: false },
  },
  { timestamps: true }
);

customerSchema.index({ isDeleted: 1 });

export const Customer = mongoose.model<ICustomerDocument>('Customer', customerSchema);
