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
import { CreateSalesReturnDto } from './dto/sales-return.dto';

@Injectable()
export class SalesReturnsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly stock: StockService,
    private readonly numbering: NumberingService,
    private readonly audit: AuditService,
  ) {}

  async findAll(page: number, limit: number, sort?: 'asc' | 'desc') {
    const [returns, total] = await this.prisma.$transaction([
      this.prisma.salesReturn.findMany({
        include: {
          order: {
            select: {
              id: true,
              number: true,
              customer: { select: { id: true, name: true } },
            },
          },
          warehouse: { select: { id: true, name: true } },
        },
        orderBy: sort ? { createdAt: sort } : { id: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.salesReturn.count(),
    ]);
    return { data: returns, meta: { page, limit, total } };
  }

  async findOne(id: number) {
    const ret = await this.prisma.salesReturn.findUnique({
      where: { id },
      include: {
        order: {
          select: {
            id: true,
            number: true,
            customer: { select: { id: true, name: true } },
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
    if (!ret) throw new NotFoundException('Sotuv qaytarishi topilmadi');
    return ret;
  }

  /**
   * FR-1.8: one DB transaction — SRT number, inflow movements
   * (type=sale_return, +) into the order's warehouse. The return
   * total (at order item prices) reduces the customer's debt via the
   * computed FR-3.7 formula. Returned qty per product must not exceed
   * (sold − previously returned) (invariant 7). Refund payments —
   * stage 3 (FR-3.6 out+customer).
   */
  async create(dto: CreateSalesReturnDto, userId: number) {
    const order = await this.prisma.order.findUnique({
      where: { id: dto.orderId },
      include: { items: true },
    });
    if (!order) throw new NotFoundException('Buyurtma topilmadi');
    if (order.status !== 'confirmed' && order.status !== 'shipped') {
      throw new BadRequestException(
        'Qaytarish faqat confirmed/shipped buyurtma asosida (FR-1.8)',
      );
    }

    const soldByProduct = new Map(order.items.map((i) => [i.productId, i]));

    const previous = await this.prisma.salesReturnItem.groupBy({
      by: ['productId'],
      where: { salesReturn: { orderId: dto.orderId } },
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
      const sold = soldByProduct.get(item.productId);
      if (!sold) {
        throw new BadRequestException(
          `Mahsulot (id=${item.productId}) bu buyurtmada yo'q`,
        );
      }
      const alreadyReturned =
        returnedByProduct.get(item.productId) ?? new Prisma.Decimal(0);
      const available = sold.quantity.minus(alreadyReturned);
      const qty = new Prisma.Decimal(item.quantity);
      if (qty.greaterThan(available)) {
        throw new BadRequestException(
          `Qaytarish miqdori oshib ketdi: sotilgan ${sold.quantity}, avval qaytarilgan ${alreadyReturned}, mumkin ${available}`,
        );
      }
      total = total.plus(qty.times(sold.price));
    }

    const created = await this.prisma.$transaction(async (tx) => {
      const number = await this.numbering.next(tx, 'salesReturn');
      const ret = await tx.salesReturn.create({
        data: {
          number,
          orderId: dto.orderId,
          warehouseId: order.warehouseId,
          date: dto.date ? new Date(dto.date) : new Date(),
          total,
          note: dto.note,
          userId,
          items: {
            create: dto.items.map((i) => ({
              productId: i.productId,
              quantity: new Prisma.Decimal(i.quantity),
              price: soldByProduct.get(i.productId)!.price,
            })),
          },
        },
      });

      for (const item of dto.items) {
        await this.stock.createInflow(tx, {
          productId: item.productId,
          warehouseId: order.warehouseId,
          type: 'sale_return',
          quantity: new Prisma.Decimal(item.quantity),
          refType: 'sales_return',
          refId: ret.id,
          userId,
        });
      }

      await this.audit.log(
        {
          userId,
          action: 'sales_return.create',
          entity: 'SalesReturn',
          entityId: ret.id,
          details: { number, order: order.number, total: total.toString() },
        },
        tx,
      );

      return ret;
    });

    return this.findOne(created.id);
  }
}
