import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AuditModule } from './common/audit/audit.module';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { NumberingModule } from './common/numbering/numbering.module';
import { PrismaModule } from './common/prisma/prisma.module';
import { AuthModule } from './modules/auth/auth.module';
import { CategoriesModule } from './modules/categories/categories.module';
import { CustomersModule } from './modules/customers/customers.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { DealsModule } from './modules/deals/deals.module';
import { FinanceModule } from './modules/finance/finance.module';
import { HrModule } from './modules/hr/hr.module';
import { ImportsModule } from './modules/imports/imports.module';
import { InvoicesModule } from './modules/invoices/invoices.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { OrdersModule } from './modules/orders/orders.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { ProductsModule } from './modules/products/products.module';
import { PurchaseReturnsModule } from './modules/purchase-returns/purchase-returns.module';
import { PurchasesModule } from './modules/purchases/purchases.module';
import { ReportsModule } from './modules/reports/reports.module';
import { SalesReturnsModule } from './modules/sales-returns/sales-returns.module';
import { SearchModule } from './modules/search/search.module';
import { SettingsModule } from './modules/settings/settings.module';
import { StockModule } from './modules/stock/stock.module';
import { SuppliersModule } from './modules/suppliers/suppliers.module';
import { UsersModule } from './modules/users/users.module';
import { WarehousesModule } from './modules/warehouses/warehouses.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 300 }]),
    PrismaModule,
    AuditModule,
    NumberingModule,
    AuthModule,
    UsersModule,
    FinanceModule,
    WarehousesModule,
    CategoriesModule,
    ProductsModule,
    SuppliersModule,
    StockModule,
    PurchasesModule,
    PurchaseReturnsModule,
    ImportsModule,
    CustomersModule,
    DealsModule,
    OrdersModule,
    SalesReturnsModule,
    SettingsModule,
    PaymentsModule,
    InvoicesModule,
    HrModule,
    NotificationsModule,
    DashboardModule,
    ReportsModule,
    SearchModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
