import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { Role } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { AttendanceService } from './attendance.service';
import { SetAttendanceDto } from './dto/hr.dto';

@Controller('attendance')
@Roles(Role.admin, Role.hr)
export class AttendanceController {
  constructor(private readonly service: AttendanceService) {}

  @Get()
  month(@Query('month') month: string) {
    return this.service.month(month);
  }

  @Post()
  set(@Body() dto: SetAttendanceDto) {
    return this.service.set(dto);
  }
}
