import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowRight, Plus } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import {
  createMoneyTransfer,
  getAccounts,
  getMoneyTransfers,
} from '@/api/finance';
import { Pagination } from '@/components/Pagination';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
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
import { apiErrorMessage, formatDate, formatMoney } from '@/lib/format';
import { t } from '@/lib/i18n';

const emptyForm = { fromAccountId: '', toAccountId: '', amount: '', note: '' };

/** FR-3.9: cash↔bank transfers; balances move, KPIs stay untouched. */
export function TransfersPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<SortDir>('desc');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState('');

  const { data: list, isLoading } = useQuery({
    queryKey: ['finance', 'transfers', page, sort],
    queryFn: () => getMoneyTransfers({ page, sort }),
  });
  const { data: accounts } = useQuery({
    queryKey: ['accounts'],
    queryFn: getAccounts,
    enabled: dialogOpen,
  });

  const mutation = useMutation({
    mutationFn: createMoneyTransfer,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['finance'] });
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      setDialogOpen(false);
    },
    onError: (err) => setError(apiErrorMessage(err)),
  });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setError('');
    mutation.mutate({
      fromAccountId: Number(form.fromAccountId),
      toAccountId: Number(form.toAccountId),
      amount: Number(form.amount),
      note: form.note || undefined,
    });
  };

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">{t('moneyTransfers.title')}</h1>
        <Button
          onClick={() => {
            setForm(emptyForm);
            setError('');
            setDialogOpen(true);
          }}
        >
          <Plus className="h-4 w-4" /> {t('moneyTransfers.new')}
        </Button>
      </div>

      <div className="mb-3 flex justify-end">
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
            <TableHead>{t('common.date')}</TableHead>
            <TableHead>{t('moneyTransfers.from')}</TableHead>
            <TableHead>{t('moneyTransfers.to')}</TableHead>
            <TableHead>{t('common.note')}</TableHead>
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
            list?.data.map((transfer) => (
              <TableRow key={transfer.id}>
                <TableCell>{formatDate(transfer.date)}</TableCell>
                <TableCell>{transfer.fromAccount.name}</TableCell>
                <TableCell>
                  <span className="flex items-center gap-1">
                    <ArrowRight className="h-3 w-3 text-muted-foreground" />
                    {transfer.toAccount.name}
                  </span>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {transfer.note ?? '—'}
                </TableCell>
                <TableCell className="text-right font-medium">
                  {formatMoney(transfer.amount)}
                </TableCell>
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
        onClose={() => setDialogOpen(false)}
        title={t('moneyTransfers.new')}
      >
        <form onSubmit={submit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>{t('moneyTransfers.from')} *</Label>
              <Select
                required
                value={form.fromAccountId}
                onChange={(e) => setForm({ ...form, fromAccountId: e.target.value })}
              >
                <option value="">{t('txs.selectAccount')}</option>
                {accounts?.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name} ({formatMoney(a.balance)})
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>{t('moneyTransfers.to')} *</Label>
              <Select
                required
                value={form.toAccountId}
                onChange={(e) => setForm({ ...form, toAccountId: e.target.value })}
              >
                <option value="">{t('txs.selectAccount')}</option>
                {accounts
                  ?.filter((a) => String(a.id) !== form.fromAccountId)
                  .map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>{t('common.total')} *</Label>
            <Input
              required
              type="number"
              min="0.01"
              step="0.01"
              value={form.amount}
              onChange={(e) => setForm({ ...form, amount: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label>{t('common.note')}</Label>
            <Input
              value={form.note}
              onChange={(e) => setForm({ ...form, note: e.target.value })}
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
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
