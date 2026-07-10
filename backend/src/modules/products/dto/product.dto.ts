import {
  IsBoolean,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export const UNITS = ['dona', 'kg', 'litr', 'metr'] as const;

export class CreateProductDto {
  @IsString()
  @IsNotEmpty({ message: 'Mahsulot nomi kiritilishi shart' })
  name!: string;

  @IsString()
  @IsNotEmpty({ message: 'SKU kiritilishi shart' })
  sku!: string;

  @IsOptional()
  @IsString()
  barcode?: string;

  @IsInt({ message: 'Kategoriya tanlanishi shart' })
  categoryId!: number;

  @IsIn(UNITS, { message: "Birlik noto'g'ri (dona/kg/litr/metr)" })
  unit!: string;

  @IsNumber({}, { message: "Tannarx raqam bo'lishi kerak" })
  @Min(0, { message: "Tannarx manfiy bo'lishi mumkin emas" })
  costPrice!: number;

  @IsNumber({}, { message: "Sotuv narxi raqam bo'lishi kerak" })
  @Min(0, { message: "Sotuv narxi manfiy bo'lishi mumkin emas" })
  salePrice!: number;

  @IsOptional()
  @IsNumber()
  @Min(0, { message: "Minimal zaxira manfiy bo'lishi mumkin emas" })
  minStock?: number;
}

export class UpdateProductDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  name?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  sku?: string;

  @IsOptional()
  @IsString()
  barcode?: string;

  @IsOptional()
  @IsInt()
  categoryId?: number;

  @IsOptional()
  @IsIn(UNITS, { message: "Birlik noto'g'ri (dona/kg/litr/metr)" })
  unit?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  costPrice?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  salePrice?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  minStock?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
