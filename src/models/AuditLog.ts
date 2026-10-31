import mongoose, { Document, Schema } from 'mongoose';

export interface IAuditLog {
  user?: mongoose.Types.ObjectId;
  action: string;
  entityType?: string;
  entityId?: mongoose.Types.ObjectId;
  changes?: {
    before?: unknown;
    after?: unknown;
  };
  ipAddress?: string;
  userAgent?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface IAuditLogDocument extends IAuditLog, Document {}

const auditLogSchema = new Schema<IAuditLogDocument>(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User' },
    action: { type: String, required: true },
    entityType: String,
    entityId: { type: Schema.Types.ObjectId },
    changes: {
      before: { type: Schema.Types.Mixed },
      after: { type: Schema.Types.Mixed },
    },
    ipAddress: String,
    userAgent: String,
  },
  { timestamps: true }
);

auditLogSchema.index({ entityType: 1, entityId: 1 });
auditLogSchema.index({ user: 1 });
// TTL index: auto-delete audit logs after 90 days
auditLogSchema.index({ createdAt: -1 }, { expireAfterSeconds: 90 * 24 * 3600 });

export const AuditLog = mongoose.model<IAuditLogDocument>('AuditLog', auditLogSchema);
