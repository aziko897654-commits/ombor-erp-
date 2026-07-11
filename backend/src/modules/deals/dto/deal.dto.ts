import { DealStage } from '@prisma/client';
import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class CreateDealDto {
  @IsString()
  @IsNotEmpty({ message: 'Bitim nomi kiritilishi shart' })
  title!: string;

  @IsInt({ message: 'Mijoz tanlanishi shart' })
  customerId!: number;

  @IsNumber({}, { message: "Summa raqam bo'lishi kerak" })
  @Min(0, { message: "Summa manfiy bo'lishi mumkin emas" })
  amount!: number;

  @IsOptional()
  @IsEnum(DealStage, { message: "Bosqich noto'g'ri" })
  stage?: DealStage;

  @IsOptional()
  @IsInt()
  managerId?: number;

  @IsOptional()
  @IsString()
  note?: string;
}

export class UpdateDealDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  title?: string;

  @IsOptional()
  @IsInt()
  customerId?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  amount?: number;

  @IsOptional()
  @IsEnum(DealStage, { message: "Bosqich noto'g'ri" })
  stage?: DealStage;

  @IsOptional()
  @IsInt()
  managerId?: number;

  @IsOptional()
  @IsString()
  note?: string;
}
