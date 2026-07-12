export interface Period {
  start: Date;
  end: Date;
}

/** Inclusive upper bound for a YYYY-MM-DD date filter. */
export function endOfDay(date: string): Date {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

/** Parses ?from&to; defaults to the current month (FR-5.1/FR-6.1). */
export function parsePeriod(from?: string, to?: string): Period {
  if (from && to) {
    return { start: new Date(from), end: endOfDay(to) };
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
