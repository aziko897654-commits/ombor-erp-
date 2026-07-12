import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EmployeeStatus, Prisma } from '@prisma/client';
import { AuditService } from '../../common/audit/audit.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CreateEmployeeDto, UpdateEmployeeDto } from './dto/hr.dto';
import { monthRange } from './month.util';

const EMPLOYEE_INCLUDE = {
  department: { select: { id: true, name: true } },
  position: { select: { id: true, name: true } },
} satisfies Prisma.EmployeeInclude;

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

  async create(dto: CreateEmployeeDto) {
    await this.validateRefs(dto.departmentId, dto.positionId);
    return this.prisma.employee.create({
      data: {
        fullName: dto.fullName,
        phone: dto.phone,
        email: dto.email,
        departmentId: dto.departmentId,
        positionId: dto.positionId,
        salary: new Prisma.Decimal(dto.salary),
        hiredAt: new Date(dto.hiredAt),
      },
      include: EMPLOYEE_INCLUDE,
    });
  }

  async update(id: number, dto: UpdateEmployeeDto, userId: number) {
    const employee = await this.prisma.employee.findUnique({ where: { id } });
    if (!employee) throw new NotFoundException('Xodim topilmadi');
    if (dto.departmentId || dto.positionId) {
      await this.validateRefs(
        dto.departmentId ?? employee.departmentId,
        dto.positionId ?? employee.positionId,
      );
    }

    // FR-4.6: fired → keep the date; back to active → clear it
    const statusChange: Prisma.EmployeeUncheckedUpdateInput =
      dto.status === 'fired'
        ? { status: 'fired', firedAt: dto.firedAt ? new Date(dto.firedAt) : new Date() }
        : dto.status === 'active'
          ? { status: 'active', firedAt: null }
          : {};

    const updated = await this.prisma.employee.update({
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
      include: EMPLOYEE_INCLUDE,
    });

    if (dto.status && dto.status !== employee.status) {
      await this.audit.log({
        userId,
        action: dto.status === 'fired' ? 'employee.fire' : 'employee.activate',
        entity: 'Employee',
        entityId: id,
        details: { fullName: employee.fullName },
      });
    }
    return updated;
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
