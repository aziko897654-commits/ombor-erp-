import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { SetAttendanceDto } from './dto/hr.dto';
import { monthRange } from './month.util';

/** FR-4.3: daily journal; the month grid is rows=employees, cols=days. */
@Injectable()
export class AttendanceService {
  constructor(private readonly prisma: PrismaService) {}

  async month(month: string) {
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
      throw new BadRequestException("Oy formati noto'g'ri (YYYY-MM)");
    }
    const { start, end } = monthRange(month);
    const [employees, entries] = await Promise.all([
      this.prisma.employee.findMany({
        where: { status: 'active' },
        select: { id: true, fullName: true },
        orderBy: { fullName: 'asc' },
      }),
      this.prisma.attendance.findMany({
        where: { date: { gte: start, lt: end } },
        select: { employeeId: true, date: true, status: true },
      }),
    ]);
    return { month, employees, entries };
  }

  /** Upsert on (employeeId, date); 'clear' removes the mark. */
  async set(dto: SetAttendanceDto) {
    const employee = await this.prisma.employee.findUnique({
      where: { id: dto.employeeId },
    });
    if (!employee) throw new NotFoundException('Xodim topilmadi');
    if (employee.status !== 'active') {
      throw new BadRequestException(
        'Faol bo\'lmagan xodim uchun davomat belgilanmaydi',
      );
    }

    const date = new Date(dto.date);
    if (dto.status === 'clear') {
      await this.prisma.attendance.deleteMany({
        where: { employeeId: dto.employeeId, date },
      });
      return { employeeId: dto.employeeId, date: dto.date, status: null };
    }

    return this.prisma.attendance.upsert({
      where: {
        employeeId_date: { employeeId: dto.employeeId, date },
      },
      update: { status: dto.status },
      create: { employeeId: dto.employeeId, date, status: dto.status },
    });
  }
}
