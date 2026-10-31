import mongoose from 'mongoose';
import { Sale } from '../models/Sale';
import { Product } from '../models/Product';

function dateRange(period: string, customStart?: string, customEnd?: string) {
  const now = new Date();
  let start: Date;
  let end: Date = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

  switch (period) {
    case 'today':
      start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      break;
    case 'yesterday':
      start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
      end   = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 23, 59, 59, 999);
      break;
    case 'this_week': {
      const day = now.getDay();
      start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - day);
      break;
    }
    case 'last_week': {
      const day = now.getDay();
      start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - day - 7);
      end   = new Date(now.getFullYear(), now.getMonth(), now.getDate() - day - 1, 23, 59, 59, 999);
      break;
    }
    case 'this_month':
      start = new Date(now.getFullYear(), now.getMonth(), 1);
      break;
    case 'last_month':
      start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      end   = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
      break;
    case 'this_year':
      start = new Date(now.getFullYear(), 0, 1);
      break;
    case 'custom':
      start = customStart ? new Date(customStart) : new Date(now.getFullYear(), now.getMonth(), 1);
      end   = customEnd   ? new Date(new Date(customEnd).setHours(23, 59, 59, 999)) : end;
      break;
    default:
      start = new Date(now.getFullYear(), now.getMonth(), 1);
  }
  return { start, end };
}

// ─── Summary Report ──────────────────────────────────────────────────────────
export async function getSummaryReport(period: string, customStart?: string, customEnd?: string) {
  const { start, end } = dateRange(period, customStart, customEnd);

  const [salesAgg, prevAgg] = await Promise.all([
    // Current period
    Sale.aggregate([
      { $match: { status: 'confirmed', invoiceDate: { $gte: start, $lte: end } } },
      { $unwind: '$items' },
      {
        $group: {
          _id: null,
          totalRevenue:   { $sum: '$items.lineTotal' },
          totalCOGS:      { $sum: { $multiply: ['$items.costAtSale', '$items.quantity'] } },
          totalDiscount:  { $sum: '$items.discountAmount' },
          totalOrders:    { $addToSet: '$_id' },
          totalItemsSold: { $sum: '$items.quantity' },
        },
      },
    ]),
    // Previous period (same duration) for comparison
    Sale.aggregate([
      {
        $match: {
          status: 'confirmed',
          invoiceDate: {
            $gte: new Date(start.getTime() - (end.getTime() - start.getTime())),
            $lte: new Date(start.getTime() - 1),
          },
        },
      },
      { $group: { _id: null, totalRevenue: { $sum: '$grandTotal' }, totalOrders: { $sum: 1 } } },
    ]),
  ]);

  const curr = salesAgg[0] ?? { totalRevenue: 0, totalCOGS: 0, totalDiscount: 0, totalOrders: [], totalItemsSold: 0 };
  const prev = prevAgg[0] ?? { totalRevenue: 0, totalOrders: 0 };

  const revenue   = parseFloat((curr.totalRevenue   ?? 0).toFixed(2));
  const cogs      = parseFloat((curr.totalCOGS      ?? 0).toFixed(2));
  const discount  = parseFloat((curr.totalDiscount  ?? 0).toFixed(2));
  const grossProfit   = parseFloat((revenue - cogs).toFixed(2));
  const grossMargin   = revenue > 0 ? parseFloat(((grossProfit / revenue) * 100).toFixed(1)) : 0;
  const orders    = Array.isArray(curr.totalOrders) ? curr.totalOrders.length : 0;
  const avgOrderValue = orders > 0 ? parseFloat((revenue / orders).toFixed(2)) : 0;

  const prevRevenue = parseFloat((prev.totalRevenue ?? 0).toFixed(2));
  const revenueGrowth = prevRevenue > 0
    ? parseFloat((((revenue - prevRevenue) / prevRevenue) * 100).toFixed(1))
    : null;

  return {
    period: { start, end },
    revenue,
    cogs,
    grossProfit,
    grossMargin,
    discount,
    orders,
    avgOrderValue,
    itemsSold: curr.totalItemsSold ?? 0,
    revenueGrowth,
    prevRevenue,
  };
}

