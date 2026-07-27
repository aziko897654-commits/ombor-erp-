import { Loader2, X } from 'lucide-react';
import { Suspense, useEffect, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
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
  const { pathname } = useLocation();

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
            'absolute left-0 top-0 flex h-full w-64 flex-col bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-sidebar-foreground shadow-xl transition-transform',
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

      <div className="relative flex min-w-0 flex-1 flex-col">
        {/* Jonli to'q fon (blob-lar sekin harakatlanadi) */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 overflow-hidden"
        >
          <div className="animate-blob absolute -left-32 top-0 h-72 w-72 rounded-full bg-indigo-600/10 blur-3xl" />
          <div className="animate-blob absolute -right-24 top-1/3 h-80 w-80 rounded-full bg-sky-600/10 blur-3xl [animation-delay:5s]" />
          <div className="animate-float absolute bottom-0 left-1/3 h-72 w-72 rounded-full bg-violet-600/10 blur-3xl" />
        </div>

        <Header onMenuClick={() => setMobileOpen(true)} />
        <main className="relative flex-1 overflow-y-auto p-4 md:p-6">
          <Suspense fallback={<PageLoading />}>
            {/* Sahifa o'tishida fade-up animatsiyasi (yo'l o'zgarganda qayta ishga tushadi) */}
            <div key={pathname} className="animate-fade-up">
              <Outlet />
            </div>
          </Suspense>
        </main>
      </div>
    </div>
  );
}
