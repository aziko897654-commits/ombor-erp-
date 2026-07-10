import { Controller, Get } from '@nestjs/common';
import { Role } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';

/**
 * Stage 0 stub: proves the RBAC contour (sales -> 403).
 * Full finance module is implemented in stage 3.
 */
@Controller('finance')
@Roles(Role.admin, Role.accountant)
export class FinanceController {
  @Get('balance')
  balance() {
    return { accounts: [] };
  }
}
