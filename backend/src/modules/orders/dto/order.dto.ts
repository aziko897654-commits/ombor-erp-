import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsInt,
  IsNumber,
  IsOptional,
  IsPositive,
  Min,
  ValidateNested,
} from 'class-validator';

export class OrderItemDto {
  @IsInt({ message: 'Mahsulot tanlanishi shart' })
  productId!: number;

  @IsNumber({}, { message: "Miqdor raqam bo'lishi kerak" })
  @IsPositive({ message: "Miqdor musbat bo'lishi kerak" })
  quantity!: number;

  @IsNumber({}, { message: "Narx raqam bo'lishi kerak" })
  @Min(0, { message: "Narx manfiy bo'lishi mumkin emas" })
  price!: number;
}

export class CreateOrderDto {
  @IsInt({ message: 'Mijoz tanlanishi shart' })
  customerId!: number;

  @IsInt({ message: 'Ombor tanlanishi shart' })
  warehouseId!: number;

  /** Order-level discount as an amount (FR-1.4). */
  @IsOptional()
  @IsNumber({}, { message: "Chegirma raqam bo'lishi kerak" })
  @Min(0, { message: "Chegirma manfiy bo'lishi mumkin emas" })
  discount?: number;

  @IsArray()
  @ArrayMinSize(1, { message: "Kamida bitta pozitsiya bo'lishi kerak" })
  @ValidateNested({ each: true })
  @Type(() => OrderItemDto)
  items!: OrderItemDto[];
}

export class UpdateOrderDto {
  @IsOptional()
  @IsInt()
  customerId?: number;

  @IsOptional()
  @IsInt()
  warehouseId?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  discount?: number;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1, { message: "Kamida bitta pozitsiya bo'lishi kerak" })
  @ValidateNested({ each: true })
  @Type(() => OrderItemDto)
  items?: OrderItemDto[];
}
