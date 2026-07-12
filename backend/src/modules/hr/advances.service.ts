import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuditService } from '../../common/audit/audit.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { resolveCategory } from '../finance/categories.util';
import { CreateAdvanceDto } from './dto/hr.dto';

const ADVANCE_INCLUDE = {
  employee: { select: { id: true, fullName: true } },
} satisfies Prisma.AdvanceInclude;

/**
 * FR-4.4: an advance creates an expense transaction (source=advance,
 * category "Ish haqi avansi") in the same DB transaction, and is
 * auto-deducted in that month's payroll.
 */
@Injectable()
export class AdvancesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async findAll(page: number, limit: number) {
    const [advances, total] = await this.prisma.$transaction([
      this.prisma.advance.findMany({
        include: ADVANCE_INCLUDE,
        orderBy: [{ date: 'desc' }, { id: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.advance.count(),
    ]);
    // account names (Advance has no relation to Account in the schema)
    const accountIds = [...new Set(advances.map((a) => a.accountId))];
    const accounts = accountIds.length
      ? await this.prisma.account.findMany({
          where: { id: { in: accountIds } },
          select: { id: true, name: true },
        })
      : [];
    const nameById = new Map(accounts.map((a) => [a.id, a.name]));
    return {
      data: advances.map((a) => ({
        ...a,
        accountName: nameById.get(a.accountId) ?? null,
      })),
      meta: { page, limit, total },
    };
  }

  async create(dto: CreateAdvanceDto, userId: number) {
    const [employee, account] = await Promise.all([
      this.prisma.employee.findUnique({ where: { id: dto.employeeId } }),
      this.prisma.account.findUnique({ where: { id: dto.accountId } }),
    ]);
    if (!employee) throw new NotFoundException('Xodim topilmadi');
    if (employee.status !== 'active') {
      throw new BadRequestException('Faol bo\'lmagan xodimga avans berilmaydi');
    }
    if (!account) throw new NotFoundException('Hisob topilmadi');

    const amount = new Prisma.Decimal(dto.amount);
    const date = dto.date ? new Date(dto.date) : new Date();

    const advance = await this.prisma.$transaction(async (tx) => {
      const created = await tx.advance.create({
        data: {
          employeeId: dto.employeeId,
          accountId: dto.accountId,
          amount,
          date,
          note: dto.note,
          userId,
        },
      });

      const categoryId = await resolveCategory(tx, 'Ish haqi avansi', 'expense');
      await tx.transaction.create({
        data: {
          date,
          accountId: dto.accountId,
          type: 'expense',
          amount,
          categoryId,
          source: 'advance',
          refId: created.id,
          note: dto.note ?? `Avans: ${employee.fullName}`,
          userId,
        },
      });

      await this.audit.log(
        {
          userId,
          action: 'advance.create',
          entity: 'Advance',
          entityId: created.id,
          details: { employee: employee.fullName, amount: amount.toString() },
        },
        tx,
      );

      return created;
    });

    return this.prisma.advance.findUnique({
      where: { id: advance.id },
      include: ADVANCE_INCLUDE,
    });
  }
}
