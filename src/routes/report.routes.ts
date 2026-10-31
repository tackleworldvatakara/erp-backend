import { Router, Request, Response } from 'express';
import { verifyToken } from '../middleware/auth';
import { asyncHandler } from '../middleware/asyncHandler';
import { sendSuccess } from '../utils/response';
import * as ReportService from '../services/report.service';

const router = Router();
router.use(verifyToken);

router.get('/summary', asyncHandler(async (req: Request, res: Response) => {
  const { period = 'this_month', startDate, endDate } = req.query;
  const data = await ReportService.getSummaryReport(period as string, startDate as string, endDate as string);
  sendSuccess(res, data);
}));

router.get('/trend', asyncHandler(async (req: Request, res: Response) => {
  const { period = 'this_month', startDate, endDate } = req.query;
  const data = await ReportService.getSalesTrend(period as string, startDate as string, endDate as string);
  sendSuccess(res, data);
}));

router.get('/top-products', asyncHandler(async (req: Request, res: Response) => {
  const { period = 'this_month', startDate, endDate, limit } = req.query;
  const data = await ReportService.getTopProducts(period as string, startDate as string, endDate as string, Number(limit) || 10);
  sendSuccess(res, data);
}));

router.get('/payment-breakdown', asyncHandler(async (req: Request, res: Response) => {
  const { period = 'this_month', startDate, endDate } = req.query;
  const data = await ReportService.getPaymentBreakdown(period as string, startDate as string, endDate as string);
  sendSuccess(res, data);
}));

router.get('/stock-valuation', asyncHandler(async (_req: Request, res: Response) => {
  const data = await ReportService.getStockValuation();
  sendSuccess(res, data);
}));

export default router;
