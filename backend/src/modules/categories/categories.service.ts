import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';

@Injectable()
export class CategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.category.findMany({
      orderBy: { name: 'asc' },
      include: { _count: { select: { products: true } } },
    });
  }

  async create(name: string) {
    await this.ensureUniqueName(name);
    return this.prisma.category.create({ data: { name } });
  }

  async update(id: number, name: string) {
    const category = await this.prisma.category.findUnique({ where: { id } });
    if (!category) throw new NotFoundException('Kategoriya topilmadi');
    if (name !== category.name) await this.ensureUniqueName(name);
    return this.prisma.category.update({ where: { id }, data: { name } });
  }

  async remove(id: number) {
    const category = await this.prisma.category.findUnique({
      where: { id },
      include: { _count: { select: { products: true } } },
    });
    if (!category) throw new NotFoundException('Kategoriya topilmadi');
    if (category._count.products > 0) {
      throw new ConflictException(
        "Bu kategoriyada mahsulotlar bor — o'chirish mumkin emas",
      );
    }
    await this.prisma.category.delete({ where: { id } });
    return { success: true };
  }

  private async ensureUniqueName(name: string) {
    const exists = await this.prisma.category.findUnique({ where: { name } });
    if (exists) {
      throw new ConflictException('Bu nomdagi kategoriya allaqachon mavjud');
    }
  }
}
