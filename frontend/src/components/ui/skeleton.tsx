import { cn } from '@/lib/utils';

/** TASK-017: shimmering placeholder block. */
export function Skeleton({ className }: { className?: string }) {
  return (
    <div className={cn('animate-pulse rounded-md bg-muted', className)} />
  );
}

/**
 * Table-body skeleton: `rows` × `cols` grid of shimmer cells sized to
 * match a typical data row, so swapping in real content causes no
 * layout shift.
 */
export function TableSkeleton({
  rows = 5,
  cols,
}: {
  rows?: number;
  cols: number;
}) {
  return (
    <>
      {Array.from({ length: rows }, (_, r) => (
        <tr key={r} className="border-b last:border-0">
          {Array.from({ length: cols }, (_, c) => (
            <td key={c} className="px-3 py-3">
              <Skeleton className={cn('h-4', c === 0 ? 'w-28' : 'w-16')} />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

/** KPI/stat card skeleton matching the dashboard card dimensions. */
export function CardSkeleton() {
  return (
    <div className="rounded-xl border bg-card p-6">
      <Skeleton className="mb-3 h-4 w-24" />
      <Skeleton className="h-7 w-36" />
    </div>
  );
}

/** Chart area skeleton. */
export function ChartSkeleton({ height = 280 }: { height?: number }) {
  return (
    <div
      style={{ height }}
      className="w-full animate-pulse rounded-md bg-muted"
    />
  );
}
