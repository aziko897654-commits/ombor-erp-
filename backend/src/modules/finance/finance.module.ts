import { Module } from '@nestjs/common';
import { AccountsController } from './accounts.controller';
import { AccountsService } from './accounts.service';
import { FinanceController } from './finance.controller';
import { FinanceService } from './finance.service';
import { TransactionsController } from './transactions.controller';
import { TransactionsService } from './transactions.service';
import { TxCategoriesController } from './tx-categories.controller';
import { TxCategoriesService } from './tx-categories.service';

@Module({
  controllers: [
    FinanceController,
    AccountsController,
    TxCategoriesController,
    TransactionsController,
  ],
  providers: [
    FinanceService,
    AccountsService,
    TxCategoriesService,
    TransactionsService,
  ],
  exports: [AccountsService],
})
export class FinanceModule {}
