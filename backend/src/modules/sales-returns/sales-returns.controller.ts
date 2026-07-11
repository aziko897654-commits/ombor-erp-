import {
  Body,
  Controller,
  DefaultValuePipe,
  Get,
  Param,
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
import { CreateSalesReturnDto } from './dto/sales-return.dto';
import { SalesReturnsService } from './sales-returns.service';

@Controller('sales-returns')
export class SalesReturnsController {
  constructor(private readonly service: SalesReturnsService) {}

  @Get()
  @Roles(Role.admin, Role.sales, Role.accountant)
  findAll(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
  ) {
    return this.service.findAll(page, limit);
  }

  @Get(':id')
  @Roles(Role.admin, Role.sales, Role.accountant)
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.service.findOne(id);
  }

  @Post()
  @Roles(Role.admin, Role.sales)
  create(@Body() dto: CreateSalesReturnDto, @CurrentUser() user: AuthUser) {
    return this.service.create(dto, user.id);
  }
}
