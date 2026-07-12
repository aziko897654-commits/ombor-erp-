import type { ComponentType } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import {
  HomeRedirect,
  RequireAuth,
  RequireRoles,
} from '@/components/ProtectedRoute';
import { allMenuItems } from '@/lib/menu';
import { DashboardPage } from '@/pages/DashboardPage';
import { AccountsPage } from '@/pages/finance/AccountsPage';
import { DebtsPage } from '@/pages/finance/DebtsPage';
import { InvoicesPage } from '@/pages/finance/InvoicesPage';
import { PaymentsPage } from '@/pages/finance/PaymentsPage';
import { TransactionsPage } from '@/pages/finance/TransactionsPage';
import { TransfersPage as MoneyTransfersPage } from '@/pages/finance/TransfersPage';
import { AdvancesPage } from '@/pages/hr/AdvancesPage';
import { AttendancePage } from '@/pages/hr/AttendancePage';
import { EmployeeDetailPage } from '@/pages/hr/EmployeeDetailPage';
import { EmployeesPage } from '@/pages/hr/EmployeesPage';
import { PayrollCreatePage } from '@/pages/hr/PayrollCreatePage';
import { PayrollDetailPage } from '@/pages/hr/PayrollDetailPage';
import { PayrollPage } from '@/pages/hr/PayrollPage';
import { LoginPage } from '@/pages/LoginPage';
import { PlaceholderPage } from '@/pages/PlaceholderPage';
import { CustomerDetailPage } from '@/pages/sales/CustomerDetailPage';
import { CustomersPage } from '@/pages/sales/CustomersPage';
import { DealsPage } from '@/pages/sales/DealsPage';
import { OrderCreatePage } from '@/pages/sales/OrderCreatePage';
import { OrderDetailPage } from '@/pages/sales/OrderDetailPage';
import { OrdersPage } from '@/pages/sales/OrdersPage';
import { SalesReturnsPage } from '@/pages/sales/SalesReturnsPage';
import { AuditPage } from '@/pages/system/AuditPage';
import { ReportsPage } from '@/pages/system/ReportsPage';
import { SettingsPage } from '@/pages/system/SettingsPage';
import { UsersPage } from '@/pages/system/UsersPage';
import { ImportsPage } from '@/pages/warehouse/ImportsPage';
import { ProductDetailPage } from '@/pages/warehouse/ProductDetailPage';
import { ProductsPage } from '@/pages/warehouse/ProductsPage';
import { PurchaseCreatePage } from '@/pages/warehouse/PurchaseCreatePage';
import { PurchaseDetailPage } from '@/pages/warehouse/PurchaseDetailPage';
import { PurchaseReturnsPage } from '@/pages/warehouse/PurchaseReturnsPage';
import { PurchasesPage } from '@/pages/warehouse/PurchasesPage';
import { StockCountDetailPage } from '@/pages/warehouse/StockCountDetailPage';
import { StockCountsPage } from '@/pages/warehouse/StockCountsPage';
import { SupplierDetailPage } from '@/pages/warehouse/SupplierDetailPage';
import { SuppliersPage } from '@/pages/warehouse/SuppliersPage';
import { TransfersPage } from '@/pages/warehouse/TransfersPage';
import { WarehousesPage } from '@/pages/warehouse/WarehousesPage';

// Stage-by-stage: implemented list pages replace their placeholders here.
const IMPLEMENTED: Record<string, ComponentType> = {
  '/customers': CustomersPage,
  '/deals': DealsPage,
  '/orders': OrdersPage,
  '/returns/sales': SalesReturnsPage,
  '/finance/transactions': TransactionsPage,
  '/finance/payments': PaymentsPage,
  '/finance/debts': DebtsPage,
  '/finance/accounts': AccountsPage,
  '/finance/invoices': InvoicesPage,
  '/finance/transfers': MoneyTransfersPage,
  '/employees': EmployeesPage,
  '/attendance': AttendancePage,
  '/advances': AdvancesPage,
  '/payroll': PayrollPage,
  '/reports': ReportsPage,
  '/users': UsersPage,
  '/settings': SettingsPage,
  '/audit': AuditPage,
  '/products': ProductsPage,
  '/warehouses': WarehousesPage,
  '/suppliers': SuppliersPage,
  '/purchases': PurchasesPage,
  '/returns/purchases': PurchaseReturnsPage,
  '/stock/transfers': TransfersPage,
  '/stock/counts': StockCountsPage,
  '/imports': ImportsPage,
};

const DETAIL_ROUTES: Array<{
  path: string;
  roles: Array<'admin' | 'accountant' | 'warehouse' | 'sales' | 'hr'>;
  Component: ComponentType;
}> = [
  { path: '/products/:id', roles: ['admin', 'warehouse'], Component: ProductDetailPage },
  { path: '/suppliers/:id', roles: ['admin', 'warehouse', 'accountant'], Component: SupplierDetailPage },
  { path: '/purchases/new', roles: ['admin', 'warehouse'], Component: PurchaseCreatePage },
  { path: '/purchases/:id', roles: ['admin', 'warehouse', 'accountant'], Component: PurchaseDetailPage },
  { path: '/stock/counts/:id', roles: ['admin', 'warehouse'], Component: StockCountDetailPage },
  { path: '/customers/:id', roles: ['admin', 'sales'], Component: CustomerDetailPage },
  { path: '/orders/new', roles: ['admin', 'sales'], Component: OrderCreatePage },
  { path: '/orders/:id', roles: ['admin', 'sales'], Component: OrderDetailPage },
  { path: '/employees/:id', roles: ['admin', 'hr'], Component: EmployeeDetailPage },
  { path: '/payroll/new', roles: ['admin', 'hr'], Component: PayrollCreatePage },
  { path: '/payroll/:id', roles: ['admin', 'hr', 'accountant'], Component: PayrollDetailPage },
];

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        element={
          <RequireAuth>
            <AppLayout />
          </RequireAuth>
        }
      >
        <Route
          path="/"
          element={
            <HomeRedirect>
              <DashboardPage />
            </HomeRedirect>
          }
        />
        {allMenuItems()
          .filter((item) => item.path !== '/')
          .map((item) => {
            const Page = IMPLEMENTED[item.path];
            return (
              <Route
                key={item.path}
                path={item.path}
                element={
                  <RequireRoles roles={item.roles}>
                    {Page ? (
                      <Page />
                    ) : (
                      <PlaceholderPage titleKey={item.labelKey} stage={item.stage} />
                    )}
                  </RequireRoles>
                }
              />
            );
          })}
        {DETAIL_ROUTES.map(({ path, roles, Component }) => (
          <Route
            key={path}
            path={path}
            element={
              <RequireRoles roles={roles}>
                <Component />
              </RequireRoles>
            }
          />
        ))}
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
