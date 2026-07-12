import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { TxType } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CreateTxCategoryDto, UpdateTxCategoryDto } from './dto/finance.dto';

/** FR-3.3: income/expense categories. */
@Injectable()
export class TxCategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(type?: TxType) {
    return this.prisma.txCategory.findMany({
      where: type ? { type } : {},
      include: { _count: { select: { transactions: true } } },
      orderBy: [{ type: 'asc' }, { name: 'asc' }],
    });
  }

  async create(dto: CreateTxCategoryDto) {
    const existing = await this.prisma.txCategory.findFirst({
      where: { name: dto.name, type: dto.type },
    });
    if (existing) {
      throw new ConflictException('Bunday kategoriya allaqachon mavjud');
    }
    return this.prisma.txCategory.create({ data: dto });
  }

  async update(id: number, dto: UpdateTxCategoryDto) {
    const category = await this.prisma.txCategory.findUnique({ where: { id } });
    if (!category) throw new NotFoundException('Kategoriya topilmadi');
    const duplicate = await this.prisma.txCategory.findFirst({
      where: { name: dto.name, type: category.type, id: { not: id } },
    });
    if (duplicate) {
      throw new ConflictException('Bunday kategoriya allaqachon mavjud');
    }
    return this.prisma.txCategory.update({
      where: { id },
      data: { name: dto.name },
    });
  }

  /** Only empty categories may be removed (history stays intact, NFR-9). */
  async remove(id: number) {
    const category = await this.prisma.txCategory.findUnique({
      where: { id },
      include: { _count: { select: { transactions: true } } },
    });
    if (!category) throw new NotFoundException('Kategoriya topilmadi');
    if (category._count.transactions > 0) {
      throw new ConflictException(
        "Bu kategoriyada tranzaksiyalar bor — o'chirish mumkin emas",
      );
    }
    await this.prisma.txCategory.delete({ where: { id } });
    return { success: true };
  }
}
