import { PrismaClient, Role } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

// Stage 0: demo users + company settings.
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
    'Seed OK: 5 users (password: Demo1234!), 2 warehouses, app settings',
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
