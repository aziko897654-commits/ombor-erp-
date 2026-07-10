import { Module } from '@nestjs/common';
import { StockController } from './stock.controller';
import { StockOperationsService } from './stock-operations.service';
import { StockService } from './stock.service';

@Module({
  controllers: [StockController],
  providers: [StockService, StockOperationsService],
  exports: [StockService],
})
export class StockModule {}
