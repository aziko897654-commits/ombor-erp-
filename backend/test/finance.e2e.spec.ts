import 'dotenv/config';
import { ValidationPipe, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Prisma, PrismaClient } from '@prisma/client';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppModule } from '../src/app.module';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';
import { TransformInterceptor } from '../src/common/interceptors/transform.interceptor';

/**
 * Stage 3 DoD (e2e): payment → auto transaction → balance; partial
 * payments reduce the debt and flip the invoice to paid; overpayment
 * is rejected; deleting a payment removes its transaction and
 * re-derives debt + invoice status; purchase payments reduce creditor
 * debt; transfers move balances without touching the income/expense
 * flow; cancel is blocked while payments exist.
 */
describe('finance contour e2e', () => {
  const prisma = new PrismaClient();
  const suffix = Date.now().toString();

  let app: INestApplication;
  let token: string;
  let customerId: number;
  let supplierId: number;
  let warehouseId: number;
  let categoryId: number;
  let productId: number;
  let accountAId: number;
  let accountBId: number;
  let orderId: number;
  let invoiceId: number;
  let payment1Id: number;
  let payment2Id: number;
  let purchaseId: number;

  const server = () => app.getHttpServer();
  const auth = () => ({ Authorization: `Bearer ${token}` });

  const customerDebt = async (): Promise<string> => {
    const res = await request(server())
      .get(`/api/v1/customers/${customerId}/balance`)
      .set(auth())
      .expect(200);
    return res.body.data.debt;
  };

  const accountBalance = async (accountId: number): Promise<string> => {
    const res = await request(server())
      .get('/api/v1/finance/balance')
      .set(auth())
      .expect(200);
    const account = res.body.data.accounts.find(
      (a: any) => a.id === accountId,
    );
    return account?.balance ?? 'missing';
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.use(cookieParser());
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        transformOptions: { enableImplicitConversion: true },
      }),
    );
    app.useGlobalFilters(new HttpExceptionFilter());
    app.useGlobalInterceptors(new TransformInterceptor());
    await app.init();

    const login = await request(server())
      .post('/api/v1/auth/login')
      .send({ email: 'admin@demo.uz', password: 'Demo1234!' })
      .expect(200);
    token = login.body.data.accessToken;

    const admin = await prisma.user.findFirstOrThrow({
      where: { role: 'admin' },
    });
    categoryId = (
      await prisma.category.create({ data: { name: `fin-cat-${suffix}` } })
    ).id;
    warehouseId = (
      await prisma.warehouse.create({ data: { name: `fin-wh-${suffix}` } })
    ).id;
    productId = (
      await prisma.product.create({
        data: {
          name: `fin-product-${suffix}`,
          sku: `FIN-${suffix}`,
          categoryId,
          unit: 'dona',
          costPrice: new Prisma.Decimal(10000),
          avgCost: new Prisma.Decimal(10000),
          salePrice: new Prisma.Decimal(15000),
        },
      })
    ).id;
    customerId = (
      await prisma.customer.create({ data: { name: `fin-customer-${suffix}` } })
    ).id;
    supplierId = (
      await prisma.supplier.create({ data: { name: `fin-supplier-${suffix}` } })
    ).id;
    accountAId = (
      await prisma.account.create({
        data: { name: `fin-accA-${suffix}`, type: 'cash' },
      })
    ).id;
    accountBId = (
      await prisma.account.create({
        data: { name: `fin-accB-${suffix}`, type: 'bank' },
      })
    ).id;

    await prisma.stockMovement.create({
      data: {
        productId,
        warehouseId,
        type: 'purchase',
        quantity: new Prisma.Decimal(10),
        userId: admin.id,
      },
    });

    // confirmed order: 4 × 15 000 = 60 000
    const orderRes = await request(server())
      .post('/api/v1/orders')
      .set(auth())
      .send({
        customerId,
        warehouseId,
        items: [{ productId, quantity: 4, price: 15000 }],
      })
      .expect(201);
    orderId = orderRes.body.data.id;
    await request(server())
      .post(`/api/v1/orders/${orderId}/confirm`)
      .set(auth())
      .expect(201);
  });

  afterAll(async () => {
    const accountIds = [accountAId, accountBId];
    await prisma.transaction.deleteMany({
      where: { accountId: { in: accountIds } },
    });
    await prisma.moneyTransfer.deleteMany({
      where: { fromAccountId: { in: accountIds } },
    });
    await prisma.payment.deleteMany({
      where: { OR: [{ customerId }, { supplierId }] },
    });
    await prisma.invoice.deleteMany({ where: { orderId } });
    await prisma.salesReturnItem.deleteMany({
      where: { salesReturn: { orderId } },
    });
    await prisma.salesReturn.deleteMany({ where: { orderId } });
    await prisma.orderItem.deleteMany({ where: { orderId } });
    await prisma.order.deleteMany({ where: { id: orderId } });
    await prisma.purchaseItem.deleteMany({
      where: { purchase: { supplierId } },
    });
    await prisma.purchase.deleteMany({ where: { supplierId } });
    await prisma.stockMovement.deleteMany({ where: { productId } });
    await prisma.account.deleteMany({ where: { id: { in: accountIds } } });
    await prisma.customer.delete({ where: { id: customerId } });
    await prisma.supplier.delete({ where: { id: supplierId } });
    await prisma.product.delete({ where: { id: productId } });
    await prisma.warehouse.delete({ where: { id: warehouseId } });
    await prisma.category.delete({ where: { id: categoryId } });
    await prisma.$disconnect();
    await app.close();
  });

  it('creates an invoice (draft) and moves it to sent; one per order', async () => {
    const res = await request(server())
      .post('/api/v1/invoices')
      .set(auth())
      .send({ orderId })
      .expect(201);
    invoiceId = res.body.data.id;
    expect(res.body.data.status).toBe('draft');
    expect(res.body.data.number).toMatch(/^INV-\d{4}-\d{4}$/);

    await request(server())
      .post('/api/v1/invoices')
      .set(auth())
      .send({ orderId })
      .expect(409);

    const sent = await request(server())
      .patch(`/api/v1/invoices/${invoiceId}/status`)
      .set(auth())
      .send({ status: 'sent' })
      .expect(200);
    expect(sent.body.data.status).toBe('sent');
  });

  it('payment → auto transaction → account balance and customer debt', async () => {
    const res = await request(server())
      .post('/api/v1/payments')
      .set(auth())
      .send({
        direction: 'in',
        accountId: accountAId,
        amount: 20000,
        customerId,
        orderId,
      })
      .expect(201);
    payment1Id = res.body.data.id;

    const transaction = await prisma.transaction.findFirst({
      where: { source: 'payment', refId: payment1Id },
    });
    expect(transaction?.type).toBe('income');
    expect(transaction?.amount.toNumber()).toBe(20000);
    expect(transaction?.accountId).toBe(accountAId);

    expect(Number(await accountBalance(accountAId))).toBe(20000);
    expect(Number(await customerDebt())).toBe(40000);
  });

  it('second partial payment covers the total → invoice auto-paid', async () => {
    const res = await request(server())
      .post('/api/v1/payments')
      .set(auth())
      .send({
        direction: 'in',
        accountId: accountAId,
        amount: 40000,
        customerId,
        orderId,
      })
      .expect(201);
    payment2Id = res.body.data.id;

    expect(Number(await customerDebt())).toBe(0);
    const invoice = await prisma.invoice.findUniqueOrThrow({
      where: { id: invoiceId },
    });
    expect(invoice.status).toBe('paid');
    expect(invoice.paidAt).not.toBeNull();
  });

  it('overpayment on a linked order is rejected (FR-3.6)', async () => {
    const res = await request(server())
      .post('/api/v1/payments')
      .set(auth())
      .send({
        direction: 'in',
        accountId: accountAId,
        amount: 1000,
        customerId,
        orderId,
      })
      .expect(400);
    expect(String(res.body.message)).toContain("Ortiqcha to'lov");
  });

  it('cancel is blocked while the order has payments (FR-1.6)', async () => {
    const res = await request(server())
      .post(`/api/v1/orders/${orderId}/cancel`)
      .set(auth())
      .expect(400);
    expect(String(res.body.message)).toContain("to'lovlar");
  });

  it('deleting a payment removes its transaction and reverts the invoice', async () => {
    await request(server())
      .delete(`/api/v1/payments/${payment2Id}`)
      .set(auth())
      .expect(200);

    const transactions = await prisma.transaction.count({
      where: { source: 'payment', refId: payment2Id },
    });
    expect(transactions).toBe(0);
    expect(Number(await customerDebt())).toBe(40000);
    expect(Number(await accountBalance(accountAId))).toBe(20000);

    const invoice = await prisma.invoice.findUniqueOrThrow({
      where: { id: invoiceId },
    });
    expect(invoice.status).toBe('sent');
    expect(invoice.paidAt).toBeNull();
  });

  it('purchase payment reduces the creditor debt', async () => {
    // purchase: 5 × 10 000 = 50 000
    const purchaseRes = await request(server())
      .post('/api/v1/purchases')
      .set(auth())
      .send({
        supplierId,
        warehouseId,
        items: [{ productId, quantity: 5, costPrice: 10000 }],
      })
      .expect(201);
    purchaseId = purchaseRes.body.data.id;

    const before = await request(server())
      .get('/api/v1/finance/debts')
      .set(auth())
      .expect(200);
    const creditorBefore = before.body.data.creditors.find(
      (c: any) => c.id === supplierId,
    );
    expect(Number(creditorBefore?.debt)).toBe(50000);

    await request(server())
      .post('/api/v1/payments')
      .set(auth())
      .send({
        direction: 'out',
        accountId: accountBId,
        amount: 30000,
        supplierId,
        purchaseId,
      })
      .expect(201);

    const after = await request(server())
      .get('/api/v1/finance/debts')
      .set(auth())
      .expect(200);
    const creditorAfter = after.body.data.creditors.find(
      (c: any) => c.id === supplierId,
    );
    expect(Number(creditorAfter?.debt)).toBe(20000);
    // the debtors list shows our customer with 40 000
    const debtor = after.body.data.debtors.find(
      (d: any) => d.id === customerId,
    );
    expect(Number(debtor?.debt)).toBe(40000);

    // overpayment on the purchase is rejected too
    await request(server())
      .post('/api/v1/payments')
      .set(auth())
      .send({
        direction: 'out',
        accountId: accountBId,
        amount: 30000,
        supplierId,
        purchaseId,
      })
      .expect(400);
  });

  it('transfer moves both balances but stays out of the flow (FR-3.9)', async () => {
    const before = await request(server())
      .get('/api/v1/finance/balance')
      .set(auth())
      .expect(200);
    const flowBefore = before.body.data.flow;

    await request(server())
      .post('/api/v1/finance/transfers')
      .set(auth())
      .send({ fromAccountId: accountAId, toAccountId: accountBId, amount: 5000 })
      .expect(201);

    const after = await request(server())
      .get('/api/v1/finance/balance')
      .set(auth())
      .expect(200);
    expect(Number(await accountBalance(accountAId))).toBe(15000);
    expect(Number(await accountBalance(accountBId))).toBe(-25000);
    // income/expense KPIs unchanged (invariant 9)
    expect(after.body.data.flow).toEqual(flowBefore);

    // insufficient funds on the source account
    const insufficient = await request(server())
      .post('/api/v1/finance/transfers')
      .set(auth())
      .send({
        fromAccountId: accountAId,
        toAccountId: accountBId,
        amount: 999999,
      })
      .expect(400);
    expect(String(insufficient.body.message)).toContain('yetarli emas');
  });

  it('manual transactions are deletable; automatic ones are not', async () => {
    const category = await prisma.txCategory.findFirstOrThrow({
      where: { type: 'expense', name: 'Ijara' },
    });
    const created = await request(server())
      .post('/api/v1/transactions')
      .set(auth())
      .send({
        type: 'expense',
        accountId: accountAId,
        amount: 1000,
        categoryId: category.id,
        note: 'e2e ijara',
      })
      .expect(201);
    await request(server())
      .delete(`/api/v1/transactions/${created.body.data.id}`)
      .set(auth())
      .expect(200);

    const auto = await prisma.transaction.findFirstOrThrow({
      where: { source: 'payment', refId: payment1Id },
    });
    const res = await request(server())
      .delete(`/api/v1/transactions/${auto.id}`)
      .set(auth())
      .expect(400);
    expect(String(res.body.message)).toContain('manba hujjati');
  });

  it('sales return reduces the customer debt (FR-3.7)', async () => {
    await request(server())
      .post('/api/v1/sales-returns')
      .set(auth())
      .send({ orderId, items: [{ productId, quantity: 1 }] })
      .expect(201);
    expect(Number(await customerDebt())).toBe(25000);
  });

  it('order payment status and PDFs are served', async () => {
    const order = await request(server())
      .get(`/api/v1/orders/${orderId}`)
      .set(auth())
      .expect(200);
    expect(Number(order.body.data.paidTotal)).toBe(20000);
    expect(order.body.data.payments).toHaveLength(1);

    const invoicePdf = await request(server())
      .get(`/api/v1/invoices/${invoiceId}/pdf`)
      .set(auth())
      .buffer(true)
      .expect(200)
      .expect('Content-Type', /application\/pdf/);
    expect(invoicePdf.body.length).toBeGreaterThan(1000);

    const note = await request(server())
      .get(`/api/v1/orders/${orderId}/delivery-note`)
      .set(auth())
      .buffer(true)
      .expect(200)
      .expect('Content-Type', /application\/pdf/);
    expect(note.body.length).toBeGreaterThan(1000);
  });

  it('finance endpoints are hidden from the sales role (403)', async () => {
    const login = await request(server())
      .post('/api/v1/auth/login')
      .send({ email: 'sales@demo.uz', password: 'Demo1234!' })
      .expect(200);
    const salesToken = login.body.data.accessToken;
    for (const path of [
      '/api/v1/finance/debts',
      '/api/v1/payments',
      '/api/v1/accounts',
      '/api/v1/invoices',
    ]) {
      await request(server())
        .get(path)
        .set('Authorization', `Bearer ${salesToken}`)
        .expect(403);
    }
  });
});
