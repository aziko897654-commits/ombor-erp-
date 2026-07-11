import { Module } from '@nestjs/common';
import { StockModule } from '../stock/stock.module';
import { SalesReturnsController } from './sales-returns.controller';
import { SalesReturnsService } from './sales-returns.service';

@Module({
  imports: [StockModule],
  controllers: [SalesReturnsController],
  providers: [SalesReturnsService],
})
export class SalesReturnsModule {}
