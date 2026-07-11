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
import { DealStage, Role } from '@prisma/client';
import {
  AuthUser,
  CurrentUser,
} from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { DealsService } from './deals.service';
import { CreateDealDto, UpdateDealDto } from './dto/deal.dto';

@Controller('deals')
@Roles(Role.admin, Role.sales)
export class DealsController {
  constructor(private readonly service: DealsService) {}

  @Get()
  findAll(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
    @Query('stage') stage?: DealStage,
  ) {
    return this.service.findAll(page, limit, stage);
  }

  @Get('board')
  board() {
    return this.service.board();
  }

  @Post()
  create(@Body() dto: CreateDealDto, @CurrentUser() user: AuthUser) {
    return this.service.create(dto, user.id);
  }

  @Patch(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateDealDto) {
    return this.service.update(id, dto);
  }
}
