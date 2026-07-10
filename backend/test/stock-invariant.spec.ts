import 'dotenv/config';
import { Prisma, PrismaClient } from '@prisma/client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { StockService } from '../src/modules/stock/stock.service';

/**
 * Stage 1 DoD: the stock invariant (FR-2.7) — parallel outflows must
 * never drive the stock below zero. Runs against the dev database.
 */
describe('stock invariant under parallel outflows', () => {
  const prisma = new PrismaClient();
  const stock = new StockService(prisma as any);
  const suffix = Date.now().toString();

  let productId: number;
  let warehouseId: number;
  let categoryId: number;
  let userId: number;

  beforeAll(async () => {
    const user = await prisma.user.findFirstOrThrow({
      where: { role: 'admin' },
    });
    userId = user.id;

    const category = await prisma.category.create({
      data: { name: `invariant-test-${suffix}` },
    });
    categoryId = category.id;

    const warehouse = await prisma.warehouse.create({
      data: { name: `invariant-wh-${suffix}` },
    });
    warehouseId = warehouse.id;

    const product = await prisma.product.create({
      data: {
        name: `invariant-product-${suffix}`,
        sku: `INV-${suffix}`,
        categoryId,
        unit: 'dona',
        costPrice: new Prisma.Decimal(1000),
        salePrice: new Prisma.Decimal(1500),
      },
    });
    productId = product.id;

    // initial stock: 10
    await prisma.stockMovement.create({
      data: {
        productId,
        warehouseId,
        type: 'purchase',
        quantity: new Prisma.Decimal(10),
        userId,
      },
    });
  });

  afterAll(async () => {
    await prisma.stockMovement.deleteMany({ where: { productId } });
    await prisma.product.delete({ where: { id: productId } });
    await prisma.warehouse.delete({ where: { id: warehouseId } });
    await prisma.category.delete({ where: { id: categoryId } });
    await prisma.$disconnect();
  });

  it('never lets the stock go negative (10 in stock, 5 parallel × 3)', async () => {
    const attempts = 5;
    const perAttempt = new Prisma.Decimal(3);

    const results = await Promise.allSettled(
      Array.from({ length: attempts }, () =>
        prisma.$transaction(async (tx) => {
          await stock.createOutflow(tx, {
            productId,
            warehouseId,
            type: 'writeoff',
            quantity: perAttempt,
            reason: 'invariant test',
            userId,
          });
        }),
      ),
    );

    const succeeded = results.filter((r) => r.status === 'fulfilled').length;
    const failed = results.filter((r) => r.status === 'rejected').length;

    // 10 / 3 => at most 3 outflows can succeed
    expect(succeeded).toBeLessThanOrEqual(3);
    expect(succeeded + failed).toBe(attempts);

    const remaining = await stock.getStock(prisma, productId, warehouseId);
    expect(remaining.greaterThanOrEqualTo(0)).toBe(true);
    expect(remaining.toString()).toBe(
      new Prisma.Decimal(10).minus(perAttempt.times(succeeded)).toString(),
    );

    // rejected attempts carry the clear error message (FR-1.5.2)
    const firstError = results.find(
      (r): r is PromiseRejectedResult => r.status === 'rejected',
    );
    expect(String(firstError?.reason?.message ?? '')).toContain('qoldiq');
  });
});
