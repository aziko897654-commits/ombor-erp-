import { Controller, Get, Query, StreamableFile } from '@nestjs/common';
import { Role } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import {
  reportToPdf,
  reportToXlsx,
  type Report,
} from './report-export.util';
import { assertFormat, ReportsService } from './reports.service';

const XLSX_MIME =
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

/** FR-6: report endpoints follow the rights matrix (FR-6.3). */
@Controller('reports')
export class ReportsController {
  constructor(private readonly service: ReportsService) {}

  @Get('finance')
  @Roles(Role.admin, Role.accountant)
  finance(
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('format') format?: string,
  ) {
    return this.deliver(() => this.service.finance_(from, to), format);
  }

  @Get('sales')
  @Roles(Role.admin, Role.sales)
  sales(
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('format') format?: string,
  ) {
    return this.deliver(() => this.service.sales(from, to), format);
  }

  @Get('stock')
  @Roles(Role.admin, Role.warehouse)
  stock(
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('format') format?: string,
  ) {
    return this.deliver(() => this.service.stock(from, to), format);
  }

  @Get('debts')
  @Roles(Role.admin, Role.accountant)
  debts(@Query('format') format?: string) {
    return this.deliver(() => this.service.debts(), format);
  }

  @Get('payments')
  @Roles(Role.admin, Role.accountant)
  payments(
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('format') format?: string,
  ) {
    return this.deliver(() => this.service.payments(from, to), format);
  }

  @Get('attendance')
  @Roles(Role.admin, Role.hr)
  attendance(@Query('month') month?: string, @Query('format') format?: string) {
    return this.deliver(() => this.service.attendance(month), format);
  }

  @Get('profit')
  @Roles(Role.admin, Role.accountant)
  profit(
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('format') format?: string,
  ) {
    return this.deliver(() => this.service.profit(from, to), format);
  }

  // TASK-022: journal + payroll exports for the table pages
  @Get('transactions')
  @Roles(Role.admin, Role.accountant)
  transactions(
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('format') format?: string,
  ) {
    return this.deliver(() => this.service.transactions(from, to), format);
  }

  @Get('payroll')
  @Roles(Role.admin, Role.hr, Role.accountant)
  payroll(@Query('month') month?: string, @Query('format') format?: string) {
    return this.deliver(() => this.service.payroll(month), format);
  }

  private async deliver(build: () => Promise<Report>, formatRaw?: string) {
    const format = assertFormat(formatRaw);
    const report = await build();
    if (format === 'json') return report;
    if (format === 'xlsx') {
      const buffer = await reportToXlsx(report);
      return new StreamableFile(buffer, {
        type: XLSX_MIME,
        disposition: `attachment; filename="report-${report.slug}.xlsx"`,
      });
    }
    const buffer = await reportToPdf(report);
    return new StreamableFile(buffer, {
      type: 'application/pdf',
      disposition: `attachment; filename="report-${report.slug}.pdf"`,
    });
  }
}
