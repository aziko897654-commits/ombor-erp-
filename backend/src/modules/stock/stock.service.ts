import { BadRequestException, Injectable } from '@nestjs/common';
import { MovementType, Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';

export interface MovementInput {
  productId: number;
  warehouseId: number;
  type: MovementType;
  /** Always positive; sign is applied by inflow/outflow. */
  quantity: Prisma.Decimal;
  reason?: string;
  refType?: string;
  refId?: number;
  userId: number;
}

/**
 * Core stock operations. The invariant "stock never goes negative"
 * (FR-2.7) is protected inside DB transactions with an advisory
 * xact lock per (product, warehouse): concurrent outflows serialize,
 * the second one sees the committed sum of the first.
 */
@Injectable()
export class StockService {
  constructor(private readonly prisma: PrismaService) {}

  /** Serializes movements of one product in one warehouse. */
  async lockStock(
    tx: Prisma.TransactionClient,
    productId: number,
    warehouseId: number,
  ): Promise<void> {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(${productId}::int, ${warehouseId}::int)`;
  }

  /** Serializes AVCO updates of one product (across warehouses). */
  async lockProduct(
    tx: Prisma.TransactionClient,
    productId: number,
  ): Promise<void> {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(${productId}::bigint)`;
  }

  /** Stock of a product in one warehouse = SUM(movements) (FR-2.7). */
  async getStock(
    client: Prisma.TransactionClient | PrismaService,
    productId: number,
    warehouseId?: number,
  ): Promise<Prisma.Decimal> {
    const agg = await client.stockMovement.aggregate({
      where: { productId, ...(warehouseId ? { warehouseId } : {}) },
      _sum: { quantity: true },
    });
    return agg._sum.quantity ?? new Prisma.Decimal(0);
  }

  /** Total stock per product id (optionally per warehouse). */
  async getStockMap(
    productIds: number[],
    warehouseId?: number,
  ): Promise<Map<number, Prisma.Decimal>> {
    if (productIds.length === 0) return new Map();
    const rows = await this.prisma.stockMovement.groupBy({
      by: ['productId'],
      where: {
        productId: { in: productIds },
        ...(warehouseId ? { warehouseId } : {}),
      },
      _sum: { quantity: true },
    });
    return new Map(
      rows.map((r) => [r.productId, r._sum.quantity ?? new Prisma.Decimal(0)]),
    );
  }

  /** Incoming movement (+). Caller is responsible for locks it needs. */
  async createInflow(
    tx: Prisma.TransactionClient,
    input: MovementInput,
  ): Promise<void> {
    await tx.stockMovement.create({
      data: {
        productId: input.productId,
        warehouseId: input.warehouseId,
        type: input.type,
        quantity: input.quantity,
        reason: input.reason,
        refType: input.refType,
        refId: input.refId,
        userId: input.userId,
      },
    });
  }

  /**
   * Outgoing movement (−). Takes the advisory lock, re-reads the sum
   * and rejects with a clear error when stock is insufficient (FR-1.5.2).
   */
  async createOutflow(
    tx: Prisma.TransactionClient,
    input: MovementInput,
  ): Promise<void> {
    await this.lockStock(tx, input.productId, input.warehouseId);
    const stock = await this.getStock(tx, input.productId, input.warehouseId);
    if (stock.lessThan(input.quantity)) {
      const [product, warehouse] = await Promise.all([
        tx.product.findUnique({
          where: { id: input.productId },
          select: { name: true, unit: true },
        }),
        tx.warehouse.findUnique({
          where: { id: input.warehouseId },
          select: { name: true },
        }),
      ]);
      throw new BadRequestException(
        `Mahsulot ${product?.name ?? input.productId}: ${warehouse?.name ?? ''} omborda qoldiq ${stock.toString()} ${product?.unit ?? ''}, so'ralgan ${input.quantity.toString()} ${product?.unit ?? ''}`.trim(),
      );
    }
    await tx.stockMovement.create({
      data: {
        productId: input.productId,
        warehouseId: input.warehouseId,
        type: input.type,
        quantity: input.quantity.negated(),
        reason: input.reason,
        refType: input.refType,
        refId: input.refId,
        userId: input.userId,
      },
    });
  }
}
