import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuditService } from '../../common/audit/audit.service';
import { NumberingService } from '../../common/numbering/numbering.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { StockService } from '../stock/stock.service';
import { CreatePurchaseDto } from './dto/purchase.dto';

@Injectable()
export class PurchasesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly stock: StockService,
    private readonly numbering: NumberingService,
    private readonly audit: AuditService,
  ) {}

  async findAll(
    page: number,
    limit: number,
    supplierId?: number,
    sort?: 'asc' | 'desc',
  ) {
    const where: Prisma.PurchaseWhereInput = supplierId ? { supplierId } : {};
    const [purchases, total] = await this.prisma.$transaction([
      this.prisma.purchase.findMany({
        where,
        include: {
          supplier: { select: { id: true, name: true } },
          warehouse: { select: { id: true, name: true } },
        },
        // TASK-004: sort by the displayed business date, not createdAt
        orderBy: sort ? [{ date: sort }, { id: sort }] : { id: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.purchase.count({ where }),
    ]);
    return { data: purchases, meta: { page, limit, total } };
  }

  async findOne(id: number) {
    const purchase = await this.prisma.purchase.findUnique({
      where: { id },
      include: {
        supplier: { select: { id: true, name: true } },
        warehouse: { select: { id: true, name: true } },
        items: { include: { product: { select: { id: true, name: true, sku: true, unit: true } } } },
        returns: { select: { id: true, number: true, total: true, date: true } },
      },
    });
    if (!purchase) throw new NotFoundException('Xarid hujjati topilmadi');
    return purchase;
  }

  /**
   * FR-2.4: one DB transaction — purchase + items, inflow movements,
   * costPrice update (last purchase price) and AVCO recalc (FR-2.12).
   * No expense transaction here: money moves only via Payment (principle 3).
   */
  async create(dto: CreatePurchaseDto, userId: number) {
    const [supplier, warehouse] = await Promise.all([
      this.prisma.supplier.findUnique({ where: { id: dto.supplierId } }),
      this.prisma.warehouse.findUnique({ where: { id: dto.warehouseId } }),
    ]);
    if (!supplier) throw new NotFoundException('Yetkazib beruvchi topilmadi');
    if (!warehouse || !warehouse.isActive) {
      throw new NotFoundException('Ombor topilmadi yoki faol emas');
    }

    const productIds = dto.items.map((i) => i.productId);
    if (new Set(productIds).size !== productIds.length) {
      throw new BadRequestException(
        'Bitta mahsulot hujjatda faqat bir marta kelishi mumkin',
      );
    }
    const products = await this.prisma.product.findMany({
      where: { id: { in: productIds } },
    });
    if (products.length !== productIds.length) {
      throw new NotFoundException('Ba\'zi mahsulotlar topilmadi');
    }

    const total = dto.items.reduce(
      (acc, i) =>
        acc.plus(new Prisma.Decimal(i.costPrice).times(i.quantity)),
      new Prisma.Decimal(0),
    );

    const purchase = await this.prisma.$transaction(async (tx) => {
      const number = await this.numbering.next(tx, 'purchase');
      const created = await tx.purchase.create({
        data: {
          number,
          supplierId: dto.supplierId,
          warehouseId: dto.warehouseId,
          date: dto.date ? new Date(dto.date) : new Date(),
          total,
          note: dto.note,
          userId,
          items: {
            create: dto.items.map((i) => ({
              productId: i.productId,
              quantity: new Prisma.Decimal(i.quantity),
              costPrice: new Prisma.Decimal(i.costPrice),
            })),
          },
        },
      });

      for (const item of dto.items) {
        const qty = new Prisma.Decimal(item.quantity);
        const price = new Prisma.Decimal(item.costPrice);

        // AVCO (FR-2.12): serialize per product, recalc from total stock
        await this.stock.lockProduct(tx, item.productId);
        const totalStock = await this.stock.getStock(tx, item.productId);
        const product = products.find((p) => p.id === item.productId)!;
        const current = await tx.product.findUnique({
          where: { id: item.productId },
          select: { avgCost: true },
        });
        const oldAvg = current?.avgCost ?? product.avgCost;

        const newAvg = totalStock.lessThanOrEqualTo(0)
          ? price
          : totalStock
              .times(oldAvg)
              .plus(qty.times(price))
              .dividedBy(totalStock.plus(qty))
              .toDecimalPlaces(2);

        await tx.product.update({
          where: { id: item.productId },
          data: { avgCost: newAvg, costPrice: price },
        });

        await this.stock.createInflow(tx, {
          productId: item.productId,
          warehouseId: dto.warehouseId,
          type: 'purchase',
          quantity: qty,
          refType: 'purchase',
          refId: created.id,
          userId,
        });
      }

      await this.audit.log(
        {
          userId,
          action: 'purchase.create',
          entity: 'Purchase',
          entityId: created.id,
          details: { number, total: total.toString(), items: dto.items.length },
        },
        tx,
      );

      return created;
    });

    return this.findOne(purchase.id);
  }
}
