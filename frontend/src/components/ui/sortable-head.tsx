import { ArrowDown, ArrowUp, ChevronsUpDown } from 'lucide-react';
import { TableHead } from '@/components/ui/table';
import { cn } from '@/lib/utils';

export interface ColumnSort {
  by: string;
  dir: 'asc' | 'desc';
}

/**
 * TASK-021: clickable column header. First click sorts desc, the next
 * flips to asc; the active column shows a solid arrow, inactive ones
 * a faint up/down hint.
 */
export function SortableHead({
  label,
  sortKey,
  sort,
  onSort,
  className,
}: {
  label: string;
  sortKey: string;
  sort: ColumnSort;
  onSort: (key: string) => void;
  className?: string;
}) {
  const active = sort.by === sortKey;
  return (
    <TableHead className={className}>
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        aria-label={`${label} — saralash`}
        className={cn(
          'inline-flex items-center gap-1 hover:text-foreground',
          active && 'text-foreground',
        )}
      >
        {label}
        {active ? (
          sort.dir === 'asc' ? (
            <ArrowUp className="h-3.5 w-3.5" />
          ) : (
            <ArrowDown className="h-3.5 w-3.5" />
          )
        ) : (
          <ChevronsUpDown className="h-3.5 w-3.5 opacity-40" />
        )}
      </button>
    </TableHead>
  );
}

/** Shared click-to-toggle behavior for pages. */
export function nextSort(current: ColumnSort, key: string): ColumnSort {
  if (current.by === key) {
    return { by: key, dir: current.dir === 'desc' ? 'asc' : 'desc' };
  }
  return { by: key, dir: 'desc' };
}
