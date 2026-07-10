import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2 } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import {
  createTransfer,
  getProducts,
  getTransfers,
  getWarehouses,
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
import { apiErrorMessage, formatDate } from '@/lib/format';
import { t } from '@/lib/i18n';

interface ItemRow {
  productId: string;
  quantity: string;
}

export function TransfersPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [fromId, setFromId] = useState('');
  const [toId, setToId] = useState('');
  const [note, setNote] = useState('');
  const [items, setItems] = useState<ItemRow[]>([{ productId: '', quantity: '' }]);
  const [error, setError] = useState('');

  const { data: list, isLoading } = useQuery({
    queryKey: ['transfers', page],
    queryFn: () => getTransfers({ page }),
  });
  const { data: warehouses } = useQuery({
    queryKey: ['warehouses'],
    queryFn: () => getWarehouses(),
  });
  const { data: products } = useQuery({
    queryKey: ['products', 'all'],
    queryFn: () => getProducts({ page: 1, limit: 100 }),
    enabled: dialogOpen,
  });

  const mutation = useMutation({
    mutationFn: createTransfer,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transfers'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      closeDialog();
    },
    onError: (err) => setError(apiErrorMessage(err)),
  });

  const closeDialog = () => {
    setDialogOpen(false);
    setFromId('');
    setToId('');
    setNote('');
    setItems([{ productId: '', quantity: '' }]);
    setError('');
  };

  const setItem = (i: number, patch: Partial<ItemRow>) => {
    setItems((rows) => rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setError('');
    mutation.mutate({
      fromWarehouseId: Number(fromId),
      toWarehouseId: Number(toId),
      note: note || undefined,
      items: items.map((r) => ({
        productId: Number(r.productId),
        quantity: Number(r.quantity),
      })),
    });
  };

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">{t('transfers.title')}</h1>
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="h-4 w-4" /> {t('transfers.new')}
        </Button>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t('common.number')}</TableHead>
            <TableHead>{t('common.date')}</TableHead>
            <TableHead>{t('transfers.from')}</TableHead>
            <TableHead>{t('transfers.to')}</TableHead>
            <TableHead>{t('common.note')}</TableHead>
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
            list?.data.map((tr) => (
              <TableRow key={tr.id}>
                <TableCell className="font-medium">{tr.number}</TableCell>
                <TableCell>{formatDate(tr.date)}</TableCell>
                <TableCell>{tr.fromWarehouseName}</TableCell>
                <TableCell>{tr.toWarehouseName}</TableCell>
                <TableCell className="text-muted-foreground">{tr.note ?? '—'}</TableCell>
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
        title={t('transfers.new')}
        className="max-w-2xl"
      >
        <form onSubmit={submit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>{t('transfers.from')} *</Label>
              <Select required value={fromId} onChange={(e) => setFromId(e.target.value)}>
                <option value="">—</option>
                {warehouses?.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name}
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>{t('transfers.to')} *</Label>
              <Select required value={toId} onChange={(e) => setToId(e.target.value)}>
                <option value="">—</option>
                {warehouses
                  ?.filter((w) => String(w.id) !== fromId)
                  .map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name}
                    </option>
                  ))}
              </Select>
            </div>
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <Label>{t('purchases.items')}</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setItems([...items, { productId: '', quantity: '' }])}
              >
                <Plus className="h-4 w-4" /> {t('purchases.addItem')}
              </Button>
            </div>
            <div className="space-y-2">
              {items.map((row, i) => (
                <div key={i} className="flex items-center gap-2">
                  <Select
                    required
                    className="flex-1"
                    value={row.productId}
                    onChange={(e) => setItem(i, { productId: e.target.value })}
                  >
                    <option value="">{t('purchases.selectProduct')}</option>
                    {products?.data.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({p.sku})
                      </option>
                    ))}
                  </Select>
                  <Input
                    required
                    className="w-28"
                    type="number"
                    min="0.001"
                    step="0.001"
                    placeholder={t('common.quantity')}
                    value={row.quantity}
                    onChange={(e) => setItem(i, { quantity: e.target.value })}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    disabled={items.length === 1}
                    onClick={() => setItems(items.filter((_, idx) => idx !== i))}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>{t('common.note')}</Label>
            <Input value={note} onChange={(e) => setNote(e.target.value)} />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={closeDialog}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? t('common.saving') : t('common.save')}
            </Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}
