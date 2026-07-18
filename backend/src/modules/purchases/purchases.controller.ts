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
import { CreatePurchaseDto } from './dto/purchase.dto';
import { PurchasesService } from './purchases.service';

@Controller('purchases')
export class PurchasesController {
  constructor(private readonly service: PurchasesService) {}

  // accountant reads purchases to link supplier payments (matrix 2.1: R)
  @Get()
  @Roles(Role.admin, Role.warehouse, Role.accountant)
  findAll(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
    @Query('supplierId') supplierId?: string,
    @Query('sort') sort?: 'asc' | 'desc',
  ) {
    return this.service.findAll(
      page,
      limit,
      supplierId ? parseInt(supplierId, 10) : undefined,
      sort,
    );
  }

  @Get(':id')
  @Roles(Role.admin, Role.warehouse, Role.accountant)
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.service.findOne(id);
  }

  @Post()
  @Roles(Role.admin, Role.warehouse)
  create(@Body() dto: CreatePurchaseDto, @CurrentUser() user: AuthUser) {
    return this.service.create(dto, user.id);
  }
}
