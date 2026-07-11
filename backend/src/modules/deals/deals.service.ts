import { Injectable, NotFoundException } from '@nestjs/common';
import { DealStage, Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CreateDealDto, UpdateDealDto } from './dto/deal.dto';

const DEAL_INCLUDE = {
  customer: { select: { id: true, name: true } },
  manager: { select: { id: true, firstName: true, lastName: true } },
} satisfies Prisma.DealInclude;

@Injectable()
export class DealsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(page: number, limit: number, stage?: DealStage) {
    const where: Prisma.DealWhereInput = stage ? { stage } : {};
    const [deals, total] = await this.prisma.$transaction([
      this.prisma.deal.findMany({
        where,
        include: DEAL_INCLUDE,
        orderBy: { updatedAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.deal.count({ where }),
    ]);
    return { data: deals, meta: { page, limit, total } };
  }

  /** FR-1.3: kanban board — deals grouped by stage. */
  async board() {
    const deals = await this.prisma.deal.findMany({
      include: DEAL_INCLUDE,
      orderBy: { updatedAt: 'desc' },
    });
    const columns: Record<DealStage, typeof deals> = {
      new: [],
      negotiation: [],
      won: [],
      lost: [],
    };
    for (const deal of deals) columns[deal.stage].push(deal);
    return columns;
  }

  async create(dto: CreateDealDto, userId: number) {
    const customer = await this.prisma.customer.findUnique({
      where: { id: dto.customerId },
    });
    if (!customer) throw new NotFoundException('Mijoz topilmadi');

    return this.prisma.deal.create({
      data: {
        title: dto.title,
        customerId: dto.customerId,
        amount: new Prisma.Decimal(dto.amount),
        stage: dto.stage ?? 'new',
        managerId: dto.managerId ?? userId,
        note: dto.note,
      },
      include: DEAL_INCLUDE,
    });
  }

  async update(id: number, dto: UpdateDealDto) {
    const deal = await this.prisma.deal.findUnique({ where: { id } });
    if (!deal) throw new NotFoundException('Bitim topilmadi');
    if (dto.customerId) {
      const customer = await this.prisma.customer.findUnique({
        where: { id: dto.customerId },
      });
      if (!customer) throw new NotFoundException('Mijoz topilmadi');
    }
    const { amount, ...rest } = dto;
    return this.prisma.deal.update({
      where: { id },
      data: {
        ...rest,
        ...(amount !== undefined ? { amount: new Prisma.Decimal(amount) } : {}),
      },
      include: DEAL_INCLUDE,
    });
  }
}
