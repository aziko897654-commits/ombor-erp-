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
import {
  AuthUser,
  CurrentUser,
} from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import {
  CreateStockCountDto,
  CreateTransferDto,
  UpdateStockCountDto,
  WriteoffDto,
} from './dto/stock.dto';
import { StockOperationsService } from './stock-operations.service';

@Controller('stock')
@Roles(Role.admin, Role.warehouse)
export class StockController {
  constructor(private readonly service: StockOperationsService) {}

  @Post('writeoff')
  writeoff(@Body() dto: WriteoffDto, @CurrentUser() user: AuthUser) {
    return this.service.writeoff(dto, user.id);
  }

  @Get('transfers')
  findTransfers(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
  ) {
    return this.service.findTransfers(page, limit);
  }

  @Get('transfers/:id')
  findTransfer(@Param('id', ParseIntPipe) id: number) {
    return this.service.findTransfer(id);
  }

  @Post('transfers')
  createTransfer(@Body() dto: CreateTransferDto, @CurrentUser() user: AuthUser) {
    return this.service.createTransfer(dto, user.id);
  }

  @Get('counts')
  findCounts(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
  ) {
    return this.service.findCounts(page, limit);
  }

  @Get('counts/:id')
  findCount(@Param('id', ParseIntPipe) id: number) {
    return this.service.findCount(id);
  }

  @Post('counts')
  createCount(@Body() dto: CreateStockCountDto, @CurrentUser() user: AuthUser) {
    return this.service.createCount(dto, user.id);
  }

  @Patch('counts/:id')
  updateCount(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateStockCountDto,
  ) {
    return this.service.updateCount(id, dto);
  }

  @Post('counts/:id/complete')
  completeCount(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: AuthUser) {
    return this.service.completeCount(id, user.id);
  }
}
