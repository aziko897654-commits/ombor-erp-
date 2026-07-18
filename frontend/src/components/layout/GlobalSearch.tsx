import { useQuery } from '@tanstack/react-query';
import {
  LayoutGrid,
  Package,
  Search,
  ShoppingCart,
  Truck,
  Users,
  Zap,
} from 'lucide-react';
import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import type { Role } from '@/api/auth';
import { globalSearch } from '@/api/system';
import { useAuth } from '@/lib/auth';
import { t } from '@/lib/i18n';
import { visibleSections } from '@/lib/menu';
import { cn } from '@/lib/utils';

interface FlatItem {
  key: string;
  label: string;
  hint: string;
  path: string;
}

/** TASK-024: quick actions offered before any query is typed. */
const QUICK_ACTIONS: Array<{
  labelKey: string;
  path: string;
  roles: Role[];
}> = [
  { labelKey: 'search.newOrder', path: '/orders/new', roles: ['admin', 'sales'] },
  { labelKey: 'search.newPurchase', path: '/purchases/new', roles: ['admin', 'warehouse'] },
  { labelKey: 'search.newCustomer', path: '/customers', roles: ['admin', 'sales'] },
  { labelKey: 'search.newPayment', path: '/finance/payments', roles: ['admin', 'accountant'] },
];

