import { Request, Response } from 'express';
import { asyncHandler } from '../middleware/asyncHandler';
import { sendSuccess, sendError } from '../utils/response';
import { createSaleSchema } from '../validation/sale.validation';
import * as SaleService from '../services/sale.service';

export const createSale = asyncHandler(async (req: Request, res: Response) => {
  const parsed = createSaleSchema.safeParse(req.body);
  if (!parsed.success) {
    sendError(res, 'Validation failed', 400, parsed.error.errors);
    return;
  }
  const sale = await SaleService.createSale(parsed.data, req.user!.userId);
  sendSuccess(res, sale, 'Bill created successfully', 201);
});

export const listSales = asyncHandler(async (req: Request, res: Response) => {
  const { search, startDate, endDate, page, pageSize } = req.query;
  const result = await SaleService.getSales({
    search: search as string,
    startDate: startDate as string,
    endDate: endDate as string,
    page: page ? Number(page) : 1,
    pageSize: pageSize ? Number(pageSize) : 20,
  });
  sendSuccess(res, result.sales, undefined, 200, result.pagination);
});

export const getSale = asyncHandler(async (req: Request, res: Response) => {
  const sale = await SaleService.getSaleById(req.params.id);
  sendSuccess(res, sale);
});

export const cancelSale = asyncHandler(async (req: Request, res: Response) => {
  const { reason } = req.body as { reason?: string };
  if (!reason || !reason.trim()) {
    res.status(400).json({ success: false, message: 'Cancellation reason is required' });
    return;
  }
  const sale = await SaleService.cancelSale(req.params.id, req.user!.userId, reason.trim());
  sendSuccess(res, sale, 'Bill cancelled and stock restored');
});

export const getDashboardStats = asyncHandler(async (_req: Request, res: Response) => {
  const stats = await SaleService.getDashboardStats();
  const recent = await SaleService.getRecentSales(5);
  sendSuccess(res, { stats, recentSales: recent });
});
