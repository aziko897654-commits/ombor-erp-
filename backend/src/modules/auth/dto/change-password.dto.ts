import { IsNotEmpty, IsString, MinLength } from 'class-validator';

export class ChangePasswordDto {
  @IsString()
  @IsNotEmpty({ message: 'Joriy parol kiritilishi shart' })
  oldPassword!: string;

  @IsString()
  @MinLength(8, { message: "Yangi parol kamida 8 belgidan iborat bo'lishi kerak" })
  newPassword!: string;
}
