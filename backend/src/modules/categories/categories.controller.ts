import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { IsNotEmpty, IsString } from 'class-validator';
import { Roles } from '../../common/decorators/roles.decorator';
import { CategoriesService } from './categories.service';

class CategoryDto {
  @IsString()
  @IsNotEmpty({ message: 'Kategoriya nomi kiritilishi shart' })
  name!: string;
}

@Controller('categories')
@Roles(Role.admin, Role.warehouse)
export class CategoriesController {
  constructor(private readonly service: CategoriesService) {}

  @Get()
  findAll() {
    return this.service.findAll();
  }

  @Post()
  create(@Body() dto: CategoryDto) {
    return this.service.create(dto.name);
  }

  @Patch(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: CategoryDto) {
    return this.service.update(id, dto.name);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.service.remove(id);
  }
}
