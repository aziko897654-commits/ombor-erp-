import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuditService } from '../../common/audit/audit.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CreateSupplierDto, UpdateSupplierDto } from './dto/supplier.dto';

@Injectable()
export class SuppliersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async findAll(
    page: number,
    limit: number,
    search?: string,
    sort?: 'asc' | 'desc',
  ) {
    const where: Prisma.SupplierWhereInput = search
      ? {
          OR: [
            { name: { contains: search, mode: 'insensitive' } },
            { phone: { contains: search } },
          ],
        }
      : {};

    const [suppliers, total] = await this.prisma.$transaction([
      this.prisma.supplier.findMany({
        where,
        orderBy: sort ? { createdAt: sort } : { name: 'asc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.supplier.count({ where }),
    ]);

    return { data: suppliers, meta: { page, limit, total } };
  }

  /** Supplier card: purchases history + creditor debt (FR-2.3, FR-3.7). */
  async findOne(id: number) {
    const supplier = await this.prisma.supplier.findUnique({ where: { id } });
    if (!supplier) throw new NotFoundException('Yetkazib beruvchi topilmadi');

    const [purchases, purchasesSum, returnsSum, paymentsOut, paymentsIn] =
      await Promise.all([
        this.prisma.purchase.findMany({
          where: { supplierId: id },
          include: { warehouse: { select: { id: true, name: true } } },
          orderBy: { date: 'desc' },
          take: 20,
        }),
        this.prisma.purchase.aggregate({
          where: { supplierId: id },
          _sum: { total: true },
        }),
        this.prisma.purchaseReturn.aggregate({
          where: { purchase: { supplierId: id } },
          _sum: { total: true },
        }),
        this.prisma.payment.aggregate({
          where: { supplierId: id, direction: 'out' },
          _sum: { amount: true },
        }),
        this.prisma.payment.aggregate({
          where: { supplierId: id, direction: 'in' },
          _sum: { amount: true },
        }),
      ]);

    const zero = new Prisma.Decimal(0);
    // Supplier debt = purchases − returns − payments(out) + refunds(in);
    // positive means we owe the supplier (FR-3.7)
    const debt = (purchasesSum._sum.total ?? zero)
      .minus(returnsSum._sum.total ?? zero)
      .minus(paymentsOut._sum.amount ?? zero)
      .plus(paymentsIn._sum.amount ?? zero);

    return {
      ...supplier,
      purchases,
      stats: {
        purchasesTotal: (purchasesSum._sum.total ?? zero).toString(),
        returnsTotal: (returnsSum._sum.total ?? zero).toString(),
        paymentsTotal: (paymentsOut._sum.amount ?? zero).toString(),
        debt: debt.toString(),
      },
    };
  }

  create(dto: CreateSupplierDto) {
    return this.prisma.supplier.create({ data: dto });
  }

  async update(id: number, dto: UpdateSupplierDto) {
    const supplier = await this.prisma.supplier.findUnique({ where: { id } });
    if (!supplier) throw new NotFoundException('Yetkazib beruvchi topilmadi');
    return this.prisma.supplier.update({ where: { id }, data: dto });
  }

  /**
   * TASK-009: mirrors customers.remove — hard delete only when there is
   * no document history (NFR-9); otherwise a 409 tells the UI to offer
   * archiving (isActive=false) instead. Logged to audit.
   */
  async remove(id: number, actorId: number) {
    const supplier = await this.prisma.supplier.findUnique({
      where: { id },
      include: { _count: { select: { purchases: true, payments: true } } },
    });
    if (!supplier) throw new NotFoundException('Yetkazib beruvchi topilmadi');
    const { purchases, payments } = supplier._count;
    if (purchases + payments > 0) {
      throw new ConflictException(
        `Bu yetkazib beruvchiga ${purchases} ta xarid va ${payments} ta to'lov bog'langan — o'chirib bo'lmaydi. Arxivlansinmi?`,
      );
    }
    await this.prisma.supplier.delete({ where: { id } });
    await this.audit.log({
      userId: actorId,
      action: 'supplier.delete',
      entity: 'Supplier',
      entityId: id,
      details: { name: supplier.name },
    });
    return { success: true };
  }

  /** TASK-009: archive (soft-delete) for suppliers with history. */
  async archive(id: number, actorId: number) {
    const supplier = await this.prisma.supplier.findUnique({ where: { id } });
    if (!supplier) throw new NotFoundException('Yetkazib beruvchi topilmadi');
    const updated = await this.prisma.supplier.update({
      where: { id },
      data: { isActive: false },
    });
    await this.audit.log({
      userId: actorId,
      action: 'supplier.archive',
      entity: 'Supplier',
      entityId: id,
      details: { name: supplier.name },
    });
    return updated;
  }
}
