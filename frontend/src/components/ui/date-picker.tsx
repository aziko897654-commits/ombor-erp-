import { Calendar, ChevronLeft, ChevronRight, X } from 'lucide-react';
import * as React from 'react';
import { t } from '@/lib/i18n';
import { cn } from '@/lib/utils';

// TASK-010: single DatePicker for the whole app — dd.mm.yyyy display,
// Uzbek month names, weeks start on Monday. Value in/out stays the
// API-friendly YYYY-MM-DD string.

const MONTHS = [
  'Yanvar',
  'Fevral',
  'Mart',
  'Aprel',
  'May',
  'Iyun',
  'Iyul',
  'Avgust',
  'Sentabr',
  'Oktabr',
  'Noyabr',
  'Dekabr',
];
const WEEKDAYS = ['Du', 'Se', 'Ch', 'Pa', 'Ju', 'Sh', 'Ya'];

function toIso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function fromIso(value: string | undefined): Date | null {
  if (!value) return null;
  const [y, m, d] = value.split('-').map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

function display(value: string | undefined): string {
  const d = fromIso(value);
  if (!d) return '';
  return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}`;
}

interface Props {
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  disabled?: boolean;
  clearable?: boolean;
  className?: string;
  placeholder?: string;
}

export function DatePicker({
  value,
  onChange,
  required,
  disabled,
  clearable,
  className,
  placeholder,
}: Props) {
  const [open, setOpen] = React.useState(false);
  const selected = fromIso(value);
  const [view, setView] = React.useState<Date>(selected ?? new Date());
  const rootRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (open) setView(fromIso(value) ?? new Date());
  }, [open, value]);

  React.useEffect(() => {
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

  const year = view.getFullYear();
  const month = view.getMonth();
  const firstDay = new Date(year, month, 1);
  // Monday-first offset: JS getDay() is 0=Sunday
  const lead = (firstDay.getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const todayIso = toIso(new Date());

  const cells: Array<number | null> = [
    ...Array.from({ length: lead }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  return (
    <div ref={rootRef} className={cn('relative', className)}>
      <button
        type="button"
        disabled={disabled}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className={cn(
          'flex h-9 w-full items-center gap-2 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors',
          'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
          'disabled:cursor-not-allowed disabled:opacity-50',
          !value && 'text-muted-foreground',
        )}
      >
        <Calendar className="h-4 w-4 shrink-0 text-muted-foreground" />
        <span className="flex-1 text-left">
          {display(value) || placeholder || t('common.pickDate')}
        </span>
        {clearable && value && (
          <X
            className="h-4 w-4 shrink-0 text-muted-foreground hover:text-foreground"
            aria-label={t('common.clear')}
            onClick={(e) => {
              e.stopPropagation();
              onChange('');
            }}
          />
        )}
      </button>
      {/* mutable mirror keeps native `required` validation working */}
      {required && (
        <input
          tabIndex={-1}
          aria-hidden="true"
          required
          value={value}
          onChange={() => undefined}
          className="pointer-events-none absolute inset-0 h-px w-px opacity-0"
        />
      )}

      {open && (
        <div
          role="dialog"
          className="absolute left-0 top-10 z-50 w-64 rounded-md border bg-background p-2 shadow-md"
        >
          <div className="mb-1 flex items-center justify-between">
            <button
              type="button"
              aria-label={t('common.prevMonth')}
              className="rounded p-1 hover:bg-accent"
              onClick={() => setView(new Date(year, month - 1, 1))}
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="text-sm font-medium">
              {MONTHS[month]} {year}
            </span>
            <button
              type="button"
              aria-label={t('common.nextMonth')}
              className="rounded p-1 hover:bg-accent"
              onClick={() => setView(new Date(year, month + 1, 1))}
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
          <div className="grid grid-cols-7 text-center text-[11px] font-medium text-muted-foreground">
            {WEEKDAYS.map((w, i) => (
              <span key={w} className={cn('py-1', i >= 5 && 'text-destructive/70')}>
                {w}
              </span>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {cells.map((day, i) => {
              if (day === null) return <span key={`x${i}`} />;
              const iso = toIso(new Date(year, month, day));
              const isSelected = iso === value;
              const isToday = iso === todayIso;
              return (
                <button
                  key={iso}
                  type="button"
                  onClick={() => {
                    onChange(iso);
                    setOpen(false);
                  }}
                  className={cn(
                    'rounded py-1 text-center text-sm hover:bg-accent',
                    isToday && !isSelected && 'font-semibold text-primary',
                    isSelected &&
                      'bg-primary text-primary-foreground hover:bg-primary',
                  )}
                >
                  {day}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
