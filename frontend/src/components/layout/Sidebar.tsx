import { useQuery } from '@tanstack/react-query';
import { Building2 } from 'lucide-react';
import { NavLink } from 'react-router-dom';
import { assetUrl } from '@/api/client';
import { getPublicSettings } from '@/api/system';
import { useAuth } from '@/lib/auth';
import { t } from '@/lib/i18n';
import { visibleSections } from '@/lib/menu';
import { cn } from '@/lib/utils';

/** Brand + role-filtered navigation; shared by the desktop rail and the
 *  mobile drawer. `onNavigate` lets the drawer close on selection. */
export function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const { user } = useAuth();
  // company brand (logo + name) — FR-9; shared cache with the tab title
  const { data: brand } = useQuery({
    queryKey: ['brand'],
    queryFn: getPublicSettings,
    staleTime: 60_000,
  });
  if (!user) return null;

  const sections = visibleSections(user.role);
  let flatIndex = 0; // running index → staggered reveal of nav items

  return (
    <>
      <div className="relative flex h-14 items-center gap-2 border-b border-white/10 px-4">
        {/* nozik yorug'lik brend ostida */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-indigo-400/40 to-transparent"
        />
        {brand?.logoPath ? (
          <img
            src={assetUrl(brand.logoPath)}
            alt=""
            className="h-8 w-8 shrink-0 rounded object-contain"
          />
        ) : (
          <div className="animate-shine relative flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-white/10 ring-1 ring-white/15">
            <Building2 className="h-5 w-5 text-sidebar-accent-foreground" />
          </div>
        )}
        <span className="truncate text-base font-semibold text-sidebar-accent-foreground">
          {brand?.companyName || t('app.name')}
        </span>
      </div>
      <nav className="sidebar-scroll flex-1 space-y-4 overflow-y-auto px-2 py-4">
        {sections.map((section, i) => (
          <div key={section.labelKey ?? i}>
            {section.labelKey && (
              <div className="mb-1 px-3 text-[11px] font-semibold uppercase tracking-wider text-sidebar-foreground/50">
                {t(section.labelKey)}
              </div>
            )}
            <ul className="space-y-0.5">
              {section.items.map((item) => {
                const delay = flatIndex++ * 0.04;
                return (
                  <li
                    key={item.path}
                    className="animate-fade-up"
                    style={{ animationDelay: `${delay}s` }}
                  >
                    <NavLink
                      to={item.path}
                      end={item.path === '/'}
                      onClick={onNavigate}
                      className={({ isActive }) =>
                        cn(
                          'group relative flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-all duration-200',
                          isActive
                            ? "bg-sidebar-accent text-sidebar-accent-foreground shadow-sm before:absolute before:left-0 before:top-1/2 before:h-5 before:w-[3px] before:-translate-y-1/2 before:rounded-r-full before:bg-indigo-400 before:content-['']"
                            : 'text-sidebar-foreground/80 hover:translate-x-0.5 hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground',
                        )
                      }
                    >
                      <item.icon className="h-4 w-4 shrink-0 transition-transform duration-200 group-hover:scale-110" />
                      <span className="truncate">{t(item.labelKey)}</span>
                    </NavLink>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>
    </>
  );
}

/** Desktop rail — hidden below the md breakpoint (NFR-14). */
export function Sidebar() {
  return (
    <aside className="hidden h-screen w-60 shrink-0 flex-col border-r border-white/5 bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-sidebar-foreground md:flex">
      <SidebarNav />
    </aside>
  );
}
