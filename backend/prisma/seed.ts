import { Prisma, PrismaClient, Role, TxType } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();
const D = (v: number | string) => new Prisma.Decimal(v);

// ---------------------------------------------------------------- base

async function seedBase() {
  const passwordHash = await bcrypt.hash('Demo1234!', 10);
  // owner's admin account — its own credentials, not the shared demo password
  const adminPasswordHash = await bcrypt.hash('salimov2109', 10);

  const users: Array<{
    email: string;
    firstName: string;
    lastName: string;
    role: Role;
    passwordHash: string;
  }> = [
    { email: 'jamshid@gmail.com', firstName: 'Anvar', lastName: 'Karimov', role: Role.admin, passwordHash: adminPasswordHash },
    { email: 'accountant@demo.uz', firstName: 'Dilnoza', lastName: 'Rahimova', role: Role.accountant, passwordHash },
    { email: 'warehouse@demo.uz', firstName: 'Bekzod', lastName: 'Toshmatov', role: Role.warehouse, passwordHash },
    { email: 'sales@demo.uz', firstName: 'Malika', lastName: 'Yusupova', role: Role.sales, passwordHash },
    { email: 'hr@demo.uz', firstName: 'Sherzod', lastName: 'Aliyev', role: Role.hr, passwordHash },
  ];
  for (const u of users) {
    await prisma.user.upsert({
      where: { email: u.email },
      update: {},
      create: u,
    });
  }

  for (const name of ['Asosiy ombor', 'Filial ombori']) {
    await prisma.warehouse.upsert({ where: { name }, update: {}, create: { name } });
  }

  // Ilova A: Kassa 5 000 000, Bank 20 000 000
  const accounts: Array<{ name: string; type: 'cash' | 'bank'; opening: number }> = [
    { name: 'Kassa', type: 'cash', opening: 5_000_000 },
    { name: 'Bank hisobi', type: 'bank', opening: 20_000_000 },
  ];
  for (const a of accounts) {
    const existing = await prisma.account.findFirst({ where: { name: a.name } });
    if (existing) {
      if (existing.openingBalance.isZero()) {
        await prisma.account.update({
          where: { id: existing.id },
          data: { openingBalance: D(a.opening) },
        });
      }
    } else {
      await prisma.account.create({
        data: { name: a.name, type: a.type, openingBalance: D(a.opening) },
      });
    }
  }

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
}

// ---------------------------------------------------------------- demo

/** Days ago at a stable mid-day hour so month filters behave. */
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

async function seedDemo() {
  // idempotency marker: full demo data is created exactly once
  const marker = await prisma.customer.findFirst({
    where: { name: 'Olmos Savdo MChJ' },
  });
  if (marker) {
    console.log('Demo data already present — skipping (Ilova A).');
    return;
  }
  // one atomic transaction: a failed seed leaves no partial demo state
  await prisma.$transaction((tx) => seedDemoData(tx), {
    timeout: 180_000,
    maxWait: 15_000,
  });
}

