import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { OrderStatus, Prisma } from '@prisma/client';
import { AuditService } from '../../common/audit/audit.service';
import { NumberingService } from '../../common/numbering/numbering.service';
import {
  buildPdf,
  drawCompanyHeader,
  drawTable,
  pdfDate,
  pdfMoney,
  pdfQty,
} from '../../common/pdf/pdf.util';
import { PrismaService } from '../../common/prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { SettingsService } from '../settings/settings.service';
import { StockService } from '../stock/stock.service';
import { CreateOrderDto, OrderItemDto, UpdateOrderDto } from './dto/order.dto';

const ZERO = new Prisma.Decimal(0);

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
  payments: {
    select: {
      id: true,
      date: true,
      direction: true,
      amount: true,
      note: true,
      account: { select: { id: true, name: true } },
    },
    orderBy: { id: 'desc' as const },
  },
} satisfies Prisma.OrderInclude;

@Injectable()
export class OrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly stock: StockService,
    private readonly numbering: NumberingService,
    private readonly audit: AuditService,
    private readonly settings: SettingsService,
    private readonly notifications: NotificationsService,
  ) {}

  async findAll(params: {
    page: number;
    limit: number;
    status?: OrderStatus;
    customerId?: number;
    sort?: 'asc' | 'desc';
    sortBy?: string;
  }) {
    const { page, limit, status, customerId, sort, sortBy } = params;
    const where: Prisma.OrderWhereInput = {
      ...(status ? { status } : {}),
      ...(customerId ? { customerId } : {}),
    };
    // TASK-021: whitelist of sortable columns
    const dir = sort ?? 'desc';
    const orderBy: Prisma.OrderOrderByWithRelationInput =
      sortBy === 'number'
        ? { number: dir }
        : sortBy === 'customer'
          ? { customer: { name: dir } }
          : sortBy === 'warehouse'
            ? { warehouse: { name: dir } }
            : sortBy === 'status'
              ? { status: dir }
              : sortBy === 'total'
                ? { total: dir }
                : sortBy === 'date' || sort
                  ? { createdAt: dir }
                  : { id: 'desc' };
    const [orders, total] = await this.prisma.$transaction([
      this.prisma.order.findMany({
        where,
        include: {
          customer: { select: { id: true, name: true } },
          warehouse: { select: { id: true, name: true } },
        },
        orderBy,
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
    // payment status (stage 3): paid = in-payments − refunds (computed)
    const paidTotal = order.payments.reduce(
      (acc, p) =>
        p.direction === 'in' ? acc.plus(p.amount) : acc.minus(p.amount),
      ZERO,
    );
    return { ...order, paidTotal: paidTotal.toString() };
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
      // serialize against a concurrent confirm/cancel and re-check the
      // status under the lock, so a double-submit can't deduct stock
      // twice for one order (same lock key PaymentsService/cancel use)
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`pay-order-${id}`}))`;
      const fresh = await tx.order.findUnique({
        where: { id },
        select: { status: true },
      });
      if (fresh?.status !== 'draft') {
        throw new BadRequestException(
          "Faqat qoralama (draft) buyurtma tasdiqlanadi",
        );
      }

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

      // FR-7.2: "Buyurtma tasdiqlandi" → admin
      await this.notifications.notifyRoles(
        ['admin'],
        {
          title: 'Buyurtma tasdiqlandi',
          message: `${order.number} — ${order.customer.name}, jami ${order.total.toString()} so'm`,
          link: `/orders/${id}`,
        },
        tx,
      );
    });

    return this.findOne(id);
  }

  /**
   * FR-1.6: cancel — only from `confirmed`, and only when the order
   * has no payments (they must be deleted first). Creates return (+)
   * movements so the order's net stock effect is zero.
   */
  async cancel(id: number, userId: number) {
    const order = await this.findOne(id);
    if (order.status !== 'confirmed') {
      throw new BadRequestException(
        'Faqat tasdiqlangan (confirmed) buyurtma bekor qilinadi (FR-1.6)',
      );
    }
    if (order.payments.length > 0) {
      throw new BadRequestException(
        "Buyurtma bo'yicha to'lovlar mavjud — avval to'lovlarni o'chiring (FR-1.6)",
      );
    }

    await this.prisma.$transaction(async (tx) => {
      // same advisory lock as PaymentsService: serializes cancel vs
      // a concurrent payment, then re-checks under the lock
      const lockKey = `pay-order-${id}`;
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${lockKey}))`;
      // re-check status under the lock too: a concurrent cancel may have
      // already reverted the stock, otherwise we'd double the inflows
      const fresh = await tx.order.findUnique({
        where: { id },
        select: { status: true },
      });
      if (fresh?.status !== 'confirmed') {
        throw new BadRequestException(
          'Faqat tasdiqlangan (confirmed) buyurtma bekor qilinadi (FR-1.6)',
        );
      }
      const paymentsCount = await tx.payment.count({ where: { orderId: id } });
      if (paymentsCount > 0) {
        throw new BadRequestException(
          "Buyurtma bo'yicha to'lovlar mavjud — avval to'lovlarni o'chiring (FR-1.6)",
        );
      }

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

  /** FR-1.9: delivery note PDF for a confirmed/shipped order. */
  async deliveryNote(id: number): Promise<{ number: string; buffer: Buffer }> {
    const order = await this.findOne(id);
    if (order.status !== 'confirmed' && order.status !== 'shipped') {
      throw new BadRequestException(
        'Yuk xati faqat tasdiqlangan buyurtma uchun chop etiladi (FR-1.9)',
      );
    }
    const settings = await this.settings.get();

    const buffer = await buildPdf((doc) => {
      drawCompanyHeader(doc, settings);

      doc
        .font('Helvetica-Bold')
        .fontSize(16)
        .text(`YUK XATI ${order.number}`, { align: 'center' });
      doc
        .font('Helvetica')
        .fontSize(10)
        .text(`Sana: ${pdfDate(order.createdAt)}`, { align: 'center' });
      doc.moveDown(1);

      doc.font('Helvetica-Bold').fontSize(10).text('Mijoz:', { continued: true });
      doc.font('Helvetica').text(` ${order.customer.name}`);
      doc.font('Helvetica-Bold').text('Ombor:', { continued: true });
      doc.font('Helvetica').text(` ${order.warehouse.name}`);
      doc.moveDown(1);

      drawTable(
        doc,
        [
          { header: '#', width: 25 },
          { header: 'Mahsulot', width: 190 },
          { header: 'Birlik', width: 45 },
          { header: 'Miqdor', width: 65, align: 'right' },
          { header: 'Narx', width: 90, align: 'right' },
          { header: 'Summa', width: 100, align: 'right' },
        ],
        order.items.map((item, i) => [
          String(i + 1),
          `${item.product.name} (${item.product.sku})`,
          item.product.unit,
          pdfQty(item.quantity),
          pdfMoney(item.price),
          pdfMoney(item.quantity.times(item.price)),
        ]),
      );

      const right = { align: 'right' as const };
      doc.font('Helvetica').fontSize(10);
      doc.text(`Oraliq jami: ${pdfMoney(order.subtotal)}`, right);
      doc.text(`Chegirma: ${pdfMoney(order.discount)}`, right);
      doc
        .font('Helvetica-Bold')
        .fontSize(12)
        .text(`JAMI: ${pdfMoney(order.total)}`, right);

      doc.moveDown(3);
      doc.font('Helvetica').fontSize(10);
      doc.text('Topshirdi: _________________________', {
        continued: true,
      });
      doc.text('Qabul qildi: _________________________', {
        align: 'right',
      });
    });

    return { number: order.number, buffer };
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
