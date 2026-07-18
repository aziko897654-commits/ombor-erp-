import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PayDirection, Prisma, TxType } from '@prisma/client';
import { AuditService } from '../../common/audit/audit.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AccountsService } from '../finance/accounts.service';
import { resolveCategory } from '../finance/categories.util';
import { endOfDay } from '../finance/transactions.service';
import { CreatePaymentDto } from './dto/payment.dto';

const ZERO = new Prisma.Decimal(0);

const PAYMENT_INCLUDE = {
  account: { select: { id: true, name: true } },
  customer: { select: { id: true, name: true } },
  supplier: { select: { id: true, name: true } },
  order: { select: { id: true, number: true, total: true } },
  purchase: { select: { id: true, number: true, total: true } },
} satisfies Prisma.PaymentInclude;

/**
 * FR-3.6: direction+counterparty combos → auto category for the
 * transaction created together with the payment.
 */
const CATEGORY_BY_COMBO: Record<
  'customer' | 'supplier',
  Record<PayDirection, { name: string; type: TxType }>
> = {
  customer: {
    in: { name: 'Savdo tushumi', type: 'income' },
    out: { name: 'Mijozga pul qaytarish', type: 'expense' },
  },
  supplier: {
    in: { name: 'Yetkazib beruvchidan qaytarim', type: 'income' },
    out: { name: 'Mahsulot xaridi', type: 'expense' },
  },
};

