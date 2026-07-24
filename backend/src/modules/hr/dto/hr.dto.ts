import { AttendanceStatus, EmployeeStatus, Role } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  Matches,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

export class CreateCatalogItemDto {
  @IsString()
  @IsNotEmpty({ message: 'Nomi kiritilishi shart' })
  name!: string;
}

export class CreateEmployeeDto {
  @IsString()
  @IsNotEmpty({ message: 'F.I.Sh. kiritilishi shart' })
  fullName!: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  email?: string;

  @IsInt({ message: "Bo'lim tanlanishi shart" })
  departmentId!: number;

  @IsInt({ message: 'Lavozim tanlanishi shart' })
  positionId!: number;

  @IsNumber({}, { message: "Maosh raqam bo'lishi kerak" })
  @IsPositive({ message: "Maosh musbat bo'lishi kerak" })
  salary!: number;

  @IsDateString({}, { message: "Ishga kirgan sana noto'g'ri" })
  hiredAt!: string;

  // optional login (admin only): email above is the username
  @IsOptional()
  @IsEnum(Role, { message: "Tizim roli noto'g'ri" })
  role?: Role;

  @IsOptional()
  @IsString()
  @MinLength(8, { message: "Parol kamida 8 belgidan iborat bo'lishi kerak" })
  password?: string;
}

export class UpdateEmployeeDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  fullName?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  email?: string;

  @IsOptional()
  @IsInt()
  departmentId?: number;

  @IsOptional()
  @IsInt()
  positionId?: number;

  @IsOptional()
  @IsNumber()
  @IsPositive()
  salary?: number;

  @IsOptional()
  @IsDateString()
  hiredAt?: string;

  /** FR-4.6: fired + date; data is never deleted. */
  @IsOptional()
  @IsEnum(EmployeeStatus, { message: "Holat noto'g'ri (active/fired)" })
  status?: EmployeeStatus;

  @IsOptional()
  @IsDateString({}, { message: "Bo'shatilgan sana noto'g'ri" })
  firedAt?: string;

  // optional login (admin only): email above is the username
  @IsOptional()
  @IsEnum(Role, { message: "Tizim roli noto'g'ri" })
  role?: Role;

  @IsOptional()
  @IsString()
  @MinLength(8, { message: "Parol kamida 8 belgidan iborat bo'lishi kerak" })
  password?: string;
}

/** 'clear' removes the mark (the grid cell cycles back to empty). */
export const ATTENDANCE_INPUTS = [
  'present',
  'absent',
  'vacation',
  'sick',
  'clear',
] as const;

export class SetAttendanceDto {
  @IsInt({ message: 'Xodim tanlanishi shart' })
  employeeId!: number;

  @IsDateString({}, { message: "Sana formati noto'g'ri" })
  date!: string;

  @IsIn(ATTENDANCE_INPUTS, { message: "Holat noto'g'ri" })
  status!: AttendanceStatus | 'clear';
}

export class CreateAdvanceDto {
  @IsInt({ message: 'Xodim tanlanishi shart' })
  employeeId!: number;

  @IsInt({ message: 'Hisob tanlanishi shart' })
  accountId!: number;

  @IsNumber({}, { message: "Summa raqam bo'lishi kerak" })
  @IsPositive({ message: "Summa musbat bo'lishi kerak" })
  amount!: number;

  @IsOptional()
  @IsDateString({}, { message: "Sana formati noto'g'ri" })
  date?: string;

  @IsOptional()
  @IsString()
  note?: string;

  // TASK-001: allowed through after the negative-balance confirm dialog
  @IsOptional()
  @IsBoolean()
  force?: boolean;
}

export class PayrollItemInputDto {
  @IsInt()
  employeeId!: number;

  @IsOptional()
  @IsNumber({}, { message: "Bonus raqam bo'lishi kerak" })
  @Min(0, { message: "Bonus manfiy bo'lishi mumkin emas" })
  bonus?: number;

  @IsOptional()
  @IsNumber({}, { message: "Jarima raqam bo'lishi kerak" })
  @Min(0, { message: "Jarima manfiy bo'lishi mumkin emas" })
  penalty?: number;
}

export class CreatePayrollDto {
  @Matches(/^\d{4}-(0[1-9]|1[0-2])$/, {
    message: "Oy formati noto'g'ri (YYYY-MM)",
  })
  month!: string;

  @IsInt({ message: 'Hisob tanlanishi shart' })
  accountId!: number;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PayrollItemInputDto)
  items?: PayrollItemInputDto[];

  // TASK-001: allowed through after the negative-balance confirm dialog
  @IsOptional()
  @IsBoolean()
  force?: boolean;
}
