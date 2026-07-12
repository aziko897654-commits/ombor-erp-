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
import { CreatePayrollDto } from './dto/hr.dto';
import { PayrollService } from './payroll.service';

@Controller('payroll')
@Roles(Role.admin, Role.hr)
export class PayrollController {
  constructor(private readonly service: PayrollService) {}

  @Get()
  findAll(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
  ) {
    return this.service.findAll(page, limit);
  }

  @Get('preview')
  preview(@Query('month') month: string) {
    return this.service.preview(month);
  }

  // accountant reads sheets (matrix 2.1: R for salary)
  @Get(':id')
  @Roles(Role.admin, Role.hr, Role.accountant)
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.service.findOne(id);
  }

  @Post()
  create(@Body() dto: CreatePayrollDto, @CurrentUser() user: AuthUser) {
    return this.service.create(dto, user.id);
  }
}
