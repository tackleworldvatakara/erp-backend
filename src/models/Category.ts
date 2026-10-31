import mongoose, { Document, Schema, Model } from 'mongoose';

export interface ICategory {
  name: string;
  slug: string;
  parentCategory?: mongoose.Types.ObjectId;
  description?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface ICategoryDocument extends ICategory, Document {}

const categorySchema = new Schema<ICategoryDocument>(
  {
    name: { type: String, required: true, trim: true, unique: true },
    slug: { type: String, unique: true },
    parentCategory: {
      type: Schema.Types.ObjectId,
      ref: 'Category',
      default: null,
    },
    description: String,
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

// Pre-save: generate slug from name
categorySchema.pre('save', function (next) {
  if (this.isModified('name')) {
    this.slug = this.name
      .toLowerCase()
      .trim()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, '');
  }
  next();
});

export const Category = mongoose.model<ICategoryDocument>('Category', categorySchema);