// ─── Daily Sales Trend ───────────────────────────────────────────────────────
export async function getSalesTrend(period: string, customStart?: string, customEnd?: string) {
  const { start, end } = dateRange(period, customStart, customEnd);

  const trend = await Sale.aggregate([
    { $match: { status: 'confirmed', invoiceDate: { $gte: start, $lte: end } } },
    {
      $group: {
        _id: {
          year:  { $year:  '$invoiceDate' },
          month: { $month: '$invoiceDate' },
          day:   { $dayOfMonth: '$invoiceDate' },
        },
        revenue:     { $sum: '$grandTotal' },
        orders:      { $sum: 1 },
        totalCOGS:   { $sum: { $reduce: { input: '$items', initialValue: 0, in: { $add: ['$$value', { $multiply: ['$$this.costAtSale', '$$this.quantity'] }] } } } },
      },
    },
    { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 } },
    {
      $project: {
        _id: 0,
        date: {
          $dateToString: {
            format: '%Y-%m-%d',
            date: { $dateFromParts: { year: '$_id.year', month: '$_id.month', day: '$_id.day' } },
          },
        },
        revenue: { $round: ['$revenue', 2] },
        profit:  { $round: [{ $subtract: ['$revenue', '$totalCOGS'] }, 2] },
        orders: 1,
      },
    },
  ]);

  return trend;
}

// ─── Top Products ────────────────────────────────────────────────────────────
export async function getTopProducts(period: string, customStart?: string, customEnd?: string, limit = 10) {
  const { start, end } = dateRange(period, customStart, customEnd);

  return Sale.aggregate([
    { $match: { status: 'confirmed', invoiceDate: { $gte: start, $lte: end } } },
    { $unwind: '$items' },
    {
      $group: {
        _id:         '$items.product',
        productName: { $first: '$items.productName' },
        sku:         { $first: '$items.sku' },
        qtySold:     { $sum: '$items.quantity' },
        revenue:     { $sum: '$items.lineTotal' },
        cogs:        { $sum: { $multiply: ['$items.costAtSale', '$items.quantity'] } },
      },
    },
    {
      $project: {
        _id: 0,
        productId:   '$_id',
        productName: 1,
        sku:         1,
        qtySold:     1,
        revenue:     { $round: ['$revenue', 2] },
        cogs:        { $round: ['$cogs', 2] },
        profit:      { $round: [{ $subtract: ['$revenue', '$cogs'] }, 2] },
        margin: {
          $cond: [
            { $gt: ['$revenue', 0] },
            { $round: [{ $multiply: [{ $divide: [{ $subtract: ['$revenue', '$cogs'] }, '$revenue'] }, 100] }, 1] },
            0,
          ],
        },
      },
    },
    { $sort: { revenue: -1 } },
    { $limit: limit },
  ]);
}

// ─── Payment Method Breakdown ────────────────────────────────────────────────
export async function getPaymentBreakdown(period: string, customStart?: string, customEnd?: string) {
  const { start, end } = dateRange(period, customStart, customEnd);

  return Sale.aggregate([
    { $match: { status: 'confirmed', invoiceDate: { $gte: start, $lte: end } } },
    {
      $group: {
        _id:    '$paymentMethod',
        total:  { $sum: '$grandTotal' },
        count:  { $sum: 1 },
      },
    },
    { $project: { _id: 0, method: '$_id', total: { $round: ['$total', 2] }, count: 1 } },
    { $sort: { total: -1 } },
  ]);
}

// ─── Stock Valuation ─────────────────────────────────────────────────────────
export async function getStockValuation() {
  const products = await Product.find({ isDeleted: false, status: 'active' })
    .select('name sku currentStock purchaseCost sellingPrice minStockThreshold')
    .lean();

  const items = products.map((p) => ({
    name:         p.name,
    sku:          p.sku,
    currentStock: p.currentStock,
    purchaseCost: p.purchaseCost,
    sellingPrice: p.sellingPrice,
    costValue:    parseFloat((p.currentStock * p.purchaseCost).toFixed(2)),
    saleValue:    parseFloat((p.currentStock * p.sellingPrice).toFixed(2)),
    isLowStock:   p.currentStock <= p.minStockThreshold,
  }));

  const totalCostValue = parseFloat(items.reduce((s, i) => s + i.costValue, 0).toFixed(2));
  const totalSaleValue = parseFloat(items.reduce((s, i) => s + i.saleValue, 0).toFixed(2));
  const potentialProfit = parseFloat((totalSaleValue - totalCostValue).toFixed(2));

  return { items, totalCostValue, totalSaleValue, potentialProfit };
}
