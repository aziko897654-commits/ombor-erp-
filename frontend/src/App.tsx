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
import { LoginPage } from '@/pages/LoginPage';
import { PlaceholderPage } from '@/pages/PlaceholderPage';
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
