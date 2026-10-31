import { Request, Response } from 'express';
import { asyncHandler } from '../middleware/asyncHandler';
import { sendSuccess, sendError } from '../utils/response';
import { createReturnSchema, updateReturnStatusSchema } from '../validation/return.validation';
import * as ReturnService from '../services/return.service';

export const createReturn = asyncHandler(async (req: Request, res: Response) => {
  const parsed = createReturnSchema.safeParse(req.body);
  if (!parsed.success) {
    sendError(res, 'Validation failed', 400, parsed.error.errors);
    return;
  }
  const ret = await ReturnService.createReturn(parsed.data, req.user!.userId);
  sendSuccess(res, ret, 'Return processed successfully', 201);
});

export const listReturns = asyncHandler(async (req: Request, res: Response) => {
  const { search, status, startDate, endDate, page, pageSize } = req.query;
  const result = await ReturnService.getReturns({
    search: search as string,
    status: status as string,
    startDate: startDate as string,
    endDate: endDate as string,
    page: page ? Number(page) : 1,
    pageSize: pageSize ? Number(pageSize) : 20,
  });
  sendSuccess(res, result.returns, undefined, 200, result.pagination);
});

export const getReturn = asyncHandler(async (req: Request, res: Response) => {
  const ret = await ReturnService.getReturnById(req.params.id);
  sendSuccess(res, ret);
});

export const getSaleReturnableInfo = asyncHandler(async (req: Request, res: Response) => {
  const info = await ReturnService.getReturnableSaleInfo(req.params.saleIdentifier);
  sendSuccess(res, info);
});

export const getReturnStats = asyncHandler(async (_req: Request, res: Response) => {
  const stats = await ReturnService.getReturnStats();
  sendSuccess(res, stats);
});

export const updateReturnStatus = asyncHandler(async (req: Request, res: Response) => {
  const parsed = updateReturnStatusSchema.safeParse(req.body);
  if (!parsed.success) {
    sendError(res, 'Validation failed', 400, parsed.error.errors);
    return;
  }
  const updated = await ReturnService.updateReturnStatus(req.params.id, parsed.data, req.user!.userId);
  sendSuccess(res, updated, 'Return status updated successfully');
});

