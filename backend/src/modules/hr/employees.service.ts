import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EmployeeStatus, Prisma, Role } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { AuditService } from '../../common/audit/audit.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CreateEmployeeDto, UpdateEmployeeDto } from './dto/hr.dto';
import { monthRange } from './month.util';

const EMPLOYEE_INCLUDE = {
  department: { select: { id: true, name: true } },
  position: { select: { id: true, name: true } },
  // linked login account (never exposes passwordHash)
  user: { select: { id: true, email: true, role: true, isActive: true } },
} satisfies Prisma.EmployeeInclude;

/** Splits "Akmal Rustamov" → firstName/lastName for the User record. */
function splitName(fullName: string): { firstName: string; lastName: string } {
  const parts = fullName.trim().split(/\s+/);
  const firstName = parts.shift() ?? fullName;
  return { firstName, lastName: parts.join(' ') || '-' };
}

/** FR-4.1/4.6: employees CRUD; firing is a status, never a delete (NFR-9). */
@Injectable()
export class EmployeesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async findAll(params: {
    page: number;
    limit: number;
    search?: string;
    status?: EmployeeStatus;
  }) {
    const { page, limit, search, status } = params;
    const where: Prisma.EmployeeWhereInput = {
      ...(status ? { status } : {}),
      ...(search
        ? { fullName: { contains: search, mode: 'insensitive' } }
        : {}),
    };
    const [employees, total] = await this.prisma.$transaction([
      this.prisma.employee.findMany({
        where,
        include: EMPLOYEE_INCLUDE,
        orderBy: { fullName: 'asc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.employee.count({ where }),
    ]);
    return { data: employees, meta: { page, limit, total } };
  }

  /** Card: info + current-month attendance summary + pay history. */
  async findOne(id: number) {
    const employee = await this.prisma.employee.findUnique({
      where: { id },
      include: EMPLOYEE_INCLUDE,
    });
    if (!employee) throw new NotFoundException('Xodim topilmadi');

    const now = new Date();
    const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const { start, end } = monthRange(month);

    const [attendance, payrollItems, advances] = await Promise.all([
      this.prisma.attendance.groupBy({
        by: ['status'],
        where: { employeeId: id, date: { gte: start, lt: end } },
        _count: { _all: true },
      }),
      this.prisma.payrollItem.findMany({
        where: { employeeId: id },
        include: { payroll: { select: { id: true, month: true } } },
        orderBy: { id: 'desc' },
        take: 24,
      }),
      this.prisma.advance.findMany({
        where: { employeeId: id },
        orderBy: { id: 'desc' },
        take: 20,
      }),
    ]);

    return {
      ...employee,
      attendanceSummary: {
        month,
        counts: Object.fromEntries(
          attendance.map((a) => [a.status, a._count._all]),
        ),
      },
      payrollItems,
      advances,
    };
  }

  async create(dto: CreateEmployeeDto, actorRole: Role, actorId: number) {
    await this.validateRefs(dto.departmentId, dto.positionId);
    const wantsLogin = dto.password != null || dto.role != null;
    if (wantsLogin) this.assertCanProvision(actorRole, dto);

    const employee = await this.prisma.$transaction(async (tx) => {
      const created = await tx.employee.create({
        data: {
          fullName: dto.fullName,
          phone: dto.phone,
          email: dto.email,
          departmentId: dto.departmentId,
          positionId: dto.positionId,
          salary: new Prisma.Decimal(dto.salary),
          hiredAt: new Date(dto.hiredAt),
        },
      });

      if (wantsLogin) {
        await this.provisionLogin(tx, {
          employeeId: created.id,
          fullName: dto.fullName,
          email: dto.email!,
          role: dto.role!,
          password: dto.password!,
          isActive: true,
          actorId,
        });
      }
      return created;
    });

    return this.withIncludes(employee.id);
  }

  async update(id: number, dto: UpdateEmployeeDto, actorRole: Role, actorId: number) {
    const employee = await this.prisma.employee.findUnique({
      where: { id },
      include: { user: true },
    });
    if (!employee) throw new NotFoundException('Xodim topilmadi');
    if (dto.departmentId || dto.positionId) {
      await this.validateRefs(
        dto.departmentId ?? employee.departmentId,
        dto.positionId ?? employee.positionId,
      );
    }

    const wantsLoginChange = dto.password != null || dto.role != null;
    if (wantsLoginChange && actorRole !== Role.admin) {
      throw new ForbiddenException(
        'Login faqat administrator tomonidan beriladi/o\'zgartiriladi',
      );
    }

    // FR-4.6: fired → keep the date; back to active → clear it
    const statusChange: Prisma.EmployeeUncheckedUpdateInput =
      dto.status === 'fired'
        ? { status: 'fired', firedAt: dto.firedAt ? new Date(dto.firedAt) : new Date() }
        : dto.status === 'active'
          ? { status: 'active', firedAt: null }
          : {};

    const nextStatus = dto.status ?? employee.status;
    const nextEmail = dto.email ?? employee.email ?? undefined;

    await this.prisma.$transaction(async (tx) => {
      await tx.employee.update({
        where: { id },
        data: {
          fullName: dto.fullName ?? undefined,
          phone: dto.phone ?? undefined,
          email: dto.email ?? undefined,
          departmentId: dto.departmentId ?? undefined,
          positionId: dto.positionId ?? undefined,
          salary:
            dto.salary !== undefined ? new Prisma.Decimal(dto.salary) : undefined,
          hiredAt: dto.hiredAt ? new Date(dto.hiredAt) : undefined,
          ...statusChange,
        },
      });

      if (employee.user) {
        // login always follows employment status (fired disables login)
        const data: Prisma.UserUpdateInput = {
          isActive: nextStatus === 'active',
        };
        // credential/role/email edits are admin-only
        if (actorRole === Role.admin) {
          if (dto.role) data.role = dto.role;
          if (dto.password) {
            data.passwordHash = await bcrypt.hash(dto.password, 10);
          }
          if (dto.fullName) {
            const { firstName, lastName } = splitName(dto.fullName);
            data.firstName = firstName;
            data.lastName = lastName;
          }
          if (dto.email && dto.email !== employee.user.email) {
            await this.assertEmailFree(tx, dto.email);
            data.email = dto.email;
          }
        }
        await tx.user.update({ where: { id: employee.user.id }, data });
      } else if (wantsLoginChange) {
        // provision a brand-new login for this employee (admin only)
        if (!nextEmail) {
          throw new BadRequestException('Login uchun email kiritilishi shart');
        }
        if (!dto.password || !dto.role) {
          throw new BadRequestException('Login uchun parol va rol shart');
        }
        await this.provisionLogin(tx, {
          employeeId: id,
          fullName: dto.fullName ?? employee.fullName,
          email: nextEmail,
          role: dto.role,
          password: dto.password,
          isActive: nextStatus === 'active',
          actorId,
        });
      }
    });

    if (dto.status && dto.status !== employee.status) {
      await this.audit.log({
        userId: actorId,
        action: dto.status === 'fired' ? 'employee.fire' : 'employee.activate',
        entity: 'Employee',
        entityId: id,
        details: { fullName: employee.fullName },
      });
    }
    return this.withIncludes(id);
  }

  private assertCanProvision(actorRole: Role, dto: CreateEmployeeDto) {
    if (actorRole !== Role.admin) {
      throw new ForbiddenException(
        'Login faqat administrator tomonidan beriladi',
      );
    }
    if (!dto.email) {
      throw new BadRequestException('Login uchun email kiritilishi shart');
    }
    if (!dto.password || !dto.role) {
      throw new BadRequestException('Login uchun parol va rol shart');
    }
  }

  private async provisionLogin(
    tx: Prisma.TransactionClient,
    input: {
      employeeId: number;
      fullName: string;
      email: string;
      role: Role;
      password: string;
      isActive: boolean;
      actorId: number;
    },
  ) {
    await this.assertEmailFree(tx, input.email);
    const { firstName, lastName } = splitName(input.fullName);
    const user = await tx.user.create({
      data: {
        email: input.email,
        firstName,
        lastName,
        role: input.role,
        isActive: input.isActive,
        passwordHash: await bcrypt.hash(input.password, 10),
      },
    });
    await tx.employee.update({
      where: { id: input.employeeId },
      data: { userId: user.id },
    });
    await this.audit.log(
      {
        userId: input.actorId,
        action: 'user.create',
        entity: 'User',
        entityId: user.id,
        details: {
          email: user.email,
          role: user.role,
          viaEmployee: input.employeeId,
        },
      },
      tx,
    );
  }

  private async assertEmailFree(tx: Prisma.TransactionClient, email: string) {
    const exists = await tx.user.findUnique({ where: { email } });
    if (exists) {
      throw new ConflictException('Bu email allaqachon band');
    }
  }

  private withIncludes(id: number) {
    return this.prisma.employee.findUnique({
      where: { id },
      include: EMPLOYEE_INCLUDE,
    });
  }

  private async validateRefs(departmentId: number, positionId: number) {
    const [department, position] = await Promise.all([
      this.prisma.department.findUnique({ where: { id: departmentId } }),
      this.prisma.position.findUnique({ where: { id: positionId } }),
    ]);
    if (!department) throw new BadRequestException("Bo'lim topilmadi");
    if (!position) throw new BadRequestException('Lavozim topilmadi');
  }
}
