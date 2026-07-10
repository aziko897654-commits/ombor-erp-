import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  Header,
  Post,
  Query,
  StreamableFile,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Role } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import {
  AuthUser,
  CurrentUser,
} from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { ImportsService, ProductImportRow } from './imports.service';

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

class CommitDto {
  @IsIn(['products'], { message: "Import turi noto'g'ri" })
  type!: 'products';

  @IsArray()
  @ArrayMinSize(1, { message: "Import qilinadigan satrlar yo'q" })
  @ValidateNested({ each: true })
  @Type(() => ProductRowDto)
  rows!: ProductRowDto[];
}

// FR-8.1: products — warehouse/admin; customers (stage 2) — sales/admin
function assertTypeAllowed(type: string, role: Role) {
  if (type === 'products' && role !== Role.admin && role !== Role.warehouse) {
    throw new ForbiddenException("Bu import turi uchun ruxsatingiz yo'q");
  }
}

@Controller('imports')
@Roles(Role.admin, Role.warehouse, Role.sales)
export class ImportsController {
  constructor(private readonly service: ImportsService) {}

  @Get('template')
  @Header(
    'Content-Type',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  )
  @Header('Content-Disposition', 'attachment; filename="products-template.xlsx"')
  async template(@Query('type') type: string, @CurrentUser() user: AuthUser) {
    if (type !== 'products') {
      throw new BadRequestException(
        "Noma'lum import turi (hozircha faqat products)",
      );
    }
    assertTypeAllowed(type, user.role);
    const buffer = await this.service.buildProductsTemplate();
    return new StreamableFile(buffer);
  }

  @Post('preview')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 5 * 1024 * 1024 } }))
  preview(
    @UploadedFile() file: Express.Multer.File,
    @Body('type') type: string,
    @CurrentUser() user: AuthUser,
  ) {
    if (type !== 'products') {
      throw new BadRequestException(
        "Noma'lum import turi (hozircha faqat products)",
      );
    }
    assertTypeAllowed(type, user.role);
    if (!file) throw new BadRequestException('Fayl yuklanmadi');
    return this.service.previewProducts(file.buffer);
  }

  @Post('commit')
  commit(@Body() dto: CommitDto, @CurrentUser() user: AuthUser) {
    assertTypeAllowed(dto.type, user.role);
    return this.service.commitProducts(dto.rows, user.id);
  }
}
