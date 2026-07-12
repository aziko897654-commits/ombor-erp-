import { Prisma, TxType } from '@prisma/client';

/**
 * Finds or creates a TxCategory by name+type inside the caller's
 * transaction. An advisory xact lock serializes concurrent auto-creates
 * (TxCategory.name is not unique at the DB level).
 */
export async function resolveCategory(
  tx: Prisma.TransactionClient,
  name: string,
  type: TxType,
): Promise<number> {
  const key = `txcat-${type}-${name}`;
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${key}))`;
  const existing = await tx.txCategory.findFirst({ where: { name, type } });
  if (existing) return existing.id;
  const created = await tx.txCategory.create({ data: { name, type } });
  return created.id;
}
