import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { parsePeriod, type Period } from '../../common/period.util';
import { PrismaService } from '../../common/prisma/prisma.service';
import { FinanceService } from '../finance/finance.service';
import { monthRange } from '../hr/month.util';
import type { Report } from './report-export.util';

const ZERO = new Prisma.Decimal(0);

const DIRECTION_LABEL = { in: 'Kirim', out: 'Chiqim' } as const;
const STATUS_LABEL: Record<string, string> = {
  draft: 'Qoralama',
  confirmed: 'Tasdiqlangan',
  shipped: "Jo'natilgan",
  cancelled: 'Bekor qilingan',
};

/** FR-6.2: the seven reports; every query aggregates in SQL (NFR-12). */
@Injectable()
export class ReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly finance: FinanceService,
  ) {}

  /** 1) Financial report — income/expense by category. */
  async finance_(from?: string, to?: string): Promise<Report> {
    const period = parsePeriod(from, to);
    const rows = await this.prisma.transaction.groupBy({
      by: ['categoryId', 'type'],
      where: {
        source: { not: 'transfer' },
        date: { gte: period.start, lte: period.end },
      },
      _sum: { amount: true },
    });
    const categories = await this.prisma.txCategory.findMany({
      where: { id: { in: rows.map((r) => r.categoryId) } },
    });
    const nameById = new Map(categories.map((c) => [c.id, c.name]));

    const section = (type: 'income' | 'expense', title: string) => {
      const filtered = rows.filter((r) => r.type === type);
      const total = filtered.reduce(
        (acc, r) => acc.plus(r._sum.amount ?? ZERO),
        ZERO,
      );
      return {
        title,
        columns: [
          { key: 'category', label: 'Kategoriya' },
          { key: 'total', label: 'Summa', money: true },
        ],
        rows: [
          ...filtered
            .sort((a, b) =>
              (b._sum.amount ?? ZERO).comparedTo(a._sum.amount ?? ZERO),
            )
            .map((r) => ({
              category: nameById.get(r.categoryId) ?? `#${r.categoryId}`,
              total: (r._sum.amount ?? ZERO).toString(),
            })),
          { category: 'JAMI', total: total.toString() },
        ],
      };
    };

    return {
      slug: 'finance',
      title: 'Moliyaviy hisobot',
      period,
      sections: [section('income', 'Kirimlar'), section('expense', 'Chiqimlar')],
    };
  }

  /** 2) Sales report — orders with discounts. */
  async sales(from?: string, to?: string): Promise<Report> {
    const period = parsePeriod(from, to);
    const orders = await this.prisma.order.findMany({
      where: { createdAt: { gte: period.start, lte: period.end } },
      include: { customer: { select: { name: true } } },
      orderBy: { id: 'asc' },
    });
    const active = orders.filter(
      (o) => o.status === 'confirmed' || o.status === 'shipped',
    );
    const total = active.reduce((acc, o) => acc.plus(o.total), ZERO);
    const discount = active.reduce((acc, o) => acc.plus(o.discount), ZERO);

    return {
      slug: 'sales',
      title: 'Sotuvlar hisoboti',
      period,
      sections: [
        {
          title: 'Buyurtmalar',
          columns: [
            { key: 'number', label: 'Raqam' },
            { key: 'date', label: 'Sana' },
            { key: 'customer', label: 'Mijoz' },
            { key: 'status', label: 'Holat' },
            { key: 'subtotal', label: 'Oraliq jami', money: true },
            { key: 'discount', label: 'Chegirma', money: true },
            { key: 'total', label: 'Jami', money: true },
          ],
          rows: [
            ...orders.map((o) => ({
              number: o.number,
              date: formatDate(o.createdAt),
              customer: o.customer.name,
              status: STATUS_LABEL[o.status] ?? o.status,
              subtotal: o.subtotal.toString(),
              discount: o.discount.toString(),
              total: o.total.toString(),
            })),
            {
              number: 'JAMI (confirmed/shipped)',
              date: '',
              customer: '',
              status: '',
              subtotal: '',
              discount: discount.toString(),
              total: total.toString(),
            },
          ],
        },
      ],
    };
  }

  /** 3) Stock report — current stock and period movements per product. */
  async stock(from?: string, to?: string): Promise<Report> {
    const period = parsePeriod(from, to);
    const rows = await this.prisma.$queryRaw<
      Array<{
        name: string;
        sku: string;
        unit: string;
        incoming: Prisma.Decimal | null;
        outgoing: Prisma.Decimal | null;
        stock: Prisma.Decimal | null;
        avgCost: Prisma.Decimal;
        value: Prisma.Decimal | null;
      }>
    >(
      Prisma.sql`SELECT p."name", p."sku", p."unit",
                        SUM(CASE WHEN m."quantity" > 0 AND m."createdAt" >= ${period.start} AND m."createdAt" <= ${period.end} THEN m."quantity" ELSE 0 END) AS incoming,
                        SUM(CASE WHEN m."quantity" < 0 AND m."createdAt" >= ${period.start} AND m."createdAt" <= ${period.end} THEN -m."quantity" ELSE 0 END) AS outgoing,
                        SUM(m."quantity") AS stock,
                        p."avgCost",
                        SUM(m."quantity") * p."avgCost" AS value
                 FROM "Product" p
                 LEFT JOIN "StockMovement" m ON m."productId" = p."id"
                 WHERE p."isActive" = true
                 GROUP BY p."id", p."name", p."sku", p."unit", p."avgCost"
                 ORDER BY p."name"`,
    );

    return {
      slug: 'stock',
      title: 'Ombor hisoboti',
      period,
      sections: [
        {
          title: 'Qoldiqlar va davr harakatlari',
          columns: [
            { key: 'name', label: 'Mahsulot' },
            { key: 'sku', label: 'SKU' },
            { key: 'unit', label: 'Birlik' },
            { key: 'incoming', label: 'Davr kirimi', money: true },
            { key: 'outgoing', label: 'Davr chiqimi', money: true },
            { key: 'stock', label: 'Qoldiq', money: true },
            { key: 'avgCost', label: "O'rtacha tannarx", money: true },
            { key: 'value', label: 'Qiymat', money: true },
          ],
          rows: rows.map((r) => ({
            name: r.name,
            sku: r.sku,
            unit: r.unit,
            incoming: (r.incoming ?? ZERO).toString(),
            outgoing: (r.outgoing ?? ZERO).toString(),
            stock: (r.stock ?? ZERO).toString(),
            avgCost: r.avgCost.toString(),
            value: (r.value ?? ZERO).toString(),
          })),
        },
      ],
    };
  }

  /** 4) Debts report — debtors/creditors as of now (FR-3.7). */
  async debts(): Promise<Report> {
    const { debtors, creditors } = await this.finance.debts();
    const columns = [
      { key: 'name', label: 'Nomi' },
      { key: 'phone', label: 'Telefon' },
      { key: 'debt', label: 'Qarz', money: true },
    ];
    const toRows = (list: Array<{ name: string; phone: string | null; debt: string }>) => [
      ...list.map((d) => ({ name: d.name, phone: d.phone ?? '—', debt: d.debt })),
      {
        name: 'JAMI',
        phone: '',
        debt: list
          .reduce((acc, d) => acc.plus(new Prisma.Decimal(d.debt)), ZERO)
          .toString(),
      },
    ];
    return {
      slug: 'debts',
      title: 'Qarzdorlik hisoboti',
      sections: [
        { title: 'Qarzdor mijozlar (debitor)', columns, rows: toRows(debtors) },
        { title: 'Kreditorlar', columns, rows: toRows(creditors) },
      ],
    };
  }

  /** 5) Payments report — in/out payments by counterparty. */
  async payments(from?: string, to?: string): Promise<Report> {
    const period = parsePeriod(from, to);
    const payments = await this.prisma.payment.findMany({
      where: { date: { gte: period.start, lte: period.end } },
      include: {
        customer: { select: { name: true } },
        supplier: { select: { name: true } },
        order: { select: { number: true } },
        purchase: { select: { number: true } },
        account: { select: { name: true } },
      },
      orderBy: [{ date: 'asc' }, { id: 'asc' }],
    });
    const totalIn = payments
      .filter((p) => p.direction === 'in')
      .reduce((acc, p) => acc.plus(p.amount), ZERO);
    const totalOut = payments
      .filter((p) => p.direction === 'out')
      .reduce((acc, p) => acc.plus(p.amount), ZERO);

    return {
      slug: 'payments',
      title: "To'lovlar hisoboti",
      period,
      sections: [
        {
          title: "To'lovlar",
          columns: [
            { key: 'date', label: 'Sana' },
            { key: 'direction', label: "Yo'nalish" },
            { key: 'counterparty', label: 'Kontragent' },
            { key: 'doc', label: 'Hujjat' },
            { key: 'account', label: 'Hisob' },
            { key: 'amount', label: 'Summa', money: true },
          ],
          rows: [
            ...payments.map((p) => ({
              date: formatDate(p.date),
              direction: DIRECTION_LABEL[p.direction],
              counterparty: p.customer?.name ?? p.supplier?.name ?? '—',
              doc: p.order?.number ?? p.purchase?.number ?? '—',
              account: p.account.name,
              amount: p.amount.toString(),
            })),
            {
              date: 'JAMI',
              direction: '',
              counterparty: '',
              doc: '',
              account: `Kirim: ${totalIn.toString()}`,
              amount: totalIn.minus(totalOut).toString(),
            },
          ],
        },
      ],
    };
  }

  /** 6) Attendance report — per-employee counts for a month. */
  async attendance(month?: string): Promise<Report> {
    const m =
      month && /^\d{4}-(0[1-9]|1[0-2])$/.test(month)
        ? month
        : currentMonth();
    const { start, end } = monthRange(m);
    const [employees, counts] = await Promise.all([
      this.prisma.employee.findMany({
        where: { status: 'active' },
        select: { id: true, fullName: true },
        orderBy: { fullName: 'asc' },
      }),
      this.prisma.attendance.groupBy({
        by: ['employeeId', 'status'],
        where: { date: { gte: start, lt: end } },
        _count: { _all: true },
      }),
    ]);
    const countOf = (employeeId: number, status: string) =>
      counts.find((c) => c.employeeId === employeeId && c.status === status)
        ?._count._all ?? 0;

    return {
      slug: 'attendance',
      title: `Davomat hisoboti — ${m}`,
      sections: [
        {
          title: 'Xodimlar davomati',
          columns: [
            { key: 'fullName', label: 'F.I.Sh.' },
            { key: 'present', label: 'Keldi', align: 'right' },
            { key: 'absent', label: 'Kelmadi', align: 'right' },
            { key: 'vacation', label: "Ta'til", align: 'right' },
            { key: 'sick', label: 'Kasal', align: 'right' },
          ],
          rows: employees.map((e) => ({
            fullName: e.fullName,
            present: countOf(e.id, 'present'),
            absent: countOf(e.id, 'absent'),
            vacation: countOf(e.id, 'vacation'),
            sick: countOf(e.id, 'sick'),
          })),
        },
      ],
    };
  }

  /** 7) Profit report — gross profit by product and customer (FR-6.2). */
  async profit(from?: string, to?: string): Promise<Report> {
    const period = parsePeriod(from, to);
    const [byProduct, byCustomer] = await Promise.all([
      this.profitByProduct(period),
      this.profitByCustomer(period),
    ]);
    const columns = (nameLabel: string) => [
      { key: 'name', label: nameLabel },
      { key: 'revenue', label: 'Tushum', money: true },
      { key: 'cost', label: 'Tannarx', money: true },
      { key: 'profit', label: 'Yalpi foyda', money: true },
    ];
    return {
      slug: 'profit',
      title: 'Foyda hisoboti',
      period,
      sections: [
        {
          title: 'Mahsulot kesimida',
          columns: columns('Mahsulot'),
          rows: byProduct,
        },
        {
          title: 'Mijoz kesimida',
          columns: columns('Mijoz'),
          rows: byCustomer,
        },
      ],
    };
  }

  private async profitByProduct(period: Period) {
    const sold = await this.prisma.$queryRaw<
      Array<{ id: number; name: string; revenue: Prisma.Decimal; cost: Prisma.Decimal }>
    >(
      Prisma.sql`SELECT p."id", p."name",
                        SUM(oi."quantity" * oi."price") AS revenue,
                        SUM(oi."quantity" * oi."cost") AS cost
                 FROM "OrderItem" oi
                 JOIN "Order" o ON o."id" = oi."orderId"
                 JOIN "Product" p ON p."id" = oi."productId"
                 WHERE o."status" IN ('confirmed', 'shipped')
                   AND o."createdAt" >= ${period.start} AND o."createdAt" <= ${period.end}
                 GROUP BY p."id", p."name"`,
    );
    const returned = await this.prisma.$queryRaw<
      Array<{ id: number; revenue: Prisma.Decimal; cost: Prisma.Decimal }>
    >(
      Prisma.sql`SELECT sri."productId" AS id,
                        SUM(sri."quantity" * sri."price") AS revenue,
                        SUM(sri."quantity" * oi."cost") AS cost
                 FROM "SalesReturnItem" sri
                 JOIN "SalesReturn" sr ON sr."id" = sri."returnId"
                 JOIN "OrderItem" oi
                   ON oi."orderId" = sr."orderId" AND oi."productId" = sri."productId"
                 WHERE sr."date" >= ${period.start} AND sr."date" <= ${period.end}
                 GROUP BY sri."productId"`,
    );
    return mergeProfit(sold, returned);
  }

  private async profitByCustomer(period: Period) {
    const sold = await this.prisma.$queryRaw<
      Array<{ id: number; name: string; revenue: Prisma.Decimal; cost: Prisma.Decimal }>
    >(
      Prisma.sql`SELECT c."id", c."name",
                        SUM(oi."quantity" * oi."price") AS revenue,
                        SUM(oi."quantity" * oi."cost") AS cost
                 FROM "OrderItem" oi
                 JOIN "Order" o ON o."id" = oi."orderId"
                 JOIN "Customer" c ON c."id" = o."customerId"
                 WHERE o."status" IN ('confirmed', 'shipped')
                   AND o."createdAt" >= ${period.start} AND o."createdAt" <= ${period.end}
                 GROUP BY c."id", c."name"`,
    );
    const returned = await this.prisma.$queryRaw<
      Array<{ id: number; revenue: Prisma.Decimal; cost: Prisma.Decimal }>
    >(
      Prisma.sql`SELECT o."customerId" AS id,
                        SUM(sri."quantity" * sri."price") AS revenue,
                        SUM(sri."quantity" * oi."cost") AS cost
                 FROM "SalesReturnItem" sri
                 JOIN "SalesReturn" sr ON sr."id" = sri."returnId"
                 JOIN "Order" o ON o."id" = sr."orderId"
                 JOIN "OrderItem" oi
                   ON oi."orderId" = sr."orderId" AND oi."productId" = sri."productId"
                 WHERE sr."date" >= ${period.start} AND sr."date" <= ${period.end}
                 GROUP BY o."customerId"`,
    );
    return mergeProfit(sold, returned);
  }

  /** TASK-022: 8) transaction journal export. */
  async transactions(from?: string, to?: string): Promise<Report> {
    const period = parsePeriod(from, to);
    const rows = await this.prisma.transaction.findMany({
      where: { date: { gte: period.start, lte: period.end } },
      include: {
        account: { select: { name: true } },
        category: { select: { name: true } },
      },
      orderBy: [{ date: 'asc' }, { id: 'asc' }],
    });
    const income = rows
      .filter((r) => r.type === 'income')
      .reduce((acc, r) => acc.plus(r.amount), ZERO);
    const expense = rows
      .filter((r) => r.type === 'expense')
      .reduce((acc, r) => acc.plus(r.amount), ZERO);

    const SOURCE_LABEL: Record<string, string> = {
      manual: "Qo'lda",
      payment: "To'lov",
      salary: 'Ish haqi',
      advance: 'Avans',
      transfer: "O'tkazma",
    };

    return {
      slug: 'transactions',
      title: 'Tranzaksiyalar jurnali',
      period,
      sections: [
        {
          title: 'Tranzaksiyalar',
          columns: [
            { key: 'date', label: 'Sana' },
            { key: 'account', label: 'Hisob' },
            { key: 'category', label: 'Kategoriya' },
            { key: 'source', label: 'Manba' },
            { key: 'note', label: 'Izoh' },
            { key: 'income', label: 'Kirim', money: true },
            { key: 'expense', label: 'Chiqim', money: true },
          ],
          rows: [
            ...rows.map((r) => ({
              date: formatDate(r.date),
              account: r.account.name,
              category: r.category.name,
              source: SOURCE_LABEL[r.source] ?? r.source,
              note: r.note ?? '',
              income: r.type === 'income' ? r.amount.toString() : '',
              expense: r.type === 'expense' ? r.amount.toString() : '',
            })),
            {
              date: 'JAMI',
              account: '',
              category: '',
              source: '',
              note: '',
              income: income.toString(),
              expense: expense.toString(),
            },
          ],
        },
      ],
    };
  }

  /** TASK-022: 9) payroll sheet export (latest month by default). */
  async payroll(month?: string): Promise<Report> {
    const target = month ?? currentMonth();
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(target)) {
      throw new BadRequestException("Oy formati noto'g'ri (YYYY-MM)");
    }
    const payroll = await this.prisma.payroll.findFirst({
      where: month ? { month: target } : {},
      orderBy: { month: 'desc' },
      include: {
        items: {
          include: { employee: { select: { fullName: true } } },
          orderBy: { id: 'asc' },
        },
      },
    });
    if (!payroll) {
      throw new BadRequestException('Vedomost topilmadi');
    }

    return {
      slug: 'payroll',
      title: `Ish haqi vedomosti — ${payroll.month}`,
      period: monthRange(payroll.month),
      sections: [
        {
          title: 'Xodimlar',
          columns: [
            { key: 'employee', label: 'Xodim' },
            { key: 'baseSalary', label: 'Bazaviy maosh', money: true },
            { key: 'bonus', label: 'Bonus', money: true },
            { key: 'penalty', label: 'Jarima', money: true },
            { key: 'advance', label: 'Avans', money: true },
            { key: 'amount', label: "To'lanadigan", money: true },
          ],
          rows: [
            ...payroll.items.map((i) => ({
              employee: i.employee.fullName,
              baseSalary: i.baseSalary.toString(),
              bonus: i.bonus.toString(),
              penalty: i.penalty.toString(),
              advance: i.advance.toString(),
              amount: i.amount.toString(),
            })),
            {
              employee: 'JAMI',
              baseSalary: '',
              bonus: '',
              penalty: '',
              advance: '',
              amount: payroll.total.toString(),
            },
          ],
        },
      ],
    };
  }
}

