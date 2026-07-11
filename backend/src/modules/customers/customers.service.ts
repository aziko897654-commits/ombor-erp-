import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuditService } from '../../common/audit/audit.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CreateCustomerDto, UpdateCustomerDto } from './dto/customer.dto';

const ZERO = new Prisma.Decimal(0);

@Injectable()
export class CustomersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async findAll(page: number, limit: number, search?: string) {
    const where: Prisma.CustomerWhereInput = search
      ? {
          OR: [
            { name: { contains: search, mode: 'insensitive' } },
            { phone: { contains: search } },
          ],
        }
      : {};

    const [customers, total] = await this.prisma.$transaction([
      this.prisma.customer.findMany({
        where,
        orderBy: { name: 'asc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.customer.count({ where }),
    ]);
    return { data: customers, meta: { page, limit, total } };
  }

  /** Customer card (FR-1.2): info + balance block + history. */
  async findOne(id: number) {
    const customer = await this.prisma.customer.findUnique({ where: { id } });
    if (!customer) throw new NotFoundException('Mijoz topilmadi');

    const [orders, payments, balance] = await Promise.all([
      this.prisma.order.findMany({
        where: { customerId: id },
        include: { warehouse: { select: { id: true, name: true } } },
        orderBy: { id: 'desc' },
        take: 20,
      }),
      this.prisma.payment.findMany({
        where: { customerId: id },
        include: {
          account: { select: { id: true, name: true } },
          order: { select: { id: true, number: true } },
        },
        orderBy: { id: 'desc' },
        take: 20,
      }),
      this.getBalance(id),
    ]);

    return { ...customer, orders, payments, balance };
  }

  /**
   * FR-3.7: customer debt = SUM(confirmed+shipped orders) − SUM(sales
   * returns) − SUM(payments in) + SUM(refunds out). Positive — the
   * customer owes us. Computed, never stored (NFR-10).
   */
  async getBalance(customerId: number) {
    const [ordersSum, returnsSum, paymentsIn, paymentsOut] = await Promise.all([
      this.prisma.order.aggregate({
        where: { customerId, status: { in: ['confirmed', 'shipped'] } },
        _sum: { total: true },
      }),
      this.prisma.salesReturn.aggregate({
        where: { order: { customerId } },
        _sum: { total: true },
      }),
      this.prisma.payment.aggregate({
        where: { customerId, direction: 'in' },
        _sum: { amount: true },
      }),
      this.prisma.payment.aggregate({
        where: { customerId, direction: 'out' },
        _sum: { amount: true },
      }),
    ]);

    const ordersTotal = ordersSum._sum.total ?? ZERO;
    const returnsTotal = returnsSum._sum.total ?? ZERO;
    const paidIn = paymentsIn._sum.amount ?? ZERO;
    const refundedOut = paymentsOut._sum.amount ?? ZERO;
    const debt = ordersTotal.minus(returnsTotal).minus(paidIn).plus(refundedOut);

    return {
      ordersTotal: ordersTotal.toString(),
      returnsTotal: returnsTotal.toString(),
      paymentsTotal: paidIn.toString(),
      refundsTotal: refundedOut.toString(),
      debt: debt.toString(),
    };
  }

  create(dto: CreateCustomerDto) {
    return this.prisma.customer.create({ data: dto });
  }

  async update(id: number, dto: UpdateCustomerDto) {
    const customer = await this.prisma.customer.findUnique({ where: { id } });
    if (!customer) throw new NotFoundException('Mijoz topilmadi');
    return this.prisma.customer.update({ where: { id }, data: dto });
  }

  /**
   * Physical delete is allowed only for customers with no history
   * (NFR-9 spirit + DELETE endpoint in section 8). Logged to audit.
   */
  async remove(id: number, actorId: number) {
    const customer = await this.prisma.customer.findUnique({
      where: { id },
      include: {
        _count: { select: { orders: true, deals: true, payments: true } },
      },
    });
    if (!customer) throw new NotFoundException('Mijoz topilmadi');
    const { orders, deals, payments } = customer._count;
    if (orders + deals + payments > 0) {
      throw new ConflictException(
        "Bu mijozda hujjatlar tarixi bor — o'chirish mumkin emas",
      );
    }
    await this.prisma.customer.delete({ where: { id } });
    await this.audit.log({
      userId: actorId,
      action: 'customer.delete',
      entity: 'Customer',
      entityId: id,
      details: { name: customer.name },
    });
    return { success: true };
  }
}
