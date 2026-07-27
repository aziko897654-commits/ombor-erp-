import { IsNotEmpty, IsString } from 'class-validator';

export class LoginDto {
  @IsString()
  @IsNotEmpty({ message: 'Telefon raqami kiritilishi shart' })
  phone!: string;

  @IsString()
  @IsNotEmpty({ message: 'Parol kiritilishi shart' })
  password!: string;
}