function mergeProfit(
  sold: Array<{ id: number; name: string; revenue: Prisma.Decimal; cost: Prisma.Decimal }>,
  returned: Array<{ id: number; revenue: Prisma.Decimal; cost: Prisma.Decimal }>,
) {
  const returnedById = new Map(returned.map((r) => [r.id, r]));
  const rows = sold.map((s) => {
    const r = returnedById.get(s.id);
    const revenue = new Prisma.Decimal(s.revenue).minus(r?.revenue ?? 0);
    const cost = new Prisma.Decimal(s.cost).minus(r?.cost ?? 0);
    return {
      name: s.name,
      revenue,
      cost,
      profit: revenue.minus(cost),
    };
  });
  rows.sort((a, b) => b.profit.comparedTo(a.profit));
  const total = rows.reduce(
    (acc, r) => ({
      revenue: acc.revenue.plus(r.revenue),
      cost: acc.cost.plus(r.cost),
      profit: acc.profit.plus(r.profit),
    }),
    { revenue: ZERO, cost: ZERO, profit: ZERO },
  );
  return [
    ...rows.map((r) => ({
      name: r.name,
      revenue: r.revenue.toString(),
      cost: r.cost.toString(),
      profit: r.profit.toString(),
    })),
    {
      name: 'JAMI',
      revenue: total.revenue.toString(),
      cost: total.cost.toString(),
      profit: total.profit.toString(),
    },
  ];
}

function formatDate(d: Date): string {
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${dd}.${mm}.${d.getFullYear()}`;
}

function currentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

export function assertFormat(format?: string): 'json' | 'xlsx' | 'pdf' {
  if (!format || format === 'json') return 'json';
  if (format === 'xlsx' || format === 'pdf') return format;
  throw new BadRequestException("Format noto'g'ri (xlsx|pdf)");
}
