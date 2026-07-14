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
 * Stage 2 DoD (e2e): confirm creates outflow movements and stamps
 * OrderItem.cost; insufficient stock fails atomically; cancel restores
 * stock; sales return restores stock and rejects over-return.
 * Runs against the dev database with seeded demo users.
 */
describe('order lifecycle e2e', () => {
  const prisma = new PrismaClient();
  const suffix = Date.now().toString();

  let app: INestApplication;
  let token: string;
  let customerId: number;
  let warehouseId: number;
  let categoryId: number;
  let productId: number;

  const auth = () => ({ Authorization: `Bearer ${token}` });
  const server = () => app.getHttpServer();

  const stockOf = async () => {
    const agg = await prisma.stockMovement.aggregate({
      where: { productId, warehouseId },
      _sum: { quantity: true },
    });
    return (agg._sum.quantity ?? new Prisma.Decimal(0)).toNumber();
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
      .send({ email: 'jamshid@gmail.com', password: 'salimov2109' })
      .expect(200);
    token = login.body.data.accessToken;

    const admin = await prisma.user.findFirstOrThrow({
      where: { role: 'admin' },
    });
    const category = await prisma.category.create({
      data: { name: `e2e-cat-${suffix}` },
    });
    categoryId = category.id;
    const warehouse = await prisma.warehouse.create({
      data: { name: `e2e-wh-${suffix}` },
    });
    warehouseId = warehouse.id;
    const product = await prisma.product.create({
      data: {
        name: `e2e-product-${suffix}`,
        sku: `E2E-${suffix}`,
        categoryId,
        unit: 'dona',
        costPrice: new Prisma.Decimal(10000),
        avgCost: new Prisma.Decimal(10000),
        salePrice: new Prisma.Decimal(15000),
      },
    });
    productId = product.id;
    const customer = await prisma.customer.create({
      data: { name: `e2e-customer-${suffix}` },
    });
    customerId = customer.id;

    // initial stock: 10
    await prisma.stockMovement.create({
      data: {
        productId,
        warehouseId,
        type: 'purchase',
        quantity: new Prisma.Decimal(10),
        userId: admin.id,
      },
    });
  });

  afterAll(async () => {
    await prisma.salesReturnItem.deleteMany({
      where: { salesReturn: { order: { customerId } } },
    });
    await prisma.salesReturn.deleteMany({
      where: { order: { customerId } },
    });
    await prisma.orderItem.deleteMany({ where: { order: { customerId } } });
    await prisma.order.deleteMany({ where: { customerId } });
    await prisma.stockMovement.deleteMany({ where: { productId } });
    await prisma.customer.delete({ where: { id: customerId } });
    await prisma.product.delete({ where: { id: productId } });
    await prisma.warehouse.delete({ where: { id: warehouseId } });
    await prisma.category.delete({ where: { id: categoryId } });
    await prisma.$disconnect();
    await app.close();
  });

  const createOrder = async (quantity: number, discount = 0) => {
    const res = await request(server())
      .post('/api/v1/orders')
      .set(auth())
      .send({
        customerId,
        warehouseId,
        discount,
        items: [{ productId, quantity, price: 15000 }],
      })
      .expect(201);
    return res.body.data;
  };

  let orderAId: number;

  it('creates a draft order with a correct discounted total', async () => {
    const order = await createOrder(4, 5000);
    orderAId = order.id;
    expect(order.status).toBe('draft');
    expect(Number(order.subtotal)).toBe(60000);
    expect(Number(order.discount)).toBe(5000);
    expect(Number(order.total)).toBe(55000);
    // draft does not touch stock
    expect(await stockOf()).toBe(10);
  });

  it('confirm: creates outflow movements and stamps OrderItem.cost', async () => {
    const res = await request(server())
      .post(`/api/v1/orders/${orderAId}/confirm`)
      .set(auth())
      .expect(201);
    expect(res.body.data.status).toBe('confirmed');

    const movements = await prisma.stockMovement.findMany({
      where: { refType: 'order', refId: orderAId },
    });
    expect(movements).toHaveLength(1);
    expect(movements[0].type).toBe('sale');
    expect(movements[0].quantity.toNumber()).toBe(-4);
    expect(await stockOf()).toBe(6);

    // FR-2.12: the current avgCost is stamped at confirm time
    const items = await prisma.orderItem.findMany({
      where: { orderId: orderAId },
    });
    expect(items[0].cost?.toNumber()).toBe(10000);
  });

  it('confirm fails with a clear error and no changes when stock is short', async () => {
    const order = await createOrder(100);
    const res = await request(server())
      .post(`/api/v1/orders/${order.id}/confirm`)
      .set(auth())
      .expect(400);
    expect(String(res.body.message)).toContain('qoldiq');

    const unchanged = await prisma.order.findUniqueOrThrow({
      where: { id: order.id },
    });
    expect(unchanged.status).toBe('draft');
    const movements = await prisma.stockMovement.findMany({
      where: { refType: 'order', refId: order.id },
    });
    expect(movements).toHaveLength(0);
    expect(await stockOf()).toBe(6);
  });

  it('sales return restores stock and rejects over-return', async () => {
    const res = await request(server())
      .post('/api/v1/sales-returns')
      .set(auth())
      .send({ orderId: orderAId, items: [{ productId, quantity: 1 }] })
      .expect(201);
    expect(Number(res.body.data.total)).toBe(15000);
    expect(await stockOf()).toBe(7);

    // sold 4, returned 1 — returning 4 more must fail
    const over = await request(server())
      .post('/api/v1/sales-returns')
      .set(auth())
      .send({ orderId: orderAId, items: [{ productId, quantity: 4 }] })
      .expect(400);
    expect(String(over.body.message)).toContain('oshib ketdi');
    expect(await stockOf()).toBe(7);
  });

  it('cancel creates return movements so the net stock effect is zero', async () => {
    const order = await createOrder(2);
    await request(server())
      .post(`/api/v1/orders/${order.id}/confirm`)
      .set(auth())
      .expect(201);
    expect(await stockOf()).toBe(5);

    const res = await request(server())
      .post(`/api/v1/orders/${order.id}/cancel`)
      .set(auth())
      .expect(201);
    expect(res.body.data.status).toBe('cancelled');

    const movements = await prisma.stockMovement.findMany({
      where: { refType: 'order', refId: order.id },
      orderBy: { id: 'asc' },
    });
    expect(movements).toHaveLength(2);
    expect(movements[1].quantity.toNumber()).toBe(2);
    expect(await stockOf()).toBe(7);
  });
});
