import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, TxSource, TxType } from '@prisma/client';
import { AuditService } from '../../common/audit/audit.service';
import { endOfDay } from '../../common/period.util';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AccountsService } from './accounts.service';
import { CreateTransactionDto } from './dto/finance.dto';

const TX_INCLUDE = {
  account: { select: { id: true, name: true, type: true } },
  category: { select: { id: true, name: true, type: true } },
} satisfies Prisma.TransactionInclude;

/** FR-3.2: transaction journal; only `manual` is created/deleted here. */
@Injectable()
export class TransactionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly accounts: AccountsService,
  ) {}

  async findAll(params: {
    page: number;
    limit: number;
    type?: TxType;
    accountId?: number;
    categoryId?: number;
    source?: TxSource;
    from?: string;
    to?: string;
    sort?: 'asc' | 'desc';
  }) {
    const {
      page,
      limit,
      type,
      accountId,
      categoryId,
      source,
      from,
      to,
      sort,
    } = params;
    const where: Prisma.TransactionWhereInput = {
      ...(type ? { type } : {}),
      ...(accountId ? { accountId } : {}),
      ...(categoryId ? { categoryId } : {}),
      ...(source ? { source } : {}),
      ...(from || to
        ? {
            date: {
              ...(from ? { gte: new Date(from) } : {}),
              ...(to ? { lte: endOfDay(to) } : {}),
            },
          }
        : {}),
    };
    const [transactions, total] = await this.prisma.$transaction([
      this.prisma.transaction.findMany({
        where,
        include: TX_INCLUDE,
        orderBy: sort ? { date: sort } : [{ date: 'desc' }, { id: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.transaction.count({ where }),
    ]);
    return { data: transactions, meta: { page, limit, total } };
  }

  async createManual(dto: CreateTransactionDto, userId: number) {
    const [account, category] = await Promise.all([
      this.prisma.account.findUnique({ where: { id: dto.accountId } }),
      this.prisma.txCategory.findUnique({ where: { id: dto.categoryId } }),
    ]);
    if (!account) throw new NotFoundException('Hisob topilmadi');
    if (!category) throw new NotFoundException('Kategoriya topilmadi');
    if (category.type !== dto.type) {
      throw new BadRequestException(
        'Kategoriya turi tranzaksiya turiga mos kelmaydi',
      );
    }

    const amount = new Prisma.Decimal(dto.amount);
    const created = await this.prisma.$transaction(async (tx) => {
      // TASK-001: expense must not overdraw the account (subject to the
      // "allow negative balance" setting + confirm-to-proceed flow)
      if (dto.type === 'expense') {
        await this.accounts.assertCanSpend(
          tx,
          dto.accountId,
          amount,
          dto.force ?? false,
        );
      }
      return tx.transaction.create({
        data: {
          type: dto.type,
          accountId: dto.accountId,
          amount,
          categoryId: dto.categoryId,
          source: 'manual',
          date: dto.date ? new Date(dto.date) : new Date(),
          note: dto.note,
          userId,
        },
        include: TX_INCLUDE,
      });
    });
    return created;
  }

  /** NFR-9 exception: only manual transactions are deleted, with audit. */
  async remove(id: number, userId: number) {
    const transaction = await this.prisma.transaction.findUnique({
      where: { id },
    });
    if (!transaction) throw new NotFoundException('Tranzaksiya topilmadi');
    if (transaction.source !== 'manual') {
      throw new BadRequestException(
        "Avtomatik tranzaksiya faqat manba hujjati orqali o'chiriladi (FR-3.2)",
      );
    }
    await this.prisma.$transaction(async (tx) => {
      await tx.transaction.delete({ where: { id } });
      await this.audit.log(
        {
          userId,
          action: 'transaction.delete',
          entity: 'Transaction',
          entityId: id,
          details: {
            type: transaction.type,
            amount: transaction.amount.toString(),
          },
        },
        tx,
      );
    });
    return { success: true };
  }
}

// kept as a re-export for existing importers (payments, finance)
export { endOfDay };
