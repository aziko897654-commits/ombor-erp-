/**
 * One-off correction: restore-transactions.ts dated the salary
 * expense using `new Date(y, m, 1)` on the payroll's `month` field
 * ("2026-06" → JS month index 6 = July, an off-by-one since JS
 * Date months are 0-indexed). That pushed a 45.2M expense into the
 * current calendar month, breaking the dashboard's "this month" KPIs.
 * The payroll's own createdAt (2026-06-28, visible in the Payroll
 * list since before the incident) is the correct historical date.
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const payroll = await prisma.payroll.findFirstOrThrow({
    where: { month: '2026-06' },
  });
  const tx = await prisma.transaction.findFirstOrThrow({
    where: { source: 'salary', refId: payroll.id },
  });
  await prisma.transaction.update({
    where: { id: tx.id },
    data: { date: payroll.createdAt },
  });
  console.log(
    `Transaction #${tx.id} sanasi ${tx.date.toISOString()} -> ${payroll.createdAt.toISOString()} ga to'g'rilandi`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
