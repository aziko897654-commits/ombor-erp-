import { Module } from '@nestjs/common';
import { FinanceModule } from '../finance/finance.module';
import { ProductsModule } from '../products/products.module';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';

@Module({
  imports: [FinanceModule, ProductsModule],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
