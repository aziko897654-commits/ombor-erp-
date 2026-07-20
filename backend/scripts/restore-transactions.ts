/**
 * One-off recovery: the Transaction journal was wiped by a test-suite
 * afterAll that ran with undefined ids after its beforeAll failed
 * (Prisma treats `in: undefined` as "no filter"). Source documents
 * (payments, advances, payroll, money transfers) survived, so their
 * journal rows are rebuilt 1:1; the seed's scattered manual history is
 * re-created from the same formulas seed.ts uses.
 *
 * Run: npx ts-node --transpile-only scripts/restore-transactions.ts
 * Safe to run only when the journal is empty — aborts otherwise.
 */
import { PrismaClient, Prisma, TxType } from '@prisma/client';

const prisma = new PrismaClient();
const D = (n: number | string) => new Prisma.Decimal(n);

function daysAgo(days: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - days);
  d.setHours(11, 0, 0, 0);
  return d;
}
function monthsAgo(months: number, day = 10): Date {
  const d = new Date();
  d.setMonth(d.getMonth() - months, day);
  d.setHours(11, 0, 0, 0);
  return d;
}

async function catOf(name: string, type: TxType): Promise<number> {
  const found = await prisma.txCategory.findFirst({ where: { name, type } });
  if (found) return found.id;
  return (await prisma.txCategory.create({ data: { name, type } })).id;
}

async function main() {
  const existing = await prisma.transaction.count();
  if (existing > 0) {
    console.error(`Jurnal bo'sh emas (${existing} ta yozuv) — bekor qilindi.`);
    process.exit(1);
  }
  const admin = await prisma.user.findFirstOrThrow({ where: { role: 'admin' } });
  const kassa = await prisma.account.findFirstOrThrow({ where: { type: 'cash' } });
  const bank = await prisma.account.findFirstOrThrow({ where: { type: 'bank' } });

  const catSale = await catOf('Savdo tushumi', 'income');
  const catPurchase = await catOf('Mahsulot xaridi', 'expense');
  const catRent = await catOf('Ijara', 'expense');
  const catUtility = await catOf('Kommunal', 'expense');
  const catOtherIncome = await catOf('Boshqa', 'income');
  const catRefundOut = await catOf('Mijozga pul qaytarish', 'expense');
  const catSupplierRefund = await catOf('Yetkazib beruvchidan qaytarim', 'income');
  const catSalary = await catOf('Ish haqi', 'expense');
  const catAdvance = await catOf('Ish haqi avansi', 'expense');
  const catTransferExp = await catOf("Hisoblararo o'tkazma", 'expense');
  const catTransferInc = await catOf("Hisoblararo o'tkazma", 'income');

  let created = 0;

  // 1) payments → source=payment (mirrors payments.service CATEGORY_BY_COMBO)
  const payments = await prisma.payment.findMany({ orderBy: { id: 'asc' } });
  for (const p of payments) {
    const isCustomer = p.customerId != null;
    const type: TxType = p.direction === 'in' ? 'income' : 'expense';
    const categoryId = isCustomer
      ? p.direction === 'in'
        ? catSale
        : catRefundOut
      : p.direction === 'in'
        ? catSupplierRefund
        : catPurchase;
    await prisma.transaction.create({
      data: {
        date: p.date,
        accountId: p.accountId,
        type,
        amount: p.amount,
        categoryId,
        source: 'payment',
        refId: p.id,
        note: p.note,
        userId: p.userId,
      },
    });
    created++;
  }

  // 2) advances → source=advance
  const advances = await prisma.advance.findMany({ orderBy: { id: 'asc' } });
  for (const a of advances) {
    const employee = await prisma.employee.findUnique({
      where: { id: a.employeeId },
      select: { fullName: true },
    });
    await prisma.transaction.create({
      data: {
        date: a.date,
        accountId: a.accountId,
        type: 'expense',
        amount: a.amount,
        categoryId: catAdvance,
        source: 'advance',
        refId: a.id,
        note: a.note ?? `Avans: ${employee?.fullName ?? a.employeeId}`,
        userId: a.userId,
      },
    });
    created++;
  }

  // 3) payrolls → source=salary (seed booked it on the bank account,
  //    dated the 1st of the following month)
  const payrolls = await prisma.payroll.findMany({ orderBy: { id: 'asc' } });
  for (const pr of payrolls) {
    const [y, m] = pr.month.split('-').map(Number);
    const txDate = new Date(y, m, 1, 11, 0, 0, 0);
    await prisma.transaction.create({
      data: {
        date: txDate,
        accountId: bank.id,
        type: 'expense',
        amount: pr.total,
        categoryId: catSalary,
        source: 'salary',
        refId: pr.id,
        note: `Ish haqi vedomosti: ${pr.month}`,
        userId: admin.id,
      },
    });
    created++;
  }

  // 4) money transfers → paired source=transfer rows
  const transfers = await prisma.moneyTransfer.findMany({
    orderBy: { id: 'asc' },
  });
  for (const t of transfers) {
    await prisma.transaction.createMany({
      data: [
        {
          date: t.date,
          accountId: t.fromAccountId,
          type: 'expense',
          amount: t.amount,
          categoryId: catTransferExp,
          source: 'transfer',
          refId: t.id,
          note: t.note,
          userId: t.userId,
        },
        {
          date: t.date,
          accountId: t.toAccountId,
          type: 'income',
          amount: t.amount,
          categoryId: catTransferInc,
          source: 'transfer',
          refId: t.id,
          note: t.note,
          userId: t.userId,
        },
      ],
    });
    created += 2;
  }

  // 5) the seed's 6-month manual history (same formulas as seed.ts)
  for (let m = 5; m >= 0; m--) {
    await prisma.transaction.create({
      data: {
        date: monthsAgo(m, 3),
        accountId: kassa.id,
        type: 'income',
        amount: D(7_500_000 + m * 300_000),
        categoryId: catSale,
        source: 'manual',
        note: 'Chakana savdo tushumi',
        userId: admin.id,
      },
    });
    await prisma.transaction.create({
      data: {
        date: monthsAgo(m, 5),
        accountId: bank.id,
        type: 'expense',
        amount: D(1_500_000),
        categoryId: catRent,
        source: 'manual',
        note: 'Ofis ijarasi',
        userId: admin.id,
      },
    });
    await prisma.transaction.create({
      data: {
        date: monthsAgo(m, 7),
        accountId: kassa.id,
        type: 'expense',
        amount: D(350_000 + m * 20_000),
        categoryId: catUtility,
        source: 'manual',
        note: 'Kommunal xizmatlar',
        userId: admin.id,
      },
    });
    created += 3;
    if (m % 2 === 0) {
      await prisma.transaction.create({
        data: {
          date: monthsAgo(m, 18),
          accountId: kassa.id,
          type: 'income',
          amount: D(400_000 + m * 50_000),
          categoryId: catOtherIncome,
          source: 'manual',
          note: 'Boshqa tushum',
          userId: admin.id,
        },
      });
      created++;
    }
  }

  console.log(`Tiklandi: ${created} ta tranzaksiya`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
