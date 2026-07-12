import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { Role, TxType } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { CreateTxCategoryDto, UpdateTxCategoryDto } from './dto/finance.dto';
import { TxCategoriesService } from './tx-categories.service';

@Controller('tx-categories')
@Roles(Role.admin, Role.accountant)
export class TxCategoriesController {
  constructor(private readonly service: TxCategoriesService) {}

  @Get()
  findAll(@Query('type') type?: TxType) {
    return this.service.findAll(type);
  }

  @Post()
  create(@Body() dto: CreateTxCategoryDto) {
    return this.service.create(dto);
  }

  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateTxCategoryDto,
  ) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.service.remove(id);
  }
}
