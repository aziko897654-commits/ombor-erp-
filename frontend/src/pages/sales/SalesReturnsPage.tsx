import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import {
  createSalesReturn,
  getOrder,
  getOrders,
  getSalesReturns,
} from '@/api/sales';
import { Pagination } from '@/components/Pagination';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
import { apiErrorMessage, formatDate, formatMoney, formatQty } from '@/lib/format';
import { t } from '@/lib/i18n';

/** FR-1.8: sales return based on a confirmed/shipped order. */
export function SalesReturnsPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<SortDir>('desc');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [orderId, setOrderId] = useState('');
  const [quantities, setQuantities] = useState<Record<number, string>>({});
  const [note, setNote] = useState('');
  const [error, setError] = useState('');

  const { data: list, isLoading } = useQuery({
    queryKey: ['sales-returns', page, sort],
    queryFn: () => getSalesReturns({ page, sort }),
  });
  // returns are based on confirmed or shipped orders only (FR-1.8)
  const { data: returnableOrders } = useQuery({
    queryKey: ['orders', 'returnable'],
    queryFn: async () => {
      const [confirmed, shipped] = await Promise.all([
        getOrders({ page: 1, limit: 100, status: 'confirmed' }),
        getOrders({ page: 1, limit: 100, status: 'shipped' }),
      ]);
      return [...confirmed.data, ...shipped.data];
    },
    enabled: dialogOpen,
  });
  const { data: order } = useQuery({
    queryKey: ['order', orderId],
    queryFn: () => getOrder(Number(orderId)),
    enabled: dialogOpen && orderId !== '',
  });

  const mutation = useMutation({
    mutationFn: createSalesReturn,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sales-returns'] });
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      closeDialog();
    },
    onError: (err) => setError(apiErrorMessage(err)),
  });

  const closeDialog = () => {
    setDialogOpen(false);
    setOrderId('');
    setQuantities({});
    setNote('');
    setError('');
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setError('');
    const items = Object.entries(quantities)
      .filter(([, q]) => Number(q) > 0)
      .map(([productId, q]) => ({
        productId: Number(productId),
        quantity: Number(q),
      }));
    if (items.length === 0) {
      setError('Kamida bitta pozitsiya uchun miqdor kiriting');
      return;
    }
    mutation.mutate({
      orderId: Number(orderId),
      note: note || undefined,
      items,
    });
  };

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">{t('salesReturns.title')}</h1>
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="h-4 w-4" /> {t('salesReturns.new')}
        </Button>
      </div>

      <div className="mb-3 flex items-center gap-2">
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
            <TableHead>{t('salesReturns.order')}</TableHead>
            <TableHead>{t('orders.customer')}</TableHead>
            <TableHead className="text-right">{t('common.total')}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading ? (
            <TableRow>
              <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                {t('common.loading')}
              </TableCell>
            </TableRow>
          ) : (list?.data.length ?? 0) === 0 ? (
            <TableRow>
              <TableCell colSpan={5} className="p-0">
                <EmptyState
                  message={t('salesReturns.empty')}
                  onAction={() => setDialogOpen(true)}
                  actionLabel={`+ ${t('salesReturns.new')}`}
                />
              </TableCell>
            </TableRow>
          ) : (
            list?.data.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="font-medium">{r.number}</TableCell>
                <TableCell>{formatDate(r.date)}</TableCell>
                <TableCell>
                  <Link to={`/orders/${r.orderId}`} className="hover:underline">
                    {r.order?.number}
                  </Link>
                </TableCell>
                <TableCell>{r.order?.customer?.name}</TableCell>
                <TableCell className="text-right">{formatMoney(r.total)}</TableCell>
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
        />
      )}

      <Dialog
        open={dialogOpen}
        onClose={closeDialog}
        title={t('salesReturns.new')}
        className="max-w-2xl"
      >
        <form onSubmit={submit} className="space-y-3">
          <div className="space-y-1.5">
            <Label>{t('salesReturns.order')} *</Label>
            <Select
              required
              value={orderId}
              onChange={(e) => {
                setOrderId(e.target.value);
                setQuantities({});
              }}
            >
              <option value="">{t('salesReturns.selectOrder')}</option>
              {returnableOrders?.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.number} — {o.customer?.name} ({formatMoney(o.total)})
                </option>
              ))}
            </Select>
          </div>

          {order && (
            <div className="rounded-md border">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr className="border-b text-left text-xs font-semibold uppercase text-muted-foreground">
                    <th className="px-3 py-2">{t('orders.product')}</th>
                    <th className="px-3 py-2 text-right">{t('salesReturns.sold')}</th>
                    <th className="w-32 px-3 py-2">{t('salesReturns.returned')}</th>
                  </tr>
                </thead>
                <tbody>
                  {order.items?.map((item) => (
                    <tr key={item.id} className="border-b last:border-0">
                      <td className="px-3 py-2">{item.product.name}</td>
                      <td className="px-3 py-2 text-right">
                        {formatQty(item.quantity)} {item.product.unit}
                      </td>
                      <td className="px-3 py-2">
                        <Input
                          type="number"
                          min="0"
                          step="0.001"
                          max={item.quantity}
                          className="h-8"
                          value={quantities[item.productId] ?? ''}
                          onChange={(e) =>
                            setQuantities({
                              ...quantities,
                              [item.productId]: e.target.value,
                            })
                          }
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="space-y-1.5">
            <Label>{t('common.note')}</Label>
            <Input value={note} onChange={(e) => setNote(e.target.value)} />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={closeDialog}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" disabled={mutation.isPending || !orderId}>
              {mutation.isPending ? t('common.saving') : t('common.save')}
            </Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}
