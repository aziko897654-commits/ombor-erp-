import { AccountType, TxType } from '@prisma/client';
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  Min,
} from 'class-validator';

export class CreateAccountDto {
  @IsString()
  @IsNotEmpty({ message: 'Hisob nomi kiritilishi shart' })
  name!: string;

  @IsEnum(AccountType, { message: "Hisob turi noto'g'ri (cash/bank)" })
  type!: AccountType;

  @IsOptional()
  @IsNumber({}, { message: "Boshlang'ich qoldiq raqam bo'lishi kerak" })
  @Min(0, { message: "Boshlang'ich qoldiq manfiy bo'lishi mumkin emas" })
  openingBalance?: number;
}

export class CreateTxCategoryDto {
  @IsString()
  @IsNotEmpty({ message: 'Kategoriya nomi kiritilishi shart' })
  name!: string;

  @IsEnum(TxType, { message: "Kategoriya turi noto'g'ri (income/expense)" })
  type!: TxType;
}

export class UpdateTxCategoryDto {
  @IsString()
  @IsNotEmpty({ message: 'Kategoriya nomi kiritilishi shart' })
  name!: string;
}

export class CreateTransactionDto {
  @IsEnum(TxType, { message: "Tranzaksiya turi noto'g'ri (income/expense)" })
  type!: TxType;

  @IsInt({ message: 'Hisob tanlanishi shart' })
  accountId!: number;

  @IsNumber({}, { message: "Summa raqam bo'lishi kerak" })
  @IsPositive({ message: "Summa musbat bo'lishi kerak" })
  amount!: number;

  @IsInt({ message: 'Kategoriya tanlanishi shart' })
  categoryId!: number;

  @IsOptional()
  @IsDateString({}, { message: "Sana formati noto'g'ri" })
  date?: string;

  @IsOptional()
  @IsString()
  note?: string;

  // TASK-001: set after the user accepts the "balance would go negative"
  // confirm dialog, so the resubmit is allowed through.
  @IsOptional()
  @IsBoolean()
  force?: boolean;
}

export class CreateTransferDto {
  @IsInt({ message: 'Chiquvchi hisob tanlanishi shart' })
  fromAccountId!: number;

  @IsInt({ message: 'Kiruvchi hisob tanlanishi shart' })
  toAccountId!: number;

  @IsNumber({}, { message: "Summa raqam bo'lishi kerak" })
  @IsPositive({ message: "Summa musbat bo'lishi kerak" })
  amount!: number;

  @IsOptional()
  @IsDateString({}, { message: "Sana formati noto'g'ri" })
  date?: string;

  @IsOptional()
  @IsString()
  note?: string;

  @IsOptional()
  @IsBoolean()
  force?: boolean;
}
