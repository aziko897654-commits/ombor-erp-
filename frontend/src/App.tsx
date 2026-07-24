import { useQuery } from '@tanstack/react-query';
import { lazy, useEffect, type ComponentType } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { getPublicSettings } from '@/api/system';
import { AppLayout } from '@/components/layout/AppLayout';
import {
  HomeRedirect,
  RequireAuth,
  RequireRoles,
} from '@/components/ProtectedRoute';
import { allMenuItems } from '@/lib/menu';
import { LoginPage } from '@/pages/LoginPage';
import { PlaceholderPage } from '@/pages/PlaceholderPage';

const DEFAULT_TITLE = 'ERP — Korxona boshqaruv tizimi';

/** Keeps the browser tab title in sync with the company name (FR-9). */
function BrandTitle() {
  const { data } = useQuery({
    queryKey: ['brand'],
    queryFn: getPublicSettings,
    staleTime: 60_000,
  });
  useEffect(() => {
    document.title = data?.companyName
      ? `${data.companyName} — ERP`
      : DEFAULT_TITLE;
  }, [data?.companyName]);
  return null;
}

// Route-level code splitting: each page (and its heavy deps, e.g. Recharts
// on the dashboard) is fetched only when first navigated to. Named exports
// are adapted to the default export React.lazy expects.
function named(
  loader: () => Promise<Record<string, unknown>>,
  key: string,
): ComponentType {
  return lazy(() =>
    loader().then((m) => ({ default: m[key] as ComponentType })),
  ) as unknown as ComponentType;
}

const DashboardPage = named(() => import('@/pages/DashboardPage'), 'DashboardPage');
const AccountsPage = named(() => import('@/pages/finance/AccountsPage'), 'AccountsPage');
const DebtsPage = named(() => import('@/pages/finance/DebtsPage'), 'DebtsPage');
const InvoicesPage = named(() => import('@/pages/finance/InvoicesPage'), 'InvoicesPage');
const PaymentsPage = named(() => import('@/pages/finance/PaymentsPage'), 'PaymentsPage');
const TransactionsPage = named(() => import('@/pages/finance/TransactionsPage'), 'TransactionsPage');
const MoneyTransfersPage = named(() => import('@/pages/finance/TransfersPage'), 'TransfersPage');
const AdvancesPage = named(() => import('@/pages/hr/AdvancesPage'), 'AdvancesPage');
const AttendancePage = named(() => import('@/pages/hr/AttendancePage'), 'AttendancePage');
const EmployeeDetailPage = named(() => import('@/pages/hr/EmployeeDetailPage'), 'EmployeeDetailPage');
const EmployeesPage = named(() => import('@/pages/hr/EmployeesPage'), 'EmployeesPage');
const PayrollCreatePage = named(() => import('@/pages/hr/PayrollCreatePage'), 'PayrollCreatePage');
const PayrollDetailPage = named(() => import('@/pages/hr/PayrollDetailPage'), 'PayrollDetailPage');
const PayrollPage = named(() => import('@/pages/hr/PayrollPage'), 'PayrollPage');
const CustomerDetailPage = named(() => import('@/pages/sales/CustomerDetailPage'), 'CustomerDetailPage');
const CustomersPage = named(() => import('@/pages/sales/CustomersPage'), 'CustomersPage');
const DealsPage = named(() => import('@/pages/sales/DealsPage'), 'DealsPage');
const OrderCreatePage = named(() => import('@/pages/sales/OrderCreatePage'), 'OrderCreatePage');
const OrderDetailPage = named(() => import('@/pages/sales/OrderDetailPage'), 'OrderDetailPage');
const OrdersPage = named(() => import('@/pages/sales/OrdersPage'), 'OrdersPage');
const SalesReturnsPage = named(() => import('@/pages/sales/SalesReturnsPage'), 'SalesReturnsPage');
const AuditPage = named(() => import('@/pages/system/AuditPage'), 'AuditPage');
const ReportsPage = named(() => import('@/pages/system/ReportsPage'), 'ReportsPage');
const SettingsPage = named(() => import('@/pages/system/SettingsPage'), 'SettingsPage');
const UsersPage = named(() => import('@/pages/system/UsersPage'), 'UsersPage');
const ImportsPage = named(() => import('@/pages/warehouse/ImportsPage'), 'ImportsPage');
const ProductDetailPage = named(() => import('@/pages/warehouse/ProductDetailPage'), 'ProductDetailPage');
const ProductsPage = named(() => import('@/pages/warehouse/ProductsPage'), 'ProductsPage');
const PurchaseCreatePage = named(() => import('@/pages/warehouse/PurchaseCreatePage'), 'PurchaseCreatePage');
const PurchaseDetailPage = named(() => import('@/pages/warehouse/PurchaseDetailPage'), 'PurchaseDetailPage');
const PurchaseReturnsPage = named(() => import('@/pages/warehouse/PurchaseReturnsPage'), 'PurchaseReturnsPage');
const PurchasesPage = named(() => import('@/pages/warehouse/PurchasesPage'), 'PurchasesPage');
const StockCountDetailPage = named(() => import('@/pages/warehouse/StockCountDetailPage'), 'StockCountDetailPage');
const StockCountsPage = named(() => import('@/pages/warehouse/StockCountsPage'), 'StockCountsPage');
const SupplierDetailPage = named(() => import('@/pages/warehouse/SupplierDetailPage'), 'SupplierDetailPage');
const SuppliersPage = named(() => import('@/pages/warehouse/SuppliersPage'), 'SuppliersPage');
const TransfersPage = named(() => import('@/pages/warehouse/TransfersPage'), 'TransfersPage');
const WarehousesPage = named(() => import('@/pages/warehouse/WarehousesPage'), 'WarehousesPage');

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
    <>
      <BrandTitle />
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
    </>
  );
}
