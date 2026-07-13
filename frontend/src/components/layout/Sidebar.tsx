import { Building2 } from 'lucide-react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { t } from '@/lib/i18n';
import { visibleSections } from '@/lib/menu';
import { cn } from '@/lib/utils';

/** Brand + role-filtered navigation; shared by the desktop rail and the
 *  mobile drawer. `onNavigate` lets the drawer close on selection. */
export function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const { user } = useAuth();
  if (!user) return null;

  const sections = visibleSections(user.role);

  return (
    <>
      <div className="flex h-14 items-center gap-2 border-b border-sidebar-accent px-4">
        <Building2 className="h-6 w-6 text-sidebar-accent-foreground" />
        <span className="text-base font-semibold text-sidebar-accent-foreground">
          {t('app.name')}
        </span>
      </div>
      <nav className="flex-1 space-y-4 overflow-y-auto px-2 py-4">
        {sections.map((section, i) => (
          <div key={section.labelKey ?? i}>
            {section.labelKey && (
              <div className="mb-1 px-3 text-[11px] font-semibold uppercase tracking-wider text-sidebar-foreground/60">
                {t(section.labelKey)}
              </div>
            )}
            <ul className="space-y-0.5">
              {section.items.map((item) => (
                <li key={item.path}>
                  <NavLink
                    to={item.path}
                    end={item.path === '/'}
                    onClick={onNavigate}
                    className={({ isActive }) =>
                      cn(
                        'flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors',
                        isActive
                          ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                          : 'hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground',
                      )
                    }
                  >
                    <item.icon className="h-4 w-4 shrink-0" />
                    <span className="truncate">{t(item.labelKey)}</span>
                  </NavLink>
                </li>
              ))}
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
    <aside className="hidden h-screen w-60 shrink-0 flex-col bg-sidebar text-sidebar-foreground md:flex">
      <SidebarNav />
    </aside>
  );
}
