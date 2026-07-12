import { Injectable } from '@nestjs/common';
import { Prisma, Role } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { ProductsService } from '../products/products.service';

export interface NotifyPayload {
  title: string;
  message: string;
  link?: string;
  /** FR-7.3: same event notifies once until the condition resets. */
  dedupeKey?: string;
}

const SWEEP_INTERVAL_MS = 55_000;
const OVERDUE_DAYS = 7;

/** FR-7: in-app notifications; the 60s polling GET triggers the sweep. */
@Injectable()
export class NotificationsService {
  private lastSweep = 0;

  constructor(
    private readonly prisma: PrismaService,
    private readonly products: ProductsService,
  ) {}

  async list(userId: number, page: number, limit: number) {
    await this.sweepIfDue();
    const [notifications, total, unread] = await this.prisma.$transaction([
      this.prisma.notification.findMany({
        where: { userId },
        orderBy: { id: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.notification.count({ where: { userId } }),
      this.prisma.notification.count({ where: { userId, isRead: false } }),
    ]);
    return { data: notifications, meta: { page, limit, total, unread } };
  }

  async markRead(userId: number, ids?: number[], all?: boolean) {
    await this.prisma.notification.updateMany({
      where: {
        userId,
        isRead: false,
        ...(all ? {} : { id: { in: ids ?? [] } }),
      },
      data: { isRead: true },
    });
    const unread = await this.prisma.notification.count({
      where: { userId, isRead: false },
    });
    return { unread };
  }

  /**
   * FR-7.2: creates the notification for every active user holding one
   * of the roles. With a dedupeKey, users who already carry an active
   * notification for the key are skipped (FR-7.3).
   */
  async notifyRoles(
    roles: Role[],
    payload: NotifyPayload,
    tx?: Prisma.TransactionClient,
  ): Promise<void> {
    const client = tx ?? this.prisma;
    const users = await client.user.findMany({
      where: { role: { in: roles }, isActive: true },
      select: { id: true },
    });
    let targets = users;
    if (payload.dedupeKey) {
      const existing = await client.notification.findMany({
        where: { dedupeKey: payload.dedupeKey },
        select: { userId: true },
      });
      const skip = new Set(existing.map((e) => e.userId));
      targets = users.filter((u) => !skip.has(u.id));
    }
    if (targets.length === 0) return;
    await client.notification.createMany({
      data: targets.map((u) => ({
        userId: u.id,
        title: payload.title,
        message: payload.message,
        link: payload.link,
        dedupeKey: payload.dedupeKey,
      })),
    });
  }

  /** Runs at most once per polling interval, whoever polls first. */
  private async sweepIfDue(): Promise<void> {
    const now = Date.now();
    if (now - this.lastSweep < SWEEP_INTERVAL_MS) return;
    this.lastSweep = now;
    try {
      await this.sweepLowStock();
      await this.sweepOverdueInvoices();
    } catch {
      // a failed sweep must never break the notifications list
      this.lastSweep = 0;
    }
  }

  /** FR-7.2 row 1: stock fell to min_stock — admin, warehouse. */
  private async sweepLowStock(): Promise<void> {
    const low = await this.products.findLowStock();
    const lowKeys = new Set(low.map((p) => `low-stock:${p.id}`));

    // condition reset (FR-7.3): recovered products release their key
    const activeKeys = await this.prisma.notification.findMany({
      where: { dedupeKey: { startsWith: 'low-stock:' } },
      select: { dedupeKey: true },
      distinct: ['dedupeKey'],
    });
    const recovered = activeKeys
      .map((k) => k.dedupeKey!)
      .filter((key) => !lowKeys.has(key));
    if (recovered.length > 0) {
      await this.prisma.notification.updateMany({
        where: { dedupeKey: { in: recovered } },
        data: { dedupeKey: null },
      });
    }

    for (const product of low) {
      await this.notifyRoles([Role.admin, Role.warehouse], {
        title: 'Kam zaxira',
        message: `${product.name} (${product.sku}) qoldig'i ${product.stock} ${product.unit} — minimal ${product.minStock.toString()}`,
        link: '/products?lowStock=1',
        dedupeKey: `low-stock:${product.id}`,
      });
    }
  }

  /** FR-7.2 row 2 / FR-3.8: invoice unpaid for 7+ days — admin, accountant. */
  private async sweepOverdueInvoices(): Promise<void> {
    const threshold = new Date(Date.now() - OVERDUE_DAYS * 24 * 60 * 60 * 1000);
    const overdue = await this.prisma.invoice.findMany({
      where: { status: 'sent', issuedAt: { lte: threshold } },
      select: { id: true, number: true, issuedAt: true },
    });
    const overdueKeys = new Set(overdue.map((i) => `invoice-overdue:${i.id}`));

    const activeKeys = await this.prisma.notification.findMany({
      where: { dedupeKey: { startsWith: 'invoice-overdue:' } },
      select: { dedupeKey: true },
      distinct: ['dedupeKey'],
    });
    const resolved = activeKeys
      .map((k) => k.dedupeKey!)
      .filter((key) => !overdueKeys.has(key));
    if (resolved.length > 0) {
      await this.prisma.notification.updateMany({
        where: { dedupeKey: { in: resolved } },
        data: { dedupeKey: null },
      });
    }

    for (const invoice of overdue) {
      const days = Math.floor(
        (Date.now() - invoice.issuedAt.getTime()) / (24 * 60 * 60 * 1000),
      );
      await this.notifyRoles([Role.admin, Role.accountant], {
        title: "To'lanmagan hisob-faktura",
        message: `${invoice.number} ${days} kundan beri to'lanmagan`,
        link: '/finance/invoices',
        dedupeKey: `invoice-overdue:${invoice.id}`,
      });
    }
  }
}
