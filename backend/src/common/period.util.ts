export interface Period {
  start: Date;
  end: Date;
}

/**
 * TASK-003: YYYY-MM-DD parsed into LOCAL calendar-day parts. Plain
 * `new Date('2026-07-01')` reads the string as UTC midnight (05:00
 * local here), which shifted period starts by 5 hours: transactions
 * between 00:00 and 05:00 on the first day fell out of the period and
 * the comparison window drifted into the next day.
 */
function localDate(date: string): Date {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/** Inclusive upper bound for a YYYY-MM-DD date filter (local day). */
export function endOfDay(date: string): Date {
  const d = localDate(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

/** Parses ?from&to; defaults to the current month (FR-5.1/FR-6.1). */
export function parsePeriod(from?: string, to?: string): Period {
  if (from && to) {
    return { start: localDate(from), end: endOfDay(to) };
  }
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

/** FR-5.2: the preceding period of exactly the same length. */
export function previousPeriod(period: Period): Period {
  const length = period.end.getTime() - period.start.getTime();
  const end = new Date(period.start.getTime() - 1);
  return { start: new Date(end.getTime() - length), end };
}

/**
 * TASK-003: "01.07–31.07" — display label built server-side (in the
 * server's timezone, which owns the period math) so a browser in a
 * different timezone cannot shift the end-of-day boundary to the
 * next/previous day.
 */
export function periodLabel(period: Period): string {
  const short = (d: Date) =>
    `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}`;
  return `${short(period.start)}–${short(period.end)}`;
}
