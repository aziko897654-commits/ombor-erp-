import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

type NumberedModel =
  | 'order'
  | 'purchase'
  | 'salesReturn'
  | 'purchaseReturn'
  | 'stockTransfer'
  | 'stockCount'
  | 'invoice';

const PREFIXES: Record<NumberedModel, string> = {
  order: 'ORD',
  purchase: 'PUR',
  salesReturn: 'SRT',
  purchaseReturn: 'PRT',
  stockTransfer: 'TRF',
  stockCount: 'INVT',
  invoice: 'INV',
};

/**
 * Generates document numbers like PUR-2026-0001 (TZ section 3).
 * Must be called inside a $transaction: an advisory xact lock on the
 * prefix+year serializes concurrent callers so numbers never collide.
 */
@Injectable()
export class NumberingService {
  async next(tx: Prisma.TransactionClient, model: NumberedModel): Promise<string> {
    const prefix = PREFIXES[model];
    const year = new Date().getFullYear();
    const key = `${prefix}-${year}`;

    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${key}))`;

    const delegate = (tx as any)[model];
    const last = await delegate.findFirst({
      where: { number: { startsWith: `${key}-` } },
      orderBy: { number: 'desc' },
      select: { number: true },
    });

    const seq = last ? parseInt(last.number.slice(key.length + 1), 10) + 1 : 1;
    return `${key}-${String(seq).padStart(4, '0')}`;
  }
}
