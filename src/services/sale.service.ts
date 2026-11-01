import mongoose from 'mongoose';
import { Sale } from '../models/Sale';
import { Product } from '../models/Product';
import { StockMovement } from '../models/StockMovement';
import { BusinessSettings } from '../models/BusinessSettings';
import { CustomerReturn } from '../models/CustomerReturn';
import { CreateSaleInput } from '../validation/sale.validation';

async function generateInvoiceNumber(): Promise<string> {
  // Atomically increment the counter in BusinessSettings
  const settings = await BusinessSettings.findOneAndUpdate(
    {},
    { $inc: { invoiceCounter: 1 } },
    { new: false, upsert: true }
  );
  const counter = settings ? settings.invoiceCounter : 1;
  const prefix = settings?.invoicePrefix ?? 'INV';
  return `${prefix}-${String(counter).padStart(5, '0')}`;
}

export async function createSale(data: CreateSaleInput, userId: string) {
  // 1. Fetch all products in one query
  const productIds = data.items.map((i) => new mongoose.Types.ObjectId(i.productId));
  const products = await Product.find({ _id: { $in: productIds }, isDeleted: false });

  const productMap = new Map(products.map((p) => [p._id.toString(), p]));

  // 2. Validate stock availability
  for (const item of data.items) {
    const product = productMap.get(item.productId);
    if (!product) {
      throw Object.assign(new Error(`Product not found: ${item.productId}`), { statusCode: 404 });
    }
    // If product has variants and a variantColor is specified, validate variant stock
    if (product.variants && product.variants.length > 0 && item.variantColor) {
      const variant = product.variants.find((v) => v.color === item.variantColor);
      if (!variant) {
        throw Object.assign(new Error(`Color variant "${item.variantColor}" not found for "${product.name}"`), { statusCode: 400 });
      }
      if (variant.quantity < item.quantity) {
        throw Object.assign(
          new Error(`Insufficient stock for "${product.name}" (${item.variantColor}). Available: ${variant.quantity}, Requested: ${item.quantity}`),
          { statusCode: 400 }
        );
      }
    } else if (product.variants && product.variants.length > 0 && !item.variantColor) {
      throw Object.assign(new Error(`Please select a color variant for "${product.name}"`), { statusCode: 400 });
    } else {
      if (product.currentStock < item.quantity) {
        throw Object.assign(
          new Error(`Insufficient stock for "${product.name}". Available: ${product.currentStock}, Requested: ${item.quantity}`),
          { statusCode: 400 }
        );
      }
    }
  }

  // 3. Calculate totals server-side
  let subtotal = 0;
  let discountTotal = 0;

  const saleItems = data.items.map((item) => {
    const product = productMap.get(item.productId)!;
    const lineSubtotal = item.quantity * item.unitPrice;
    const discountAmount = parseFloat(((lineSubtotal * item.discount) / 100).toFixed(2));
    const lineTotal = parseFloat((lineSubtotal - discountAmount).toFixed(2));
    subtotal += lineSubtotal;
    discountTotal += discountAmount;
    return {
      product: product._id,
      productName: product.name,
      sku: product.sku,
      variantColor: item.variantColor,
      quantity: item.quantity,
      unit: product.unit,
      unitPrice: item.unitPrice,
      discount: item.discount,
      discountAmount,
      taxRate: 0,
      taxAmount: 0,
      lineTotal,
      costAtSale: product.purchaseCost,
    };
  });

  subtotal = parseFloat(subtotal.toFixed(2));
  discountTotal = parseFloat((discountTotal + (data.commonDiscount ?? 0)).toFixed(2));
  const grandTotal = parseFloat((subtotal - discountTotal).toFixed(2));
  const paidAmount = parseFloat(Math.min(data.amountPaid, grandTotal).toFixed(2));
  const balanceDue = parseFloat((grandTotal - paidAmount).toFixed(2));
  const paymentStatus =
    balanceDue <= 0 ? 'paid' : paidAmount > 0 ? 'partial' : 'unpaid';

  // 4. Generate invoice number
  const invoiceNumber = await generateInvoiceNumber();

  // 5. Create sale document
  const sale = await Sale.create({
    invoiceNumber,
    customerName: data.customerName || 'Walk-in Customer',
    invoiceDate: new Date(),
    items: saleItems,
    subtotal,
    discountTotal,
    taxableAmount: grandTotal,
    taxTotal: 0,
    grandTotal,
    paidAmount,
    balanceDue,
    paymentStatus,
    paymentMethod: data.paymentMethod,
    payments: [{ method: data.paymentMethod, amount: paidAmount, date: new Date() }],
    status: 'confirmed',
    notes: data.notes,
    createdBy: new mongoose.Types.ObjectId(userId),
  });

  // 6. Deduct stock and create movements for each item
  const stockOps = data.items.map(async (item) => {
    const product = productMap.get(item.productId)!;
    const prevStock = product.currentStock;
    const newStock = prevStock - item.quantity;

    if (product.variants && product.variants.length > 0 && item.variantColor) {
      // Deduct from the specific variant quantity and update total stock
      await Product.findByIdAndUpdate(item.productId, {
        $inc: {
          currentStock: -item.quantity,
          'variants.$[v].quantity': -item.quantity,
        },
      }, {
        arrayFilters: [{ 'v.color': item.variantColor }],
      });
    } else {
      await Product.findByIdAndUpdate(item.productId, { $inc: { currentStock: -item.quantity } });
    }

    await StockMovement.create({
      product: product._id,
      movementType: 'sale',
      quantity: -item.quantity,
      previousStock: prevStock,
      newStock,
      referenceType: 'Sale',
      referenceId: sale._id,
      reason: `Sale: ${invoiceNumber}${item.variantColor ? ` (${item.variantColor})` : ''}`,
      createdBy: new mongoose.Types.ObjectId(userId),
    });
  });

  await Promise.all(stockOps);

  return sale;
}

