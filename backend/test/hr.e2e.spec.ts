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

/**
 * Stage 4 DoD (e2e): an advance is auto-deducted in the month's
 * payroll; a second payroll for the same month is rejected; the sheet
 * total equals the sum of nets and lands in finance as ONE salary
 * expense; a fired employee is excluded from the next payroll.
 */
describe('hr contour e2e', () => {
  const prisma = new PrismaClient();
  const suffix = Date.now().toString();
  // unique far-future year so payroll months never collide with data
  const year = 2100 + (Date.now() % 300);
  const month1 = `${year}-03`;
  const month2 = `${year}-04`;

  let app: INestApplication;
  let token: string;
  let departmentId: number;
  let positionId: number;
  let employeeAId: number;
  let employeeBId: number;
  let accountId: number;
  let payroll1Id: number;

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
      .send({ email: 'hr@demo.uz', password: 'Demo1234!' })
      .expect(200);
    token = login.body.data.accessToken;

    accountId = (
      await prisma.account.create({
        data: { name: `hr-acc-${suffix}`, type: 'cash' },
      })
    ).id;
  });

  afterAll(async () => {
    // if beforeAll failed, ids are undefined and Prisma would treat
    // `where: { accountId: undefined }` as "no filter" — wiping whole
    // tables. Never clean up after an incomplete setup.
    if (!token || !accountId) {
      await prisma.$disconnect();
      await app?.close();
      return;
    }
    await prisma.transaction.deleteMany({ where: { accountId } });
    await prisma.payrollItem.deleteMany({
      where: { payroll: { month: { in: [month1, month2] } } },
    });
    await prisma.payroll.deleteMany({
      where: { month: { in: [month1, month2] } },
    });
    const employeeIds = [employeeAId, employeeBId].filter(Boolean);
    await prisma.advance.deleteMany({
      where: { employeeId: { in: employeeIds } },
    });
    await prisma.attendance.deleteMany({
      where: { employeeId: { in: employeeIds } },
    });
    await prisma.employee.deleteMany({ where: { id: { in: employeeIds } } });
    await prisma.department.deleteMany({ where: { id: departmentId } });
    await prisma.position.deleteMany({ where: { id: positionId } });
    await prisma.account.delete({ where: { id: accountId } });
    await prisma.$disconnect();
    await app.close();
  });

  it('creates catalogs and employees (FR-4.1/4.2)', async () => {
    const dep = await request(server())
      .post('/api/v1/departments')
      .set(auth())
      .send({ name: `Savdo-${suffix}` })
      .expect(201);
    departmentId = dep.body.data.id;

    const pos = await request(server())
      .post('/api/v1/positions')
      .set(auth())
      .send({ name: `Menejer-${suffix}` })
      .expect(201);
    positionId = pos.body.data.id;

    const employeeA = await request(server())
      .post('/api/v1/employees')
      .set(auth())
      .send({
        fullName: `Xodim A ${suffix}`,
        departmentId,
        positionId,
        salary: 3000000,
        hiredAt: '2026-01-10',
      })
      .expect(201);
    employeeAId = employeeA.body.data.id;
    expect(employeeA.body.data.status).toBe('active');

    const employeeB = await request(server())
      .post('/api/v1/employees')
      .set(auth())
      .send({
        fullName: `Xodim B ${suffix}`,
        departmentId,
        positionId,
        salary: 2000000,
        hiredAt: '2026-02-01',
      })
      .expect(201);
    employeeBId = employeeB.body.data.id;
  });

  it('attendance: set, toggle, clear (FR-4.3)', async () => {
    // TASK-015: attendance rejects pre-hire and future dates, so the
    // grid checks use a real past month (employee A hired 2026-01-10)
    const attMonth = '2026-03';
    const date = `${attMonth}-05`;
    await request(server())
      .post('/api/v1/attendance')
      .set(auth())
      .send({ employeeId: employeeAId, date, status: 'present' })
      .expect(201);
    // upsert on the same day flips the status
    await request(server())
      .post('/api/v1/attendance')
      .set(auth())
      .send({ employeeId: employeeAId, date, status: 'sick' })
      .expect(201);

    const grid = await request(server())
      .get(`/api/v1/attendance?month=${attMonth}`)
      .set(auth())
      .expect(200);
    const entry = grid.body.data.entries.find(
      (e: any) => e.employeeId === employeeAId,
    );
    expect(entry?.status).toBe('sick');

    await request(server())
      .post('/api/v1/attendance')
      .set(auth())
      .send({ employeeId: employeeAId, date, status: 'clear' })
      .expect(201);
    const after = await request(server())
      .get(`/api/v1/attendance?month=${attMonth}`)
      .set(auth())
      .expect(200);
    expect(
      after.body.data.entries.some((e: any) => e.employeeId === employeeAId),
    ).toBe(false);

    // TASK-015: future and pre-hire dates are rejected
    await request(server())
      .post('/api/v1/attendance')
      .set(auth())
      .send({ employeeId: employeeAId, date: `${year}-03-05`, status: 'present' })
      .expect(400);
    await request(server())
      .post('/api/v1/attendance')
      .set(auth())
      .send({ employeeId: employeeAId, date: '2026-01-05', status: 'present' })
      .expect(400);
  });

  it('advance creates a source=advance expense transaction (FR-4.4)', async () => {
    const res = await request(server())
      .post('/api/v1/advances')
      .set(auth())
      .send({
        employeeId: employeeAId,
        accountId,
        amount: 500000,
        date: `${year}-03-15`,
      })
      .expect(201);
    const advanceId = res.body.data.id;

    const transaction = await prisma.transaction.findFirst({
      where: { source: 'advance', refId: advanceId },
      include: { category: true },
    });
    expect(transaction?.type).toBe('expense');
    expect(transaction?.amount.toNumber()).toBe(500000);
    expect(transaction?.category.name).toBe('Ish haqi avansi');
  });

  it('payroll preview auto-deducts the month advances', async () => {
    const res = await request(server())
      .get(`/api/v1/payroll/preview?month=${month1}`)
      .set(auth())
      .expect(200);
    const rowA = res.body.data.rows.find(
      (r: any) => r.employeeId === employeeAId,
    );
    expect(Number(rowA?.advance)).toBe(500000);
    expect(Number(rowA?.baseSalary)).toBe(3000000);
  });

  it('payroll: net formula, total = sum(net), ONE salary expense (FR-4.5)', async () => {
    const res = await request(server())
      .post('/api/v1/payroll')
      .set(auth())
      .send({
        month: month1,
        accountId,
        items: [{ employeeId: employeeAId, bonus: 200000, penalty: 100000 }],
      })
      .expect(201);
    payroll1Id = res.body.data.id;

    const items = res.body.data.items;
    const itemA = items.find((i: any) => i.employeeId === employeeAId);
    // 3 000 000 + 200 000 − 100 000 − 500 000 = 2 600 000
    expect(Number(itemA.amount)).toBe(2600000);
    expect(Number(itemA.advance)).toBe(500000);

    const sumOfNets = items.reduce(
      (acc: number, i: any) => acc + Number(i.amount),
      0,
    );
    expect(Number(res.body.data.total)).toBe(sumOfNets);

    const transactions = await prisma.transaction.findMany({
      where: { source: 'salary', refId: payroll1Id },
      include: { category: true },
    });
    expect(transactions).toHaveLength(1);
    expect(transactions[0].amount.toNumber()).toBe(sumOfNets);
    expect(transactions[0].category.name).toBe('Ish haqi');
  });

  it('a second payroll for the same month is rejected (FR-4.5)', async () => {
    await request(server())
      .post('/api/v1/payroll')
      .set(auth())
      .send({ month: month1, accountId })
      .expect(409);
    await request(server())
      .get(`/api/v1/payroll/preview?month=${month1}`)
      .set(auth())
      .expect(409);
  });

  it('a fired employee is excluded from the next payroll (FR-4.6)', async () => {
    const fired = await request(server())
      .patch(`/api/v1/employees/${employeeBId}`)
      .set(auth())
      .send({ status: 'fired', firedAt: `${year}-03-31` })
      .expect(200);
    expect(fired.body.data.status).toBe('fired');
    expect(fired.body.data.firedAt).not.toBeNull();

    const res = await request(server())
      .post('/api/v1/payroll')
      .set(auth())
      .send({ month: month2, accountId })
      .expect(201);
    const ids = res.body.data.items.map((i: any) => i.employeeId);
    expect(ids).toContain(employeeAId);
    expect(ids).not.toContain(employeeBId);
  });

  it('roles: accountant reads a payroll, sales gets 403', async () => {
    const accountant = await request(server())
      .post('/api/v1/auth/login')
      .send({ email: 'accountant@demo.uz', password: 'Demo1234!' })
      .expect(200);
    await request(server())
      .get(`/api/v1/payroll/${payroll1Id}`)
      .set('Authorization', `Bearer ${accountant.body.data.accessToken}`)
      .expect(200);

    const sales = await request(server())
      .post('/api/v1/auth/login')
      .send({ email: 'sales@demo.uz', password: 'Demo1234!' })
      .expect(200);
    for (const path of ['/api/v1/employees', '/api/v1/payroll', '/api/v1/advances']) {
      await request(server())
        .get(path)
        .set('Authorization', `Bearer ${sales.body.data.accessToken}`)
        .expect(403);
    }
  });
});
