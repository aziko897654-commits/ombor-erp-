import {
  Body,
  Controller,
  DefaultValuePipe,
  Get,
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
import { AdvancesService } from './advances.service';
import { CreateAdvanceDto } from './dto/hr.dto';

@Controller('advances')
@Roles(Role.admin, Role.hr)
export class AdvancesController {
  constructor(private readonly service: AdvancesService) {}

  @Get()
  findAll(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
  ) {
    return this.service.findAll(page, limit);
  }

  @Post()
  create(@Body() dto: CreateAdvanceDto, @CurrentUser() user: AuthUser) {
    return this.service.create(dto, user.id);
  }
}
