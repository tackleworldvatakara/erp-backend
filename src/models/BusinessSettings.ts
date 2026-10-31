import mongoose, { Document, Schema, Model } from 'mongoose';

export interface IBusinessSettings {
  shopName: string;
  logo?: string;
  address: {
    line1?: string;
    line2?: string;
    city?: string;
    state?: string;
    pincode?: string;
    country?: string;
  };
  phone?: string;
  email?: string;
  gstin?: string;
  invoicePrefix: string;
  invoiceCounter: number;
  currency: string;
  currencySymbol: string;
  timezone: string;
  taxEnabled: boolean;
  defaultTaxRate: number;
  cgstRate: number;
  sgstRate: number;
  igstRate: number;
  roundingMethod: 'none' | 'up' | 'down' | 'nearest';
  lowStockDefault: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface IBusinessSettingsDocument extends IBusinessSettings, Document {}

interface IBusinessSettingsModel extends Model<IBusinessSettingsDocument> {
  getInstance(): Promise<IBusinessSettingsDocument>;
}

const businessSettingsSchema = new Schema<IBusinessSettingsDocument, IBusinessSettingsModel>(
  {
    shopName: { type: String, default: 'My Shop' },
    logo: { type: String },
    address: {
      line1: String,
      line2: String,
      city: String,
      state: String,
      pincode: String,
      country: { type: String, default: 'India' },
    },
    phone: String,
    email: String,
    gstin: String,
    invoicePrefix: { type: String, default: 'INV' },
    invoiceCounter: { type: Number, default: 1 },
    currency: { type: String, default: 'INR' },
    currencySymbol: { type: String, default: '₹' },
    timezone: { type: String, default: 'Asia/Kolkata' },
    taxEnabled: { type: Boolean, default: true },
    defaultTaxRate: { type: Number, default: 18 },
    cgstRate: { type: Number, default: 9 },
    sgstRate: { type: Number, default: 9 },
    igstRate: { type: Number, default: 18 },
    roundingMethod: {
      type: String,
      enum: ['none', 'up', 'down', 'nearest'],
      default: 'nearest',
    },
    lowStockDefault: { type: Number, default: 10 },
  },
  { timestamps: true }
);

businessSettingsSchema.statics.getInstance = async function (): Promise<IBusinessSettingsDocument> {
  let settings = await this.findOne();
  if (!settings) {
    settings = await this.create({});
  }
  return settings;
};

export const BusinessSettings = mongoose.model<IBusinessSettingsDocument, IBusinessSettingsModel>(
  'BusinessSettings',
  businessSettingsSchema
);
