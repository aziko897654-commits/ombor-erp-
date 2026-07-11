import { useQuery } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { getCustomer } from '@/api/sales';
import { OrderStatusBadge } from '@/components/OrderStatusBadge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
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

/** FR-1.2: customer card — info, balance block (FR-3.7), histories. */
export function CustomerDetailPage() {
  const { id } = useParams();
  const { data: customer } = useQuery({
    queryKey: ['customer', id],
    queryFn: () => getCustomer(Number(id)),
  });

  if (!customer) {
    return <div className="text-muted-foreground">{t('common.loading')}</div>;
  }

  const debt = Number(customer.balance?.debt ?? 0);

  return (
    <div>
      <div className="mb-4 flex items-center gap-3">
        <Button variant="ghost" size="icon">
          <Link to="/customers">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <h1 className="text-2xl font-semibold">{customer.name}</h1>
      </div>

      <div className="mb-6 grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t('customers.title')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1.5 text-sm">
            <Row label={t('common.phone')} value={customer.phone ?? '—'} />
            <Row label="Email" value={customer.email ?? '—'} />
            <Row label={t('common.address')} value={customer.address ?? '—'} />
            <Row label={t('common.note')} value={customer.note ?? '—'} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t('customers.balance')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1.5 text-sm">
            <Row
              label={t('customers.ordersTotal')}
              value={formatMoney(customer.balance?.ordersTotal)}
            />
            <Row
              label={t('customers.returnsTotal')}
              value={formatMoney(customer.balance?.returnsTotal)}
            />
            <Row
              label={t('customers.paymentsTotal')}
              value={formatMoney(customer.balance?.paymentsTotal)}
            />
            <div className="flex justify-between border-t pt-1.5">
              <span className="font-medium">{t('customers.debt')}</span>
              <span
                className={`font-semibold ${debt > 0 ? 'text-destructive' : 'text-green-700'}`}
              >
                {formatMoney(customer.balance?.debt)}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      <h2 className="mb-3 text-lg font-semibold">{t('customers.ordersHistory')}</h2>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t('common.number')}</TableHead>
            <TableHead>{t('common.date')}</TableHead>
            <TableHead>{t('orders.warehouse')}</TableHead>
            <TableHead>{t('common.status')}</TableHead>
            <TableHead className="text-right">{t('common.total')}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {customer.orders.length === 0 ? (
            <TableRow>
              <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                {t('common.noData')}
              </TableCell>
            </TableRow>
          ) : (
            customer.orders.map((o) => (
              <TableRow key={o.id}>
                <TableCell>
                  <Link to={`/orders/${o.id}`} className="font-medium hover:underline">
                    {o.number}
                  </Link>
                </TableCell>
                <TableCell>{formatDate(o.createdAt)}</TableCell>
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

      <h2 className="mb-3 mt-6 text-lg font-semibold">
        {t('customers.paymentsHistory')}
      </h2>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t('common.date')}</TableHead>
            <TableHead>{t('orders.title')}</TableHead>
            <TableHead>{t('common.note')}</TableHead>
            <TableHead className="text-right">{t('common.total')}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {customer.payments.length === 0 ? (
            <TableRow>
              <TableCell colSpan={4} className="py-8 text-center text-muted-foreground">
                {t('common.noData')}
              </TableCell>
            </TableRow>
          ) : (
            customer.payments.map((p) => (
              <TableRow key={p.id}>
                <TableCell>{formatDate(p.date)}</TableCell>
                <TableCell>{p.order?.number ?? '—'}</TableCell>
                <TableCell className="text-muted-foreground">{p.note ?? '—'}</TableCell>
                <TableCell
                  className={`text-right ${p.direction === 'out' ? 'text-destructive' : ''}`}
                >
                  {p.direction === 'out' ? '−' : ''}
                  {formatMoney(p.amount)}
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}
