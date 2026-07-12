import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuditService } from '../../common/audit/audit.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { resolveCategory } from '../finance/categories.util';
import { CreatePayrollDto } from './dto/hr.dto';
import { monthRange } from './month.util';

const ZERO = new Prisma.Decimal(0);

/**
 * FR-4.5: payroll sheet — base + bonus − penalty − advances = net per
 * active employee; ONE expense transaction (source=salary, "Ish haqi",
 * amount = total net) in the same DB transaction. One sheet per month.
 */
@Injectable()
export class PayrollService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async findAll(page: number, limit: number) {
    const [payrolls, total] = await this.prisma.$transaction([
      this.prisma.payroll.findMany({
        include: { _count: { select: { items: true } } },
        orderBy: { month: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.payroll.count(),
    ]);
    return { data: payrolls, meta: { page, limit, total } };
  }

  async findOne(id: number) {
    const payroll = await this.prisma.payroll.findUnique({
      where: { id },
      include: {
        items: {
          include: {
            employee: {
              select: {
                id: true,
                fullName: true,
                position: { select: { name: true } },
              },
            },
          },
          orderBy: { id: 'asc' },
        },
      },
    });
    if (!payroll) throw new NotFoundException('Vedomost topilmadi');
    return payroll;
  }

  /** Active employees + auto-deducted month advances (FR-4.4). */
  async preview(month: string) {
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
      throw new BadRequestException("Oy formati noto'g'ri (YYYY-MM)");
    }
    const existing = await this.prisma.payroll.findUnique({
      where: { month },
    });
    if (existing) {
      throw new ConflictException(
        `${month} oyi uchun vedomost allaqachon yaratilgan (FR-4.5)`,
      );
    }

    const rows = await this.buildRows(month);
    return { month, rows };
  }

  async create(dto: CreatePayrollDto, userId: number) {
    const account = await this.prisma.account.findUnique({
      where: { id: dto.accountId },
    });
    if (!account) throw new NotFoundException('Hisob topilmadi');

    const rows = await this.buildRows(dto.month);
    if (rows.length === 0) {
      throw new BadRequestException("Faol xodimlar yo'q — vedomost bo'sh");
    }

    const inputByEmployee = new Map(
      (dto.items ?? []).map((i) => [i.employeeId, i]),
    );

    const items = rows.map((row) => {
      const input = inputByEmployee.get(row.employeeId);
      const bonus = new Prisma.Decimal(input?.bonus ?? 0);
      const penalty = new Prisma.Decimal(input?.penalty ?? 0);
      const amount = row.baseSalary
        .plus(bonus)
        .minus(penalty)
        .minus(row.advance);
      return {
        employeeId: row.employeeId,
        baseSalary: row.baseSalary,
        bonus,
        penalty,
        advance: row.advance,
        amount,
      };
    });
    const total = items.reduce((acc, i) => acc.plus(i.amount), ZERO);

    const payroll = await this.prisma
      .$transaction(async (tx) => {
        const created = await tx.payroll.create({
          data: {
            month: dto.month,
            total,
            items: { create: items },
          },
        });

        const categoryId = await resolveCategory(tx, 'Ish haqi', 'expense');
        await tx.transaction.create({
          data: {
            accountId: dto.accountId,
            type: 'expense',
            amount: total,
            categoryId,
            source: 'salary',
            refId: created.id,
            note: `Ish haqi vedomosti: ${dto.month}`,
            userId,
          },
        });

        await this.audit.log(
          {
            userId,
            action: 'payroll.create',
            entity: 'Payroll',
            entityId: created.id,
            details: {
              month: dto.month,
              total: total.toString(),
              employees: items.length,
            },
          },
          tx,
        );

        return created;
      })
      .catch((e) => {
        // unique month: a concurrent create won the race (FR-4.5)
        if (
          e instanceof Prisma.PrismaClientKnownRequestError &&
          e.code === 'P2002'
        ) {
          throw new ConflictException(
            `${dto.month} oyi uchun vedomost allaqachon yaratilgan (FR-4.5)`,
          );
        }
        throw e;
      });

    return this.findOne(payroll.id);
  }

  /** FR-4.6: only active employees enter the sheet. */
  private async buildRows(month: string) {
    const { start, end } = monthRange(month);
    const [employees, advances] = await Promise.all([
      this.prisma.employee.findMany({
        where: { status: 'active' },
        select: { id: true, fullName: true, salary: true },
        orderBy: { fullName: 'asc' },
      }),
      this.prisma.advance.groupBy({
        by: ['employeeId'],
        where: { date: { gte: start, lt: end } },
        _sum: { amount: true },
      }),
    ]);
    const advanceByEmployee = new Map(
      advances.map((a) => [a.employeeId, a._sum.amount ?? ZERO]),
    );
    return employees.map((e) => ({
      employeeId: e.id,
      fullName: e.fullName,
      baseSalary: e.salary,
      advance: advanceByEmployee.get(e.id) ?? ZERO,
    }));
  }
}