/** FR-10.1: Ctrl+K command palette — entities, pages, quick actions. */
export function GlobalSearch() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen(true);
      }
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    if (open) {
      setQuery('');
      setDebounced('');
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [open]);

  useEffect(() => {
    const handle = setTimeout(() => setDebounced(query), 250);
    return () => clearTimeout(handle);
  }, [query]);

  const { data: results, isFetching } = useQuery({
    queryKey: ['search', debounced],
    queryFn: () => globalSearch(debounced),
    enabled: open && debounced.trim().length >= 2,
  });

  const go = (path: string) => {
    setOpen(false);
    navigate(path);
  };

  // TASK-024: page navigation results, filtered by role and query
  const q = debounced.trim().toLowerCase();
  const pageItems: FlatItem[] = user
    ? visibleSections(user.role)
        .flatMap((s) => s.items)
        .filter((i) => q.length >= 2 && t(i.labelKey).toLowerCase().includes(q))
        .map((i) => ({
          key: `n${i.path}`,
          label: t(i.labelKey),
          hint: i.path,
          path: i.path,
        }))
    : [];

  // quick actions shown before any query is typed
  const actionItems: FlatItem[] = user
    ? QUICK_ACTIONS.filter((a) => a.roles.includes(user.role)).map((a) => ({
        key: `a${a.path}`,
        label: t(a.labelKey),
        hint: a.path,
        path: a.path,
      }))
    : [];

  const hasResults =
    pageItems.length > 0 ||
    (results &&
      results.customers.length +
        results.products.length +
        results.orders.length +
        results.suppliers.length >
        0);

  const entityItems: FlatItem[] = results
    ? [
        ...results.customers.map((c) => ({
          key: `c${c.id}`,
          label: c.name,
          hint: c.phone ?? '',
          path: `/customers/${c.id}`,
        })),
        ...results.products.map((p) => ({
          key: `p${p.id}`,
          label: p.name,
          hint: p.sku,
          path: `/products/${p.id}`,
        })),
        ...results.orders.map((o) => ({
          key: `o${o.id}`,
          label: o.number,
          hint: o.customer?.name ?? '',
          path: `/orders/${o.id}`,
        })),
        ...results.suppliers.map((s) => ({
          key: `s${s.id}`,
          label: s.name,
          hint: s.phone ?? '',
          path: `/suppliers/${s.id}`,
        })),
      ]
    : [];

  const flatItems: FlatItem[] =
    q.length < 2 ? actionItems : [...pageItems, ...entityItems];

  useEffect(() => {
    setActiveIndex(0);
  }, [debounced, results]);

  const onInputKeyDown = (e: ReactKeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, flatItems.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const item = flatItems[activeIndex];
      if (item) go(item.path);
    } else if (e.key === 'Tab') {
      // the input is the only focusable control; results are chosen via
      // arrow keys, so keep focus trapped here rather than leaking out
      e.preventDefault();
    }
  };

  const activeKey = flatItems[activeIndex]?.key;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex w-72 items-center gap-2 rounded-md border px-3 py-1.5 text-sm text-muted-foreground transition hover:bg-accent"
      >
        <Search className="h-4 w-4" />
        <span>{t('common.search')}</span>
        <kbd className="ml-auto rounded border bg-muted px-1.5 text-[10px]">
          Ctrl+K
        </kbd>
      </button>

      {open &&
        createPortal(
          <div
            className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 p-4 pt-[12vh]"
            onMouseDown={(e) => {
              if (e.target === e.currentTarget) setOpen(false);
            }}
          >
            <div
              role="dialog"
              aria-modal="true"
              aria-label={t('common.search')}
              className="w-full max-w-xl rounded-xl border bg-background shadow-lg"
            >
              <div className="flex items-center gap-2 border-b px-4 py-3">
                <Search className="h-4 w-4 text-muted-foreground" />
                <input
                  ref={inputRef}
                  role="combobox"
                  aria-expanded={hasResults}
                  aria-controls="global-search-listbox"
                  aria-activedescendant={activeKey ? `gs-${activeKey}` : undefined}
                  className="flex-1 bg-transparent text-sm outline-none"
                  placeholder={t('search.placeholder')}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={onInputKeyDown}
                />
                {isFetching && (
                  <span className="text-xs text-muted-foreground">…</span>
                )}
              </div>
              <div
                id="global-search-listbox"
                role="listbox"
                className="max-h-[50vh] overflow-y-auto p-2"
              >
                {q.length < 2 ? (
                  <>
                    <Group
                      title={t('search.quickActions')}
                      icon={<Zap className="h-3.5 w-3.5" />}
                      items={actionItems}
                      activeKey={activeKey}
                      onGo={go}
                    />
                    <p className="px-3 py-3 text-center text-xs text-muted-foreground">
                      {t('search.hint')}
                    </p>
                  </>
                ) : !hasResults ? (
                  <p className="px-3 py-6 text-center text-sm text-muted-foreground">
                    {isFetching ? t('common.loading') : t('search.empty')}
                  </p>
                ) : (
                  <>
                    <Group
                      title={t('search.pages')}
                      icon={<LayoutGrid className="h-3.5 w-3.5" />}
                      items={pageItems}
                      activeKey={activeKey}
                      onGo={go}
                    />
                    <Group
                      title={t('search.customers')}
                      icon={<Users className="h-3.5 w-3.5" />}
                      items={entityItems.filter((i) => i.key.startsWith('c'))}
                      activeKey={activeKey}
                      onGo={go}
                    />
                    <Group
                      title={t('search.products')}
                      icon={<Package className="h-3.5 w-3.5" />}
                      items={entityItems.filter((i) => i.key.startsWith('p'))}
                      activeKey={activeKey}
                      onGo={go}
                    />
                    <Group
                      title={t('search.orders')}
                      icon={<ShoppingCart className="h-3.5 w-3.5" />}
                      items={entityItems.filter((i) => i.key.startsWith('o'))}
                      activeKey={activeKey}
                      onGo={go}
                    />
                    <Group
                      title={t('search.suppliers')}
                      icon={<Truck className="h-3.5 w-3.5" />}
                      items={entityItems.filter((i) => i.key.startsWith('s'))}
                      activeKey={activeKey}
                      onGo={go}
                    />
                  </>
                )}
              </div>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}

function Group({
  title,
  icon,
  items,
  activeKey,
  onGo,
}: {
  title: string;
  icon: ReactNode;
  items: FlatItem[];
  activeKey: string | undefined;
  onGo: (path: string) => void;
}) {
  if (items.length === 0) return null;
  return (
    <div className="mb-1">
      <p className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold uppercase text-muted-foreground">
        {icon} {title}
      </p>
      {items.map((item) => (
        <button
          key={item.key}
          id={`gs-${item.key}`}
          type="button"
          role="option"
          aria-selected={item.key === activeKey}
          tabIndex={-1}
          onClick={() => onGo(item.path)}
          className={cn(
            'flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm hover:bg-accent',
            item.key === activeKey && 'bg-accent',
          )}
        >
          <span className="font-medium">{item.label}</span>
          <span className="text-xs text-muted-foreground">{item.hint}</span>
        </button>
      ))}
    </div>
  );
}
