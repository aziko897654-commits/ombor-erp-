import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';

export class WriteoffDto {
  @IsInt({ message: 'Mahsulot tanlanishi shart' })
  productId!: number;

  @IsInt({ message: 'Ombor tanlanishi shart' })
  warehouseId!: number;

  @IsNumber({}, { message: "Miqdor raqam bo'lishi kerak" })
  @IsPositive({ message: "Miqdor musbat bo'lishi kerak" })
  quantity!: number;

  @IsString()
  @IsNotEmpty({ message: "Sabab ko'rsatilishi shart (brak, yo'qolish...)" })
  reason!: string;
}

export class TransferItemDto {
  @IsInt({ message: 'Mahsulot tanlanishi shart' })
  productId!: number;

  @IsNumber({}, { message: "Miqdor raqam bo'lishi kerak" })
  @IsPositive({ message: "Miqdor musbat bo'lishi kerak" })
  quantity!: number;
}

export class CreateTransferDto {
  @IsInt({ message: 'Qayerdan ombori tanlanishi shart' })
  fromWarehouseId!: number;

  @IsInt({ message: 'Qayerga ombori tanlanishi shart' })
  toWarehouseId!: number;

  @IsOptional()
  @IsDateString({}, { message: "Sana formati noto'g'ri" })
  date?: string;

  @IsOptional()
  @IsString()
  note?: string;

  @IsArray()
  @ArrayMinSize(1, { message: "Kamida bitta pozitsiya bo'lishi kerak" })
  @ValidateNested({ each: true })
  @Type(() => TransferItemDto)
  items!: TransferItemDto[];
}

export class CreateStockCountDto {
  @IsInt({ message: 'Ombor tanlanishi shart' })
  warehouseId!: number;

  @IsOptional()
  @IsString()
  note?: string;
}

export class StockCountItemUpdateDto {
  @IsInt()
  itemId!: number;

  @IsNumber({}, { message: "Sanoq miqdori raqam bo'lishi kerak" })
  @Min(0, { message: "Sanoq miqdori manfiy bo'lishi mumkin emas" })
  actualQty!: number;
}

export class UpdateStockCountDto {
  @IsOptional()
  @IsString()
  note?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => StockCountItemUpdateDto)
  items?: StockCountItemUpdateDto[];
}
