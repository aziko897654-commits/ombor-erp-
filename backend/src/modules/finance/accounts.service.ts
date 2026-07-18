import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
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

  /**
   * TASK-001: guards every money-out operation (manual expense, outgoing
   * payment, transfer) against overdrawing an account. Takes the same
   * advisory lock the balance is read under, so concurrent submissions
   * can't both pass the check and jointly overdraw it.
   *
   * - setting off (default): always blocks going negative.
   * - setting on + !force: blocks once, with a 409 the frontend turns
   *   into a "continue anyway?" confirm dialog.
   * - setting on + force: the confirm was accepted, let it through.
   */
  async assertCanSpend(
    tx: Prisma.TransactionClient,
    accountId: number,
    amount: Prisma.Decimal,
    force: boolean,
  ): Promise<void> {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`account-${accountId}`}))`;

    const account = await tx.account.findUnique({ where: { id: accountId } });
    if (!account) throw new NotFoundException('Hisob topilmadi');

    const balance = await this.balanceOf(tx, accountId);
    const resulting = balance.minus(amount);
    if (!resulting.isNegative()) return;

    const setting = await tx.appSetting.findUnique({ where: { id: 1 } });
    const current = balance.toString();
    const after = resulting.toString();
    if (!setting?.allowNegativeBalance) {
      throw new BadRequestException(
        `"${account.name}" hisobida mablag' yetarli emas. Joriy qoldiq: ${current} so'm.`,
      );
    }
    if (!force) {
      throw new ConflictException(
        `Diqqat! "${account.name}" hisobida mablag' yetarli emas. Joriy qoldiq: ${current} so'm. Amal bajarilsa balans manfiy bo'ladi: ${after} so'm.`,
      );
    }
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
