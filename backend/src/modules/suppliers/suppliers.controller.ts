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
import { Role } from '@prisma/client';
import {
  AuthUser,
  CurrentUser,
} from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { CreateSupplierDto, UpdateSupplierDto } from './dto/supplier.dto';
import { SuppliersService } from './suppliers.service';

@Controller('suppliers')
export class SuppliersController {
  constructor(private readonly service: SuppliersService) {}

  // accountant has read access (section 8)
  @Get()
  @Roles(Role.admin, Role.warehouse, Role.accountant)
  findAll(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
    @Query('search') search?: string,
    @Query('sort') sort?: 'asc' | 'desc',
  ) {
    return this.service.findAll(page, limit, search, sort);
  }

  @Get(':id')
  @Roles(Role.admin, Role.warehouse, Role.accountant)
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.service.findOne(id);
  }

  @Post()
  @Roles(Role.admin, Role.warehouse)
  create(@Body() dto: CreateSupplierDto) {
    return this.service.create(dto);
  }

  @Patch(':id')
  @Roles(Role.admin, Role.warehouse)
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateSupplierDto) {
    return this.service.update(id, dto);
  }

  // TASK-009: hard delete only without history; 409 offers archiving
  @Delete(':id')
  @Roles(Role.admin, Role.warehouse)
  remove(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: AuthUser) {
    return this.service.remove(id, user.id);
  }

  @Post(':id/archive')
  @Roles(Role.admin, Role.warehouse)
  archive(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: AuthUser) {
    return this.service.archive(id, user.id);
  }
}
