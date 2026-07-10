import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { StockService } from '../stock/stock.service';
import { CreateProductDto, UpdateProductDto } from './dto/product.dto';

@Injectable()
export class ProductsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly stock: StockService,
  ) {}

  async findAll(params: {
    page: number;
    limit: number;
    search?: string;
    warehouseId?: number;
    includeInactive?: boolean;
  }) {
    const { page, limit, search, warehouseId, includeInactive } = params;
    const where: Prisma.ProductWhereInput = {
      ...(includeInactive ? {} : { isActive: true }),
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: 'insensitive' } },
              { sku: { contains: search, mode: 'insensitive' } },
              { barcode: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [products, total] = await this.prisma.$transaction([
      this.prisma.product.findMany({
        where,
        include: { category: true },
        orderBy: { name: 'asc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.product.count({ where }),
    ]);

    const stockMap = await this.stock.getStockMap(
      products.map((p) => p.id),
      warehouseId,
    );

    return {
      data: products.map((p) => ({
        ...p,
        stock: (stockMap.get(p.id) ?? new Prisma.Decimal(0)).toString(),
      })),
      meta: { page, limit, total },
    };
  }

  /** Products whose total stock ≤ minStock (FR-2.8). */
  async findLowStock() {
    const products = await this.prisma.product.findMany({
      where: { isActive: true },
      include: { category: true },
      orderBy: { name: 'asc' },
    });
    const stockMap = await this.stock.getStockMap(products.map((p) => p.id));
    return products
      .map((p) => ({
        ...p,
        stock: (stockMap.get(p.id) ?? new Prisma.Decimal(0)).toString(),
      }))
      .filter((p) => new Prisma.Decimal(p.stock).lessThanOrEqualTo(p.minStock));
  }

  async findOne(id: number) {
    const product = await this.prisma.product.findUnique({
      where: { id },
      include: { category: true },
    });
    if (!product) throw new NotFoundException('Mahsulot topilmadi');

    // stock per warehouse (FR-2.7)
    const perWarehouse = await this.prisma.stockMovement.groupBy({
      by: ['warehouseId'],
      where: { productId: id },
      _sum: { quantity: true },
    });
    const warehouses = await this.prisma.warehouse.findMany({
      where: { id: { in: perWarehouse.map((w) => w.warehouseId) } },
      select: { id: true, name: true },
    });
    const nameById = new Map(warehouses.map((w) => [w.id, w.name]));

    const stockByWarehouse = perWarehouse.map((w) => ({
      warehouseId: w.warehouseId,
      warehouseName: nameById.get(w.warehouseId) ?? '',
      stock: (w._sum.quantity ?? new Prisma.Decimal(0)).toString(),
    }));
    const totalStock = perWarehouse
      .reduce(
        (acc, w) => acc.plus(w._sum.quantity ?? 0),
        new Prisma.Decimal(0),
      )
      .toString();

    return { ...product, stockByWarehouse, totalStock };
  }

  /** Movement history of a product (FR-2.9). */
  async findMovements(id: number, page: number, limit: number) {
    const product = await this.prisma.product.findUnique({ where: { id } });
    if (!product) throw new NotFoundException('Mahsulot topilmadi');

    const [movements, total] = await this.prisma.$transaction([
      this.prisma.stockMovement.findMany({
        where: { productId: id },
        include: { warehouse: { select: { id: true, name: true } } },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.stockMovement.count({ where: { productId: id } }),
    ]);

    const userIds = [...new Set(movements.map((m) => m.userId))];
    const users = await this.prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, firstName: true, lastName: true },
    });
    const userById = new Map(users.map((u) => [u.id, u]));

    return {
      data: movements.map((m) => ({
        ...m,
        user: userById.get(m.userId) ?? null,
      })),
      meta: { page, limit, total },
    };
  }

  async create(dto: CreateProductDto) {
    await this.ensureUnique(dto.sku, dto.barcode);
    const category = await this.prisma.category.findUnique({
      where: { id: dto.categoryId },
    });
    if (!category) throw new NotFoundException('Kategoriya topilmadi');

    return this.prisma.product.create({
      data: {
        name: dto.name,
        sku: dto.sku,
        barcode: dto.barcode || null,
        categoryId: dto.categoryId,
        unit: dto.unit,
        costPrice: new Prisma.Decimal(dto.costPrice),
        avgCost: new Prisma.Decimal(dto.costPrice), // initial AVCO = cost price
        salePrice: new Prisma.Decimal(dto.salePrice),
        minStock: new Prisma.Decimal(dto.minStock ?? 0),
      },
      include: { category: true },
    });
  }

  async update(id: number, dto: UpdateProductDto) {
    const product = await this.prisma.product.findUnique({ where: { id } });
    if (!product) throw new NotFoundException('Mahsulot topilmadi');
    if (
      (dto.sku && dto.sku !== product.sku) ||
      (dto.barcode && dto.barcode !== product.barcode)
    ) {
      await this.ensureUnique(
        dto.sku !== product.sku ? dto.sku : undefined,
        dto.barcode !== product.barcode ? dto.barcode : undefined,
      );
    }
    if (dto.categoryId) {
      const category = await this.prisma.category.findUnique({
        where: { id: dto.categoryId },
      });
      if (!category) throw new NotFoundException('Kategoriya topilmadi');
    }

    const { costPrice, salePrice, minStock, barcode, ...rest } = dto;
    return this.prisma.product.update({
      where: { id },
      data: {
        ...rest,
        ...(barcode !== undefined ? { barcode: barcode || null } : {}),
        ...(costPrice !== undefined
          ? { costPrice: new Prisma.Decimal(costPrice) }
          : {}),
        ...(salePrice !== undefined
          ? { salePrice: new Prisma.Decimal(salePrice) }
          : {}),
        ...(minStock !== undefined
          ? { minStock: new Prisma.Decimal(minStock) }
          : {}),
      },
      include: { category: true },
    });
  }

  private async ensureUnique(sku?: string, barcode?: string) {
    if (sku) {
      const bySku = await this.prisma.product.findUnique({ where: { sku } });
      if (bySku) throw new ConflictException('Bu SKU allaqachon mavjud');
    }
    if (barcode) {
      const byBarcode = await this.prisma.product.findUnique({
        where: { barcode },
      });
      if (byBarcode) {
        throw new ConflictException('Bu shtrix-kod allaqachon mavjud');
      }
    }
  }
}
