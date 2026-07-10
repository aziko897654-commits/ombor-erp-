import { IsEmail, IsNotEmpty, IsString } from 'class-validator';

export class LoginDto {
  @IsEmail({}, { message: "Email formati noto'g'ri" })
  email!: string;

  @IsString()
  @IsNotEmpty({ message: 'Parol kiritilishi shart' })
  password!: string;
}
