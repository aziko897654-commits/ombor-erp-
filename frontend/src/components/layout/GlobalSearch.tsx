import { useQuery } from '@tanstack/react-query';
import { Package, Search, ShoppingCart, Truck, Users } from 'lucide-react';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { globalSearch } from '@/api/system';
import { t } from '@/lib/i18n';

/** FR-10.1: Ctrl+K modal, grouped results, role-filtered server-side. */
export function GlobalSearch() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');
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

  const hasResults =
    results &&
    results.customers.length +
      results.products.length +
      results.orders.length +
      results.suppliers.length >
      0;

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
            <div className="w-full max-w-xl rounded-xl border bg-background shadow-lg">
              <div className="flex items-center gap-2 border-b px-4 py-3">
                <Search className="h-4 w-4 text-muted-foreground" />
                <input
                  ref={inputRef}
                  className="flex-1 bg-transparent text-sm outline-none"
                  placeholder={t('search.placeholder')}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
                {isFetching && (
                  <span className="text-xs text-muted-foreground">…</span>
                )}
              </div>
              <div className="max-h-[50vh] overflow-y-auto p-2">
                {debounced.trim().length < 2 ? (
                  <p className="px-3 py-6 text-center text-sm text-muted-foreground">
                    {t('search.hint')}
                  </p>
                ) : !hasResults ? (
                  <p className="px-3 py-6 text-center text-sm text-muted-foreground">
                    {isFetching ? t('common.loading') : t('search.empty')}
                  </p>
                ) : (
                  <>
                    <Group
                      title={t('search.customers')}
                      icon={<Users className="h-3.5 w-3.5" />}
                      items={results!.customers.map((c) => ({
                        key: `c${c.id}`,
                        label: c.name,
                        hint: c.phone ?? '',
                        path: `/customers/${c.id}`,
                      }))}
                      onGo={go}
                    />
                    <Group
                      title={t('search.products')}
                      icon={<Package className="h-3.5 w-3.5" />}
                      items={results!.products.map((p) => ({
                        key: `p${p.id}`,
                        label: p.name,
                        hint: p.sku,
                        path: `/products/${p.id}`,
                      }))}
                      onGo={go}
                    />
                    <Group
                      title={t('search.orders')}
                      icon={<ShoppingCart className="h-3.5 w-3.5" />}
                      items={results!.orders.map((o) => ({
                        key: `o${o.id}`,
                        label: o.number,
                        hint: o.customer?.name ?? '',
                        path: `/orders/${o.id}`,
                      }))}
                      onGo={go}
                    />
                    <Group
                      title={t('search.suppliers')}
                      icon={<Truck className="h-3.5 w-3.5" />}
                      items={results!.suppliers.map((s) => ({
                        key: `s${s.id}`,
                        label: s.name,
                        hint: s.phone ?? '',
                        path: `/suppliers/${s.id}`,
                      }))}
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
  onGo,
}: {
  title: string;
  icon: ReactNode;
  items: Array<{ key: string; label: string; hint: string; path: string }>;
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
          type="button"
          onClick={() => onGo(item.path)}
          className="flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm hover:bg-accent"
        >
          <span className="font-medium">{item.label}</span>
          <span className="text-xs text-muted-foreground">{item.hint}</span>
        </button>
      ))}
    </div>
  );
}
