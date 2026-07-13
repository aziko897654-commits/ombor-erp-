import { ChevronDown, KeyRound, LogOut, Menu } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/lib/auth';
import { t } from '@/lib/i18n';
import { ChangePasswordDialog } from './ChangePasswordDialog';
import { GlobalSearch } from './GlobalSearch';
import { NotificationsBell } from './NotificationsBell';

export function Header({ onMenuClick }: { onMenuClick: () => void }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [passwordOpen, setPasswordOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const onClick = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [menuOpen]);

  if (!user) return null;

  const handleLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  return (
    <header className="flex h-14 shrink-0 items-center gap-3 border-b bg-background px-4">
      {/* NFR-14: hamburger opens the mobile drawer */}
      <Button
        variant="ghost"
        size="icon"
        className="md:hidden"
        aria-label={t('common.menu')}
        onClick={onMenuClick}
      >
        <Menu className="h-5 w-5" />
      </Button>

      {/* FR-10.1: global search (Ctrl+K) */}
      <GlobalSearch />

      <div className="ml-auto flex items-center gap-2">
        {/* FR-7.1: notifications with 60s polling */}
        <NotificationsBell />

        <div ref={menuRef} className="relative">
          <button
            type="button"
            onClick={() => setMenuOpen((o) => !o)}
            className="flex items-center gap-2 rounded-md px-2 py-1.5 text-left hover:bg-accent"
            aria-haspopup="menu"
            aria-expanded={menuOpen}
          >
            <div className="hidden leading-tight sm:block">
              <div className="text-sm font-medium">
                {user.firstName} {user.lastName}
              </div>
              <div className="text-xs text-muted-foreground">
                {t(`roles.${user.role}`)}
              </div>
            </div>
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          </button>

          {menuOpen && (
            <div
              role="menu"
              className="absolute right-0 top-11 z-50 w-56 rounded-lg border bg-background p-1 shadow-lg"
            >
              <div className="border-b px-3 py-2 sm:hidden">
                <div className="text-sm font-medium">
                  {user.firstName} {user.lastName}
                </div>
                <div className="text-xs text-muted-foreground">
                  {t(`roles.${user.role}`)}
                </div>
              </div>
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setMenuOpen(false);
                  setPasswordOpen(true);
                }}
                className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm hover:bg-accent"
              >
                <KeyRound className="h-4 w-4" /> {t('profile.changePassword')}
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={handleLogout}
                className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm text-destructive hover:bg-accent"
              >
                <LogOut className="h-4 w-4" /> {t('auth.logout')}
              </button>
            </div>
          )}
        </div>
      </div>

      <ChangePasswordDialog
        open={passwordOpen}
        onClose={() => setPasswordOpen(false)}
      />
    </header>
  );
}
