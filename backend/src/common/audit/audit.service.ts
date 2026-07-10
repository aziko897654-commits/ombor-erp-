import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export interface AuditEntry {
  userId: number;
  action: string; // "order.confirm", "payment.delete", "user.create" ...
  entity: string;
  entityId?: number;
  details?: Prisma.InputJsonValue;
}

/**
 * Writes important actions to the audit log (NFR-5).
 * Pass `tx` when logging inside a $transaction so the log entry
 * is rolled back together with the operation.
 */
@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async log(entry: AuditEntry, tx?: Prisma.TransactionClient): Promise<void> {
    const client = tx ?? this.prisma;
    await client.auditLog.create({
      data: {
        userId: entry.userId,
        action: entry.action,
        entity: entry.entity,
        entityId: entry.entityId,
        details: entry.details,
      },
    });
  }
}
