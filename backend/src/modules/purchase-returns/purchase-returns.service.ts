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
import { CreatePurchaseReturnDto } from './dto/purchase-return.dto';

@Injectable()
export class PurchaseReturnsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly stock: StockService,
    private readonly numbering: NumberingService,
    private readonly audit: AuditService,
  ) {}

  async findAll(page: number, limit: number, sort?: 'asc' | 'desc') {
    const [returns, total] = await this.prisma.$transaction([
      this.prisma.purchaseReturn.findMany({
        include: {
          purchase: {
            select: {
              id: true,
              number: true,
              supplier: { select: { id: true, name: true } },
            },
          },
          warehouse: { select: { id: true, name: true } },
        },
        // TASK-004: sort by the displayed business date, not createdAt
        orderBy: sort ? [{ date: sort }, { id: sort }] : { id: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.purchaseReturn.count(),
    ]);
    return { data: returns, meta: { page, limit, total } };
  }

  async findOne(id: number) {
    const ret = await this.prisma.purchaseReturn.findUnique({
      where: { id },
      include: {
        purchase: {
          select: {
            id: true,
            number: true,
            supplier: { select: { id: true, name: true } },
          },
        },
        warehouse: { select: { id: true, name: true } },
        items: {
          include: {
            product: { select: { id: true, name: true, sku: true, unit: true } },
          },
        },
      },
    });
    if (!ret) throw new NotFoundException('Xarid qaytarishi topilmadi');
    return ret;
  }

  /**
   * FR-2.10: one DB transaction — outflow movements from the purchase
   * warehouse (stock checked) + PRT numbering. Returned qty per product
   * must not exceed (purchased − previously returned) (invariant 7).
   */
  async create(dto: CreatePurchaseReturnDto, userId: number) {
    const productIds = dto.items.map((i) => i.productId);
    if (new Set(productIds).size !== productIds.length) {
      throw new BadRequestException(
        'Bitta mahsulot hujjatda faqat bir marta kelishi mumkin',
      );
    }

    const purchase = await this.prisma.purchase.findUnique({
      where: { id: dto.purchaseId },
      include: { items: true },
    });
    if (!purchase) throw new NotFoundException('Xarid hujjati topilmadi');

    const purchasedByProduct = new Map(
      purchase.items.map((i) => [i.productId, i]),
    );

    const created = await this.prisma.$transaction(async (tx) => {
      // serialize concurrent returns of the same purchase so the
      // "returned <= purchased" invariant (7) is re-checked under the lock
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`return-purchase-${dto.purchaseId}`}))`;

      // previously returned per product for this purchase
      const previous = await tx.purchaseReturnItem.groupBy({
        by: ['productId'],
        where: { purchaseReturn: { purchaseId: dto.purchaseId } },
        _sum: { quantity: true },
      });
      const returnedByProduct = new Map(
        previous.map((r) => [
          r.productId,
          r._sum.quantity ?? new Prisma.Decimal(0),
        ]),
      );

      let total = new Prisma.Decimal(0);
      for (const item of dto.items) {
        const purchased = purchasedByProduct.get(item.productId);
        if (!purchased) {
          throw new BadRequestException(
            `Mahsulot (id=${item.productId}) bu xarid hujjatida yo'q`,
          );
        }
        const alreadyReturned =
          returnedByProduct.get(item.productId) ?? new Prisma.Decimal(0);
        const available = purchased.quantity.minus(alreadyReturned);
        const qty = new Prisma.Decimal(item.quantity);
        if (qty.greaterThan(available)) {
          throw new BadRequestException(
            `Qaytarish miqdori oshib ketdi: olingan ${purchased.quantity}, avval qaytarilgan ${alreadyReturned}, mumkin ${available}`,
          );
        }
        total = total.plus(qty.times(purchased.costPrice));
      }

      const number = await this.numbering.next(tx, 'purchaseReturn');
      const ret = await tx.purchaseReturn.create({
        data: {
          number,
          purchaseId: dto.purchaseId,
          warehouseId: purchase.warehouseId,
          date: dto.date ? new Date(dto.date) : new Date(),
          total,
          note: dto.note,
          userId,
          items: {
            create: dto.items.map((i) => ({
              productId: i.productId,
              quantity: new Prisma.Decimal(i.quantity),
              costPrice: purchasedByProduct.get(i.productId)!.costPrice,
            })),
          },
        },
      });

      for (const item of dto.items) {
        await this.stock.createOutflow(tx, {
          productId: item.productId,
          warehouseId: purchase.warehouseId,
          type: 'purchase_return',
          quantity: new Prisma.Decimal(item.quantity),
          refType: 'purchase_return',
          refId: ret.id,
          userId,
        });
      }

      await this.audit.log(
        {
          userId,
          action: 'purchase_return.create',
          entity: 'PurchaseReturn',
          entityId: ret.id,
          details: { number, purchase: purchase.number, total: total.toString() },
        },
        tx,
      );

      return ret;
    });

    return this.findOne(created.id);
  }
}
