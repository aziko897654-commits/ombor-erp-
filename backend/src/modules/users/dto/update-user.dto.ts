import { Role } from '@prisma/client';
import {
  IsBoolean,
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';

export class UpdateUserDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty({ message: "Ism bo'sh bo'lishi mumkin emas" })
  firstName?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty({ message: "Familiya bo'sh bo'lishi mumkin emas" })
  lastName?: string;

  @IsOptional()
  @IsEmail({}, { message: "Email formati noto'g'ri" })
  email?: string;

  @IsOptional()
  @IsEnum(Role, { message: "Rol noto'g'ri" })
  role?: Role;

  @IsOptional()
  @IsString()
  @MinLength(8, { message: "Parol kamida 8 belgidan iborat bo'lishi kerak" })
  password?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
