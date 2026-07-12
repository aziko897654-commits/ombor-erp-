import { PrismaClient, Role, TxType } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

// Stage 0: demo users + company settings.
// Stage 3: accounts + transaction categories (FR-3.1, FR-3.3).
// The full demo dataset (Appendix A) is added in stage 5.
async function main() {
  const passwordHash = await bcrypt.hash('Demo1234!', 10);

  const users: Array<{
    email: string;
    firstName: string;
    lastName: string;
    role: Role;
  }> = [
    { email: 'admin@demo.uz', firstName: 'Anvar', lastName: 'Karimov', role: Role.admin },
    { email: 'accountant@demo.uz', firstName: 'Dilnoza', lastName: 'Rahimova', role: Role.accountant },
    { email: 'warehouse@demo.uz', firstName: 'Bekzod', lastName: 'Toshmatov', role: Role.warehouse },
    { email: 'sales@demo.uz', firstName: 'Malika', lastName: 'Yusupova', role: Role.sales },
    { email: 'hr@demo.uz', firstName: 'Sherzod', lastName: 'Aliyev', role: Role.hr },
  ];

  for (const u of users) {
    await prisma.user.upsert({
      where: { email: u.email },
      update: {},
      create: { ...u, passwordHash },
    });
  }

  // FR-2.0: at least "Asosiy ombor" must exist
  for (const name of ['Asosiy ombor', 'Filial ombori']) {
    await prisma.warehouse.upsert({
      where: { name },
      update: {},
      create: { name },
    });
  }

  // FR-3.1: cash + bank accounts
  const accounts: Array<{ name: string; type: 'cash' | 'bank' }> = [
    { name: 'Kassa', type: 'cash' },
    { name: 'Bank hisobi', type: 'bank' },
  ];
  for (const a of accounts) {
    const existing = await prisma.account.findFirst({
      where: { name: a.name },
    });
    if (!existing) await prisma.account.create({ data: a });
  }

  // FR-3.3: seed transaction categories
  const categories: Array<{ name: string; type: TxType }> = [
    { name: 'Savdo tushumi', type: TxType.income },
    { name: 'Boshqa', type: TxType.income },
    { name: 'Mahsulot xaridi', type: TxType.expense },
    { name: 'Ish haqi', type: TxType.expense },
    { name: 'Ish haqi avansi', type: TxType.expense },
    { name: 'Ijara', type: TxType.expense },
    { name: 'Kommunal', type: TxType.expense },
    { name: 'Boshqa', type: TxType.expense },
  ];
  for (const c of categories) {
    const existing = await prisma.txCategory.findFirst({
      where: { name: c.name, type: c.type },
    });
    if (!existing) await prisma.txCategory.create({ data: c });
  }

  await prisma.appSetting.upsert({
    where: { id: 1 },
    update: {},
    create: {
      id: 1,
      companyName: 'Demo Savdo MChJ',
      address: "Toshkent sh., Chilonzor tumani, Bunyodkor ko'chasi 12",
      phone: '+998 71 200 00 00',
      inn: '305123456',
      bankDetails: 'ATB "Demo Bank", h/r 2020 8000 1234 5678 9001, MFO 00456',
      invoiceFooter: "Hisob-faktura to'lov uchun asos hisoblanadi.",
    },
  });

  console.log(
    'Seed OK: 5 users (password: Demo1234!), 2 warehouses, 2 accounts, tx categories, app settings',
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
