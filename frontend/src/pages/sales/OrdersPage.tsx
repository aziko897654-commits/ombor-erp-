import { useQuery } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { getOrders, type OrderStatus } from '@/api/sales';
import { OrderStatusBadge } from '@/components/OrderStatusBadge';
import { Pagination } from '@/components/Pagination';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { TableSkeleton } from '@/components/ui/skeleton';
import { Select } from '@/components/ui/select';
import { SortToggle, type SortDir } from '@/components/ui/sort-toggle';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { formatDate, formatMoney } from '@/lib/format';
import { t } from '@/lib/i18n';

const STATUSES: OrderStatus[] = ['draft', 'confirmed', 'shipped', 'cancelled'];

export function OrdersPage() {
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [status, setStatus] = useState('');
  const [sort, setSort] = useState<SortDir>('desc');

  const { data: list, isLoading } = useQuery({
    queryKey: ['orders', page, limit, status, sort],
    queryFn: () =>
      getOrders({
        page,
        limit,
        status: (status || undefined) as OrderStatus | undefined,
        sort,
      }),
  });

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">{t('orders.title')}</h1>
        <Button>
          <Link to="/orders/new" className="flex items-center gap-2">
            <Plus className="h-4 w-4" /> {t('orders.new')}
          </Link>
        </Button>
      </div>

      <div className="mb-3 flex items-center gap-2">
        <Select
          className="w-56"
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setPage(1);
          }}
        >
          <option value="">{t('common.all')}</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {t(`orders.status.${s}`)}
            </option>
          ))}
        </Select>
        <SortToggle
          value={sort}
          onChange={(v) => {
            setSort(v);
            setPage(1);
          }}
        />
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t('common.number')}</TableHead>
            <TableHead>{t('common.date')}</TableHead>
            <TableHead>{t('orders.customer')}</TableHead>
            <TableHead>{t('orders.warehouse')}</TableHead>
            <TableHead>{t('common.status')}</TableHead>
            <TableHead className="text-right">{t('common.total')}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading ? (
            <TableSkeleton rows={6} cols={6} />
          ) : (list?.data.length ?? 0) === 0 ? (
            <TableRow>
              <TableCell colSpan={6} className="p-0">
                <EmptyState
                  filtered={!!status}
                  onAction={
                    status
                      ? () => {
                          setStatus('');
                          setPage(1);
                        }
                      : undefined
                  }
                />
              </TableCell>
            </TableRow>
          ) : (
            list?.data.map((o) => (
              <TableRow key={o.id}>
                <TableCell>
                  <Link to={`/orders/${o.id}`} className="font-medium hover:underline">
                    {o.number}
                  </Link>
                </TableCell>
                <TableCell>{formatDate(o.createdAt)}</TableCell>
                <TableCell>
                  <Link
                    to={`/customers/${o.customerId}`}
                    className="hover:underline"
                  >
                    {o.customer?.name}
                  </Link>
                </TableCell>
                <TableCell>{o.warehouse?.name}</TableCell>
                <TableCell>
                  <OrderStatusBadge status={o.status} />
                </TableCell>
                <TableCell className="text-right">{formatMoney(o.total)}</TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
      {list?.meta && (
        <Pagination
          page={list.meta.page}
          limit={list.meta.limit}
          total={list.meta.total}
          onPageChange={setPage}
          onLimitChange={(l) => {
            setLimit(l);
            setPage(1);
          }}
        />
      )}
    </div>
  );
}