@Injectable()
export class PaymentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly accounts: AccountsService,
  ) {}

  async findAll(params: {
    page: number;
    limit: number;
    direction?: PayDirection;
    customerId?: number;
    supplierId?: number;
    orderId?: number;
    purchaseId?: number;
    from?: string;
    to?: string;
    sort?: 'asc' | 'desc';
  }) {
    const {
      page,
      limit,
      direction,
      customerId,
      supplierId,
      orderId,
      purchaseId,
      from,
      to,
      sort,
    } = params;
    const where: Prisma.PaymentWhereInput = {
      ...(direction ? { direction } : {}),
      ...(customerId ? { customerId } : {}),
      ...(supplierId ? { supplierId } : {}),
      ...(orderId ? { orderId } : {}),
      ...(purchaseId ? { purchaseId } : {}),
      ...(from || to
        ? {
            date: {
              ...(from ? { gte: new Date(from) } : {}),
              ...(to ? { lte: endOfDay(to) } : {}),
            },
          }
        : {}),
    };
    const [payments, total] = await this.prisma.$transaction([
      this.prisma.payment.findMany({
        where,
        include: PAYMENT_INCLUDE,
        orderBy: sort ? { createdAt: sort } : [{ date: 'desc' }, { id: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.payment.count({ where }),
    ]);
    return { data: payments, meta: { page, limit, total } };
  }

  /**
   * FR-3.6: ONE DB transaction — Payment + auto Transaction
   * (source=payment). Overpayment on a linked document is rejected
   * under an advisory lock (invariant 6); a full in-payment flips the
   * order's invoice to `paid` automatically (FR-3.5).
   */
  async create(dto: CreatePaymentDto, userId: number) {
    const counterparty = await this.validateRefs(dto);
    const amount = new Prisma.Decimal(dto.amount);
    const date = dto.date ? new Date(dto.date) : new Date();

    const payment = await this.prisma.$transaction(async (tx) => {
      // TASK-001: an outgoing payment must not overdraw the account
      if (dto.direction === 'out') {
        await this.accounts.assertCanSpend(
          tx,
          dto.accountId,
          amount,
          dto.force ?? false,
        );
      }

      let orderTotal: Prisma.Decimal | undefined;
      let paidBefore: Prisma.Decimal | undefined;
      if (dto.orderId) {
        await this.lockDoc(tx, `pay-order-${dto.orderId}`);
        const order = (await tx.order.findUnique({
          where: { id: dto.orderId },
        }))!;
        // re-check under the lock: a concurrent cancel may have won
        if (order.status !== 'confirmed' && order.status !== 'shipped') {
          throw new BadRequestException(
            "To'lov faqat tasdiqlangan buyurtmaga bog'lanadi",
          );
        }
        orderTotal = order.total;
        paidBefore = await this.linkedSum(tx, {
          orderId: dto.orderId,
          direction: dto.direction,
        });
        if (paidBefore.plus(amount).greaterThan(order.total)) {
          throw new BadRequestException(
            `Ortiqcha to'lov taqiqlanadi (FR-3.6): buyurtma jami ${order.total.toString()} so'm, avval to'langan ${paidBefore.toString()} so'm`,
          );
        }
      }
      if (dto.purchaseId) {
        await this.lockDoc(tx, `pay-purchase-${dto.purchaseId}`);
        const purchase = (await tx.purchase.findUnique({
          where: { id: dto.purchaseId },
        }))!;
        const already = await this.linkedSum(tx, {
          purchaseId: dto.purchaseId,
          direction: dto.direction,
        });
        if (already.plus(amount).greaterThan(purchase.total)) {
          throw new BadRequestException(
            `Ortiqcha to'lov taqiqlanadi (FR-3.6): xarid jami ${purchase.total.toString()} so'm, avval to'langan ${already.toString()} so'm`,
          );
        }
      }

      const created = await tx.payment.create({
        data: {
          date,
          direction: dto.direction,
          accountId: dto.accountId,
          amount,
          customerId: dto.customerId,
          supplierId: dto.supplierId,
          orderId: dto.orderId,
          purchaseId: dto.purchaseId,
          note: dto.note,
          userId,
        },
      });

      // money movement is mirrored into the journal (section 6, principle 3)
      const category =
        CATEGORY_BY_COMBO[dto.customerId ? 'customer' : 'supplier'][
          dto.direction
        ];
      const categoryId = await resolveCategory(tx, category.name, category.type);
      await tx.transaction.create({
        data: {
          date,
          accountId: dto.accountId,
          type: category.type,
          amount,
          categoryId,
          source: 'payment',
          refId: created.id,
          note: dto.note ?? `To'lov: ${counterparty}`,
          userId,
        },
      });

      // FR-3.5: invoice flips to paid when in-payments cover the total
      if (dto.orderId && dto.direction === 'in') {
        const paid = paidBefore!.plus(amount);
        if (paid.greaterThanOrEqualTo(orderTotal!)) {
          await tx.invoice.updateMany({
            where: { orderId: dto.orderId, status: { not: 'paid' } },
            data: { status: 'paid', paidAt: new Date() },
          });
        }
      }

      await this.audit.log(
        {
          userId,
          action: 'payment.create',
          entity: 'Payment',
          entityId: created.id,
          details: {
            direction: dto.direction,
            amount: amount.toString(),
            counterparty,
            orderId: dto.orderId,
            purchaseId: dto.purchaseId,
          },
        },
        tx,
      );

      return created;
    });

    return this.prisma.payment.findUnique({
      where: { id: payment.id },
      include: PAYMENT_INCLUDE,
    });
  }

  /**
   * FR-3.6: deleting a payment removes its transaction and re-derives
   * the invoice status — all in one DB transaction, with audit.
   */
  async remove(id: number, userId: number) {
    const payment = await this.prisma.payment.findUnique({
      where: { id },
      include: { order: { select: { total: true } } },
    });
    if (!payment) throw new NotFoundException("To'lov topilmadi");

    await this.prisma.$transaction(async (tx) => {
      await tx.transaction.deleteMany({
        where: { source: 'payment', refId: id },
      });
      await tx.payment.delete({ where: { id } });

      if (payment.orderId && payment.direction === 'in') {
        const paid = await this.linkedSum(tx, {
          orderId: payment.orderId,
          direction: 'in',
        });
        if (paid.lessThan(payment.order!.total)) {
          await tx.invoice.updateMany({
            where: { orderId: payment.orderId, status: 'paid' },
            data: { status: 'sent', paidAt: null },
          });
        }
      }

      await this.audit.log(
        {
          userId,
          action: 'payment.delete',
          entity: 'Payment',
          entityId: id,
          details: {
            direction: payment.direction,
            amount: payment.amount.toString(),
            orderId: payment.orderId,
            purchaseId: payment.purchaseId,
          },
        },
        tx,
      );
    });
    return { success: true };
  }

  private async lockDoc(tx: Prisma.TransactionClient, key: string) {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${key}))`;
  }

  private async linkedSum(
    tx: Prisma.TransactionClient,
    where: { orderId?: number; purchaseId?: number; direction: PayDirection },
  ): Promise<Prisma.Decimal> {
    const agg = await tx.payment.aggregate({ where, _sum: { amount: true } });
    return agg._sum.amount ?? ZERO;
  }

  /** FR-3.6 combos: exactly one counterparty; linked doc must match it. */
  private async validateRefs(dto: CreatePaymentDto): Promise<string> {
    if (!dto.customerId === !dto.supplierId) {
      throw new BadRequestException(
        'Kontragent: mijoz YOKI yetkazib beruvchi tanlanishi shart',
      );
    }
    if (dto.orderId && !dto.customerId) {
      throw new BadRequestException('Buyurtma faqat mijoz bilan bog\'lanadi');
    }
    if (dto.purchaseId && !dto.supplierId) {
      throw new BadRequestException(
        "Xarid hujjati faqat yetkazib beruvchi bilan bog'lanadi",
      );
    }
    if (dto.orderId && dto.purchaseId) {
      throw new BadRequestException(
        "Bitta to'lov ikkita hujjatga bog'lanmaydi",
      );
    }

    const account = await this.prisma.account.findUnique({
      where: { id: dto.accountId },
    });
    if (!account) throw new NotFoundException('Hisob topilmadi');

    if (dto.customerId) {
      const customer = await this.prisma.customer.findUnique({
        where: { id: dto.customerId },
      });
      if (!customer) throw new NotFoundException('Mijoz topilmadi');
      if (dto.orderId) {
        const order = await this.prisma.order.findUnique({
          where: { id: dto.orderId },
        });
        if (!order) throw new NotFoundException('Buyurtma topilmadi');
        if (order.customerId !== dto.customerId) {
          throw new BadRequestException(
            'Buyurtma tanlangan mijozga tegishli emas',
          );
        }
        if (order.status !== 'confirmed' && order.status !== 'shipped') {
          throw new BadRequestException(
            "To'lov faqat tasdiqlangan buyurtmaga bog'lanadi",
          );
        }
      }
      return customer.name;
    }

    const supplier = await this.prisma.supplier.findUnique({
      where: { id: dto.supplierId! },
    });
    if (!supplier) throw new NotFoundException('Yetkazib beruvchi topilmadi');
    if (dto.purchaseId) {
      const purchase = await this.prisma.purchase.findUnique({
        where: { id: dto.purchaseId },
      });
      if (!purchase) throw new NotFoundException('Xarid hujjati topilmadi');
      if (purchase.supplierId !== dto.supplierId) {
        throw new BadRequestException(
          'Xarid hujjati tanlangan yetkazib beruvchiga tegishli emas',
        );
      }
    }
    return supplier.name;
  }
}
