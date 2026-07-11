import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  Post,
  Query,
  StreamableFile,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Role } from '@prisma/client';
import { plainToInstance } from 'class-transformer';
import {
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  validateSync,
} from 'class-validator';
import {
  AuthUser,
  CurrentUser,
} from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import {
  CustomerImportRow,
  ImportsService,
  ProductImportRow,
} from './imports.service';

const XLSX_MIME =
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

type ImportType = 'products' | 'customers';

class ProductRowDto implements ProductImportRow {
  @IsInt()
  row!: number;

  @IsString()
  name!: string;

  @IsString()
  sku!: string;

  @IsOptional()
  @IsString()
  barcode?: string;

  @IsString()
  category!: string;

  @IsString()
  unit!: string;

  @IsNumber()
  costPrice!: number;

  @IsNumber()
  salePrice!: number;

  @IsOptional()
  @IsNumber()
  minStock?: number;
}

class CustomerRowDto implements CustomerImportRow {
  @IsInt()
  row!: number;

  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  email?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  note?: string;
}

// FR-8.1: products — warehouse/admin; customers — sales/admin
function assertTypeAllowed(type: string, role: Role) {
  const allowed: Record<ImportType, Role[]> = {
    products: [Role.admin, Role.warehouse],
    customers: [Role.admin, Role.sales],
  };
  const roles = allowed[type as ImportType];
  if (!roles) {
    throw new BadRequestException("Noma'lum import turi");
  }
  if (!roles.includes(role)) {
    throw new ForbiddenException("Bu import turi uchun ruxsatingiz yo'q");
  }
}

/** Row-level shape check per type (the service re-validates content). */
function parseRows<T extends object>(cls: new () => T, rows: unknown[]): T[] {
  const instances = plainToInstance(cls, rows);
  for (const instance of instances) {
    const errors = validateSync(instance);
    if (errors.length > 0) {
      throw new BadRequestException(
        `Satrlar formati noto'g'ri: ${errors
          .map((e) => Object.values(e.constraints ?? {}).join(', '))
          .join('; ')}`,
      );
    }
  }
  return instances;
}

@Controller('imports')
@Roles(Role.admin, Role.warehouse, Role.sales)
export class ImportsController {
  constructor(private readonly service: ImportsService) {}

  @Get('template')
  async template(@Query('type') type: string, @CurrentUser() user: AuthUser) {
    assertTypeAllowed(type, user.role);
    const buffer =
      type === 'products'
        ? await this.service.buildProductsTemplate()
        : await this.service.buildCustomersTemplate();
    return new StreamableFile(buffer, {
      type: XLSX_MIME,
      disposition: `attachment; filename="${type}-template.xlsx"`,
    });
  }

  @Post('preview')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 5 * 1024 * 1024 } }))
  preview(
    @UploadedFile() file: Express.Multer.File,
    @Body('type') type: string,
    @CurrentUser() user: AuthUser,
  ) {
    assertTypeAllowed(type, user.role);
    if (!file) throw new BadRequestException('Fayl yuklanmadi');
    return type === 'products'
      ? this.service.previewProducts(file.buffer)
      : this.service.previewCustomers(file.buffer);
  }

  // Untyped body on purpose: the global pipe's implicit conversion
  // mangles untyped nested arrays; parseRows validates the row shape.
  @Post('commit')
  commit(@Body() body: Record<string, unknown>, @CurrentUser() user: AuthUser) {
    const type = String(body?.type ?? '');
    assertTypeAllowed(type, user.role);
    const rows = Array.isArray(body?.rows) ? (body.rows as unknown[]) : [];
    if (rows.length === 0) {
      throw new BadRequestException("Import qilinadigan satrlar yo'q");
    }
    return type === 'products'
      ? this.service.commitProducts(parseRows(ProductRowDto, rows), user.id)
      : this.service.commitCustomers(parseRows(CustomerRowDto, rows), user.id);
  }
}
