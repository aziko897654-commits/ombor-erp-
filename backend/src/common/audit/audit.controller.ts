import {
  Controller,
  DefaultValuePipe,
  Get,
  ParseIntPipe,
  Query,
} from '@nestjs/common';
import { Prisma, Role } from '@prisma/client';
import { endOfDay } from '../period.util';
import { PrismaService } from '../prisma/prisma.service';
import { Roles } from '../decorators/roles.decorator';

/** FR-10.2: audit journal page — admin only, with filters. */
@Controller('audit')
@Roles(Role.admin)
export class AuditController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async findAll(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
    @Query('userId') userId?: string,
    @Query('action') action?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    const where: Prisma.AuditLogWhereInput = {
      ...(userId ? { userId: parseInt(userId, 10) } : {}),
      ...(action ? { action: { contains: action, mode: 'insensitive' } } : {}),
      ...(from || to
        ? {
            createdAt: {
              ...(from ? { gte: new Date(from) } : {}),
              ...(to ? { lte: endOfDay(to) } : {}),
            },
          }
        : {}),
    };
    const [logs, total] = await this.prisma.$transaction([
      this.prisma.auditLog.findMany({
        where,
        include: {
          user: { select: { id: true, firstName: true, lastName: true } },
        },
        orderBy: { id: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.auditLog.count({ where }),
    ]);
    return { data: logs, meta: { page, limit, total } };
  }
}
