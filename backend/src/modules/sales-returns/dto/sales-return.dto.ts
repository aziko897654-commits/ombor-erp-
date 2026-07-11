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
  ValidateNested,
} from 'class-validator';

export class SalesReturnItemDto {
  @IsInt({ message: 'Mahsulot tanlanishi shart' })
  productId!: number;

  @IsNumber({}, { message: "Miqdor raqam bo'lishi kerak" })
  @IsPositive({ message: "Miqdor musbat bo'lishi kerak" })
  quantity!: number;
}

export class CreateSalesReturnDto {
  @IsInt({ message: 'Buyurtma tanlanishi shart' })
  orderId!: number;

  @IsOptional()
  @IsDateString({}, { message: "Sana formati noto'g'ri" })
  date?: string;

  @IsOptional()
  @IsString()
  note?: string;

  @IsArray()
  @ArrayMinSize(1, { message: "Kamida bitta pozitsiya bo'lishi kerak" })
  @ValidateNested({ each: true })
  @Type(() => SalesReturnItemDto)
  items!: SalesReturnItemDto[];
}
