import { describe, it, expect, vi, beforeEach } from 'vitest';
import mongoose from 'mongoose';

const { mockCustomerReturn, mockSale, mockProduct, mockStockMovement } = vi.hoisted(() => {
  return {
    mockCustomerReturn: {
      create: vi.fn(),
      find: vi.fn(),
      findById: vi.fn(),
      countDocuments: vi.fn(),
      aggregate: vi.fn(),
    },
    mockSale: {
      findById: vi.fn(),
      findOne: vi.fn(),
      find: vi.fn(),
      findByIdAndUpdate: vi.fn(),
    },
    mockProduct: {
      findById: vi.fn(),
      findByIdAndUpdate: vi.fn(),
    },
    mockStockMovement: {
      create: vi.fn(),
    },
  };
});

vi.mock('../../models/CustomerReturn', () => ({
  CustomerReturn: mockCustomerReturn,
}));

vi.mock('../../models/Sale', () => ({
  Sale: mockSale,
}));

vi.mock('../../models/Product', () => ({
  Product: mockProduct,
}));

vi.mock('../../models/StockMovement', () => ({
  StockMovement: mockStockMovement,
}));

import * as ReturnService from '../return.service';

describe('ReturnService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createReturn', () => {
    it('throws 404 when original sale does not exist', async () => {
      mockSale.findById.mockResolvedValue(null);

      await expect(
        ReturnService.createReturn(
          {
            originalSale: new mongoose.Types.ObjectId().toString(),
            items: [
              {
                product: new mongoose.Types.ObjectId().toString(),
                quantity: 1,
                unitPrice: 100,
                condition: 'resellable',
              },
            ],
          },
          'user-1'
        )
      ).rejects.toMatchObject({ statusCode: 404 });
    });

    it('throws 400 if return quantity exceeds sold quantity', async () => {
      const prodId = new mongoose.Types.ObjectId();
      const saleItem = {
        _id: new mongoose.Types.ObjectId(),
        product: prodId,
        productName: 'Sample Product',
        quantity: 2,
        unitPrice: 500,
      };

      mockSale.findById.mockResolvedValue({
        _id: new mongoose.Types.ObjectId(),
        invoiceNumber: 'INV-001',
        items: [saleItem],
      });

      mockCustomerReturn.find.mockResolvedValue([]);

      await expect(
        ReturnService.createReturn(
          {
            originalSale: new mongoose.Types.ObjectId().toString(),
            items: [
              {
                product: prodId.toString(),
                quantity: 5, // exceeds 2
                unitPrice: 500,
                condition: 'resellable',
              },
            ],
          },
          'user-1'
        )
      ).rejects.toMatchObject({ statusCode: 400 });
    });

    it('processes return and restocks inventory for resellable items', async () => {
      const prodId = new mongoose.Types.ObjectId();
      const saleId = new mongoose.Types.ObjectId();
      const saleItem = {
        _id: new mongoose.Types.ObjectId(),
        product: prodId,
        productName: 'Sample Product',
        quantity: 5,
        unitPrice: 500,
      };

      mockSale.findById.mockResolvedValue({
        _id: saleId,
        invoiceNumber: 'INV-001',
        paymentMethod: 'cash',
        items: [saleItem],
      });

      mockCustomerReturn.find.mockResolvedValue([]);

      const returnDoc = {
        _id: new mongoose.Types.ObjectId(),
        returnNumber: 'RET-123456',
        items: [
          {
            product: prodId,
            quantity: 2,
            condition: 'resellable',
          },
        ],
      };
      mockCustomerReturn.create.mockResolvedValue(returnDoc);

      mockProduct.findById.mockResolvedValue({
        _id: prodId,
        currentStock: 10,
      });

      const populateChain = {
        populate: vi.fn().mockReturnThis(),
      };
      // return populated doc on findById
      mockCustomerReturn.findById.mockReturnValue(populateChain);

      await ReturnService.createReturn(
        {
          originalSale: saleId.toString(),
          items: [
            {
              product: prodId.toString(),
              quantity: 2,
              unitPrice: 500,
              condition: 'resellable',
            },
          ],
        },
        new mongoose.Types.ObjectId().toString()
      );

      // Verify product stock incremented
      expect(mockProduct.findByIdAndUpdate).toHaveBeenCalledWith(
        expect.anything(),
        { $inc: { currentStock: 2 } }
      );

      // Verify StockMovement created
      expect(mockStockMovement.create).toHaveBeenCalledWith(
        expect.objectContaining({
          movementType: 'customer_return',
          quantity: 2,
        })
      );
    });
  });

  describe('getReturnableSaleInfo', () => {
    it('calculates remaining returnable quantity correctly', async () => {
      const prodId = new mongoose.Types.ObjectId();
      const sale = {
        _id: new mongoose.Types.ObjectId(),
        invoiceNumber: 'INV-00010',
        invoiceDate: new Date(),
        grandTotal: 1000,
        paymentMethod: 'cash',
        status: 'confirmed',
        items: [
          {
            _id: new mongoose.Types.ObjectId(),
            product: prodId,
            productName: 'Item 1',
            sku: 'ITM1',
            unit: 'piece',
            unitPrice: 500,
            quantity: 2,
            discount: 0,
            lineTotal: 1000,
          },
        ],
      };

      mockSale.findOne.mockReturnValue({
        populate: vi.fn().mockResolvedValue(sale),
      });

      // Mock previous return of 1 item
      mockCustomerReturn.find.mockResolvedValue([
        {
          items: [{ product: prodId, quantity: 1 }],
        },
      ]);

      const res = await ReturnService.getReturnableSaleInfo('INV-00010');

      expect(res.sale.invoiceNumber).toBe('INV-00010');
      expect(res.items[0]?.soldQuantity).toBe(2);
      expect(res.items[0]?.previouslyReturned).toBe(1);
      expect(res.items[0]?.returnableQuantity).toBe(1);
      expect(res.isFullyReturned).toBe(false);
    });
  });
});

