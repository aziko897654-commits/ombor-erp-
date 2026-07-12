import { Body, Controller, Get, Post } from '@nestjs/common';
import { Role } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { CatalogsService } from './catalogs.service';
import { CreateCatalogItemDto } from './dto/hr.dto';

@Controller('departments')
@Roles(Role.admin, Role.hr)
export class DepartmentsController {
  constructor(private readonly service: CatalogsService) {}

  @Get()
  findAll() {
    return this.service.listDepartments();
  }

  @Post()
  create(@Body() dto: CreateCatalogItemDto) {
    return this.service.createDepartment(dto.name);
  }
}

@Controller('positions')
@Roles(Role.admin, Role.hr)
export class PositionsController {
  constructor(private readonly service: CatalogsService) {}

  @Get()
  findAll() {
    return this.service.listPositions();
  }

  @Post()
  create(@Body() dto: CreateCatalogItemDto) {
    return this.service.createPosition(dto.name);
  }
}
