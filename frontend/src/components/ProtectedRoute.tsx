import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import type { Role } from '@/api/auth';
import { useAuth } from '@/lib/auth';
import { t } from '@/lib/i18n';
import { firstAllowedPath } from '@/lib/menu';

function FullScreenLoader() {
  return (
    <div className="flex h-screen items-center justify-center text-muted-foreground">
      {t('common.loading')}
    </div>
  );
}

/** Blocks unauthenticated users: redirects to /login. */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { user, isLoading } = useAuth();
  if (isLoading) return <FullScreenLoader />;
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

/**
 * Frontend-side role check (RBAC 2.2). Hiding is not security —
 * the backend guard is the real protection.
 */
export function RequireRoles({
  roles,
  children,
}: {
  roles: Role[];
  children: ReactNode;
}) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (!roles.includes(user.role)) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 py-24">
        <div className="text-5xl font-bold text-muted-foreground">403</div>
        <p className="text-muted-foreground">{t('common.forbidden')}</p>
      </div>
    );
  }
  return <>{children}</>;
}

/** '/' for non-admin roles: jump to the first menu item they can open. */
export function HomeRedirect({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== 'admin') {
    return <Navigate to={firstAllowedPath(user.role)} replace />;
  }
  return <>{children}</>;
}
