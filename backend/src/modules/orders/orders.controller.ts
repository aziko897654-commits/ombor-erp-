import {
  Body,
  Controller,
  DefaultValuePipe,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { OrderStatus, Role } from '@prisma/client';
import {
  AuthUser,
  CurrentUser,
} from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { CreateOrderDto, UpdateOrderDto } from './dto/order.dto';
import { OrdersService } from './orders.service';

@Controller('orders')
@Roles(Role.admin, Role.sales)
export class OrdersController {
  constructor(private readonly service: OrdersService) {}

  @Get()
  findAll(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
    @Query('status') status?: OrderStatus,
    @Query('customerId') customerId?: string,
  ) {
    return this.service.findAll({
      page,
      limit,
      status,
      customerId: customerId ? parseInt(customerId, 10) : undefined,
    });
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.service.findOne(id);
  }

  @Post()
  create(@Body() dto: CreateOrderDto, @CurrentUser() user: AuthUser) {
    return this.service.create(dto, user.id);
  }

  @Patch(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateOrderDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: AuthUser) {
    return this.service.remove(id, user.id);
  }

  @Post(':id/confirm')
  confirm(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: AuthUser) {
    return this.service.confirm(id, user.id);
  }

  @Post(':id/cancel')
  cancel(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: AuthUser) {
    return this.service.cancel(id, user.id);
  }

  @Post(':id/ship')
  ship(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: AuthUser) {
    return this.service.ship(id, user.id);
  }
}
