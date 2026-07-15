import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Check, FileDown, Send, Trash2, Undo2, X } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  cancelOrder,
  confirmOrder,
  deleteOrder,
  downloadDeliveryNote,
  getOrder,
  shipOrder,
} from '@/api/sales';
import { Badge } from '@/components/ui/badge';
import { OrderStatusBadge } from '@/components/OrderStatusBadge';
import { Button, buttonVariants } from '@/components/ui/button';
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
import { confirmDialog } from '@/lib/confirm';
import { apiErrorMessage, formatDate, formatMoney, formatQty } from '@/lib/format';
import { t } from '@/lib/i18n';
import { cn } from '@/lib/utils';

export function OrderDetailPage() {
  const { id } = useParams();
  const orderId = Number(id);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [error, setError] = useState('');

  const { data: order } = useQuery({
    queryKey: ['order', id],
    queryFn: () => getOrder(orderId),
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['order', id] });
    queryClient.invalidateQueries({ queryKey: ['orders'] });
    queryClient.invalidateQueries({ queryKey: ['products'] });
    setError('');
  };

  const confirmMutation = useMutation({
    mutationFn: () => confirmOrder(orderId),
    onSuccess: invalidate,
    onError: (err) => setError(apiErrorMessage(err)),
  });
  const cancelMutation = useMutation({
    mutationFn: () => cancelOrder(orderId),
    onSuccess: invalidate,
    onError: (err) => setError(apiErrorMessage(err)),
  });
  const shipMutation = useMutation({
    mutationFn: () => shipOrder(orderId),
    onSuccess: invalidate,
    onError: (err) => setError(apiErrorMessage(err)),
  });
  const deleteMutation = useMutation({
    mutationFn: () => deleteOrder(orderId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      navigate('/orders');
    },
    onError: (err) => setError(apiErrorMessage(err)),
  });

  if (!order) {
    return <div className="text-muted-foreground">{t('common.loading')}</div>;
  }

  const busy =
    confirmMutation.isPending ||
    cancelMutation.isPending ||
    shipMutation.isPending ||
    deleteMutation.isPending;

  const paid = Number(order.paidTotal ?? 0);
  const remaining = Number(order.total) - paid;

  const handleDeliveryNote = async () => {
    try {
      const blob = await downloadDeliveryNote(orderId);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `delivery-note-${order.number}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  };

  return (
    <div className="max-w-4xl">
      <div className="mb-4 flex items-center gap-3">
        <Link
          to="/orders"
          aria-label={t('common.back')}
          className={cn(buttonVariants({ variant: 'ghost', size: 'icon' }))}
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <h1 className="text-2xl font-semibold">{order.number}</h1>
        <OrderStatusBadge status={order.status} />
        <div className="ml-auto flex gap-2">
          {order.status === 'draft' && (
            <>
              <Button
                disabled={busy}
                onClick={async () => {
                  if (await confirmDialog(t('orders.confirmHint'))) {
                    confirmMutation.mutate();
                  }
                }}
              >
                <Check className="h-4 w-4" /> {t('orders.confirm')}
              </Button>
              <Button
                variant="outline"
                disabled={busy}
                onClick={async () => {
                  if (
                    await confirmDialog(t('orders.deleteConfirm'), {
                      tone: 'danger',
                      confirmLabel: t('common.delete'),
                    })
                  ) {
                    deleteMutation.mutate();
                  }
                }}
              >
                <Trash2 className="h-4 w-4" /> {t('common.delete')}
              </Button>
            </>
          )}
          {(order.status === 'confirmed' || order.status === 'shipped') && (
            <Button variant="outline" onClick={handleDeliveryNote}>
              <FileDown className="h-4 w-4" /> {t('orders.deliveryNote')}
            </Button>
          )}
          {order.status === 'confirmed' && (
            <>
              <Button disabled={busy} onClick={() => shipMutation.mutate()}>
                <Send className="h-4 w-4" /> {t('orders.ship')}
              </Button>
              <Button
                variant="destructive"
                disabled={busy}
                onClick={async () => {
                  if (
                    await confirmDialog(t('orders.cancelHint'), {
                      tone: 'danger',
                      confirmLabel: t('orders.cancelOrder'),
                    })
                  ) {
                    cancelMutation.mutate();
                  }
                }}
              >
                <X className="h-4 w-4" /> {t('orders.cancelOrder')}
              </Button>
            </>
          )}
        </div>
      </div>
      {error && <p className="mb-3 text-sm text-destructive">{error}</p>}

      <div className="mb-4 grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t('orders.title')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1.5 text-sm">
            <Row
              label={t('orders.customer')}
              value={
                <Link
                  to={`/customers/${order.customerId}`}
                  className="font-medium hover:underline"
                >
                  {order.customer?.name}
                </Link>
              }
            />
            <Row label={t('orders.warehouse')} value={order.warehouse?.name ?? '—'} />
            <Row label={t('common.date')} value={formatDate(order.createdAt)} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t('common.total')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1.5 text-sm">
            <Row label={t('orders.subtotal')} value={formatMoney(order.subtotal)} />
            <Row label={t('orders.discount')} value={formatMoney(order.discount)} />
            <div className="flex justify-between border-t pt-1.5">
              <span className="font-medium">{t('common.total')}</span>
              <span className="font-semibold">{formatMoney(order.total)}</span>
            </div>
            {order.status !== 'draft' && (
              <>
                <div className="flex justify-between border-t pt-1.5">
                  <span className="text-muted-foreground">{t('orders.paid')}</span>
                  <span className="font-medium text-green-700">
                    {formatMoney(paid)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">
                    {t('orders.remaining')}
                  </span>
                  <span
                    className={`font-semibold ${remaining > 0 ? 'text-destructive' : 'text-green-700'}`}
                  >
                    {formatMoney(remaining)}
                  </span>
                </div>
                {order.invoice && (
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">
                      {t('orders.invoice')}
                    </span>
                    <span className="flex items-center gap-2 font-medium">
                      {order.invoice.number}
                      <Badge
                        variant={
                          order.invoice.status === 'paid' ? 'success' : 'secondary'
                        }
                      >
                        {t(`invoices.status.${order.invoice.status}`)}
                      </Badge>
                    </span>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <h2 className="mb-3 text-lg font-semibold">{t('orders.items')}</h2>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t('orders.product')}</TableHead>
            <TableHead className="text-right">{t('common.quantity')}</TableHead>
            <TableHead className="text-right">{t('orders.price')}</TableHead>
            {order.status !== 'draft' && (
              <TableHead className="text-right">{t('orders.cost')}</TableHead>
            )}
            <TableHead className="text-right">{t('common.total')}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {order.items?.map((item) => (
            <TableRow key={item.id}>
              <TableCell>
                <span className="font-medium">{item.product.name}</span>{' '}
                <span className="text-muted-foreground">({item.product.sku})</span>
              </TableCell>
              <TableCell className="text-right">
                {formatQty(item.quantity)} {item.product.unit}
              </TableCell>
              <TableCell className="text-right">{formatMoney(item.price)}</TableCell>
              {order.status !== 'draft' && (
                <TableCell className="text-right text-muted-foreground">
                  {formatMoney(item.cost)}
                </TableCell>
              )}
              <TableCell className="text-right">
                {formatMoney(Number(item.quantity) * Number(item.price))}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {(order.payments?.length ?? 0) > 0 && (
        <>
          <h2 className="mb-3 mt-6 text-lg font-semibold">
            {t('orders.paymentsHistory')}
          </h2>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('common.date')}</TableHead>
                <TableHead>{t('payments.direction')}</TableHead>
                <TableHead>{t('txs.account')}</TableHead>
                <TableHead>{t('common.note')}</TableHead>
                <TableHead className="text-right">{t('common.total')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {order.payments?.map((p) => (
                <TableRow key={p.id}>
                  <TableCell>{formatDate(p.date)}</TableCell>
                  <TableCell>
                    <Badge variant={p.direction === 'in' ? 'success' : 'destructive'}>
                      {t(`payments.${p.direction}`)}
                    </Badge>
                  </TableCell>
                  <TableCell>{p.account?.name}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {p.note ?? '—'}
                  </TableCell>
                  <TableCell
                    className={`text-right font-medium ${
                      p.direction === 'in' ? 'text-green-700' : 'text-destructive'
                    }`}
                  >
                    {p.direction === 'in' ? '+' : '−'}
                    {formatMoney(p.amount)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </>
      )}

      {(order.returns?.length ?? 0) > 0 && (
        <>
          <h2 className="mb-3 mt-6 flex items-center gap-2 text-lg font-semibold">
            <Undo2 className="h-4 w-4" /> {t('orders.returns')}
          </h2>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('common.number')}</TableHead>
                <TableHead>{t('common.date')}</TableHead>
                <TableHead className="text-right">{t('common.total')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {order.returns?.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">{r.number}</TableCell>
                  <TableCell>{formatDate(r.date)}</TableCell>
                  <TableCell className="text-right">{formatMoney(r.total)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}
