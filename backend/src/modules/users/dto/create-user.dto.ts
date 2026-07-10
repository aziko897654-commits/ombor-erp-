import { Role } from '@prisma/client';
import { IsEmail, IsEnum, IsNotEmpty, IsString, MinLength } from 'class-validator';

export class CreateUserDto {
  @IsString()
  @IsNotEmpty({ message: 'Ism kiritilishi shart' })
  firstName!: string;

  @IsString()
  @IsNotEmpty({ message: 'Familiya kiritilishi shart' })
  lastName!: string;

  @IsEmail({}, { message: "Email formati noto'g'ri" })
  email!: string;

  @IsEnum(Role, { message: "Rol noto'g'ri" })
  role!: Role;

  @IsString()
  @MinLength(8, { message: "Parol kamida 8 belgidan iborat bo'lishi kerak" })
  password!: string;
}
