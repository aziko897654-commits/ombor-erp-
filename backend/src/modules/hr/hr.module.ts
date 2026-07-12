import { Module } from '@nestjs/common';
import { AdvancesController } from './advances.controller';
import { AdvancesService } from './advances.service';
import { AttendanceController } from './attendance.controller';
import { AttendanceService } from './attendance.service';
import {
  DepartmentsController,
  PositionsController,
} from './catalogs.controller';
import { CatalogsService } from './catalogs.service';
import { EmployeesController } from './employees.controller';
import { EmployeesService } from './employees.service';
import { PayrollController } from './payroll.controller';
import { PayrollService } from './payroll.service';

@Module({
  controllers: [
    DepartmentsController,
    PositionsController,
    EmployeesController,
    AttendanceController,
    AdvancesController,
    PayrollController,
  ],
  providers: [
    CatalogsService,
    EmployeesService,
    AttendanceService,
    AdvancesService,
    PayrollService,
  ],
})
export class HrModule {}
