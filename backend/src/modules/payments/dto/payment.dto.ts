import { PayDirection } from '@prisma/client';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
} from 'class-validator';

export class CreatePaymentDto {
  @IsEnum(PayDirection, { message: "Yo'nalish noto'g'ri (in/out)" })
  direction!: PayDirection;

  @IsInt({ message: 'Hisob tanlanishi shart' })
  accountId!: number;

  @IsNumber({}, { message: "Summa raqam bo'lishi kerak" })
  @IsPositive({ message: "Summa musbat bo'lishi kerak" })
  amount!: number;

  @IsOptional()
  @IsInt()
  customerId?: number;

  @IsOptional()
  @IsInt()
  supplierId?: number;

  @IsOptional()
  @IsInt()
  orderId?: number;

  @IsOptional()
  @IsInt()
  purchaseId?: number;

  @IsOptional()
  @IsDateString({}, { message: "Sana formati noto'g'ri" })
  date?: string;

  @IsOptional()
  @IsString()
  note?: string;
}
