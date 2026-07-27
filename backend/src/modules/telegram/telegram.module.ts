import { Module } from '@nestjs/common';
import { DashboardModule } from '../dashboard/dashboard.module';
import { ProductsModule } from '../products/products.module';
import { TelegramService } from './telegram.service';

@Module({
  imports: [DashboardModule, ProductsModule],
  providers: [TelegramService],
  exports: [TelegramService],
})
export class TelegramModule {}
