import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CreateAccountDto } from './dto/finance.dto';

const ZERO = new Prisma.Decimal(0);

/** FR-3.1/3.4: cash and bank accounts with computed balances (NFR-10). */
@Injectable()
export class AccountsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Invariant 2: balance = openingBalance + SUM(income) − SUM(expense). */
  async balanceOf(
    client: Prisma.TransactionClient | PrismaService,
    accountId: number,
  ): Promise<Prisma.Decimal> {
    const account = await client.account.findUnique({
      where: { id: accountId },
    });
    if (!account) throw new NotFoundException('Hisob topilmadi');
    const sums = await client.transaction.groupBy({
      by: ['type'],
      where: { accountId },
      _sum: { amount: true },
    });
    let balance = account.openingBalance;
    for (const s of sums) {
      const amount = s._sum.amount ?? ZERO;
      balance = s.type === 'income' ? balance.plus(amount) : balance.minus(amount);
    }
    return balance;
  }

  async findAll() {
    const [accounts, sums] = await Promise.all([
      this.prisma.account.findMany({ orderBy: { id: 'asc' } }),
      this.prisma.transaction.groupBy({
        by: ['accountId', 'type'],
        _sum: { amount: true },
      }),
    ]);

    return accounts.map((account) => {
      let balance = account.openingBalance;
      for (const s of sums) {
        if (s.accountId !== account.id) continue;
        const amount = s._sum.amount ?? ZERO;
        balance =
          s.type === 'income' ? balance.plus(amount) : balance.minus(amount);
      }
      return { ...account, balance: balance.toString() };
    });
  }

  create(dto: CreateAccountDto) {
    return this.prisma.account.create({
      data: {
        name: dto.name,
        type: dto.type,
        openingBalance: new Prisma.Decimal(dto.openingBalance ?? 0),
      },
    });
  }
}
