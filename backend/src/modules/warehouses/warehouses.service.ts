import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CreateWarehouseDto, UpdateWarehouseDto } from './dto/warehouse.dto';

@Injectable()
export class WarehousesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(includeInactive = false) {
    const [warehouses, counts] = await Promise.all([
      this.prisma.warehouse.findMany({
        where: includeInactive ? {} : { isActive: true },
        orderBy: { id: 'asc' },
      }),
      // how many distinct products are actually stocked per warehouse
      this.prisma.$queryRaw<Array<{ warehouseId: number; count: bigint }>>(
        Prisma.sql`SELECT "warehouseId", COUNT(*) AS count FROM (
                     SELECT "warehouseId", "productId", SUM("quantity") AS qty
                     FROM "StockMovement"
                     GROUP BY "warehouseId", "productId"
                   ) t WHERE qty > 0 GROUP BY "warehouseId"`,
      ),
    ]);
    const countById = new Map(counts.map((c) => [c.warehouseId, Number(c.count)]));
    return warehouses.map((w) => ({
      ...w,
      productCount: countById.get(w.id) ?? 0,
    }));
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
