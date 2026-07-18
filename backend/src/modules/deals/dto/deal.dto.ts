import { DealStage } from '@prisma/client';
import { Transform } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  MinLength,
} from 'class-validator';

// TASK-005: trim first so whitespace-only titles fail MinLength
const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class CreateDealDto {
  @IsString()
  @Transform(trim)
  @MinLength(3, {
    message: "Bitim nomi kamida 3 ta belgidan iborat bo'lishi kerak",
  })
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
  @Transform(trim)
  @MinLength(3, {
    message: "Bitim nomi kamida 3 ta belgidan iborat bo'lishi kerak",
  })
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
