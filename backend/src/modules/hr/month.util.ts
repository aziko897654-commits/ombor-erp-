/**
 * Local-time month boundaries for "YYYY-MM" (server and users share the
 * timezone in this deployment). Used by attendance, advances and payroll
 * so all three agree on what belongs to a month.
 */
export function monthRange(month: string): { start: Date; end: Date } {
  const [year, m] = month.split('-').map(Number);
  return { start: new Date(year, m - 1, 1), end: new Date(year, m, 1) };
}
