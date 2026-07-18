import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuditService } from '../../common/audit/audit.service';
import { parsePeriod, periodLabel } from '../../common/period.util';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AccountsService } from './accounts.service';
import { resolveCategory } from './categories.util';
import { CreateTransferDto } from './dto/finance.dto';

const ZERO = new Prisma.Decimal(0);

const TRANSFER_INCLUDE = {
  fromAccount: { select: { id: true, name: true } },
  toAccount: { select: { id: true, name: true } },
} satisfies Prisma.MoneyTransferInclude;

interface DebtRow {
  id: number;
  name: string;
  phone: string | null;
  debt: string;
}

@Injectable()
export class FinanceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly accounts: AccountsService,
    private readonly audit: AuditService,
  ) {}

  /**
   * FR-3.4: per-account balances (all-time) + period cash flow.
   * Invariant 9: source=transfer stays OUT of the flow numbers —
   * it only affects account balances.
   * TASK-003: without from/to the flow defaults to the current month —
   * the same period logic the dashboard uses — and the period is
   * returned so the UI can label the flow cards.
   */
  async balance(from?: string, to?: string) {
    const period = parsePeriod(from, to);

    const [accounts, flows] = await Promise.all([
      this.accounts.findAll(),
      this.prisma.transaction.groupBy({
        by: ['type'],
        where: {
          source: { not: 'transfer' },
          date: { gte: period.start, lte: period.end },
        },
        _sum: { amount: true },
      }),
    ]);

    const income =
      flows.find((f) => f.type === 'income')?._sum.amount ?? ZERO;
    const expense =
      flows.find((f) => f.type === 'expense')?._sum.amount ?? ZERO;
    const total = accounts.reduce(
      (acc, a) => acc.plus(new Prisma.Decimal(a.balance)),
      ZERO,
    );

    return {
      accounts,
      total: total.toString(),
      period: {
        from: period.start,
        to: period.end,
        label: periodLabel(period),
      },
      flow: {
        income: income.toString(),
        expense: expense.toString(),
        net: income.minus(expense).toString(),
      },
    };
  }

  /** FR-3.7: debtors (customers) and creditors (suppliers), desc by debt. */
  async debts() {
    const [debtors, creditors] = await Promise.all([
      this.customerDebts(),
      this.supplierDebts(),
    ]);
    return { debtors, creditors };
  }

  private async customerDebts(): Promise<DebtRow[]> {
    const [orders, returns, payments] = await Promise.all([
      this.prisma.order.groupBy({
        by: ['customerId'],
        where: { status: { in: ['confirmed', 'shipped'] } },
        _sum: { total: true },
      }),
      this.prisma.$queryRaw<Array<{ id: number; total: Prisma.Decimal }>>(
        Prisma.sql`SELECT o."customerId" AS id, SUM(sr."total") AS total
                   FROM "SalesReturn" sr
                   JOIN "Order" o ON o."id" = sr."orderId"
                   GROUP BY o."customerId"`,
      ),
      this.prisma.payment.groupBy({
        by: ['customerId', 'direction'],
        where: { customerId: { not: null } },
        _sum: { amount: true },
      }),
    ]);

    const debtById = new Map<number, Prisma.Decimal>();
    const add = (id: number, delta: Prisma.Decimal) => {
      debtById.set(id, (debtById.get(id) ?? ZERO).plus(delta));
    };
    for (const o of orders) add(o.customerId, o._sum.total ?? ZERO);
    for (const r of returns) add(r.id, new Prisma.Decimal(r.total).negated());
    for (const p of payments) {
      const amount = p._sum.amount ?? ZERO;
      add(p.customerId!, p.direction === 'in' ? amount.negated() : amount);
    }

    return this.toDebtRows(debtById, 'customer');
  }

  private async supplierDebts(): Promise<DebtRow[]> {
    const [purchases, returns, payments] = await Promise.all([
      this.prisma.purchase.groupBy({
        by: ['supplierId'],
        _sum: { total: true },
      }),
      this.prisma.$queryRaw<Array<{ id: number; total: Prisma.Decimal }>>(
        Prisma.sql`SELECT p."supplierId" AS id, SUM(pr."total") AS total
                   FROM "PurchaseReturn" pr
                   JOIN "Purchase" p ON p."id" = pr."purchaseId"
                   GROUP BY p."supplierId"`,
      ),
      this.prisma.payment.groupBy({
        by: ['supplierId', 'direction'],
        where: { supplierId: { not: null } },
        _sum: { amount: true },
      }),
    ]);

    const debtById = new Map<number, Prisma.Decimal>();
    const add = (id: number, delta: Prisma.Decimal) => {
      debtById.set(id, (debtById.get(id) ?? ZERO).plus(delta));
    };
    for (const p of purchases) add(p.supplierId, p._sum.total ?? ZERO);
    for (const r of returns) add(r.id, new Prisma.Decimal(r.total).negated());
    for (const p of payments) {
      const amount = p._sum.amount ?? ZERO;
      add(p.supplierId!, p.direction === 'out' ? amount.negated() : amount);
    }

    return this.toDebtRows(debtById, 'supplier');
  }

  private async toDebtRows(
    debtById: Map<number, Prisma.Decimal>,
    entity: 'customer' | 'supplier',
  ): Promise<DebtRow[]> {
    const withDebt = [...debtById.entries()].filter(([, debt]) =>
      debt.greaterThan(0),
    );
    if (withDebt.length === 0) return [];

    const ids = withDebt.map(([id]) => id);
    const parties =
      entity === 'customer'
        ? await this.prisma.customer.findMany({
            where: { id: { in: ids } },
            select: { id: true, name: true, phone: true },
          })
        : await this.prisma.supplier.findMany({
            where: { id: { in: ids } },
            select: { id: true, name: true, phone: true },
          });
    const byId = new Map(parties.map((p) => [p.id, p]));

    return withDebt
      .sort(([, a], [, b]) => b.comparedTo(a))
      .map(([id, debt]) => ({
        id,
        name: byId.get(id)?.name ?? `#${id}`,
        phone: byId.get(id)?.phone ?? null,
        debt: debt.toString(),
      }));
  }

  // --- FR-3.9: transfers between accounts ---

  async listTransfers(page: number, limit: number, sort?: 'asc' | 'desc') {
    const [transfers, total] = await this.prisma.$transaction([
      this.prisma.moneyTransfer.findMany({
        include: TRANSFER_INCLUDE,
        orderBy: sort ? { createdAt: sort } : [{ date: 'desc' }, { id: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.moneyTransfer.count(),
    ]);
    return { data: transfers, meta: { page, limit, total } };
  }

  /**
   * One DB transaction: MoneyTransfer + two Transactions
   * (expense on from, income on to), both source=transfer with a
   * shared refId. The source account balance is checked under an
   * advisory lock so parallel transfers cannot overdraw it.
   */
  async createTransfer(dto: CreateTransferDto, userId: number) {
    if (dto.fromAccountId === dto.toAccountId) {
      throw new BadRequestException(
        "Chiquvchi va kiruvchi hisob bir xil bo'lishi mumkin emas",
      );
    }
    const [fromAccount, toAccount] = await Promise.all([
      this.prisma.account.findUnique({ where: { id: dto.fromAccountId } }),
      this.prisma.account.findUnique({ where: { id: dto.toAccountId } }),
    ]);
    if (!fromAccount) throw new NotFoundException('Chiquvchi hisob topilmadi');
    if (!toAccount) throw new NotFoundException('Kiruvchi hisob topilmadi');

    const amount = new Prisma.Decimal(dto.amount);
    const date = dto.date ? new Date(dto.date) : new Date();

    const transfer = await this.prisma.$transaction(async (tx) => {
      // TASK-001: same negative-balance policy as manual expenses/payments
      await this.accounts.assertCanSpend(
        tx,
        dto.fromAccountId,
        amount,
        dto.force ?? false,
      );

      const created = await tx.moneyTransfer.create({
        data: {
          date,
          fromAccountId: dto.fromAccountId,
          toAccountId: dto.toAccountId,
          amount,
          note: dto.note,
          userId,
        },
      });

      const note =
        dto.note ?? `O'tkazma: ${fromAccount.name} → ${toAccount.name}`;
      // sequential on purpose: interactive tx clients must not run
      // concurrent queries (Prisma limitation)
      const expenseCat = await resolveCategory(
        tx,
        "Hisoblararo o'tkazma",
        'expense',
      );
      const incomeCat = await resolveCategory(
        tx,
        "Hisoblararo o'tkazma",
        'income',
      );
      await tx.transaction.createMany({
        data: [
          {
            date,
            accountId: dto.fromAccountId,
            type: 'expense',
            amount,
            categoryId: expenseCat,
            source: 'transfer',
            refId: created.id,
            note,
            userId,
          },
          {
            date,
            accountId: dto.toAccountId,
            type: 'income',
            amount,
            categoryId: incomeCat,
            source: 'transfer',
            refId: created.id,
            note,
            userId,
          },
        ],
      });

      await this.audit.log(
        {
          userId,
          action: 'transfer.create',
          entity: 'MoneyTransfer',
          entityId: created.id,
          details: {
            from: fromAccount.name,
            to: toAccount.name,
            amount: amount.toString(),
          },
        },
        tx,
      );

      return created;
    });

    return this.prisma.moneyTransfer.findUnique({
      where: { id: transfer.id },
      include: TRANSFER_INCLUDE,
    });
  }
}
