import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CreateWarehouseDto, UpdateWarehouseDto } from './dto/warehouse.dto';

@Injectable()
export class WarehousesService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(includeInactive = false) {
    return this.prisma.warehouse.findMany({
      where: includeInactive ? {} : { isActive: true },
      orderBy: { id: 'asc' },
    });
  }

  async create(dto: CreateWarehouseDto) {
    await this.ensureUniqueName(dto.name);
    return this.prisma.warehouse.create({ data: dto });
  }

  async update(id: number, dto: UpdateWarehouseDto) {
    const warehouse = await this.prisma.warehouse.findUnique({ where: { id } });
    if (!warehouse) throw new NotFoundException('Ombor topilmadi');
    if (dto.name && dto.name !== warehouse.name) {
      await this.ensureUniqueName(dto.name);
    }
    return this.prisma.warehouse.update({ where: { id }, data: dto });
  }

  private async ensureUniqueName(name: string) {
    const exists = await this.prisma.warehouse.findUnique({ where: { name } });
    if (exists) {
      throw new ConflictException('Bu nomdagi ombor allaqachon mavjud');
    }
  }
}
