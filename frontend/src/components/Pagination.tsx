import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import { t } from '@/lib/i18n';

const PAGE_SIZES = [10, 25, 50, 100];

interface Props {
  page: number;
  limit: number;
  total: number;
  onPageChange: (page: number) => void;
  /** TASK-020: when provided, a 10/25/50/100 page-size selector shows */
  onLimitChange?: (limit: number) => void;
}

export function Pagination({
  page,
  limit,
  total,
  onPageChange,
  onLimitChange,
}: Props) {
  const pages = Math.max(1, Math.ceil(total / limit));
  if (pages <= 1 && !onLimitChange) return null;
  if (total === 0) return null;

  const from = (page - 1) * limit + 1;
  const to = Math.min(page * limit, total);

  return (
    <nav
      aria-label={t('common.pagination')}
      className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground"
    >
      <span>
        {from}–{to} / {total} tadan
      </span>
      <div className="flex items-center gap-2">
        {onLimitChange && (
          <Select
            className="h-9 w-20"
            aria-label={t('common.pageSize')}
            value={String(limit)}
            onChange={(e) => onLimitChange(Number(e.target.value))}
          >
            {PAGE_SIZES.map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </Select>
        )}
        <Button
          variant="outline"
          size="icon"
          aria-label={t('common.prevPage')}
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="min-w-14 text-center">
          {page}/{pages}
        </span>
        <Button
          variant="outline"
          size="icon"
          aria-label={t('common.nextPage')}
          disabled={page >= pages}
          onClick={() => onPageChange(page + 1)}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </nav>
  );
}
