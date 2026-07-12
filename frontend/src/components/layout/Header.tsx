import { LogOut } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/lib/auth';
import { t } from '@/lib/i18n';
import { GlobalSearch } from './GlobalSearch';
import { NotificationsBell } from './NotificationsBell';

export function Header() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  if (!user) return null;

  const handleLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b bg-background px-4">
      {/* FR-10.1: global search (Ctrl+K) */}
      <GlobalSearch />

      <div className="flex items-center gap-3">
        {/* FR-7.1: notifications with 60s polling */}
        <NotificationsBell />

        <div className="text-right leading-tight">
          <div className="text-sm font-medium">
            {user.firstName} {user.lastName}
          </div>
          <div className="text-xs text-muted-foreground">
            {t(`roles.${user.role}`)}
          </div>
        </div>

        <Button
          variant="ghost"
          size="icon"
          onClick={handleLogout}
          title={t('auth.logout')}
        >
          <LogOut className="h-4 w-4" />
        </Button>
      </div>
    </header>
  );
}
