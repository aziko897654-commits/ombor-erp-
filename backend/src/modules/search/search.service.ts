import { Injectable } from '@nestjs/common';
import { Role } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';

const LIMIT = 5;

/** FR-10.1: global search over 4 entity types, filtered by role. */
@Injectable()
export class SearchService {
  constructor(private readonly prisma: PrismaService) {}

  async search(q: string, role: Role) {
    const query = q.trim();
    if (query.length < 2) {
      return { customers: [], products: [], orders: [], suppliers: [] };
    }

    const [customers, products, orders, suppliers] = await Promise.all([
      this.can(role, [Role.admin, Role.sales, Role.accountant])
        ? this.prisma.customer.findMany({
            where: {
              OR: [
                { name: { contains: query, mode: 'insensitive' } },
                { phone: { contains: query } },
              ],
            },
            select: { id: true, name: true, phone: true },
            take: LIMIT,
          })
        : [],
      this.can(role, [Role.admin, Role.warehouse, Role.sales])
        ? this.prisma.product.findMany({
            where: {
              isActive: true,
              OR: [
                { name: { contains: query, mode: 'insensitive' } },
                { sku: { contains: query, mode: 'insensitive' } },
                { barcode: { contains: query } },
              ],
            },
            select: { id: true, name: true, sku: true, barcode: true },
            take: LIMIT,
          })
        : [],
      this.can(role, [Role.admin, Role.sales, Role.accountant])
        ? this.prisma.order.findMany({
            where: { number: { contains: query, mode: 'insensitive' } },
            select: {
              id: true,
              number: true,
              status: true,
              customer: { select: { name: true } },
            },
            take: LIMIT,
          })
        : [],
      this.can(role, [Role.admin, Role.warehouse, Role.accountant])
        ? this.prisma.supplier.findMany({
            where: { name: { contains: query, mode: 'insensitive' } },
            select: { id: true, name: true, phone: true },
            take: LIMIT,
          })
        : [],
    ]);

    return { customers, products, orders, suppliers };
  }

  private can(role: Role, allowed: Role[]): boolean {
    return allowed.includes(role);
  }
}
