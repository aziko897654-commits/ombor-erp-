import { Columns3 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { t } from '@/lib/i18n';

export interface ToggleColumn {
  key: string;
  label: string;
  visible: boolean;
  onToggle: (visible: boolean) => void;
}

/**
 * TASK-008: per-table column visibility dropdown. Empty columns (like
 * Email with no data) hide by default; users re-enable them here.
 */
export function ColumnsToggle({ columns }: { columns: ToggleColumn[] }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <Button
        type="button"
        variant="outline"
        size="sm"
        aria-haspopup="true"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        <Columns3 className="h-4 w-4" /> {t('common.columns')}
      </Button>
      {open && (
        <div className="absolute right-0 top-9 z-50 w-48 rounded-md border bg-background p-2 shadow-md">
          {columns.map((col) => (
            <label
              key={col.key}
              className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-accent"
            >
              <input
                type="checkbox"
                checked={col.visible}
                onChange={(e) => col.onToggle(e.target.checked)}
              />
              {col.label}
            </label>
          ))}
        </div>
      )}
    </div>
  );
}
