import { Category } from '../models/Category';
import { Product } from '../models/Product';

export async function getCategories() {
  return Category.find({ isActive: true }).sort({ name: 1 }).lean();
}

export async function createCategory(name: string, description?: string) {
  const existing = await Category.findOne({ name: { $regex: `^${name}$`, $options: 'i' } });
  if (existing) {
    throw Object.assign(new Error(`Category "${name}" already exists`), { statusCode: 409 });
  }
  return Category.create({ name: name.trim(), description: description?.trim() });
}

export async function updateCategory(id: string, name: string, description?: string) {
  const category = await Category.findById(id);
  if (!category) throw Object.assign(new Error('Category not found'), { statusCode: 404 });

  // Check duplicate name (exclude self)
  const dup = await Category.findOne({
    name: { $regex: `^${name}$`, $options: 'i' },
    _id: { $ne: id },
  });
  if (dup) throw Object.assign(new Error(`Category "${name}" already exists`), { statusCode: 409 });

  category.name = name.trim();
  if (description !== undefined) category.description = description.trim();
  await category.save();
  return category;
}

export async function deleteCategory(id: string) {
  // Check if any product uses this category name
  const category = await Category.findById(id);
  if (!category) throw Object.assign(new Error('Category not found'), { statusCode: 404 });

  const usedCount = await Product.countDocuments({ category: category.name, isDeleted: false });
  if (usedCount > 0) {
    throw Object.assign(
      new Error(`Cannot delete — ${usedCount} product(s) use this category`),
      { statusCode: 409 }
    );
  }

  await Category.findByIdAndDelete(id);
}
