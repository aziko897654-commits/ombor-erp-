import {
  Body,
  Controller,
  DefaultValuePipe,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { CreateProductDto, UpdateProductDto } from './dto/product.dto';
import { ProductsService } from './products.service';

@Controller('products')
export class ProductsController {
  constructor(private readonly service: ProductsService) {}

  // sales has read access to stock levels (matrix 2.1)
  @Get()
  @Roles(Role.admin, Role.warehouse, Role.sales)
  findAll(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
    @Query('search') search?: string,
    @Query('warehouseId') warehouseId?: string,
    @Query('all') all?: string,
  ) {
    return this.service.findAll({
      page,
      limit,
      search,
      warehouseId: warehouseId ? parseInt(warehouseId, 10) : undefined,
      includeInactive: all === 'true',
    });
  }

  @Get('low-stock')
  @Roles(Role.admin, Role.warehouse)
  findLowStock() {
    return this.service.findLowStock();
  }

  @Get(':id')
  @Roles(Role.admin, Role.warehouse)
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.service.findOne(id);
  }

  @Get(':id/movements')
  @Roles(Role.admin, Role.warehouse)
  findMovements(
    @Param('id', ParseIntPipe) id: number,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
  ) {
    return this.service.findMovements(id, page, limit);
  }

  @Post()
  @Roles(Role.admin, Role.warehouse)
  create(@Body() dto: CreateProductDto) {
    return this.service.create(dto);
  }

  @Patch(':id')
  @Roles(Role.admin, Role.warehouse)
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateProductDto) {
    return this.service.update(id, dto);
  }
}
