import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import * as ExcelJS from 'exceljs';
import { AuditService } from '../../common/audit/audit.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { UNITS } from '../products/dto/product.dto';

export interface ProductImportRow {
  row: number;
  name: string;
  sku: string;
  barcode?: string;
  category: string;
  unit: string;
  costPrice: number;
  salePrice: number;
  minStock?: number;
}

export interface CustomerImportRow {
  row: number;
  name: string;
  phone?: string;
  email?: string;
  address?: string;
  note?: string;
}

interface PreviewResult<T> {
  valid: T[];
  errors: Array<{ row: number; message: string }>;
  duplicates: Array<{ row: number; reason: string }>;
  summary: { total: number; valid: number; errors: number; duplicates: number };
}

const PRODUCT_HEADERS = [
  'Nomi*',
  'SKU*',
  'Shtrix-kod',
  'Kategoriya*',
  'Birlik* (dona/kg/litr/metr)',
  'Tannarx*',
  'Sotuv narxi*',
  'Min zaxira',
];

// FR-8.4: customer import columns
const CUSTOMER_HEADERS = ['Nomi*', 'Telefon', 'Email', 'Manzil', 'Izoh'];

@Injectable()
export class ImportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /** FR-8.2 step 1: downloadable .xlsx template with headers. */
  async buildProductsTemplate(): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Mahsulotlar');
    sheet.addRow(PRODUCT_HEADERS);
    sheet.getRow(1).font = { bold: true };
    sheet.columns.forEach((c) => (c.width = 22));
    sheet.addRow([
      'Misol mahsulot',
      'SKU-0001',
      '4780000000001',
      'Ichimliklar',
      'dona',
      12000,
      15000,
      10,
    ]);
    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }

  /** FR-8.2 step 1: customers template (FR-8.4 columns). */
  async buildCustomersTemplate(): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Mijozlar');
    sheet.addRow(CUSTOMER_HEADERS);
    sheet.getRow(1).font = { bold: true };
    sheet.columns.forEach((c) => (c.width = 24));
    sheet.addRow([
      'Misol mijoz MChJ',
      '+998901234567',
      'mijoz@mail.uz',
      'Toshkent sh.',
      'Doimiy mijoz',
    ]);
    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }

  /** FR-8.2 steps 2–3: row-by-row validation with a preview. */
  async previewProducts(fileBuffer: Buffer): Promise<PreviewResult<ProductImportRow>> {
    const rows = await this.parseProductsFile(fileBuffer);
    return this.validateProducts(rows);
  }

  async previewCustomers(
    fileBuffer: Buffer,
  ): Promise<PreviewResult<CustomerImportRow>> {
    const rows = await this.parseCustomersFile(fileBuffer);
    return this.validateCustomers(rows);
  }

  /** FR-8.2 step 4: import only the valid rows (re-validated). */
  async commitProducts(rows: ProductImportRow[], userId: number) {
    const { valid, errors, duplicates } = await this.validateProducts(rows);
    if (valid.length === 0) {
      throw new BadRequestException(
        "Import qilinadigan to'g'ri satrlar yo'q",
      );
    }

    const created = await this.prisma.$transaction(async (tx) => {
      // categories are auto-created by name (FR-8.4)
      const categoryNames = [...new Set(valid.map((r) => r.category))];
      const categoryIdByName = new Map<string, number>();
      for (const name of categoryNames) {
        const category = await tx.category.upsert({
          where: { name },
          update: {},
          create: { name },
        });
        categoryIdByName.set(name, category.id);
      }

      let count = 0;
      for (const row of valid) {
        await tx.product.create({
          data: {
            name: row.name,
            sku: row.sku,
            barcode: row.barcode || null,
            categoryId: categoryIdByName.get(row.category)!,
            unit: row.unit,
            costPrice: new Prisma.Decimal(row.costPrice),
            avgCost: new Prisma.Decimal(row.costPrice),
            salePrice: new Prisma.Decimal(row.salePrice),
            minStock: new Prisma.Decimal(row.minStock ?? 0),
          },
        });
        count++;
      }

      // FR-8.3: import result goes to the audit log
      await this.audit.log(
        {
          userId,
          action: 'import.products',
          entity: 'Product',
          details: {
            imported: count,
            errors: errors.length,
            duplicates: duplicates.length,
          },
        },
        tx,
      );

      return count;
    });

    return {
      imported: created,
      skippedErrors: errors.length,
      skippedDuplicates: duplicates.length,
    };
  }

  /** FR-8.2 step 4 for customers: import only the valid rows. */
  async commitCustomers(rows: CustomerImportRow[], userId: number) {
    const { valid, errors, duplicates } = await this.validateCustomers(rows);
    if (valid.length === 0) {
      throw new BadRequestException(
        "Import qilinadigan to'g'ri satrlar yo'q",
      );
    }

    const created = await this.prisma.$transaction(async (tx) => {
      let count = 0;
      for (const row of valid) {
        await tx.customer.create({
          data: {
            name: row.name,
            phone: row.phone || null,
            email: row.email || null,
            address: row.address || null,
            note: row.note || null,
          },
        });
        count++;
      }

      // FR-8.3: import result goes to the audit log
      await this.audit.log(
        {
          userId,
          action: 'import.customers',
          entity: 'Customer',
          details: {
            imported: count,
            errors: errors.length,
            duplicates: duplicates.length,
          },
        },
        tx,
      );

      return count;
    });

    return {
      imported: created,
      skippedErrors: errors.length,
      skippedDuplicates: duplicates.length,
    };
  }

  private async loadSheet(buffer: Buffer): Promise<ExcelJS.Worksheet> {
    const workbook = new ExcelJS.Workbook();
    try {
      await workbook.xlsx.load(buffer as any);
    } catch {
      throw new BadRequestException(
        "Faylni o'qib bo'lmadi — .xlsx format kutiladi",
      );
    }
    const sheet = workbook.worksheets[0];
    if (!sheet) throw new BadRequestException('Faylda varaq topilmadi');
    return sheet;
  }

  private cellText(row: ExcelJS.Row, i: number): string {
    const v = row.getCell(i).value;
    if (v === null || v === undefined) return '';
    if (typeof v === 'object' && 'text' in (v as any)) {
      return String((v as any).text).trim();
    }
    return String(v).trim();
  }

  private async parseProductsFile(buffer: Buffer): Promise<ProductImportRow[]> {
    const sheet = await this.loadSheet(buffer);

    const rows: ProductImportRow[] = [];
    sheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return; // header
      const text = (i: number) => this.cellText(row, i);
      const num = (i: number) => {
        const raw = text(i).replace(/\s/g, '').replace(',', '.');
        return raw === '' ? undefined : Number(raw);
      };
      // skip completely empty rows
      if (!text(1) && !text(2)) return;
      rows.push({
        row: rowNumber,
        name: text(1),
        sku: text(2),
        barcode: text(3) || undefined,
        category: text(4),
        unit: text(5).toLowerCase(),
        costPrice: num(6) as number,
        salePrice: num(7) as number,
        minStock: num(8),
      });
    });
    return rows;
  }

  private async parseCustomersFile(
    buffer: Buffer,
  ): Promise<CustomerImportRow[]> {
    const sheet = await this.loadSheet(buffer);

    const rows: CustomerImportRow[] = [];
    sheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return; // header
      const text = (i: number) => this.cellText(row, i);
      if (!text(1) && !text(2)) return;
      rows.push({
        row: rowNumber,
        name: text(1),
        phone: text(2) || undefined,
        email: text(3) || undefined,
        address: text(4) || undefined,
        note: text(5) || undefined,
      });
    });
    return rows;
  }

  /** FR-8.2: name required; duplicates (skipped) by phone in DB or file. */
  private async validateCustomers(
    rows: CustomerImportRow[],
  ): Promise<PreviewResult<CustomerImportRow>> {
    const valid: CustomerImportRow[] = [];
    const errors: Array<{ row: number; message: string }> = [];
    const duplicates: Array<{ row: number; reason: string }> = [];

    const phones = rows.map((r) => r.phone).filter(Boolean) as string[];
    const existingPhones = await this.prisma.customer.findMany({
      where: { phone: { in: phones } },
      select: { phone: true },
    });
    const phoneInDb = new Set(existingPhones.map((c) => c.phone));
    const seenPhone = new Set<string>();

    for (const r of rows) {
      if (!r.name) {
        errors.push({ row: r.row, message: 'nomi kiritilmagan' });
        continue;
      }

      if (r.phone && (phoneInDb.has(r.phone) || seenPhone.has(r.phone))) {
        duplicates.push({
          row: r.row,
          reason: `Telefon takrorlangan: ${r.phone}`,
        });
        continue;
      }

      if (r.phone) seenPhone.add(r.phone);
      valid.push(r);
    }

    return {
      valid,
      errors,
      duplicates,
      summary: {
        total: rows.length,
        valid: valid.length,
        errors: errors.length,
        duplicates: duplicates.length,
      },
    };
  }

  private async validateProducts(
    rows: ProductImportRow[],
  ): Promise<PreviewResult<ProductImportRow>> {
    const valid: ProductImportRow[] = [];
    const errors: Array<{ row: number; message: string }> = [];
    const duplicates: Array<{ row: number; reason: string }> = [];

    const skus = rows.map((r) => r.sku).filter(Boolean);
    const barcodes = rows.map((r) => r.barcode).filter(Boolean) as string[];
    const [existingSkus, existingBarcodes] = await Promise.all([
      this.prisma.product.findMany({
        where: { sku: { in: skus } },
        select: { sku: true },
      }),
      this.prisma.product.findMany({
        where: { barcode: { in: barcodes } },
        select: { barcode: true },
      }),
    ]);
    const skuInDb = new Set(existingSkus.map((p) => p.sku));
    const barcodeInDb = new Set(existingBarcodes.map((p) => p.barcode));
    const seenSku = new Set<string>();
    const seenBarcode = new Set<string>();

    for (const r of rows) {
      const problems: string[] = [];
      if (!r.name) problems.push('nomi kiritilmagan');
      if (!r.sku) problems.push('SKU kiritilmagan');
      if (!r.category) problems.push('kategoriya kiritilmagan');
      if (!r.unit) problems.push('birlik kiritilmagan');
      else if (!UNITS.includes(r.unit as any)) {
        problems.push(`birlik noto'g'ri: "${r.unit}" (dona/kg/litr/metr)`);
      }
      if (r.costPrice === undefined || Number.isNaN(r.costPrice)) {
        problems.push('tannarx kiritilmagan yoki raqam emas');
      } else if (r.costPrice < 0) problems.push('tannarx manfiy');
      if (r.salePrice === undefined || Number.isNaN(r.salePrice)) {
        problems.push('sotuv narxi kiritilmagan yoki raqam emas');
      } else if (r.salePrice < 0) problems.push('sotuv narxi manfiy');
      if (
        r.minStock !== undefined &&
        (Number.isNaN(r.minStock) || r.minStock < 0)
      ) {
        problems.push('min zaxira raqam emas yoki manfiy');
      }

      if (problems.length > 0) {
        errors.push({ row: r.row, message: problems.join('; ') });
        continue;
      }

      // duplicates are skipped (FR-8.2): by SKU/barcode in DB or in file
      if (skuInDb.has(r.sku) || seenSku.has(r.sku)) {
        duplicates.push({ row: r.row, reason: `SKU takrorlangan: ${r.sku}` });
        continue;
      }
      if (
        r.barcode &&
        (barcodeInDb.has(r.barcode) || seenBarcode.has(r.barcode))
      ) {
        duplicates.push({
          row: r.row,
          reason: `Shtrix-kod takrorlangan: ${r.barcode}`,
        });
        continue;
      }

      seenSku.add(r.sku);
      if (r.barcode) seenBarcode.add(r.barcode);
      valid.push(r);
    }

    return {
      valid,
      errors,
      duplicates,
      summary: {
        total: rows.length,
        valid: valid.length,
        errors: errors.length,
        duplicates: duplicates.length,
      },
    };
  }
}
