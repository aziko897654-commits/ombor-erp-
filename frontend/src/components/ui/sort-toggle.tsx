import { ArrowDown, ArrowUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { t } from '@/lib/i18n';

export type SortDir = 'asc' | 'desc';

interface Props {
  value: SortDir;
  onChange: (value: SortDir) => void;
}

/** TZ 9-bo'lim: jadval standarti — saralash (kamida sana bo'yicha). */
export function SortToggle({ value, onChange }: Props) {
  const label = value === 'desc' ? t('common.sortNewestFirst') : t('common.sortOldestFirst');
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      aria-label={`${t('common.sortByDate')}: ${label}`}
      onClick={() => onChange(value === 'desc' ? 'asc' : 'desc')}
    >
      {value === 'desc' ? (
        <ArrowDown className="h-4 w-4" />
      ) : (
        <ArrowUp className="h-4 w-4" />
      )}
      {t('common.sortByDate')}
    </Button>
  );
}
