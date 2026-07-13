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
 * Employee ↔ login account link: an admin gives an employee an email +
 * role + password; the employee then signs in with those credentials.
 * Firing the employee disables the login; reactivating restores it; HR
 * cannot provision a login (rights matrix 2.1).
 *
 * Own app instance (own throttler storage) so the several logins here
 * do not count against another suite's FR-0.5 limit.
 */
describe('employee login provisioning e2e', () => {
  const prisma = new PrismaClient();
  const suffix = Date.now().toString();
  const loginEmail = `emp-login-${suffix}@demo.uz`;

  let app: INestApplication;
  let adminToken: string;
  let hrToken: string;
  let departmentId: number;
  let positionId: number;
  let employeeId: number;
  let otherEmployeeId: number;

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

    adminToken = (
      await request(server())
        .post('/api/v1/auth/login')
        .send({ email: 'admin@demo.uz', password: 'Demo1234!' })
        .expect(200)
    ).body.data.accessToken;
    hrToken = (
      await request(server())
        .post('/api/v1/auth/login')
        .send({ email: 'hr@demo.uz', password: 'Demo1234!' })
        .expect(200)
    ).body.data.accessToken;

    departmentId = (
      await prisma.department.create({ data: { name: `dep-login-${suffix}` } })
    ).id;
    positionId = (
      await prisma.position.create({ data: { name: `pos-login-${suffix}` } })
    ).id;
    employeeId = (
      await prisma.employee.create({
        data: {
          fullName: `Login Test ${suffix}`,
          departmentId,
          positionId,
          salary: '3000000',
          hiredAt: new Date('2026-01-10'),
        },
      })
    ).id;
    otherEmployeeId = (
      await prisma.employee.create({
        data: {
          fullName: `Other ${suffix}`,
          departmentId,
          positionId,
          salary: '3000000',
          hiredAt: new Date('2026-01-10'),
        },
      })
    ).id;
  });

  afterAll(async () => {
    const ids = [employeeId, otherEmployeeId];
    // a company-wide payroll could reference these employees; clear
    // dependents before deleting them
    await prisma.payrollItem.deleteMany({ where: { employeeId: { in: ids } } });
    await prisma.attendance.deleteMany({ where: { employeeId: { in: ids } } });
    await prisma.advance.deleteMany({ where: { employeeId: { in: ids } } });
    await prisma.employee.deleteMany({ where: { id: { in: ids } } });
    // linked login accounts are unlinked once the employees are gone
    await prisma.user.deleteMany({ where: { email: { contains: suffix } } });
    await prisma.position.delete({ where: { id: positionId } });
    await prisma.department.delete({ where: { id: departmentId } });
    await prisma.$disconnect();
    await app.close();
  });

  it('admin grants a login; the employee signs in with it', async () => {
    const granted = await request(server())
      .patch(`/api/v1/employees/${employeeId}`)
      .set(asAdmin())
      .send({ email: loginEmail, role: 'sales', password: 'EmpPass123!' })
      .expect(200);
    expect(granted.body.data.user.email).toBe(loginEmail);
    expect(granted.body.data.user.role).toBe('sales');
    expect(granted.body.data.user.isActive).toBe(true);

    const asEmployee = await request(server())
      .post('/api/v1/auth/login')
      .send({ email: loginEmail, password: 'EmpPass123!' })
      .expect(200);
    expect(asEmployee.body.data.user.role).toBe('sales');
    expect(asEmployee.body.data.user.firstName).toBe('Login');
  });

  it('firing disables the login; reactivating + new password restores it (FR-4.6)', async () => {
    await request(server())
      .patch(`/api/v1/employees/${employeeId}`)
      .set(asAdmin())
      .send({ status: 'fired' })
      .expect(200);
    // the old credentials no longer work while fired
    await request(server())
      .post('/api/v1/auth/login')
      .send({ email: loginEmail, password: 'EmpPass123!' })
      .expect(401);

    // reactivate and rotate the password in one edit
    await request(server())
      .patch(`/api/v1/employees/${employeeId}`)
      .set(asAdmin())
      .send({ status: 'active', password: 'NewPass456!' })
      .expect(200);
    // restored, and the new password is in effect
    await request(server())
      .post('/api/v1/auth/login')
      .send({ email: loginEmail, password: 'NewPass456!' })
      .expect(200);
  });

  it('HR cannot provision a login but can still edit the employee (matrix 2.1)', async () => {
    await request(server())
      .patch(`/api/v1/employees/${otherEmployeeId}`)
      .set({ Authorization: `Bearer ${hrToken}` })
      .send({
        email: `hr-try-${suffix}@demo.uz`,
        role: 'sales',
        password: 'EmpPass123!',
      })
      .expect(403);

    const edited = await request(server())
      .patch(`/api/v1/employees/${otherEmployeeId}`)
      .set({ Authorization: `Bearer ${hrToken}` })
      .send({ phone: '+998900000001' })
      .expect(200);
    expect(edited.body.data.phone).toBe('+998900000001');
    expect(edited.body.data.user).toBeNull();
  });

  it('a duplicate login email is rejected (409)', async () => {
    await request(server())
      .patch(`/api/v1/employees/${otherEmployeeId}`)
      .set(asAdmin())
      .send({ email: 'admin@demo.uz', role: 'sales', password: 'EmpPass123!' })
      .expect(409);
  });
});
