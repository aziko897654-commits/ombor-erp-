import { Badge, type BadgeProps } from '@/components/ui/badge';

/**
 * TASK-012: one palette for every status badge in the system
 * (spec section: draft gray, confirmed green, shipped blue, completed
 * dark green, cancelled red, partial yellow, in green / out red).
 * Unknown statuses fall back to the neutral outline.
 */
const VARIANT_BY_STATUS: Record<string, BadgeProps['variant']> = {
  // documents
  draft: 'secondary',
  confirmed: 'success',
  shipped: 'info',
  sent: 'info',
  completed: 'done',
  paid: 'done',
  cancelled: 'destructive',
  partial: 'warning',
  // money direction
  in: 'success',
  out: 'destructive',
  income: 'success',
  expense: 'destructive',
  // people
  active: 'success',
  fired: 'destructive',
  blocked: 'destructive',
  // deals
  new: 'info',
  negotiation: 'warning',
  won: 'success',
  lost: 'destructive',
};

export function StatusBadge({
  status,
  label,
}: {
  status: string;
  label: string;
}) {
  return (
    <Badge variant={VARIANT_BY_STATUS[status] ?? 'outline'}>{label}</Badge>
  );
}
