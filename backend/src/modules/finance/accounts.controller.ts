import { Body, Controller, Get, Post } from '@nestjs/common';
import { Role } from '@prisma/client';
import {
  AuthUser,
  CurrentUser,
} from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { AccountsService } from './accounts.service';
import { CreateAccountDto } from './dto/finance.dto';

@Controller('accounts')
export class AccountsController {
  constructor(private readonly service: AccountsService) {}

  // hr picks an account for advances/payroll (FR-4.4/4.5) but must not
  // see finance balances (matrix 2.1) — they are stripped for that role
  @Get()
  @Roles(Role.admin, Role.accountant, Role.hr)
  async findAll(@CurrentUser() user: AuthUser) {
    const accounts = await this.service.findAll();
    if (user.role === Role.hr) {
      return accounts.map(({ id, name, type }) => ({ id, name, type }));
    }
    return accounts;
  }

  @Post()
  @Roles(Role.admin, Role.accountant)
  create(@Body() dto: CreateAccountDto) {
    return this.service.create(dto);
  }
}
