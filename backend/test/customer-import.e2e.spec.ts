import 'dotenv/config';
import { ValidationPipe, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
import cookieParser from 'cookie-parser';
import * as ExcelJS from 'exceljs';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppModule } from '../src/app.module';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';
import { TransformInterceptor } from '../src/common/interceptors/transform.interceptor';

/**
 * FR-8 for customers (Stage 2): template → preview (row errors +
 * duplicates by phone) → commit imports only the valid rows, with the
 * sales role.
 */
describe('customer import e2e', () => {
  const prisma = new PrismaClient();
  const suffix = Date.now().toString();
  const phone = `+99890${suffix.slice(-7)}`;

  let app: INestApplication;
  let token: string;

  const server = () => app.getHttpServer();

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

    // FR-8.1: customers import is allowed for the sales role
    const login = await request(server())
      .post('/api/v1/auth/login')
      .send({ email: 'sales@demo.uz', password: 'Demo1234!' })
      .expect(200);
    token = login.body.data.accessToken;
  });

  afterAll(async () => {
    await prisma.customer.deleteMany({
      where: { name: { startsWith: `Import-${suffix}` } },
    });
    await prisma.$disconnect();
    await app.close();
  });

  it('serves the template, previews with errors/duplicates, commits valid rows', async () => {
    await request(server())
      .get('/api/v1/imports/template?type=customers')
      .set('Authorization', `Bearer ${token}`)
      .expect(200)
      .expect('Content-Type', /spreadsheetml/);

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Mijozlar');
    sheet.addRow(['Nomi*', 'Telefon', 'Email', 'Manzil', 'Izoh']);
    sheet.addRow([`Import-${suffix} MChJ`, phone, 'a@b.uz', 'Toshkent', 'ok']);
    sheet.addRow(['', '+998911111111', '', '', '']); // error: no name
    sheet.addRow([`Import-${suffix} dublikat`, phone, '', '', '']); // dup phone
    const buffer = Buffer.from(await workbook.xlsx.writeBuffer());

    const preview = await request(server())
      .post('/api/v1/imports/preview')
      .set('Authorization', `Bearer ${token}`)
      .field('type', 'customers')
      .attach('file', buffer, 'customers.xlsx')
      .expect(201);
    const { summary, valid } = preview.body.data;
    expect(summary).toMatchObject({
      total: 3,
      valid: 1,
      errors: 1,
      duplicates: 1,
    });

    const commit = await request(server())
      .post('/api/v1/imports/commit')
      .set('Authorization', `Bearer ${token}`)
      .send({ type: 'customers', rows: valid })
      .expect(201);
    expect(commit.body.data.imported).toBe(1);

    const created = await prisma.customer.findFirst({ where: { phone } });
    expect(created?.name).toBe(`Import-${suffix} MChJ`);
  });

  it('rejects the products import for the sales role', async () => {
    await request(server())
      .get('/api/v1/imports/template?type=products')
      .set('Authorization', `Bearer ${token}`)
      .expect(403);
  });
});
