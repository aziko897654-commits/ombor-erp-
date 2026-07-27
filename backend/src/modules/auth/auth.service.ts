import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService, JwtSignOptions } from '@nestjs/jwt';
import { User } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../../common/prisma/prisma.service';
import { ChangePasswordDto } from './dto/change-password.dto';

export type SafeUser = Omit<User, 'passwordHash'>;

/**
 * Normalizes a user-typed phone into canonical E.164 for O'zbekiston.
 * Accepts "90 123 45 67", "901234567", "+998 90 123 45 67", etc.
 * → "+998901234567".
 */
export function normalizePhone(raw: string): string {
  let digits = (raw ?? '').replace(/\D/g, '');
  if (digits.length === 9) digits = `998${digits}`;
  return `+${digits}`;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async validateUser(phone: string, password: string): Promise<User> {
    const user = await this.prisma.user.findUnique({
      where: { phone: normalizePhone(phone) },
    });
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      throw new UnauthorizedException("Telefon raqami yoki parol noto'g'ri");
    }
    if (!user.isActive) {
      throw new UnauthorizedException('Foydalanuvchi faolsizlantirilgan');
    }
    return user;
  }

  issueAccessToken(user: User): string {
    return this.jwt.sign(
      { sub: user.id, email: user.email, role: user.role },
      {
        secret: this.config.getOrThrow<string>('JWT_ACCESS_SECRET'),
        expiresIn: (this.config.get<string>('JWT_ACCESS_TTL') ??
          '15m') as JwtSignOptions['expiresIn'],
      },
    );
  }

  issueRefreshToken(user: User): string {
    return this.jwt.sign(
      { sub: user.id },
      {
        secret: this.config.getOrThrow<string>('JWT_REFRESH_SECRET'),
        expiresIn: (this.config.get<string>('JWT_REFRESH_TTL') ??
          '7d') as JwtSignOptions['expiresIn'],
      },
    );
  }

  async validateRefreshToken(token: string | undefined): Promise<User> {
    if (!token) {
      throw new UnauthorizedException('Refresh token topilmadi');
    }
    let payload: { sub: number };
    try {
      payload = this.jwt.verify(token, {
        secret: this.config.getOrThrow<string>('JWT_REFRESH_SECRET'),
      });
    } catch {
      throw new UnauthorizedException('Refresh token yaroqsiz');
    }
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
    });
    if (!user || !user.isActive) {
      throw new UnauthorizedException('Avtorizatsiya talab qilinadi');
    }
    return user;
  }

  async changePassword(userId: number, dto: ChangePasswordDto): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || !(await bcrypt.compare(dto.oldPassword, user.passwordHash))) {
      throw new BadRequestException("Joriy parol noto'g'ri");
    }
    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash: await bcrypt.hash(dto.newPassword, 10) },
    });
  }

  sanitize(user: User): SafeUser {
    const { passwordHash: _passwordHash, ...rest } = user;
    return rest;
  }
}
