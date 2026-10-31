import mongoose, { Document, Schema } from 'mongoose';

export type ProductUnit = 'piece' | 'pair' | 'box' | 'kg' | 'meter' | 'liter' | 'set' | 'roll';
export type ProductStatus = 'active' | 'inactive' | 'archived';

export interface IProduct {
  name: string;
  sku: string;
  barcode?: string;
  category?: string;
  subcategory?: string;
  brand?: string;
  modelNumber?: string;
  description?: string;
  unit: ProductUnit;
  purchaseCost: number;
  sellingPrice: number;
  wholesalePrice: number;
  minSellingPrice: number;
  gstRate: number;
  hsnCode?: string;
  currentStock: number;
  minStockThreshold: number;
  location?: string;
  supplier?: mongoose.Types.ObjectId;
  images: string[];
  status: ProductStatus;
  isDeleted: boolean;
  createdBy?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

export interface IProductDocument extends IProduct, Document {}

const productSchema = new Schema<IProductDocument>(
  {
    name: { type: String, required: true, trim: true },
    sku: { type: String, required: true, unique: true, trim: true, uppercase: true },
    barcode: String,
    category: { type: String, trim: true },
    subcategory: String,
    brand: String,
    modelNumber: String,
    description: String,
    unit: {
      type: String,
      enum: ['piece', 'pair', 'box', 'kg', 'meter', 'liter', 'set', 'roll'],
      default: 'piece',
    },
    purchaseCost: { type: Number, default: 0 },
    sellingPrice: { type: Number, default: 0 },
    wholesalePrice: { type: Number, default: 0 },
    minSellingPrice: { type: Number, default: 0 },
    gstRate: { type: Number, default: 0 },
    hsnCode: String,
    currentStock: { type: Number, default: 0 },
    minStockThreshold: { type: Number, default: 10 },
    location: String,
    supplier: { type: Schema.Types.ObjectId, ref: 'Supplier' },
    images: [{ type: String }],
    status: {
      type: String,
      enum: ['active', 'inactive', 'archived'],
      default: 'active',
    },
    isDeleted: { type: Boolean, default: false },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

productSchema.index({ barcode: 1 });
productSchema.index({ category: 1, status: 1 });
productSchema.index({ name: 'text', brand: 'text', modelNumber: 'text' });

export const Product = mongoose.model<IProductDocument>('Product', productSchema);
