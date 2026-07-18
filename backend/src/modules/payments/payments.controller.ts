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
import { PayDirection, Role } from '@prisma/client';
import {
  AuthUser,
  CurrentUser,
} from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { CreatePaymentDto } from './dto/payment.dto';
import { PaymentsService } from './payments.service';

@Controller('payments')
@Roles(Role.admin, Role.accountant)
export class PaymentsController {
  constructor(private readonly service: PaymentsService) {}

  @Get()
  findAll(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
    @Query('direction') direction?: PayDirection,
    @Query('customerId') customerId?: string,
    @Query('supplierId') supplierId?: string,
    @Query('orderId') orderId?: string,
    @Query('purchaseId') purchaseId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('sort') sort?: 'asc' | 'desc',
  ) {
    const toInt = (v?: string) => (v ? parseInt(v, 10) : undefined);
    return this.service.findAll({
      page,
      limit,
      direction,
      customerId: toInt(customerId),
      supplierId: toInt(supplierId),
      orderId: toInt(orderId),
      purchaseId: toInt(purchaseId),
      from,
      to,
      sort,
    });
  }

  @Post()
  create(@Body() dto: CreatePaymentDto, @CurrentUser() user: AuthUser) {
    return this.service.create(dto, user.id);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: AuthUser) {
    return this.service.remove(id, user.id);
  }
}
