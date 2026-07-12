import { Controller, Get, Query } from '@nestjs/common';
import { Role } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { DashboardService } from './dashboard.service';

@Controller('dashboard')
@Roles(Role.admin)
export class DashboardController {
  constructor(private readonly service: DashboardService) {}

  @Get('summary')
  summary(@Query('from') from?: string, @Query('to') to?: string) {
    return this.service.summary(from, to);
  }

  @Get('charts')
  charts(@Query('from') from?: string, @Query('to') to?: string) {
    return this.service.charts(from, to);
  }
}
