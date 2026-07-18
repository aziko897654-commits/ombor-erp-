import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  parsePeriod,
  previousPeriod,
  type Period,
} from '../../common/period.util';
import { PrismaService } from '../../common/prisma/prisma.service';
import { FinanceService } from '../finance/finance.service';
import { ProductsService } from '../products/products.service';

const ZERO = new Prisma.Decimal(0);

/** FR-5: director dashboard — all numbers aggregated in SQL (NFR-12). */
@Injectable()
export class DashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly finance: FinanceService,
    private readonly products: ProductsService,
  ) {}

  async summary(from?: string, to?: string) {
    const period = parsePeriod(from, to);
    const previous = previousPeriod(period);

    const [
      flow,
      prevFlow,
      cashNow,
      cashPrev,
      debts,
      grossProfit,
      prevGrossProfit,
      opex,
      prevOpex,
      stockValue,
      openDeals,
      activeEmployees,
      lowStock,
    ] = await Promise.all([
      this.flow(period),
      this.flow(previous),
      this.cashAt(period.end),
      this.cashAt(previous.end),
      this.finance.debts(),
      this.grossProfit(period),
      this.grossProfit(previous),
      this.operatingExpenses(period),
      this.operatingExpenses(previous),
      this.stockValue(),
      this.prisma.deal.aggregate({
        where: { stage: { in: ['new', 'negotiation'] } },
        _count: { _all: true },
        _sum: { amount: true },
      }),
      this.prisma.employee.count({ where: { status: 'active' } }),
      this.products.findLowStock(),
    ]);

    const receivables = debts.debtors.reduce(
      (acc, d) => acc.plus(new Prisma.Decimal(d.debt)),
      ZERO,
    );
    const payables = debts.creditors.reduce(
      (acc, d) => acc.plus(new Prisma.Decimal(d.debt)),
      ZERO,
    );
    // TASK-002: Net Profit = Gross Profit − operating expenses (accrual),
    // NOT income − expense (that is cash flow and can exceed gross profit).
    const profit = grossProfit.minus(opex);
    const prevProfit = prevGrossProfit.minus(prevOpex);

    return {
      period: { from: period.start, to: period.end },
      kpi: {
        income: {
          value: flow.income.toString(),
          change: percentChange(flow.income, prevFlow.income),
        },
        expense: {
          value: flow.expense.toString(),
          change: percentChange(flow.expense, prevFlow.expense),
        },
        profit: {
          value: profit.toString(),
          change: percentChange(profit, prevProfit),
        },
        cash: {
          value: cashNow.toString(),
          change: percentChange(cashNow, cashPrev),
        },
      },
      cards: {
        receivables: receivables.toString(),
        payables: payables.toString(),
        grossProfit: grossProfit.toString(),
        stockValue: stockValue.toString(),
        openDealsCount: openDeals._count._all,
        openDealsTotal: (openDeals._sum.amount ?? ZERO).toString(),
        activeEmployees,
        lowStockCount: lowStock.length,
      },
    };
  }

  async charts(from?: string, to?: string) {
    const period = parsePeriod(from, to);
    const [monthly, funnel, topProducts] = await Promise.all([
      this.monthlyFlow(),
      this.dealsFunnel(),
      this.topProducts(period),
    ]);
    return { monthly, funnel, topProducts };
  }

  /** Invariant 9: transfers stay out of income/expense KPIs. */
  private async flow(period: Period) {
    const rows = await this.prisma.transaction.groupBy({
      by: ['type'],
      where: {
        source: { not: 'transfer' },
        date: { gte: period.start, lte: period.end },
      },
      _sum: { amount: true },
    });
    return {
      income: rows.find((r) => r.type === 'income')?._sum.amount ?? ZERO,
      expense: rows.find((r) => r.type === 'expense')?._sum.amount ?? ZERO,
    };
  }

  /**
   * TASK-002: operating expenses for Net Profit — expense transactions
   * excluding transfers (invariant 9) and excluding the two categories
   * already reflected in gross profit: product purchases (become COGS
   * when sold) and customer refunds (mirrored by sales returns).
   */
  private async operatingExpenses(period: Period): Promise<Prisma.Decimal> {
    const [row] = await this.prisma.$queryRaw<Array<{ total: Prisma.Decimal | null }>>(
      Prisma.sql`SELECT SUM(t."amount") AS total
                 FROM "Transaction" t
                 JOIN "TxCategory" c ON c."id" = t."categoryId"
                 WHERE t."type" = 'expense'
                   AND t."source" != 'transfer'
                   AND c."name" NOT IN ('Mahsulot xaridi', 'Mijozga pul qaytarish')
                   AND t."date" >= ${period.start} AND t."date" <= ${period.end}`,
    );
    return new Prisma.Decimal(row?.total ?? 0);
  }

  /** Cash+bank total as of a date (transfers cancel out in the sum). */
  private async cashAt(date: Date): Promise<Prisma.Decimal> {
    const [openings, sums] = await Promise.all([
      this.prisma.account.aggregate({ _sum: { openingBalance: true } }),
      this.prisma.transaction.groupBy({
        by: ['type'],
        where: { date: { lte: date } },
        _sum: { amount: true },
      }),
    ]);
    const income = sums.find((s) => s.type === 'income')?._sum.amount ?? ZERO;
    const expense = sums.find((s) => s.type === 'expense')?._sum.amount ?? ZERO;
    return (openings._sum.openingBalance ?? ZERO).plus(income).minus(expense);
  }

  /** FR-5.3: Σ(price − OrderItem.cost) × qty, minus sales returns. */
  private async grossProfit(period: Period): Promise<Prisma.Decimal> {
    const [sold] = await this.prisma.$queryRaw<Array<{ total: Prisma.Decimal | null }>>(
      Prisma.sql`SELECT SUM((oi."price" - oi."cost") * oi."quantity") AS total
                 FROM "OrderItem" oi
                 JOIN "Order" o ON o."id" = oi."orderId"
                 WHERE o."status" IN ('confirmed', 'shipped')
                   AND o."createdAt" >= ${period.start}
                   AND o."createdAt" <= ${period.end}`,
    );
    const [returned] = await this.prisma.$queryRaw<Array<{ total: Prisma.Decimal | null }>>(
      Prisma.sql`SELECT SUM((sri."price" - oi."cost") * sri."quantity") AS total
                 FROM "SalesReturnItem" sri
                 JOIN "SalesReturn" sr ON sr."id" = sri."returnId"
                 JOIN "OrderItem" oi
                   ON oi."orderId" = sr."orderId" AND oi."productId" = sri."productId"
                 WHERE sr."date" >= ${period.start} AND sr."date" <= ${period.end}`,
    );
    return new Prisma.Decimal(sold?.total ?? 0).minus(
      new Prisma.Decimal(returned?.total ?? 0),
    );
  }

  /** FR-5.3: stock value = Σ(total stock × avgCost). */
  private async stockValue(): Promise<Prisma.Decimal> {
    const [row] = await this.prisma.$queryRaw<Array<{ total: Prisma.Decimal | null }>>(
      Prisma.sql`SELECT SUM(s."qty" * p."avgCost") AS total FROM (
                   SELECT "productId", SUM("quantity") AS qty
                   FROM "StockMovement" GROUP BY "productId"
                 ) s JOIN "Product" p ON p."id" = s."productId"
                 WHERE s."qty" > 0`,
    );
    return new Prisma.Decimal(row?.total ?? 0);
  }

  /** FR-5.4: last 12 months income/expense (transfer excluded). */
  private async monthlyFlow() {
    const start = new Date();
    start.setMonth(start.getMonth() - 11, 1);
    start.setHours(0, 0, 0, 0);

    const rows = await this.prisma.$queryRaw<
      Array<{ month: Date; type: string; total: Prisma.Decimal }>
    >(
      Prisma.sql`SELECT date_trunc('month', "date") AS month, "type"::text AS type,
                        SUM("amount") AS total
                 FROM "Transaction"
                 WHERE "source" != 'transfer' AND "date" >= ${start}
                 GROUP BY 1, 2 ORDER BY 1`,
    );

    const months: Array<{ month: string; income: string; expense: string }> = [];
    const cursor = new Date(start);
    for (let i = 0; i < 12; i++) {
      const key = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}`;
      const income = rows.find(
        (r) => monthKey(r.month) === key && r.type === 'income',
      );
      const expense = rows.find(
        (r) => monthKey(r.month) === key && r.type === 'expense',
      );
      months.push({
        month: key,
        income: (income?.total ?? ZERO).toString(),
        expense: (expense?.total ?? ZERO).toString(),
      });
      cursor.setMonth(cursor.getMonth() + 1);
    }
    return months;
  }

  private async dealsFunnel() {
    const rows = await this.prisma.deal.groupBy({
      by: ['stage'],
      _count: { _all: true },
      _sum: { amount: true },
    });
    return (['new', 'negotiation', 'won', 'lost'] as const).map((stage) => {
      const row = rows.find((r) => r.stage === stage);
      return {
        stage,
        count: row?._count._all ?? 0,
        total: (row?._sum.amount ?? ZERO).toString(),
      };
    });
  }

  /** FR-5.4: top-5 products by revenue in the selected period. */
  private async topProducts(period: Period) {
    const rows = await this.prisma.$queryRaw<
      Array<{ id: number; name: string; quantity: Prisma.Decimal; revenue: Prisma.Decimal }>
    >(
      Prisma.sql`SELECT p."id", p."name", SUM(oi."quantity") AS quantity,
                        SUM(oi."quantity" * oi."price") AS revenue
                 FROM "OrderItem" oi
                 JOIN "Order" o ON o."id" = oi."orderId"
                 JOIN "Product" p ON p."id" = oi."productId"
                 WHERE o."status" IN ('confirmed', 'shipped')
                   AND o."createdAt" >= ${period.start}
                   AND o."createdAt" <= ${period.end}
                 GROUP BY p."id", p."name"
                 ORDER BY revenue DESC LIMIT 5`,
    );
    return rows.map((r) => ({
      productId: r.id,
      name: r.name,
      quantity: r.quantity.toString(),
      revenue: r.revenue.toString(),
    }));
  }
}

function percentChange(
  current: Prisma.Decimal,
  previous: Prisma.Decimal,
): number | null {
  if (previous.isZero()) return null;
  return Number(
    current.minus(previous).dividedBy(previous.abs()).times(100).toFixed(1),
  );
}

function monthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}
