import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuditService } from '../../common/audit/audit.service';
import { NumberingService } from '../../common/numbering/numbering.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import {
  CreateStockCountDto,
  CreateTransferDto,
  UpdateStockCountDto,
  WriteoffDto,
} from './dto/stock.dto';
import { StockService } from './stock.service';

@Injectable()
export class StockOperationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly stock: StockService,
    private readonly numbering: NumberingService,
    private readonly audit: AuditService,
  ) {}

  /** FR-2.5: manual write-off with reason, stock checked. */
  async writeoff(dto: WriteoffDto, userId: number) {
    await this.prisma.$transaction(async (tx) => {
      await this.stock.createOutflow(tx, {
        productId: dto.productId,
        warehouseId: dto.warehouseId,
        type: 'writeoff',
        quantity: new Prisma.Decimal(dto.quantity),
        reason: dto.reason,
        userId,
      });
      await this.audit.log(
        {
          userId,
          action: 'stock.writeoff',
          entity: 'StockMovement',
          details: {
            productId: dto.productId,
            warehouseId: dto.warehouseId,
            quantity: dto.quantity,
            reason: dto.reason,
          },
        },
        tx,
      );
    });
    return { success: true };
  }

  async findTransfers(page: number, limit: number) {
    const [transfers, total] = await this.prisma.$transaction([
      this.prisma.stockTransfer.findMany({
        orderBy: { id: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.stockTransfer.count(),
    ]);

    const warehouses = await this.prisma.warehouse.findMany({
      select: { id: true, name: true },
    });
    const byId = new Map(warehouses.map((w) => [w.id, w.name]));

    return {
      data: transfers.map((t) => ({
        ...t,
        fromWarehouseName: byId.get(t.fromWarehouseId) ?? '',
        toWarehouseName: byId.get(t.toWarehouseId) ?? '',
      })),
      meta: { page, limit, total },
    };
  }

  async findTransfer(id: number) {
    const transfer = await this.prisma.stockTransfer.findUnique({
      where: { id },
    });
    if (!transfer) throw new NotFoundException('Ko\'chirish hujjati topilmadi');

    const [warehouses, movements] = await Promise.all([
      this.prisma.warehouse.findMany({ select: { id: true, name: true } }),
      this.prisma.stockMovement.findMany({
        where: { refType: 'transfer', refId: id },
        include: {
          product: { select: { id: true, name: true, sku: true, unit: true } },
        },
      }),
    ]);
    const byId = new Map(warehouses.map((w) => [w.id, w.name]));

    // one item per product: the outgoing (−) side carries the quantity
    const items = movements
      .filter((m) => m.quantity.isNegative())
      .map((m) => ({
        product: m.product,
        quantity: m.quantity.abs().toString(),
      }));

    return {
      ...transfer,
      fromWarehouseName: byId.get(transfer.fromWarehouseId) ?? '',
      toWarehouseName: byId.get(transfer.toWarehouseId) ?? '',
      items,
    };
  }

  /**
   * FR-2.6: one DB transaction — for each item two movements:
   * (−, from) and (+, to), both refType='transfer'. Stock in the
   * from-warehouse is checked by createOutflow.
   */
  async createTransfer(dto: CreateTransferDto, userId: number) {
    if (dto.fromWarehouseId === dto.toWarehouseId) {
      throw new BadRequestException(
        "Qayerdan va qayerga omborlari bir xil bo'lishi mumkin emas",
      );
    }
    const warehouses = await this.prisma.warehouse.findMany({
      where: { id: { in: [dto.fromWarehouseId, dto.toWarehouseId] } },
    });
    if (warehouses.length !== 2) throw new NotFoundException('Ombor topilmadi');

    const productIds = dto.items.map((i) => i.productId);
    if (new Set(productIds).size !== productIds.length) {
      throw new BadRequestException(
        'Bitta mahsulot hujjatda faqat bir marta kelishi mumkin',
      );
    }
    const count = await this.prisma.product.count({
      where: { id: { in: productIds } },
    });
    if (count !== productIds.length) {
      throw new NotFoundException("Ba'zi mahsulotlar topilmadi");
    }

    const transfer = await this.prisma.$transaction(async (tx) => {
      const number = await this.numbering.next(tx, 'stockTransfer');
      const created = await tx.stockTransfer.create({
        data: {
          number,
          fromWarehouseId: dto.fromWarehouseId,
          toWarehouseId: dto.toWarehouseId,
          date: dto.date ? new Date(dto.date) : new Date(),
          note: dto.note,
          userId,
        },
      });

      for (const item of dto.items) {
        const qty = new Prisma.Decimal(item.quantity);
        await this.stock.createOutflow(tx, {
          productId: item.productId,
          warehouseId: dto.fromWarehouseId,
          type: 'transfer',
          quantity: qty,
          refType: 'transfer',
          refId: created.id,
          userId,
        });
        await this.stock.createInflow(tx, {
          productId: item.productId,
          warehouseId: dto.toWarehouseId,
          type: 'transfer',
          quantity: qty,
          refType: 'transfer',
          refId: created.id,
          userId,
        });
      }

      await this.audit.log(
        {
          userId,
          action: 'transfer.create',
          entity: 'StockTransfer',
          entityId: created.id,
          details: { number, items: dto.items.length },
        },
        tx,
      );

      return created;
    });

    return this.findTransfer(transfer.id);
  }

  async findCounts(page: number, limit: number) {
    const [counts, total] = await this.prisma.$transaction([
      this.prisma.stockCount.findMany({
        include: { warehouse: { select: { id: true, name: true } } },
        orderBy: { id: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.stockCount.count(),
    ]);
    return { data: counts, meta: { page, limit, total } };
  }

  async findCount(id: number) {
    const count = await this.prisma.stockCount.findUnique({
      where: { id },
      include: {
        warehouse: { select: { id: true, name: true } },
        items: {
          include: {
            product: { select: { id: true, name: true, sku: true, unit: true } },
          },
          orderBy: { id: 'asc' },
        },
      },
    });
    if (!count) throw new NotFoundException('Inventarizatsiya topilmadi');
    return count;
  }

  /**
   * FR-2.11: snapshot current system stock of the warehouse into the
   * document (draft). actualQty starts equal to systemQty.
   */
  async createCount(dto: CreateStockCountDto, userId: number) {
    const warehouse = await this.prisma.warehouse.findUnique({
      where: { id: dto.warehouseId },
    });
    if (!warehouse) throw new NotFoundException('Ombor topilmadi');

    const stocks = await this.prisma.stockMovement.groupBy({
      by: ['productId'],
      where: { warehouseId: dto.warehouseId },
      _sum: { quantity: true },
    });
    if (stocks.length === 0) {
      throw new BadRequestException(
        "Bu omborda hech qanday harakat yo'q — inventarizatsiya uchun ma'lumot topilmadi",
      );
    }

    const count = await this.prisma.$transaction(async (tx) => {
      const number = await this.numbering.next(tx, 'stockCount');
      return tx.stockCount.create({
        data: {
          number,
          warehouseId: dto.warehouseId,
          note: dto.note,
          userId,
          items: {
            create: stocks.map((s) => {
              const systemQty = s._sum.quantity ?? new Prisma.Decimal(0);
              return {
                productId: s.productId,
                systemQty,
                actualQty: systemQty,
                diff: new Prisma.Decimal(0),
              };
            }),
          },
        },
      });
    });

    return this.findCount(count.id);
  }

  /** Draft counts can be continued: enter actual quantities (FR-2.11). */
  async updateCount(id: number, dto: UpdateStockCountDto) {
    const count = await this.prisma.stockCount.findUnique({
      where: { id },
      include: { items: true },
    });
    if (!count) throw new NotFoundException('Inventarizatsiya topilmadi');
    if (count.status !== 'draft') {
      throw new BadRequestException(
        "Yakunlangan inventarizatsiya o'zgartirilmaydi",
      );
    }

    const itemById = new Map(count.items.map((i) => [i.id, i]));
    await this.prisma.$transaction(async (tx) => {
      if (dto.note !== undefined) {
        await tx.stockCount.update({ where: { id }, data: { note: dto.note } });
      }
      for (const upd of dto.items ?? []) {
        const item = itemById.get(upd.itemId);
        if (!item) {
          throw new BadRequestException(
            `Pozitsiya (id=${upd.itemId}) bu hujjatga tegishli emas`,
          );
        }
        const actual = new Prisma.Decimal(upd.actualQty);
        await tx.stockCountItem.update({
          where: { id: upd.itemId },
          data: { actualQty: actual, diff: actual.minus(item.systemQty) },
        });
      }
    });

    return this.findCount(id);
  }

  /**
   * FR-2.11: completion — for every discrepancy an `adjustment`
   * movement is created inside one transaction so the stock equals
   * the counted quantity. Movements are computed against the CURRENT
   * stock (under lock), so the result is exact even if stock moved
   * after the snapshot.
   */
  async completeCount(id: number, userId: number) {
    const count = await this.findCount(id);
    if (count.status !== 'draft') {
      throw new BadRequestException('Inventarizatsiya allaqachon yakunlangan');
    }

    await this.prisma.$transaction(async (tx) => {
      for (const item of count.items) {
        await this.stock.lockStock(tx, item.productId, count.warehouseId);
        const current = await this.stock.getStock(
          tx,
          item.productId,
          count.warehouseId,
        );
        const adjustment = item.actualQty.minus(current);
        if (!adjustment.isZero()) {
          await tx.stockMovement.create({
            data: {
              productId: item.productId,
              warehouseId: count.warehouseId,
              type: 'adjustment',
              quantity: adjustment,
              reason: `Inventarizatsiya ${count.number}`,
              refType: 'stock_count',
              refId: count.id,
              userId,
            },
          });
        }
      }

      await tx.stockCount.update({
        where: { id },
        data: { status: 'completed' },
      });

      await this.audit.log(
        {
          userId,
          action: 'stockcount.complete',
          entity: 'StockCount',
          entityId: id,
          details: { number: count.number },
        },
        tx,
      );
    });

    return this.findCount(id);
  }
}
