import { Loader2, X } from 'lucide-react';
import { Suspense, useEffect, useState } from 'react';
import { Outlet } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { Header } from './Header';
import { Sidebar, SidebarNav } from './Sidebar';

function PageLoading() {
  return (
    <div className="flex h-full min-h-[50vh] items-center justify-center text-muted-foreground">
      <Loader2 className="h-6 w-6 animate-spin" />
    </div>
  );
}

export function AppLayout() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const closeMobile = () => setMobileOpen(false);

  // TASK-033: "N" triggers the current page's create action (a button
  // or link marked with data-new-record); ignored while typing or
  // while any dialog is open
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() !== 'n' || e.ctrlKey || e.metaKey || e.altKey)
        return;
      const el = e.target as HTMLElement;
      if (
        el.tagName === 'INPUT' ||
        el.tagName === 'TEXTAREA' ||
        el.tagName === 'SELECT' ||
        el.isContentEditable
      )
        return;
      if (document.querySelector('[role="dialog"]')) return;
      const target = document.querySelector<HTMLElement>('[data-new-record]');
      if (target) {
        e.preventDefault();
        target.click();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />

      {/* Mobile drawer (NFR-14): sidebar hidden < md, opened via the header
          hamburger, dismissed by backdrop or selecting an item. */}
      <div
        className={cn(
          'fixed inset-0 z-50 md:hidden',
          mobileOpen ? 'pointer-events-auto' : 'pointer-events-none',
        )}
        aria-hidden={!mobileOpen}
      >
        <div
          className={cn(
            'absolute inset-0 bg-black/50 transition-opacity',
            mobileOpen ? 'opacity-100' : 'opacity-0',
          )}
          onClick={closeMobile}
        />
        <aside
          className={cn(
            'absolute left-0 top-0 flex h-full w-64 flex-col bg-sidebar text-sidebar-foreground shadow-xl transition-transform',
            mobileOpen ? 'translate-x-0' : '-translate-x-full',
          )}
        >
          <button
            type="button"
            aria-label="Yopish"
            onClick={closeMobile}
            className="absolute right-2 top-3 rounded-md p-1 text-sidebar-foreground/70 hover:text-sidebar-accent-foreground"
          >
            <X className="h-5 w-5" />
          </button>
          <SidebarNav onNavigate={closeMobile} />
        </aside>
      </div>

      <div className="flex min-w-0 flex-1 flex-col">
        <Header onMenuClick={() => setMobileOpen(true)} />
        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          <Suspense fallback={<PageLoading />}>
            <Outlet />
          </Suspense>
        </main>
      </div>
    </div>
  );
}
