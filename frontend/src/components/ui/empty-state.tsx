import { Inbox, SearchX, type LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { t } from '@/lib/i18n';

interface Props {
  /** true when a search/filter produced no results */
  filtered?: boolean;
  icon?: LucideIcon;
  message?: ReactNode;
  actionLabel?: string;
  onAction?: () => void;
}

/**
 * TASK-016: shared empty state — icon + message + optional CTA.
 * With `filtered` it switches to "nothing found" + a clear-filters
 * action supplied by the page.
 */
export function EmptyState({
  filtered,
  icon,
  message,
  actionLabel,
  onAction,
}: Props) {
  const Icon = icon ?? (filtered ? SearchX : Inbox);
  const text =
    message ?? (filtered ? t('common.nothingFound') : t('common.noData'));
  const label =
    actionLabel ?? (filtered && onAction ? t('common.clearFilters') : undefined);

  return (
    <div className="flex flex-col items-center gap-3 py-10 text-center">
      <Icon className="h-10 w-10 text-muted-foreground/40" />
      <p className="text-sm text-muted-foreground">{text}</p>
      {label && onAction && (
        <Button type="button" variant="outline" size="sm" onClick={onAction}>
          {label}
        </Button>
      )}
    </div>
  );
}
