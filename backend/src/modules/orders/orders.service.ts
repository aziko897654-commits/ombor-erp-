import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { OrderStatus, Prisma } from '@prisma/client';
import { AuditService } from '../../common/audit/audit.service';
import { NumberingService } from '../../common/numbering/numbering.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { StockService } from '../stock/stock.service';
import { CreateOrderDto, OrderItemDto, UpdateOrderDto } from './dto/order.dto';

const ORDER_INCLUDE = {
  customer: { select: { id: true, name: true } },
  warehouse: { select: { id: true, name: true } },
  items: {
    include: {
      product: { select: { id: true, name: true, sku: true, unit: true } },
    },
  },
  invoice: { select: { id: true, number: true, status: true } },
  returns: { select: { id: true, number: true, total: true, date: true } },
} satisfies Prisma.OrderInclude;

@Injectable()
export class OrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly stock: StockService,
    private readonly numbering: NumberingService,
    private readonly audit: AuditService,
  ) {}

  async findAll(params: {
    page: number;
    limit: number;
    status?: OrderStatus;
    customerId?: number;
  }) {
    const { page, limit, status, customerId } = params;
    const where: Prisma.OrderWhereInput = {
      ...(status ? { status } : {}),
      ...(customerId ? { customerId } : {}),
    };
    const [orders, total] = await this.prisma.$transaction([
      this.prisma.order.findMany({
        where,
        include: {
          customer: { select: { id: true, name: true } },
          warehouse: { select: { id: true, name: true } },
        },
        orderBy: { id: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.order.count({ where }),
    ]);
    return { data: orders, meta: { page, limit, total } };
  }

  async findOne(id: number) {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: ORDER_INCLUDE,
    });
    if (!order) throw new NotFoundException('Buyurtma topilmadi');
    return order;
  }

  /** FR-1.4: draft order; total = subtotal − discount (invariant 5). */
  async create(dto: CreateOrderDto, userId: number) {
    await this.validateRefs(dto.customerId, dto.warehouseId, dto.items);
    const { subtotal, discount, total } = this.computeTotals(
      dto.items,
      dto.discount ?? 0,
    );

    const order = await this.prisma.$transaction(async (tx) => {
      const number = await this.numbering.next(tx, 'order');
      return tx.order.create({
        data: {
          number,
          customerId: dto.customerId,
          warehouseId: dto.warehouseId,
          status: 'draft',
          subtotal,
          discount,
          total,
          items: {
            create: dto.items.map((i) => ({
              productId: i.productId,
              quantity: new Prisma.Decimal(i.quantity),
              price: new Prisma.Decimal(i.price),
            })),
          },
        },
      });
    });
    // userId reserved for audit symmetry; draft creation is not logged (NFR-5)
    void userId;

    return this.findOne(order.id);
  }

  /** FR-1.7: only draft orders can be edited. */
  async update(id: number, dto: UpdateOrderDto) {
    const order = await this.findOne(id);
    if (order.status !== 'draft') {
      throw new BadRequestException(
        "Faqat qoralama (draft) buyurtma tahrirlanadi (FR-1.7)",
      );
    }
    await this.validateRefs(
      dto.customerId ?? order.customerId,
      dto.warehouseId ?? order.warehouseId,
      dto.items ?? [],
    );

    const items =
      dto.items ??
      order.items.map((i) => ({
        productId: i.productId,
        quantity: i.quantity.toNumber(),
        price: i.price.toNumber(),
      }));
    const { subtotal, discount, total } = this.computeTotals(
      items,
      dto.discount ?? order.discount.toNumber(),
    );

    await this.prisma.$transaction(async (tx) => {
      if (dto.items) {
        await tx.orderItem.deleteMany({ where: { orderId: id } });
        await tx.orderItem.createMany({
          data: dto.items.map((i) => ({
            orderId: id,
            productId: i.productId,
            quantity: new Prisma.Decimal(i.quantity),
            price: new Prisma.Decimal(i.price),
          })),
        });
      }
      await tx.order.update({
        where: { id },
        data: {
          customerId: dto.customerId ?? undefined,
          warehouseId: dto.warehouseId ?? undefined,
          subtotal,
          discount,
          total,
        },
      });
    });

    return this.findOne(id);
  }

  /** Draft orders may be physically deleted (NFR-9 exception), with audit. */
  async remove(id: number, userId: number) {
    const order = await this.findOne(id);
    if (order.status !== 'draft') {
      throw new BadRequestException(
        "Faqat qoralama (draft) buyurtma o'chiriladi",
      );
    }
    await this.prisma.$transaction(async (tx) => {
      await tx.orderItem.deleteMany({ where: { orderId: id } });
      await tx.order.delete({ where: { id } });
      await this.audit.log(
        {
          userId,
          action: 'order.delete',
          entity: 'Order',
          entityId: id,
          details: { number: order.number },
        },
        tx,
      );
    });
    return { success: true };
  }

  /**
   * FR-1.5: confirmation — in ONE transaction:
   * 1) outflow movement per item from the order's warehouse (stock
   *    checked with a clear error, nothing changes on failure);
   * 2) current avgCost is stamped into OrderItem.cost (FR-2.12);
   * 3) status -> confirmed. The order total becomes the customer's
   *    receivable (computed, FR-3.7) — NO income transaction here:
   *    money arrives only via Payment (FR-3.6).
   */
  async confirm(id: number, userId: number) {
    const order = await this.findOne(id);
    if (order.status !== 'draft') {
      throw new BadRequestException(
        "Faqat qoralama (draft) buyurtma tasdiqlanadi",
      );
    }

    await this.prisma.$transaction(async (tx) => {
      for (const item of order.items) {
        await this.stock.createOutflow(tx, {
          productId: item.productId,
          warehouseId: order.warehouseId,
          type: 'sale',
          quantity: item.quantity,
          refType: 'order',
          refId: order.id,
          userId,
        });
        const product = await tx.product.findUnique({
          where: { id: item.productId },
          select: { avgCost: true },
        });
        await tx.orderItem.update({
          where: { id: item.id },
          data: { cost: product?.avgCost ?? new Prisma.Decimal(0) },
        });
      }

      await tx.order.update({ where: { id }, data: { status: 'confirmed' } });

      await this.audit.log(
        {
          userId,
          action: 'order.confirm',
          entity: 'Order',
          entityId: id,
          details: { number: order.number, total: order.total.toString() },
        },
        tx,
      );
    });

    return this.findOne(id);
  }

  /**
   * FR-1.6: cancel — only from `confirmed`. Creates return (+)
   * movements so the order's net stock effect is zero. The payment
   * check is enabled in stage 3.
   */
  async cancel(id: number, userId: number) {
    const order = await this.findOne(id);
    if (order.status !== 'confirmed') {
      throw new BadRequestException(
        'Faqat tasdiqlangan (confirmed) buyurtma bekor qilinadi (FR-1.6)',
      );
    }

    await this.prisma.$transaction(async (tx) => {
      for (const item of order.items) {
        await this.stock.createInflow(tx, {
          productId: item.productId,
          warehouseId: order.warehouseId,
          type: 'sale',
          quantity: item.quantity,
          reason: 'Buyurtma bekor qilindi',
          refType: 'order',
          refId: order.id,
          userId,
        });
      }
      await tx.order.update({ where: { id }, data: { status: 'cancelled' } });
      await this.audit.log(
        {
          userId,
          action: 'order.cancel',
          entity: 'Order',
          entityId: id,
          details: { number: order.number },
        },
        tx,
      );
    });

    return this.findOne(id);
  }

  /** confirmed -> shipped (FR-1.4 status chain). */
  async ship(id: number, userId: number) {
    const order = await this.findOne(id);
    if (order.status !== 'confirmed') {
      throw new BadRequestException(
        "Faqat tasdiqlangan buyurtma jo'natilgan deb belgilanadi",
      );
    }
    await this.prisma.order.update({
      where: { id },
      data: { status: 'shipped' },
    });
    await this.audit.log({
      userId,
      action: 'order.ship',
      entity: 'Order',
      entityId: id,
      details: { number: order.number },
    });
    return this.findOne(id);
  }

  private computeTotals(items: OrderItemDto[], discountValue: number) {
    const subtotal = items.reduce(
      (acc, i) => acc.plus(new Prisma.Decimal(i.price).times(i.quantity)),
      new Prisma.Decimal(0),
    );
    const discount = new Prisma.Decimal(discountValue);
    if (discount.greaterThan(subtotal)) {
      throw new BadRequestException(
        "Chegirma pozitsiyalar yig'indisidan oshib ketdi",
      );
    }
    return { subtotal, discount, total: subtotal.minus(discount) };
  }

  private async validateRefs(
    customerId: number,
    warehouseId: number,
    items: OrderItemDto[],
  ) {
    const [customer, warehouse] = await Promise.all([
      this.prisma.customer.findUnique({ where: { id: customerId } }),
      this.prisma.warehouse.findUnique({ where: { id: warehouseId } }),
    ]);
    if (!customer) throw new NotFoundException('Mijoz topilmadi');
    if (!warehouse || !warehouse.isActive) {
      throw new NotFoundException('Ombor topilmadi yoki faol emas');
    }
    if (items.length > 0) {
      const ids = items.map((i) => i.productId);
      if (new Set(ids).size !== ids.length) {
        throw new BadRequestException(
          'Bitta mahsulot buyurtmada faqat bir marta kelishi mumkin',
        );
      }
      const count = await this.prisma.product.count({
        where: { id: { in: ids } },
      });
      if (count !== ids.length) {
        throw new NotFoundException("Ba'zi mahsulotlar topilmadi");
      }
    }
  }
}
