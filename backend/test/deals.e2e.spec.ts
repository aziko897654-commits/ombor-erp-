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

/** FR-1.3: deal funnel — create, move by stages, kanban board. */
describe('deals e2e', () => {
  const prisma = new PrismaClient();
  const suffix = Date.now().toString();

  let app: INestApplication;
  let token: string;
  let customerId: number;
  let dealId: number;

  const server = () => app.getHttpServer();
  const auth = () => ({ Authorization: `Bearer ${token}` });

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
      .send({ email: 'sales@demo.uz', password: 'Demo1234!' })
      .expect(200);
    token = login.body.data.accessToken;

    const customer = await prisma.customer.create({
      data: { name: `deal-e2e-${suffix}` },
    });
    customerId = customer.id;
  });

  afterAll(async () => {
    await prisma.deal.deleteMany({ where: { customerId } });
    await prisma.customer.delete({ where: { id: customerId } });
    await prisma.$disconnect();
    await app.close();
  });

  it('creates a deal defaulting to the current user as manager', async () => {
    const res = await request(server())
      .post('/api/v1/deals')
      .set(auth())
      .send({
        title: `Deal ${suffix}`,
        customerId,
        amount: 2500000,
        note: 'e2e',
      })
      .expect(201);
    dealId = res.body.data.id;
    expect(res.body.data.stage).toBe('new');
    expect(res.body.data.manager?.id).toBeDefined();
  });

  it('moves the deal along the funnel and shows it on the board', async () => {
    const res = await request(server())
      .patch(`/api/v1/deals/${dealId}`)
      .set(auth())
      .send({ stage: 'negotiation' })
      .expect(200);
    expect(res.body.data.stage).toBe('negotiation');

    const board = await request(server())
      .get('/api/v1/deals/board')
      .set(auth())
      .expect(200);
    const columns = board.body.data;
    expect(columns.negotiation.some((d: any) => d.id === dealId)).toBe(true);
    expect(columns.new.some((d: any) => d.id === dealId)).toBe(false);
  });
});
