import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2 } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import {
  createPayment,
  deletePayment,
  getAccounts,
  getPayments,
} from '@/api/finance';
import { getCustomers, getOrders } from '@/api/sales';
import { getPurchases, getSuppliers } from '@/api/warehouse';
import { Pagination } from '@/components/Pagination';
import { StatusBadge } from '@/components/ui/status-badge';
import { Button } from '@/components/ui/button';
import { Combobox } from '@/components/ui/combobox';
import { Dialog } from '@/components/ui/dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { ExportMenu } from '@/components/ui/export-menu';
import { TableSkeleton } from '@/components/ui/skeleton';
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
import { confirmDialog } from '@/lib/confirm';
import { apiErrorMessage, formatDate, formatMoney } from '@/lib/format';
import { t } from '@/lib/i18n';
import { submitWithBalanceConfirm } from '@/lib/negative-balance';

const emptyForm = {
  direction: 'in',
  counterparty: 'customer',
  customerId: '',
  supplierId: '',
  orderId: '',
  purchaseId: '',
  accountId: '',
  amount: '',
  note: '',
};

/** FR-3.6: payments (in/out, partial, linked) + delete with recompute. */
export function PaymentsPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [directionFilter, setDirectionFilter] = useState('');
  const [sort, setSort] = useState<SortDir>('desc');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState('');
  const [listError, setListError] = useState('');

  const { data: list, isLoading } = useQuery({
    queryKey: ['payments', page, limit, directionFilter, sort],
    queryFn: () =>
      getPayments({
        page,
        limit,
        direction: (directionFilter || undefined) as 'in' | 'out' | undefined,
        sort,
      }),
  });
  const { data: accounts } = useQuery({
    queryKey: ['accounts'],
    queryFn: getAccounts,
    enabled: dialogOpen,
  });
  const { data: customers } = useQuery({
    queryKey: ['customers', 'all'],
    queryFn: () => getCustomers({ page: 1, limit: 100 }),
    enabled: dialogOpen && form.counterparty === 'customer',
  });
  const { data: suppliers } = useQuery({
    queryKey: ['suppliers', 'all'],
    queryFn: () => getSuppliers({ page: 1, limit: 100 }),
    enabled: dialogOpen && form.counterparty === 'supplier',
  });
  // linked docs: confirmed/shipped orders of the picked customer
  const { data: customerOrders } = useQuery({
    queryKey: ['orders', 'payable', form.customerId],
    queryFn: async () => {
      const customerId = Number(form.customerId);
      const [confirmed, shipped] = await Promise.all([
        getOrders({ page: 1, limit: 100, status: 'confirmed', customerId }),
        getOrders({ page: 1, limit: 100, status: 'shipped', customerId }),
      ]);
      return [...confirmed.data, ...shipped.data];
    },
    enabled: dialogOpen && form.counterparty === 'customer' && !!form.customerId,
  });
  const { data: supplierPurchases } = useQuery({
    queryKey: ['purchases', 'payable', form.supplierId],
    queryFn: () =>
      getPurchases({ page: 1, limit: 100, supplierId: Number(form.supplierId) }),
    enabled: dialogOpen && form.counterparty === 'supplier' && !!form.supplierId,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['payments'] });
    queryClient.invalidateQueries({ queryKey: ['finance'] });
    queryClient.invalidateQueries({ queryKey: ['transactions'] });
    queryClient.invalidateQueries({ queryKey: ['invoices'] });
  };

  const createMutation = useMutation({
    mutationFn: createPayment,
    onSuccess: () => {
      invalidate();
      setDialogOpen(false);
    },
    onError: (err) => setError(apiErrorMessage(err)),
  });

  const deleteMutation = useMutation({
    mutationFn: deletePayment,
    meta: { successMessage: t('common.deleted') },
    onSuccess: () => {
      invalidate();
      setListError('');
    },
    onError: (err) => setListError(apiErrorMessage(err)),
  });

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    const isCustomer = form.counterparty === 'customer';
    try {
      await submitWithBalanceConfirm((force) =>
        createMutation.mutateAsync({
          direction: form.direction,
          accountId: Number(form.accountId),
          amount: Number(form.amount),
          customerId: isCustomer ? Number(form.customerId) : undefined,
          supplierId: !isCustomer ? Number(form.supplierId) : undefined,
          orderId: isCustomer && form.orderId ? Number(form.orderId) : undefined,
          purchaseId:
            !isCustomer && form.purchaseId ? Number(form.purchaseId) : undefined,
          note: form.note || undefined,
          force,
        }),
      );
    } catch {
      // surfaced via createMutation.onError
    }
  };

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">{t('payments.title')}</h1>
        <Button
          onClick={() => {
            setForm(emptyForm);
            setError('');
            setDialogOpen(true);
          }}
        >
          <Plus className="h-4 w-4" /> {t('payments.new')}
        </Button>
      </div>

      <div className="mb-3 flex items-center gap-2">
        <Select
          className="w-44"
          value={directionFilter}
          onChange={(e) => {
            setDirectionFilter(e.target.value);
            setPage(1);
          }}
        >
          <option value="">{t('common.all')}</option>
          <option value="in">{t('payments.in')}</option>
          <option value="out">{t('payments.out')}</option>
        </Select>
        <SortToggle
          value={sort}
          onChange={(v) => {
            setSort(v);
            setPage(1);
          }}
        />
        <div className="ml-auto">
          <ExportMenu slug="payments" />
        </div>
      </div>
      {listError && <p className="mb-2 text-sm text-destructive">{listError}</p>}

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t('common.date')}</TableHead>
            <TableHead>{t('payments.direction')}</TableHead>
            <TableHead>{t('payments.counterparty')}</TableHead>
            <TableHead>{t('payments.linkedDoc')}</TableHead>
            <TableHead>{t('txs.account')}</TableHead>
            <TableHead className="text-right">{t('common.total')}</TableHead>
            <TableHead className="w-14">{t('common.actions')}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading ? (
            <TableSkeleton rows={6} cols={7} />
          ) : (list?.data.length ?? 0) === 0 ? (
            <TableRow>
              <TableCell colSpan={7} className="p-0">
                <EmptyState
                  filtered={!!directionFilter}
                  onAction={
                    directionFilter
                      ? () => {
                          setDirectionFilter('');
                          setPage(1);
                        }
                      : undefined
                  }
                />
              </TableCell>
            </TableRow>
          ) : (
            list?.data.map((p) => (
              <TableRow key={p.id}>
                <TableCell>{formatDate(p.date)}</TableCell>
                <TableCell>
                  <StatusBadge
                    status={p.direction}
                    label={t(`payments.${p.direction}`)}
                  />
                </TableCell>
                <TableCell>{p.customer?.name ?? p.supplier?.name ?? '—'}</TableCell>
                <TableCell className="text-muted-foreground">
                  {p.order?.number ?? p.purchase?.number ?? t('payments.noDoc')}
                </TableCell>
                <TableCell>{p.account?.name}</TableCell>
                <TableCell
                  className={`text-right font-medium ${
                    p.direction === 'in' ? 'text-green-700' : 'text-destructive'
                  }`}
                >
                  {p.direction === 'in' ? '+' : '−'}
                  {formatMoney(p.amount)}
                </TableCell>
                <TableCell>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={t('common.delete')}
                    disabled={deleteMutation.isPending}
                    onClick={async () => {
                      if (
                        await confirmDialog(t('payments.deleteConfirm'), {
                          tone: 'danger',
                          confirmLabel: t('common.delete'),
                        })
                      ) {
                        deleteMutation.mutate(p.id);
                      }
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
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
          onLimitChange={(l) => {
            setLimit(l);
            setPage(1);
          }}
        />
      )}

      <Dialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        title={t('payments.new')}
      >
        <form onSubmit={submit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>{t('payments.direction')} *</Label>
              <Select
                value={form.direction}
                onChange={(e) => setForm({ ...form, direction: e.target.value })}
              >
                <option value="in">{t('payments.in')}</option>
                <option value="out">{t('payments.out')}</option>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>{t('payments.counterparty')} *</Label>
              <Select
                value={form.counterparty}
                onChange={(e) =>
                  setForm({
                    ...form,
                    counterparty: e.target.value,
                    customerId: '',
                    supplierId: '',
                    orderId: '',
                    purchaseId: '',
                  })
                }
              >
                <option value="customer">{t('payments.customer')}</option>
                <option value="supplier">{t('payments.supplier')}</option>
              </Select>
            </div>
          </div>

          {form.counterparty === 'customer' ? (
            <>
              <div className="space-y-1.5">
                <Label>{t('payments.customer')} *</Label>
                <Combobox
                  required
                  value={form.customerId}
                  onChange={(customerId) =>
                    setForm({ ...form, customerId, orderId: '' })
                  }
                  placeholder={t('payments.selectCustomer')}
                  options={
                    customers?.data.map((c) => ({
                      value: String(c.id),
                      label: c.name,
                      hint: c.phone ?? undefined,
                    })) ?? []
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label>{t('payments.linkedDoc')}</Label>
                <Select
                  value={form.orderId}
                  onChange={(e) => setForm({ ...form, orderId: e.target.value })}
                >
                  <option value="">{t('payments.noDoc')}</option>
                  {customerOrders?.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.number} ({formatMoney(o.total)})
                    </option>
                  ))}
                </Select>
              </div>
            </>
          ) : (
            <>
              <div className="space-y-1.5">
                <Label>{t('payments.supplier')} *</Label>
                <Combobox
                  required
                  value={form.supplierId}
                  onChange={(supplierId) =>
                    setForm({ ...form, supplierId, purchaseId: '' })
                  }
                  placeholder={t('payments.selectSupplier')}
                  options={
                    suppliers?.data.map((s) => ({
                      value: String(s.id),
                      label: s.name,
                      hint: s.phone ?? undefined,
                    })) ?? []
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label>{t('payments.linkedDoc')}</Label>
                <Select
                  value={form.purchaseId}
                  onChange={(e) =>
                    setForm({ ...form, purchaseId: e.target.value })
                  }
                >
                  <option value="">{t('payments.noDoc')}</option>
                  {supplierPurchases?.data.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.number} ({formatMoney(p.total)})
                    </option>
                  ))}
                </Select>
              </div>
            </>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>{t('txs.account')} *</Label>
              <Select
                required
                value={form.accountId}
                onChange={(e) => setForm({ ...form, accountId: e.target.value })}
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
            <Button type="submit" disabled={createMutation.isPending}>
              {createMutation.isPending ? t('common.saving') : t('common.save')}
            </Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}