// the parameter shadows the global client on purpose: every query in
// this function runs inside the seeding transaction
async function seedDemoData(prisma: Prisma.TransactionClient) {

  const admin = await prisma.user.findFirstOrThrow({ where: { role: 'admin' } });
  const salesUser = await prisma.user.findFirstOrThrow({ where: { role: 'sales' } });
  const mainWh = await prisma.warehouse.findFirstOrThrow({
    where: { name: 'Asosiy ombor' },
  });
  const branchWh = await prisma.warehouse.findFirstOrThrow({
    where: { name: 'Filial ombori' },
  });
  const kassa = await prisma.account.findFirstOrThrow({ where: { name: 'Kassa' } });
  const bank = await prisma.account.findFirstOrThrow({
    where: { name: 'Bank hisobi' },
  });
  const catOf = async (name: string, type: TxType) =>
    (await prisma.txCategory.findFirstOrThrow({ where: { name, type } })).id;
  const catSale = await catOf('Savdo tushumi', 'income');
  const catPurchase = await catOf('Mahsulot xaridi', 'expense');
  const catRent = await catOf('Ijara', 'expense');
  const catUtility = await catOf('Kommunal', 'expense');
  const catOtherIncome = await catOf('Boshqa', 'income');
  const catSalary = await catOf('Ish haqi', 'expense');
  const catAdvance = await catOf('Ish haqi avansi', 'expense');

  // --- 4 product categories, 15 products (2 low stock, barcodes) ---
  const categoryNames = ['Ichimliklar', 'Shirinliklar', 'Maishiy kimyo', 'Kantselyariya'];
  const categoryIds: number[] = [];
  for (const name of categoryNames) {
    const c = await prisma.category.upsert({ where: { name }, update: {}, create: { name } });
    categoryIds.push(c.id);
  }

  interface P {
    name: string;
    cat: number;
    unit: string;
    cost: number;
    price: number;
    min: number;
  }
  const productSpecs: P[] = [
    { name: 'Mineral suv 1.5L', cat: 0, unit: 'dona', cost: 4000, price: 6000, min: 50 },
    { name: 'Olma sharbati 1L', cat: 0, unit: 'dona', cost: 9000, price: 13000, min: 30 },
    { name: 'Kola 1L', cat: 0, unit: 'dona', cost: 8000, price: 12000, min: 40 },
    { name: 'Yashil choy 100g', cat: 0, unit: 'dona', cost: 12000, price: 18000, min: 20 },
    { name: 'Shokolad plitka', cat: 1, unit: 'dona', cost: 15000, price: 22000, min: 30 },
    { name: 'Pechenye 500g', cat: 1, unit: 'kg', cost: 18000, price: 26000, min: 25 },
    { name: 'Konfet assorti', cat: 1, unit: 'kg', cost: 45000, price: 65000, min: 10 },
    { name: 'Vafli 350g', cat: 1, unit: 'dona', cost: 11000, price: 16000, min: 20 },
    { name: 'Kir yuvish kukuni 3kg', cat: 2, unit: 'dona', cost: 55000, price: 78000, min: 15 },
    { name: 'Idish yuvish vositasi', cat: 2, unit: 'dona', cost: 14000, price: 21000, min: 25 },
    { name: 'Universal tozalagich', cat: 2, unit: 'litr', cost: 17000, price: 25000, min: 15 },
    { name: 'Qog\'oz A4 (500 varaq)', cat: 3, unit: 'dona', cost: 48000, price: 65000, min: 20 },
    { name: 'Ruchka ko\'k', cat: 3, unit: 'dona', cost: 2000, price: 3500, min: 100 },
    // low stock pair: high minStock, small purchases below
    { name: 'Daftar 48 varaq', cat: 3, unit: 'dona', cost: 5000, price: 8000, min: 80 },
    { name: 'Marker to\'plami', cat: 3, unit: 'dona', cost: 25000, price: 38000, min: 40 },
  ];

  const products: Array<{ id: number; spec: P; stock: Prisma.Decimal; avgCost: Prisma.Decimal }> = [];
  for (let i = 0; i < productSpecs.length; i++) {
    const spec = productSpecs[i];
    const product = await prisma.product.create({
      data: {
        name: spec.name,
        sku: `DEMO-${String(i + 1).padStart(4, '0')}`,
        barcode: `478009900${String(1000 + i)}`,
        categoryId: categoryIds[spec.cat],
        unit: spec.unit,
        costPrice: D(spec.cost),
        avgCost: D(0),
        salePrice: D(spec.price),
        minStock: D(spec.min),
      },
    });
    products.push({ id: product.id, spec, stock: D(0), avgCost: D(0) });
  }

  // --- 5 suppliers ---
  const supplierNames = [
    'Toshkent Distribyutsiya MChJ',
    'Agro Impeks XK',
    'Baraka Trade MChJ',
    'Sifat Servis MChJ',
    'Yulduz Optom XK',
  ];
  const suppliers: number[] = [];
  for (const [i, name] of supplierNames.entries()) {
    const s = await prisma.supplier.create({
      data: {
        name,
        phone: `+9987120000${i + 1}`,
        address: 'Toshkent sh.',
      },
    });
    suppliers.push(s.id);
  }

  // --- 6 purchases over 6 months (movements + AVCO) ---
  const year = new Date().getFullYear();
  // dev databases may already hold numbered documents — continue after them
  async function counterFor(
    delegate: { findFirst: (args: any) => Promise<{ number: string } | null> },
    prefix: string,
  ): Promise<number> {
    const key = `${prefix}-${year}`;
    const last = await delegate.findFirst({
      where: { number: { startsWith: `${key}-` } },
      orderBy: { number: 'desc' },
      select: { number: true },
    });
    return last ? parseInt(last.number.slice(key.length + 1), 10) : 0;
  }
  let purCounter = await counterFor(prisma.purchase, 'PUR');
  const purchaseIds: number[] = [];

  async function makePurchase(
    supplierId: number,
    warehouseId: number,
    date: Date,
    lines: Array<{ p: number; qty: number }>,
  ) {
    purCounter += 1;
    let total = D(0);
    for (const line of lines) {
      total = total.plus(D(products[line.p].spec.cost).times(line.qty));
    }
    const purchase = await prisma.purchase.create({
      data: {
        number: `PUR-${year}-${String(purCounter).padStart(4, '0')}`,
        supplierId,
        warehouseId,
        date,
        total,
        userId: admin.id,
        items: {
          create: lines.map((l) => ({
            productId: products[l.p].id,
            quantity: D(l.qty),
            costPrice: D(products[l.p].spec.cost),
          })),
        },
      },
    });
    for (const line of lines) {
      const entry = products[line.p];
      await prisma.stockMovement.create({
        data: {
          productId: entry.id,
          warehouseId,
          type: 'purchase',
          quantity: D(line.qty),
          refType: 'purchase',
          refId: purchase.id,
          userId: admin.id,
          createdAt: date,
        },
      });
      // FR-2.12 AVCO mirror
      const incoming = D(line.qty);
      const incomingCost = D(entry.spec.cost);
      const newStock = entry.stock.plus(incoming);
      entry.avgCost = entry.stock.isZero()
        ? incomingCost
        : entry.stock
            .times(entry.avgCost)
            .plus(incoming.times(incomingCost))
            .dividedBy(newStock)
            .toDecimalPlaces(2);
      entry.stock = newStock;
    }
    purchaseIds.push(purchase.id);
    return purchase;
  }

  await makePurchase(suppliers[0], mainWh.id, monthsAgo(5), [
    { p: 0, qty: 200 }, { p: 1, qty: 120 }, { p: 2, qty: 150 },
  ]);
  await makePurchase(suppliers[1], mainWh.id, monthsAgo(4), [
    { p: 4, qty: 100 }, { p: 5, qty: 80 }, { p: 6, qty: 40 },
  ]);
  await makePurchase(suppliers[2], mainWh.id, monthsAgo(3), [
    { p: 8, qty: 60 }, { p: 9, qty: 90 }, { p: 10, qty: 50 },
  ]);
  await makePurchase(suppliers[3], mainWh.id, monthsAgo(2), [
    { p: 11, qty: 70 }, { p: 12, qty: 300 }, { p: 3, qty: 60 },
  ]);
  await makePurchase(suppliers[4], branchWh.id, monthsAgo(1), [
    { p: 0, qty: 100 }, { p: 7, qty: 90 }, { p: 13, qty: 30 }, // daftar low
  ]);
  await makePurchase(suppliers[0], mainWh.id, daysAgo(12), [
    { p: 2, qty: 80 }, { p: 14, qty: 15 }, // marker low
  ]);

  // update products with final avgCost
  for (const entry of products) {
    await prisma.product.update({
      where: { id: entry.id },
      data: { avgCost: entry.avgCost, costPrice: D(entry.spec.cost) },
    });
  }

  // --- 10 customers ---
  const customerNames = [
    'Olmos Savdo MChJ', 'Bahor Market', 'Kamalak Trade', 'Do\'stlik Market',
    'Ziyo Biznes MChJ', 'Guliston Savdo', 'Istiqbol Group', 'Nur Market',
    'Sardor Ismoilov', 'Laylo Karimova',
  ];
  const customers: number[] = [];
  for (const [i, name] of customerNames.entries()) {
    const c = await prisma.customer.create({
      data: { name, phone: `+9989011122${String(10 + i)}`, address: 'Toshkent sh.' },
    });
    customers.push(c.id);
  }

  // --- 8 deals ---
  const dealSpecs: Array<{ title: string; c: number; amount: number; stage: 'new' | 'negotiation' | 'won' | 'lost' }> = [
    { title: 'Ulgurji partiya — ichimliklar', c: 0, amount: 12_000_000, stage: 'won' },
    { title: 'Ofis ta\'minoti shartnomasi', c: 1, amount: 6_500_000, stage: 'negotiation' },
    { title: 'Shirinliklar yetkazib berish', c: 2, amount: 4_200_000, stage: 'won' },
    { title: 'Maishiy kimyo partiyasi', c: 3, amount: 8_800_000, stage: 'new' },
    { title: 'Doimiy ta\'minot — choy', c: 4, amount: 3_000_000, stage: 'negotiation' },
    { title: 'Yangi filial uchun tovar', c: 5, amount: 15_000_000, stage: 'new' },
    { title: 'Kantselyariya tender', c: 6, amount: 9_500_000, stage: 'lost' },
    { title: 'Kichik ulgurji buyurtma', c: 7, amount: 2_400_000, stage: 'won' },
  ];
  for (const d of dealSpecs) {
    await prisma.deal.create({
      data: {
        title: d.title,
        customerId: customers[d.c],
        amount: D(d.amount),
        stage: d.stage,
        managerId: salesUser.id,
        note: 'Demo bitim',
      },
    });
  }

  // --- 6 orders: 4 confirmed (2 partially paid), 2 discounted, 1 shipped, 1 draft ---
  let ordCounter = await counterFor(prisma.order, 'ORD');
  async function makeOrder(
    customerIdx: number,
    warehouseId: number,
    createdAt: Date,
    lines: Array<{ p: number; qty: number }>,
    opts: { discount?: number; status: 'draft' | 'confirmed' | 'shipped' },
  ) {
    ordCounter += 1;
    let subtotal = D(0);
    for (const l of lines) {
      subtotal = subtotal.plus(D(products[l.p].spec.price).times(l.qty));
    }
    const discount = D(opts.discount ?? 0);
    const order = await prisma.order.create({
      data: {
        number: `ORD-${year}-${String(ordCounter).padStart(4, '0')}`,
        customerId: customers[customerIdx],
        warehouseId,
        status: opts.status,
        subtotal,
        discount,
        total: subtotal.minus(discount),
        createdAt,
        items: {
          create: lines.map((l) => ({
            productId: products[l.p].id,
            quantity: D(l.qty),
            price: D(products[l.p].spec.price),
            // FR-2.12: avgCost stamped at confirmation
            cost: opts.status === 'draft' ? D(0) : products[l.p].avgCost,
          })),
        },
      },
    });
    if (opts.status !== 'draft') {
      for (const l of lines) {
        await prisma.stockMovement.create({
          data: {
            productId: products[l.p].id,
            warehouseId,
            type: 'sale',
            quantity: D(l.qty).negated(),
            refType: 'order',
            refId: order.id,
            userId: salesUser.id,
            createdAt,
          },
        });
        products[l.p].stock = products[l.p].stock.minus(l.qty);
      }
    }
    return order;
  }

  const o1 = await makeOrder(0, mainWh.id, daysAgo(40), [
    { p: 0, qty: 100 }, { p: 2, qty: 60 },
  ], { status: 'confirmed', discount: 100_000 }); // 1 320 000 - 100 000 = 1 220 000
  const o2 = await makeOrder(1, mainWh.id, daysAgo(25), [
    { p: 4, qty: 40 }, { p: 6, qty: 10 },
  ], { status: 'confirmed' }); // 880 000 + 650 000 = 1 530 000
  const o3 = await makeOrder(2, mainWh.id, daysAgo(15), [
    { p: 8, qty: 20 }, { p: 9, qty: 30 },
  ], { status: 'confirmed', discount: 90_000 }); // 2 190 000 - 90 000 = 2 100 000
  const o4 = await makeOrder(3, mainWh.id, daysAgo(8), [
    { p: 11, qty: 25 }, { p: 12, qty: 100 },
  ], { status: 'shipped' }); // 1 625 000 + 350 000 = 1 975 000
  await makeOrder(4, branchWh.id, daysAgo(3), [
    { p: 7, qty: 30 },
  ], { status: 'draft' });
  await makeOrder(5, mainWh.id, daysAgo(1), [
    { p: 5, qty: 15 }, { p: 1, qty: 20 },
  ], { status: 'draft' });

  // --- 1 sales return for o1 (10 × Mineral suv) ---
  const srNum = (await counterFor(prisma.salesReturn, 'SRT')) + 1;
  const sr = await prisma.salesReturn.create({
    data: {
      number: `SRT-${year}-${String(srNum).padStart(4, '0')}`,
      orderId: o1.id,
      warehouseId: mainWh.id,
      date: daysAgo(30),
      total: D(10 * 6000),
      note: 'Demo qaytarish',
      userId: salesUser.id,
      items: {
        create: [{ productId: products[0].id, quantity: D(10), price: D(6000) }],
      },
    },
  });
  await prisma.stockMovement.create({
    data: {
      productId: products[0].id,
      warehouseId: mainWh.id,
      type: 'sale_return',
      quantity: D(10),
      refType: 'sales_return',
      refId: sr.id,
      userId: salesUser.id,
      createdAt: daysAgo(30),
    },
  });
  products[0].stock = products[0].stock.plus(10);

  // --- 1 purchase return (5 × Kola from purchase #1) ---
  const prNum = (await counterFor(prisma.purchaseReturn, 'PRT')) + 1;
  const pr = await prisma.purchaseReturn.create({
    data: {
      number: `PRT-${year}-${String(prNum).padStart(4, '0')}`,
      purchaseId: purchaseIds[0],
      warehouseId: mainWh.id,
      date: monthsAgo(4, 20),
      total: D(5 * 8000),
      userId: admin.id,
      items: {
        create: [{ productId: products[2].id, quantity: D(5), costPrice: D(8000) }],
      },
    },
  });
  await prisma.stockMovement.create({
    data: {
      productId: products[2].id,
      warehouseId: mainWh.id,
      type: 'purchase_return',
      quantity: D(5).negated(),
      refType: 'purchase_return',
      refId: pr.id,
      userId: admin.id,
      createdAt: monthsAgo(4, 20),
    },
  });
  products[2].stock = products[2].stock.minus(5);

  // --- 1 stock transfer (Asosiy → Filial, 30 × Mineral suv) ---
  const trfNum = (await counterFor(prisma.stockTransfer, 'TRF')) + 1;
  const transfer = await prisma.stockTransfer.create({
    data: {
      number: `TRF-${year}-${String(trfNum).padStart(4, '0')}`,
      fromWarehouseId: mainWh.id,
      toWarehouseId: branchWh.id,
      date: daysAgo(20),
      userId: admin.id,
    },
  });
  for (const [wh, qty] of [
    [mainWh.id, -30],
    [branchWh.id, 30],
  ] as const) {
    await prisma.stockMovement.create({
      data: {
        productId: products[0].id,
        warehouseId: wh,
        type: 'transfer',
        quantity: D(qty),
        refType: 'transfer',
        refId: transfer.id,
        userId: admin.id,
        createdAt: daysAgo(20),
      },
    });
  }

  // --- 1 completed stock count on Filial (small diffs → adjustment) ---
  const countedProducts = [products[0], products[7], products[13]];
  const stockInBranch = new Map<number, Prisma.Decimal>();
  for (const entry of countedProducts) {
    const agg = await prisma.stockMovement.aggregate({
      where: { productId: entry.id, warehouseId: branchWh.id },
      _sum: { quantity: true },
    });
    stockInBranch.set(entry.id, agg._sum.quantity ?? D(0));
  }
  const diffs = [D(-2), D(1), D(0)];
  const invtNum = (await counterFor(prisma.stockCount, 'INVT')) + 1;
  const count = await prisma.stockCount.create({
    data: {
      number: `INVT-${year}-${String(invtNum).padStart(4, '0')}`,
      warehouseId: branchWh.id,
      date: daysAgo(5),
      status: 'completed',
      userId: admin.id,
      items: {
        create: countedProducts.map((entry, i) => ({
          productId: entry.id,
          systemQty: stockInBranch.get(entry.id)!,
          actualQty: stockInBranch.get(entry.id)!.plus(diffs[i]),
          diff: diffs[i],
        })),
      },
    },
  });
  for (const [i, entry] of countedProducts.entries()) {
    if (diffs[i].isZero()) continue;
    await prisma.stockMovement.create({
      data: {
        productId: entry.id,
        warehouseId: branchWh.id,
        type: 'adjustment',
        quantity: diffs[i],
        reason: 'Inventarizatsiya farqi',
        refType: 'stock_count',
        refId: count.id,
        userId: admin.id,
        createdAt: daysAgo(5),
      },
    });
  }

  // --- payments (partial) + auto transactions ---
  async function makePayment(opts: {
    direction: 'in' | 'out';
    accountId: number;
    amount: number;
    date: Date;
    customerId?: number;
    supplierId?: number;
    orderId?: number;
    purchaseId?: number;
    categoryId: number;
    note?: string;
  }) {
    const payment = await prisma.payment.create({
      data: {
        direction: opts.direction,
        accountId: opts.accountId,
        amount: D(opts.amount),
        date: opts.date,
        customerId: opts.customerId,
        supplierId: opts.supplierId,
        orderId: opts.orderId,
        purchaseId: opts.purchaseId,
        note: opts.note,
        userId: admin.id,
      },
    });
    await prisma.transaction.create({
      data: {
        date: opts.date,
        accountId: opts.accountId,
        type: opts.direction === 'in' ? 'income' : 'expense',
        amount: D(opts.amount),
        categoryId: opts.categoryId,
        source: 'payment',
        refId: payment.id,
        note: opts.note,
        userId: admin.id,
      },
    });
  }

  // o1 (1 220 000): partial 700 000; o2 (1 530 000): partial 500 000
  await makePayment({
    direction: 'in', accountId: kassa.id, amount: 700_000, date: daysAgo(35),
    customerId: customers[0], orderId: o1.id, categoryId: catSale,
    note: "O1 qisman to'lov",
  });
  await makePayment({
    direction: 'in', accountId: bank.id, amount: 500_000, date: daysAgo(20),
    customerId: customers[1], orderId: o2.id, categoryId: catSale,
    note: "O2 qisman to'lov",
  });
  // o3 fully paid, o4 unlinked general payment
  await makePayment({
    direction: 'in', accountId: bank.id, amount: 2_100_000, date: daysAgo(10),
    customerId: customers[2], orderId: o3.id, categoryId: catSale,
  });
  await makePayment({
    direction: 'in', accountId: kassa.id, amount: 300_000, date: daysAgo(6),
    customerId: customers[3], categoryId: catSale, note: 'Umumiy balansga',
  });

  // purchases: 3 partially paid (creditor debt remains)
  const purchaseRows = await prisma.purchase.findMany({
    where: { id: { in: purchaseIds.slice(0, 3) } },
    orderBy: { id: 'asc' },
  });
  const partialRatio = [0.5, 0.6, 0.4];
  for (const [i, purchase] of purchaseRows.entries()) {
    await makePayment({
      direction: 'out',
      accountId: bank.id,
      amount: Number(purchase.total.times(partialRatio[i]).toDecimalPlaces(0)),
      date: monthsAgo(4 - i, 15),
      supplierId: purchase.supplierId,
      purchaseId: purchase.id,
      categoryId: catPurchase,
      note: `${purchase.number} qisman to'lov`,
    });
  }

  // --- manual transactions over the last 6 months (charts) ---
  for (let m = 5; m >= 0; m--) {
    // retail income keeps the demo cash flow realistic vs payroll
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
    }
  }

  // --- 1 money transfer (kassa → bank) + transfer transactions ---
  const moneyTransfer = await prisma.moneyTransfer.create({
    data: {
      date: daysAgo(9),
      fromAccountId: kassa.id,
      toAccountId: bank.id,
      amount: D(2_000_000),
      note: 'Kassadan bankka inkassatsiya',
      userId: admin.id,
    },
  });
  const catTransferExp = await (async () => {
    const c = await prisma.txCategory.findFirst({
      where: { name: "Hisoblararo o'tkazma", type: 'expense' },
    });
    return c ?? prisma.txCategory.create({ data: { name: "Hisoblararo o'tkazma", type: 'expense' } });
  })();
  const catTransferInc = await (async () => {
    const c = await prisma.txCategory.findFirst({
      where: { name: "Hisoblararo o'tkazma", type: 'income' },
    });
    return c ?? prisma.txCategory.create({ data: { name: "Hisoblararo o'tkazma", type: 'income' } });
  })();
  await prisma.transaction.createMany({
    data: [
      {
        date: daysAgo(9), accountId: kassa.id, type: 'expense', amount: D(2_000_000),
        categoryId: catTransferExp.id, source: 'transfer', refId: moneyTransfer.id,
        note: 'Kassadan bankka', userId: admin.id,
      },
      {
        date: daysAgo(9), accountId: bank.id, type: 'income', amount: D(2_000_000),
        categoryId: catTransferInc.id, source: 'transfer', refId: moneyTransfer.id,
        note: 'Kassadan bankka', userId: admin.id,
      },
    ],
  });

  // --- 2 invoices: one sent 10 days ago (overdue), one draft ---
  const invNum = await counterFor(prisma.invoice, 'INV');
  await prisma.invoice.create({
    data: {
      number: `INV-${year}-${String(invNum + 1).padStart(4, '0')}`,
      orderId: o2.id,
      status: 'sent',
      issuedAt: daysAgo(10),
    },
  });
  await prisma.invoice.create({
    data: {
      number: `INV-${year}-${String(invNum + 2).padStart(4, '0')}`,
      orderId: o4.id,
      status: 'draft',
    },
  });

  // --- HR: 3 departments, 5 positions, 12 employees ---
  const depNames = ['Savdo', 'Ombor', "Ma'muriyat"];
  const depIds: number[] = [];
  for (const name of depNames) {
    const d = await prisma.department.upsert({ where: { name }, update: {}, create: { name } });
    depIds.push(d.id);
  }
  const posNames = ['Menejer', 'Katta menejer', 'Omborchi', 'Haydovchi', 'Buxgalter yordamchisi'];
  const posIds: number[] = [];
  for (const name of posNames) {
    const p = await prisma.position.upsert({ where: { name }, update: {}, create: { name } });
    posIds.push(p.id);
  }
  const employeeSpecs: Array<{ name: string; dep: number; pos: number; salary: number; fired?: boolean }> = [
    { name: 'Akmal Rustamov', dep: 0, pos: 0, salary: 4_000_000 },
    { name: 'Dilshod Qodirov', dep: 0, pos: 0, salary: 4_200_000 },
    { name: 'Nilufar Sobirova', dep: 0, pos: 1, salary: 5_500_000 },
    { name: 'Jasur Islomov', dep: 1, pos: 2, salary: 3_800_000 },
    { name: 'Botir Ergashev', dep: 1, pos: 2, salary: 3_800_000 },
    { name: 'Olim Nazarov', dep: 1, pos: 3, salary: 3_500_000 },
    { name: 'Zulfiya Ahmedova', dep: 2, pos: 4, salary: 4_500_000 },
    { name: 'Rustam Yo\'ldoshev', dep: 0, pos: 0, salary: 4_000_000 },
    { name: 'Kamola Tosheva', dep: 0, pos: 0, salary: 3_900_000 },
    { name: 'Sherali Berdiyev', dep: 1, pos: 3, salary: 3_500_000 },
    { name: 'Madina Xolmatova', dep: 2, pos: 4, salary: 4_300_000 },
    { name: 'Farhod G\'aniyev', dep: 0, pos: 0, salary: 4_100_000, fired: true },
  ];
  const employeeIds: number[] = [];
  for (const [i, e] of employeeSpecs.entries()) {
    const emp = await prisma.employee.create({
      data: {
        fullName: e.name,
        phone: `+9989033344${String(10 + i)}`,
        departmentId: depIds[e.dep],
        positionId: posIds[e.pos],
        salary: D(e.salary),
        hiredAt: monthsAgo(8 + (i % 4), 1),
        status: e.fired ? 'fired' : 'active',
        firedAt: e.fired ? monthsAgo(1, 25) : null,
      },
    });
    employeeIds.push(emp.id);
  }

  // --- current month attendance (first 10 workdays, first 6 employees) ---
  const now = new Date();
  const statuses = ['present', 'present', 'present', 'absent', 'present', 'vacation', 'present', 'sick', 'present', 'present'] as const;
  for (let e = 0; e < 6; e++) {
    for (let day = 1; day <= 10; day++) {
      const date = new Date(now.getFullYear(), now.getMonth(), day, 12);
      if (date > now) break;
      if (date.getDay() === 0 || date.getDay() === 6) continue; // weekend
      await prisma.attendance.create({
        data: {
          employeeId: employeeIds[e],
          date,
          status: statuses[(e + day) % statuses.length],
        },
      });
    }
  }

  // --- 2 advances (current month) + expense transactions ---
  for (const [i, e] of [0, 3].entries()) {
    const advance = await prisma.advance.create({
      data: {
        employeeId: employeeIds[e],
        accountId: kassa.id,
        amount: D(500_000 + i * 200_000),
        date: daysAgo(4 + i),
        note: 'Demo avans',
        userId: admin.id,
      },
    });
    await prisma.transaction.create({
      data: {
        date: daysAgo(4 + i),
        accountId: kassa.id,
        type: 'expense',
        amount: D(500_000 + i * 200_000),
        categoryId: catAdvance,
        source: 'advance',
        refId: advance.id,
        note: `Avans: ${employeeSpecs[e].name}`,
        userId: admin.id,
      },
    });
  }

  // --- previous month payroll + ONE salary expense transaction ---
  const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const prevMonth = `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, '0')}`;
  const activeEmployees = employeeSpecs
    .map((e, i) => ({ ...e, id: employeeIds[i] }))
    .filter((e) => !e.fired);
  let payrollTotal = D(0);
  const payrollItems = activeEmployees.map((e, i) => {
    const bonus = i === 0 ? D(300_000) : D(0);
    const penalty = i === 1 ? D(100_000) : D(0);
    const amount = D(e.salary).plus(bonus).minus(penalty);
    payrollTotal = payrollTotal.plus(amount);
    return {
      employeeId: e.id,
      baseSalary: D(e.salary),
      bonus,
      penalty,
      advance: D(0),
      amount,
    };
  });
  const existingPayroll = await prisma.payroll.findUnique({
    where: { month: prevMonth },
  });
  const payroll =
    existingPayroll ??
    (await prisma.payroll.create({
      data: {
        month: prevMonth,
        total: payrollTotal,
        createdAt: monthsAgo(1, 28),
        items: { create: payrollItems },
      },
    }));
  if (!existingPayroll) {
    await prisma.transaction.create({
      data: {
        date: monthsAgo(0, 1),
        accountId: bank.id,
        type: 'expense',
        amount: payrollTotal,
        categoryId: catSalary,
        source: 'salary',
        refId: payroll.id,
        note: `Ish haqi vedomosti: ${prevMonth}`,
        userId: admin.id,
      },
    });
  }

  // --- 3 sample notifications for the admin ---
  await prisma.notification.createMany({
    data: [
      {
        userId: admin.id,
        title: 'Xush kelibsiz!',
        message: 'Demo ma\'lumotlar yuklandi — tizimni sinab ko\'ring.',
        link: '/',
      },
      {
        userId: admin.id,
        title: 'Buyurtma tasdiqlandi',
        message: `${o3.number} — ${customerNames[2]}, jami 2 100 000 so'm`,
        link: `/orders/${o3.id}`,
      },
      {
        userId: admin.id,
        title: 'Oylik vedomost yaratildi',
        message: `${prevMonth} — ${activeEmployees.length} xodim`,
        link: `/payroll/${payroll.id}`,
      },
    ],
  });

  console.log('Demo data OK (Ilova A).');
}

async function main() {
  await seedBase();
  await seedDemo();
  console.log(
    'Seed OK: admin jamshid@gmail.com (password: salimov2109), demo staff @demo.uz (password: Demo1234!), warehouses, accounts, categories, settings + demo dataset',
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
