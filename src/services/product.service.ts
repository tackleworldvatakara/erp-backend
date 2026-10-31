import { Product } from '../models/Product';
import { StockMovement } from '../models/StockMovement';
import { Sale } from '../models/Sale';
import { CreateProductInput, UpdateProductInput } from '../validation/product.validation';
import mongoose from 'mongoose';

export async function createProduct(data: CreateProductInput, userId: string) {
  // Check duplicate SKU
  const existing = await Product.findOne({ sku: data.sku.toUpperCase(), isDeleted: false });
  if (existing) {
    const err = Object.assign(new Error(`SKU "${data.sku}" already exists`), { statusCode: 409 });
    throw err;
  }

  const product = await Product.create({
    ...data,
    sku: data.sku.toUpperCase(),
    category: data.category?.trim() || undefined,
    brand: data.brand?.trim() || undefined,
    description: data.description?.trim() || undefined,
    createdBy: new mongoose.Types.ObjectId(userId),
  });

  // Create opening stock movement if stock > 0
  if (data.currentStock > 0) {
    await StockMovement.create({
      product: product._id,
      movementType: 'opening_stock',
      quantity: data.currentStock,
      previousStock: 0,
      newStock: data.currentStock,
      reason: 'Opening stock',
      createdBy: new mongoose.Types.ObjectId(userId),
    });
  }

  return product;
}

export interface GetProductsFilters {
  search?: string;
  status?: string;
  category?: string;
  brand?: string;
  unit?: string;
  minPrice?: number;
  maxPrice?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  page?: number;
  pageSize?: number;
}

export async function getProducts(filters: GetProductsFilters) {
  const {
    search,
    status,
    category,
    brand,
    unit,
    minPrice,
    maxPrice,
    sortBy,
    sortOrder = 'desc',
    page = 1,
    pageSize = 20,
  } = filters;
  const query: mongoose.FilterQuery<typeof Product> = { isDeleted: false };

  if (search) {
    query.$or = [
      { name: { $regex: search, $options: 'i' } },
      { sku: { $regex: search, $options: 'i' } },
      { brand: { $regex: search, $options: 'i' } },
    ];
  }

  if (status === 'low_stock') {
    query.$expr = { $lte: ['$currentStock', '$minStockThreshold'] };
    query.currentStock = { $gt: 0 };
  } else if (status === 'out_of_stock') {
    query.currentStock = { $lte: 0 };
  } else if (status === 'in_stock') {
    query.$expr = { $gt: ['$currentStock', '$minStockThreshold'] };
  } else if (status === 'active') {
    query.status = 'active';
  } else if (status === 'inactive') {
    query.status = { $in: ['inactive', 'archived'] };
  } else if (status === 'archived') {
    query.status = 'archived';
  }

  if (category) {
    query.category = category;
  }

  if (brand) {
    query.brand = { $regex: brand, $options: 'i' };
  }

  if (unit) {
    query.unit = unit;
  }

  if (minPrice !== undefined || maxPrice !== undefined) {
    const priceQuery: Record<string, number> = {};
    if (minPrice !== undefined && !isNaN(minPrice)) priceQuery.$gte = minPrice;
    if (maxPrice !== undefined && !isNaN(maxPrice)) priceQuery.$lte = maxPrice;
    if (Object.keys(priceQuery).length > 0) {
      query.sellingPrice = priceQuery;
    }
  }

  const sortOptions: Record<string, 1 | -1> = {};
  const allowedSortFields = ['name', 'sellingPrice', 'purchaseCost', 'currentStock', 'createdAt'];
  if (sortBy && allowedSortFields.includes(sortBy)) {
    sortOptions[sortBy] = sortOrder === 'asc' ? 1 : -1;
  } else {
    sortOptions.createdAt = -1;
  }

  const total = await Product.countDocuments(query);
  const products = await Product.find(query)
    .sort(sortOptions)
    .skip((page - 1) * pageSize)
    .limit(pageSize)
    .lean();

  const productIds = products.map((product) => product._id);
  const productsWithSales = productIds.length
    ? await Sale.distinct('items.product', { 'items.product': { $in: productIds } })
    : [];
  const productsWithSalesSet = new Set(productsWithSales.map((id) => String(id)));
  const productsWithHistory = products.map((product) => ({
    ...product,
    hasSalesHistory: productsWithSalesSet.has(String(product._id)),
  }));

  return {
    products: productsWithHistory,
    pagination: {
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    },
  };
}

export async function getProductById(id: string) {
  const product = await Product.findOne({ _id: id, isDeleted: false });
  if (!product) {
    throw Object.assign(new Error('Product not found'), { statusCode: 404 });
  }
  return product;
}

export async function updateProduct(id: string, data: UpdateProductInput, userId: string) {
  const product = await Product.findOne({ _id: id, isDeleted: false });
  if (!product) {
    throw Object.assign(new Error('Product not found'), { statusCode: 404 });
  }

  // Check SKU uniqueness if changing SKU
  if (data.sku && data.sku.toUpperCase() !== product.sku) {
    const dup = await Product.findOne({ sku: data.sku.toUpperCase(), isDeleted: false, _id: { $ne: id } });
    if (dup) {
      throw Object.assign(new Error(`SKU "${data.sku}" already exists`), { statusCode: 409 });
    }
  }

  // Track stock change for movement record
  const prevStock = product.currentStock;
  const newStock = data.currentStock !== undefined ? data.currentStock : prevStock;

  Object.assign(product, {
    ...data,
    category: data.category?.trim() || undefined,
    brand: data.brand?.trim() || undefined,
    description: data.description?.trim() || undefined,
  });
  if (data.sku) product.sku = data.sku.toUpperCase();
  await product.save();

  // Create stock adjustment movement if stock changed
  if (data.currentStock !== undefined && data.currentStock !== prevStock) {
    const diff = data.currentStock - prevStock;
    await StockMovement.create({
      product: product._id,
      movementType: 'stock_adjustment',
      quantity: diff,
      previousStock: prevStock,
      newStock: newStock,
      reason: 'Manual stock adjustment',
      createdBy: new mongoose.Types.ObjectId(userId),
    });
  }

  return product;
}

export async function deleteProduct(id: string) {
  const product = await Product.findOne({ _id: id, isDeleted: false });
  if (!product) {
    throw Object.assign(new Error('Product not found'), { statusCode: 404 });
  }

  // Preserve products referenced by any sale record, including returned sales.
  const usedInSale = await Sale.findOne({
    'items.product': new mongoose.Types.ObjectId(id),
  });
  if (usedInSale) {
    throw Object.assign(
      new Error('Cannot delete product that has been sold. Deactivate it instead.'),
      { statusCode: 409 }
    );
  }

  product.isDeleted = true;
  product.status = 'archived';
  await product.save();
}

export async function searchProducts(query: string) {
  const products = await Product.find({
    isDeleted: false,
    status: 'active',
    $or: [
      { name: { $regex: query, $options: 'i' } },
      { sku: { $regex: query, $options: 'i' } },
      { brand: { $regex: query, $options: 'i' } },
    ],
  })
    .select('_id name sku sellingPrice currentStock unit brand')
    .limit(20)
    .lean();

  return products;
}

export async function getLowStockProducts() {
  const products = await Product.find({
    isDeleted: false,
    status: 'active',
    $expr: { $lte: ['$currentStock', '$minStockThreshold'] },
  })
    .select('name sku currentStock minStockThreshold unit')
    .lean();
  return products;
}
