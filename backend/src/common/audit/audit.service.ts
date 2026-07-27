import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { EventBus } from '../events/event-bus.service';
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
  constructor(
    private readonly prisma: PrismaService,
    private readonly bus: EventBus,
  ) {}

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
    // Fan out to cross-cutting listeners (e.g. the Telegram bot forwards
    // this to linked admins). Never let a listener break the audit write.
    this.bus.emitAudit({
      userId: entry.userId,
      action: entry.action,
      entity: entry.entity,
      entityId: entry.entityId,
    });
  }
}
