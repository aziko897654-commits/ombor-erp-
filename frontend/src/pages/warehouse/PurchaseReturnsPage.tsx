import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import {
  createPurchaseReturn,
  getPurchase,
  getPurchaseReturns,
  getPurchases,
} from '@/api/warehouse';
import { Pagination } from '@/components/Pagination';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
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

export function PurchaseReturnsPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [purchaseId, setPurchaseId] = useState('');
  const [quantities, setQuantities] = useState<Record<number, string>>({});
  const [error, setError] = useState('');

  const { data: list, isLoading } = useQuery({
    queryKey: ['purchase-returns', page],
    queryFn: () => getPurchaseReturns({ page }),
  });
  const { data: purchases } = useQuery({
    queryKey: ['purchases', 'all'],
    queryFn: () => getPurchases({ page: 1, limit: 100 }),
    enabled: dialogOpen,
  });
  const { data: purchase } = useQuery({
    queryKey: ['purchase', purchaseId],
    queryFn: () => getPurchase(Number(purchaseId)),
    enabled: dialogOpen && purchaseId !== '',
  });

  const mutation = useMutation({
    mutationFn: createPurchaseReturn,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchase-returns'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      closeDialog();
    },
    onError: (err) => setError(apiErrorMessage(err)),
  });

  const closeDialog = () => {
    setDialogOpen(false);
    setPurchaseId('');
    setQuantities({});
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
      setError("Kamida bitta pozitsiya uchun miqdor kiriting");
      return;
    }
    mutation.mutate({ purchaseId: Number(purchaseId), items });
  };

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">{t('purchaseReturns.title')}</h1>
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="h-4 w-4" /> {t('purchaseReturns.new')}
        </Button>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t('common.number')}</TableHead>
            <TableHead>{t('common.date')}</TableHead>
            <TableHead>{t('purchaseReturns.purchase')}</TableHead>
            <TableHead>{t('purchases.supplier')}</TableHead>
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
              <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                {t('common.noData')}
              </TableCell>
            </TableRow>
          ) : (
            list?.data.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="font-medium">{r.number}</TableCell>
                <TableCell>{formatDate(r.date)}</TableCell>
                <TableCell>
                  <Link to={`/purchases/${r.purchaseId}`} className="hover:underline">
                    {r.purchase?.number}
                  </Link>
                </TableCell>
                <TableCell>{r.purchase?.supplier?.name}</TableCell>
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
        title={t('purchaseReturns.new')}
        className="max-w-2xl"
      >
        <form onSubmit={submit} className="space-y-3">
          <div className="space-y-1.5">
            <Label>{t('purchaseReturns.purchase')} *</Label>
            <Select
              required
              value={purchaseId}
              onChange={(e) => {
                setPurchaseId(e.target.value);
                setQuantities({});
              }}
            >
              <option value="">{t('purchaseReturns.selectPurchase')}</option>
              {purchases?.data.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.number} — {p.supplier?.name} ({formatMoney(p.total)})
                </option>
              ))}
            </Select>
          </div>

          {purchase && (
            <div className="rounded-md border">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr className="border-b text-left text-xs font-semibold uppercase text-muted-foreground">
                    <th className="px-3 py-2">{t('purchases.product')}</th>
                    <th className="px-3 py-2 text-right">Olingan</th>
                    <th className="w-32 px-3 py-2">Qaytariladigan</th>
                  </tr>
                </thead>
                <tbody>
                  {purchase.items?.map((item) => (
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

          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={closeDialog}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" disabled={mutation.isPending || !purchaseId}>
              {mutation.isPending ? t('common.saving') : t('common.save')}
            </Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}
