import mongoose, { Document, Schema } from 'mongoose';

export interface ISupplier {
  supplierName: string;
  companyName?: string;
  contactPerson?: string;
  phone?: string;
  email?: string;
  gstin?: string;
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
  paymentTerms?: string;
  openingBalance: number;
  currentBalance: number;
  isActive: boolean;
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface ISupplierDocument extends ISupplier, Document {}

const supplierSchema = new Schema<ISupplierDocument>(
  {
    supplierName: { type: String, required: true, trim: true },
    companyName: String,
    contactPerson: String,
    phone: String,
    email: { type: String, lowercase: true, trim: true },
    gstin: String,
    billingAddress: {
      line1: String,
      line2: String,
      city: String,
      state: String,
      pincode: String,
    },
    shippingAddress: {
      line1: String,
      line2: String,
      city: String,
      state: String,
      pincode: String,
    },
    paymentTerms: String,
    openingBalance: { type: Number, default: 0 },
    currentBalance: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
    isDeleted: { type: Boolean, default: false },
  },
  { timestamps: true }
);

supplierSchema.index({ isDeleted: 1 });

export const Supplier = mongoose.model<ISupplierDocument>('Supplier', supplierSchema);
