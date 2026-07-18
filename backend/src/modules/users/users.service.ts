import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { AuditService } from '../../common/audit/audit.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

const USER_SELECT = {
  id: true,
  email: true,
  firstName: true,
  lastName: true,
  role: true,
  isActive: true,
  createdAt: true,
} satisfies Prisma.UserSelect;

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async findAll(page = 1, limit = 20, sort?: 'asc' | 'desc') {
    const [users, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        select: USER_SELECT,
        orderBy: sort ? { createdAt: sort } : { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.user.count(),
    ]);
    return { data: users, meta: { page, limit, total } };
  }

  async create(dto: CreateUserDto, actorId: number) {
    const exists = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (exists) {
      throw new ConflictException('Bu email allaqachon ro\'yxatdan o\'tgan');
    }
    const user = await this.prisma.user.create({
      data: {
        firstName: dto.firstName,
        lastName: dto.lastName,
        email: dto.email,
        role: dto.role,
        passwordHash: await bcrypt.hash(dto.password, 10),
      },
      select: USER_SELECT,
    });
    await this.audit.log({
      userId: actorId,
      action: 'user.create',
      entity: 'User',
      entityId: user.id,
      details: { email: user.email, role: user.role },
    });
    return user;
  }

  async update(id: number, dto: UpdateUserDto, actorId: number) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) {
      throw new NotFoundException('Foydalanuvchi topilmadi');
    }
    if (dto.email && dto.email !== user.email) {
      const exists = await this.prisma.user.findUnique({
        where: { email: dto.email },
      });
      if (exists) {
        throw new ConflictException('Bu email allaqachon ro\'yxatdan o\'tgan');
      }
    }
    const { password, ...fields } = dto;
    const updated = await this.prisma.user.update({
      where: { id },
      data: {
        ...fields,
        ...(password ? { passwordHash: await bcrypt.hash(password, 10) } : {}),
      },
      select: USER_SELECT,
    });
    await this.audit.log({
      userId: actorId,
      action: 'user.update',
      entity: 'User',
      entityId: id,
      details: { changed: Object.keys(dto) },
    });
    return updated;
  }
}
