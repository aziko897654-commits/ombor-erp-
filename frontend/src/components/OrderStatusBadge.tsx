import type { OrderStatus } from '@/api/sales';
import { Badge } from '@/components/ui/badge';
import { t } from '@/lib/i18n';

const VARIANTS: Record<
  OrderStatus,
  'secondary' | 'success' | 'default' | 'destructive'
> = {
  draft: 'secondary',
  confirmed: 'success',
  shipped: 'default',
  cancelled: 'destructive',
};

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  return (
    <Badge variant={VARIANTS[status] ?? 'secondary'}>
      {t(`orders.status.${status}`)}
    </Badge>
  );
}
