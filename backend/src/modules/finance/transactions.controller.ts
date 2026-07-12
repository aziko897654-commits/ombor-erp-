import {
  Body,
  Controller,
  DefaultValuePipe,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
} from '@nestjs/common';
import { Role, TxSource, TxType } from '@prisma/client';
import {
  AuthUser,
  CurrentUser,
} from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { CreateTransactionDto } from './dto/finance.dto';
import { TransactionsService } from './transactions.service';

@Controller('transactions')
@Roles(Role.admin, Role.accountant)
export class TransactionsController {
  constructor(private readonly service: TransactionsService) {}

  @Get()
  findAll(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
    @Query('type') type?: TxType,
    @Query('accountId') accountId?: string,
    @Query('categoryId') categoryId?: string,
    @Query('source') source?: TxSource,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.service.findAll({
      page,
      limit,
      type,
      accountId: accountId ? parseInt(accountId, 10) : undefined,
      categoryId: categoryId ? parseInt(categoryId, 10) : undefined,
      source,
      from,
      to,
    });
  }

  @Post()
  create(@Body() dto: CreateTransactionDto, @CurrentUser() user: AuthUser) {
    return this.service.createManual(dto, user.id);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: AuthUser) {
    return this.service.remove(id, user.id);
  }
}
