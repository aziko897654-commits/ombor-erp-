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
          .map((item) => (
            <Route
              key={item.path}
              path={item.path}
              element={
                <RequireRoles roles={item.roles}>
                  <PlaceholderPage titleKey={item.labelKey} stage={item.stage} />
                </RequireRoles>
              }
            />
          ))}
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
