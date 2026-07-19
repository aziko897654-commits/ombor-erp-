import {
  Body,
  Controller,
  DefaultValuePipe,
  Get,
  ParseIntPipe,
  Post,
  Query,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import {
  AuthUser,
  CurrentUser,
} from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { CreateTransferDto } from './dto/finance.dto';
import { FinanceService } from './finance.service';

@Controller('finance')
@Roles(Role.admin, Role.accountant)
export class FinanceController {
  constructor(private readonly service: FinanceService) {}

  @Get('balance')
  balance(@Query('from') from?: string, @Query('to') to?: string) {
    return this.service.balance(from, to);
  }

  @Get('debts')
  debts() {
    return this.service.debts();
  }

  // TASK-031: receivables aging buckets
  @Get('debts/aging')
  debtAging() {
    return this.service.debtAging();
  }

  @Get('transfers')
  transfers(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
    @Query('sort') sort?: 'asc' | 'desc',
  ) {
    return this.service.listTransfers(page, limit, sort);
  }

  @Post('transfers')
  createTransfer(
    @Body() dto: CreateTransferDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.createTransfer(dto, user.id);
  }
}
