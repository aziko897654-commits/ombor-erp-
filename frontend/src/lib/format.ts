// NFR-16: date DD.MM.YYYY, money "1 250 000 so'm", negative/debt in red.

export function formatMoney(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === '') return '—';
  const n = typeof value === 'string' ? Number(value) : value;
  if (Number.isNaN(n)) return String(value);
  const formatted = new Intl.NumberFormat('ru-RU', {
    maximumFractionDigits: 2,
  })
    .format(n)
    .replace(/,/g, '.')
    .replace(/ /g, ' ');
  return `${formatted} so'm`;
}

export function formatQty(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === '') return '—';
  const n = typeof value === 'string' ? Number(value) : value;
  if (Number.isNaN(n)) return String(value);
  return new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 3 })
    .format(n)
    .replace(/,/g, '.')
    .replace(/ /g, ' ');
}

export function formatDate(value: string | Date | null | undefined): string {
  if (!value) return '—';
  const d = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return String(value);
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${dd}.${mm}.${d.getFullYear()}`;
}

export function formatDateTime(value: string | Date | null | undefined): string {
  if (!value) return '—';
  const d = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return String(value);
  const hh = String(d.getHours()).padStart(2, '0');
  const mi = String(d.getMinutes()).padStart(2, '0');
  return `${formatDate(d)} ${hh}:${mi}`;
}

/** TASK-028: signed percent — 14.4 → "+14.4%", −3 → "−3%". */
export function formatPercent(value: number | null | undefined): string {
  if (value === null || value === undefined) return '—';
  return `${value > 0 ? '+' : ''}${value}%`;
}

/**
 * TASK-003: centralized delta color semantics. Growth is good for
 * income/profit; for expenses (invert=true) a decrease is the good
 * direction. Returns the text color class for the percent badge.
 */
export function changeTone(
  change: number | null | undefined,
  invert = false,
): string {
  const up = (change ?? 0) >= 0;
  const good = invert ? !up : up;
  return good ? 'text-green-700' : 'text-destructive';
}

/** Extracts a display message from an axios error (API error format 6.4). */
export function apiErrorMessage(err: unknown): string {
  const message = (err as any)?.response?.data?.message;
  if (Array.isArray(message)) return message.join('; ');
  if (typeof message === 'string') return message;
  return 'Xatolik yuz berdi';
}
