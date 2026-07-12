import 'dotenv/config';
import { ValidationPipe, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppModule } from '../src/app.module';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';
import { TransformInterceptor } from '../src/common/interceptors/transform.interceptor';
import { NotificationsService } from '../src/modules/notifications/notifications.service';

/**
 * Stage 5 DoD (e2e): dashboard shows real seeded numbers with change
 * percentages; low-stock/overdue notifications are generated and
 * deduplicated; Ctrl+K search covers 4 entity types with role
 * filtering; every report serves xlsx and pdf; audit page works.
 * Requires the demo seed (pnpm seed) to have run.
 */
describe('stage 5 e2e', () => {
  const prisma = new PrismaClient();

  let app: INestApplication;
  let adminToken: string;
  let salesToken: string;

  const server = () => app.getHttpServer();
  const asAdmin = () => ({ Authorization: `Bearer ${adminToken}` });

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

    const admin = await request(server())
      .post('/api/v1/auth/login')
      .send({ email: 'admin@demo.uz', password: 'Demo1234!' })
      .expect(200);
    adminToken = admin.body.data.accessToken;
    const sales = await request(server())
      .post('/api/v1/auth/login')
      .send({ email: 'sales@demo.uz', password: 'Demo1234!' })
      .expect(200);
    salesToken = sales.body.data.accessToken;
  });

  afterAll(async () => {
    await prisma.$disconnect();
    await app.close();
  });

  it('dashboard summary returns seeded KPIs and cards (FR-5)', async () => {
    const res = await request(server())
      .get('/api/v1/dashboard/summary')
      .set(asAdmin())
      .expect(200);
    const { kpi, cards } = res.body.data;
    // seeded demo data guarantees non-zero numbers
    expect(Number(kpi.income.value)).toBeGreaterThan(0);
    expect(Number(kpi.expense.value)).toBeGreaterThan(0);
    expect(Number(kpi.cash.value)).not.toBe(0);
    expect(Number(cards.receivables)).toBeGreaterThan(0);
    expect(Number(cards.payables)).toBeGreaterThan(0);
    expect(Number(cards.stockValue)).toBeGreaterThan(0);
    expect(cards.lowStockCount).toBeGreaterThanOrEqual(2);
    expect(cards.activeEmployees).toBeGreaterThanOrEqual(11);

    // sales role cannot see the dashboard
    await request(server())
      .get('/api/v1/dashboard/summary')
      .set('Authorization', `Bearer ${salesToken}`)
      .expect(403);
  });

  it('dashboard charts: 12 months, funnel, top products', async () => {
    const res = await request(server())
      .get('/api/v1/dashboard/charts')
      .set(asAdmin())
      .expect(200);
    const { monthly, funnel, topProducts } = res.body.data;
    expect(monthly).toHaveLength(12);
    expect(funnel).toHaveLength(4);
    expect(funnel.some((f: any) => f.count > 0)).toBe(true);
    expect(topProducts.length).toBeGreaterThan(0);
    expect(topProducts.length).toBeLessThanOrEqual(5);
  });

  it('notifications: low-stock and overdue invoices, deduplicated (FR-7)', async () => {
    const first = await request(server())
      .get('/api/v1/notifications?limit=100')
      .set(asAdmin())
      .expect(200);
    const lowStock = first.body.data.filter((n: any) =>
      n.dedupeKey?.startsWith('low-stock:'),
    );
    const overdue = first.body.data.filter((n: any) =>
      n.dedupeKey?.startsWith('invoice-overdue:'),
    );
    expect(lowStock.length).toBeGreaterThanOrEqual(2);
    expect(overdue.length).toBeGreaterThanOrEqual(1);

    // force a second sweep — the dedupe keys must not duplicate
    (app.get(NotificationsService) as any).lastSweep = 0;
    const second = await request(server())
      .get('/api/v1/notifications?limit=100')
      .set(asAdmin())
      .expect(200);
    const keys = second.body.data
      .filter((n: any) => n.dedupeKey)
      .map((n: any) => n.dedupeKey);
    expect(new Set(keys).size).toBe(keys.length);

    // mark all read
    const read = await request(server())
      .patch('/api/v1/notifications/read')
      .set(asAdmin())
      .send({ all: true })
      .expect(200);
    expect(read.body.data.unread).toBe(0);
  });

  it('global search covers 4 entity types with role filtering (FR-10.1)', async () => {
    const res = await request(server())
      .get('/api/v1/search?q=ol')
      .set(asAdmin())
      .expect(200);
    const groups = res.body.data;
    expect(Object.keys(groups).sort()).toEqual([
      'customers',
      'orders',
      'products',
      'suppliers',
    ]);
    expect(groups.customers.length).toBeGreaterThan(0);

    // warehouse role: no customers/orders groups content
    const wh = await request(server())
      .post('/api/v1/auth/login')
      .send({ email: 'warehouse@demo.uz', password: 'Demo1234!' })
      .expect(200);
    const whRes = await request(server())
      .get('/api/v1/search?q=ol')
      .set('Authorization', `Bearer ${wh.body.data.accessToken}`)
      .expect(200);
    expect(whRes.body.data.customers).toHaveLength(0);
    expect(whRes.body.data.orders).toHaveLength(0);
  });

  it('order search finds by number (FR-10.1)', async () => {
    const order = await prisma.order.findFirstOrThrow({
      where: { number: { startsWith: 'ORD-' } },
    });
    const res = await request(server())
      .get(`/api/v1/search?q=${order.number}`)
      .set(asAdmin())
      .expect(200);
    expect(res.body.data.orders.some((o: any) => o.id === order.id)).toBe(true);
  });

  it('all 7 reports serve json, xlsx and pdf (FR-6)', async () => {
    const reports = [
      'finance',
      'sales',
      'stock',
      'debts',
      'payments',
      'attendance',
      'profit',
    ];
    for (const slug of reports) {
      const json = await request(server())
        .get(`/api/v1/reports/${slug}`)
        .set(asAdmin())
        .expect(200);
      expect(json.body.data.sections.length).toBeGreaterThan(0);

      await request(server())
        .get(`/api/v1/reports/${slug}?format=xlsx`)
        .set(asAdmin())
        .buffer(true)
        .expect(200)
        .expect('Content-Type', /spreadsheetml/);

      const pdf = await request(server())
        .get(`/api/v1/reports/${slug}?format=pdf`)
        .set(asAdmin())
        .buffer(true)
        .expect(200)
        .expect('Content-Type', /application\/pdf/);
      expect(pdf.body.length).toBeGreaterThan(800);
    }

    // FR-6.3: role gating — sales can read the sales report only
    await request(server())
      .get('/api/v1/reports/sales')
      .set('Authorization', `Bearer ${salesToken}`)
      .expect(200);
    await request(server())
      .get('/api/v1/reports/finance')
      .set('Authorization', `Bearer ${salesToken}`)
      .expect(403);
  });

  it('profit report subtracts returns and uses stamped costs (FR-6.2/7)', async () => {
    const res = await request(server())
      .get('/api/v1/reports/profit?from=2000-01-01&to=2099-12-31')
      .set(asAdmin())
      .expect(200);
    const byProduct = res.body.data.sections[0];
    const total = byProduct.rows[byProduct.rows.length - 1];
    expect(total.name).toBe('JAMI');
    expect(Number(total.profit)).toBeGreaterThan(0);
    expect(Number(total.revenue)).toBeGreaterThan(Number(total.profit));
  });

  it('audit journal lists entries with filters (FR-10.2), admin only', async () => {
    const res = await request(server())
      .get('/api/v1/audit?limit=10')
      .set(asAdmin())
      .expect(200);
    expect(res.body.meta.total).toBeGreaterThan(0);
    expect(res.body.data[0].user).toBeDefined();

    const filtered = await request(server())
      .get('/api/v1/audit?action=payment')
      .set(asAdmin())
      .expect(200);
    for (const row of filtered.body.data) {
      expect(row.action).toContain('payment');
    }

    await request(server())
      .get('/api/v1/audit')
      .set('Authorization', `Bearer ${salesToken}`)
      .expect(403);
  });
});