export async function getSales(filters: {
  search?: string;
  startDate?: string;
  endDate?: string;
  page?: number;
  pageSize?: number;
}) {
  const { search, startDate, endDate, page = 1, pageSize = 20 } = filters;
  const query: mongoose.FilterQuery<typeof Sale> = { status: { $ne: 'draft' } };

  if (search) {
    query.$or = [
      { invoiceNumber: { $regex: search, $options: 'i' } },
      { customerName: { $regex: search, $options: 'i' } },
    ];
  }

  if (startDate || endDate) {
    query.invoiceDate = {};
    if (startDate) query.invoiceDate.$gte = new Date(startDate);
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      query.invoiceDate.$lte = end;
    }
  }

  const total = await Sale.countDocuments(query);
  const sales = await Sale.find(query)
    .sort({ invoiceDate: -1 })
    .skip((page - 1) * pageSize)
    .limit(pageSize)
    .lean();

  return {
    sales,
    pagination: { total, page, pageSize, totalPages: Math.ceil(total / pageSize) },
  };
}

export async function getSaleById(id: string) {
  const sale = await Sale.findById(id).lean();
  if (!sale) {
    throw Object.assign(new Error('Sale not found'), { statusCode: 404 });
  }
  return sale;
}

export async function cancelSale(id: string, userId: string, reason: string) {
  const session = await mongoose.startSession();
  let cancelledSale: Awaited<ReturnType<typeof Sale.findById>> = null;

  try {
    await session.withTransaction(async () => {
      const sale = await Sale.findById(id).session(session);
      if (!sale) {
        throw Object.assign(new Error('Sale not found'), { statusCode: 404 });
      }
      if (sale.status !== 'confirmed') {
        throw Object.assign(new Error('Only confirmed bills can be cancelled'), { statusCode: 400 });
      }
      const hasReturns = await CustomerReturn.exists({ originalSale: sale._id, status: { $ne: 'rejected' } }).session(session);
      if (hasReturns) {
        throw Object.assign(new Error('A bill with processed returns cannot be cancelled'), { statusCode: 400 });
      }

      const updatedSale = await Sale.findOneAndUpdate(
        { _id: sale._id, status: 'confirmed' },
        {
          $set: {
            status: 'cancelled',
            cancelledBy: new mongoose.Types.ObjectId(userId),
            cancelledAt: new Date(),
            cancellationReason: reason,
          },
        },
        { new: true, session },
      );
      if (!updatedSale) {
        throw Object.assign(new Error('This bill has already been changed'), { statusCode: 409 });
      }

      for (const item of sale.items) {
        if (item.variantColor) {
          const product = await Product.findByIdAndUpdate(
            item.product,
            {
              $inc: {
                currentStock: item.quantity,
                'variants.$[v].quantity': item.quantity,
              },
            },
            { new: true, session, arrayFilters: [{ 'v.color': item.variantColor }] },
          );
          if (!product) continue;
          const previousStock = product.currentStock - item.quantity;
          await StockMovement.create([{
            product: product._id,
            movementType: 'stock_adjustment',
            quantity: item.quantity,
            previousStock,
            newStock: product.currentStock,
            referenceType: 'SaleCancellation',
            referenceId: sale._id,
            reason: `Cancelled sale: ${sale.invoiceNumber}${item.variantColor ? ` (${item.variantColor})` : ''}`,
            createdBy: new mongoose.Types.ObjectId(userId),
          }], { session });
        } else {
          const product = await Product.findByIdAndUpdate(
            item.product,
            { $inc: { currentStock: item.quantity } },
            { new: true, session },
          );
          if (!product) continue;
          const previousStock = product.currentStock - item.quantity;
          await StockMovement.create([{
            product: product._id,
            movementType: 'stock_adjustment',
            quantity: item.quantity,
            previousStock,
            newStock: product.currentStock,
            referenceType: 'SaleCancellation',
            referenceId: sale._id,
            reason: `Cancelled sale: ${sale.invoiceNumber}`,
            createdBy: new mongoose.Types.ObjectId(userId),
          }], { session });
        }
      }
      cancelledSale = updatedSale;
    });
    return cancelledSale;
  } finally {
    await session.endSession();
  }
}

export async function getDashboardStats() {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const [todayStats, monthStats, totalProducts, lowStockCount] = await Promise.all([
    Sale.aggregate([
      { $match: { status: 'confirmed', invoiceDate: { $gte: todayStart } } },
      { $group: { _id: null, count: { $sum: 1 }, revenue: { $sum: '$grandTotal' } } },
    ]),
    Sale.aggregate([
      { $match: { status: 'confirmed', invoiceDate: { $gte: monthStart } } },
      { $group: { _id: null, count: { $sum: 1 }, revenue: { $sum: '$grandTotal' } } },
    ]),
    Product.countDocuments({ isDeleted: false, status: 'active' }),
    Product.countDocuments({
      isDeleted: false,
      status: 'active',
      $expr: { $lte: ['$currentStock', '$minStockThreshold'] },
    }),
  ]);

  return {
    todaySales: todayStats[0]?.count ?? 0,
    todayRevenue: todayStats[0]?.revenue ?? 0,
    monthSales: monthStats[0]?.count ?? 0,
    monthRevenue: monthStats[0]?.revenue ?? 0,
    totalProducts,
    lowStockCount,
  };
}

export async function getRecentSales(limit = 5) {
  return Sale.find({ status: 'confirmed' })
    .sort({ invoiceDate: -1 })
    .limit(limit)
    .select('invoiceNumber customerName grandTotal paymentStatus invoiceDate')
    .lean();
}
