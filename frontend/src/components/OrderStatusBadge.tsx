import type { OrderStatus } from '@/api/sales';
import { StatusBadge } from '@/components/ui/status-badge';
import { t } from '@/lib/i18n';

// TASK-012: delegates to the central StatusBadge palette
export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  return <StatusBadge status={status} label={t(`orders.status.${status}`)} />;
}
