import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsInt,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';

export class PurchaseItemDto {
  @IsInt({ message: 'Mahsulot tanlanishi shart' })
  productId!: number;

  @IsNumber({}, { message: "Miqdor raqam bo'lishi kerak" })
  @IsPositive({ message: "Miqdor musbat bo'lishi kerak" })
  quantity!: number;

  @IsNumber({}, { message: "Tannarx raqam bo'lishi kerak" })
  @Min(0, { message: "Tannarx manfiy bo'lishi mumkin emas" })
  costPrice!: number;
}

export class CreatePurchaseDto {
  @IsInt({ message: 'Yetkazib beruvchi tanlanishi shart' })
  supplierId!: number;

  @IsInt({ message: 'Ombor tanlanishi shart' })
  warehouseId!: number;

  @IsOptional()
  @IsDateString({}, { message: "Sana formati noto'g'ri" })
  date?: string;

  @IsOptional()
  @IsString()
  note?: string;

  @IsArray()
  @ArrayMinSize(1, { message: "Kamida bitta pozitsiya bo'lishi kerak" })
  @ValidateNested({ each: true })
  @Type(() => PurchaseItemDto)
  items!: PurchaseItemDto[];
}
