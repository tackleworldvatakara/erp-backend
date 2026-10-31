import mongoose, { Document, Schema } from 'mongoose';

export type PaymentType = 'customer_receipt' | 'supplier_payment' | 'refund';
export type PaymentEntityType = 'customer' | 'supplier';

export interface IPayment {
  paymentNumber: string;
  paymentType: PaymentType;
  entityType: PaymentEntityType;
  entity: mongoose.Types.ObjectId;
  relatedDocument?: mongoose.Types.ObjectId;
  relatedDocumentType?: string;
  amount: number;
  paymentMethod?: string;
  reference?: string;
  notes?: string;
  createdBy?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

export interface IPaymentDocument extends IPayment, Document {}

const paymentSchema = new Schema<IPaymentDocument>(
  {
    paymentNumber: { type: String, required: true, unique: true, trim: true },
    paymentType: {
      type: String,
      enum: ['customer_receipt', 'supplier_payment', 'refund'],
      required: true,
    },
    entityType: {
      type: String,
      enum: ['customer', 'supplier'],
      required: true,
    },
    entity: { type: Schema.Types.ObjectId, required: true },
    relatedDocument: { type: Schema.Types.ObjectId },
    relatedDocumentType: String,
    amount: { type: Number, required: true },
    paymentMethod: String,
    reference: String,
    notes: String,
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

export const Payment = mongoose.model<IPaymentDocument>('Payment', paymentSchema);
