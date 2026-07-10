import { Bell, LogOut, Search } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/lib/auth';
import { t } from '@/lib/i18n';

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
      {/* Global search (Ctrl+K) is implemented in stage 5 (FR-10.1) */}
      <div className="flex w-72 items-center gap-2 rounded-md border px-3 py-1.5 text-sm text-muted-foreground">
        <Search className="h-4 w-4" />
        <span>{t('common.search')}</span>
        <kbd className="ml-auto rounded border bg-muted px-1.5 text-[10px]">
          Ctrl+K
        </kbd>
      </div>

      <div className="flex items-center gap-3">
        {/* Notification bell — polling arrives in stage 5 (FR-7.1) */}
        <Button variant="ghost" size="icon" title={t('common.notifications')}>
          <Bell className="h-4 w-4" />
        </Button>

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
