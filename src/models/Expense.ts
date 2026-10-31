import mongoose, { Document, Schema } from 'mongoose';

export type ExpenseCategory =
  | 'rent'
  | 'salary'
  | 'electricity'
  | 'transport'
  | 'maintenance'
  | 'packaging'
  | 'office'
  | 'other';

export interface IExpense {
  expenseDate: Date;
  category: ExpenseCategory;
  description?: string;
  amount: number;
  paymentMethod?: string;
  referenceNumber?: string;
  attachment?: string;
  createdBy?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

export interface IExpenseDocument extends IExpense, Document {}

const expenseSchema = new Schema<IExpenseDocument>(
  {
    expenseDate: { type: Date, required: true },
    category: {
      type: String,
      enum: [
        'rent',
        'salary',
        'electricity',
        'transport',
        'maintenance',
        'packaging',
        'office',
        'other',
      ],
      required: true,
    },
    description: String,
    amount: { type: Number, required: true },
    paymentMethod: String,
    referenceNumber: String,
    attachment: String,
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

export const Expense = mongoose.model<IExpenseDocument>('Expense', expenseSchema);
