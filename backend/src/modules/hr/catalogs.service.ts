import { ConflictException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';

/** FR-4.2: departments and positions — flat CRUD lists. */
@Injectable()
export class CatalogsService {
  constructor(private readonly prisma: PrismaService) {}

  listDepartments() {
    return this.prisma.department.findMany({
      include: { _count: { select: { employees: true } } },
      orderBy: { name: 'asc' },
    });
  }

  async createDepartment(name: string) {
    return this.prisma.department
      .create({ data: { name } })
      .catch(() => {
        throw new ConflictException("Bunday bo'lim allaqachon mavjud");
      });
  }

  listPositions() {
    return this.prisma.position.findMany({
      include: { _count: { select: { employees: true } } },
      orderBy: { name: 'asc' },
    });
  }

  async createPosition(name: string) {
    return this.prisma.position
      .create({ data: { name } })
      .catch(() => {
        throw new ConflictException('Bunday lavozim allaqachon mavjud');
      });
  }
}
