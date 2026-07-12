import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Tags, Trash2 } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import {
  createTransaction,
  createTxCategory,
  deleteTransaction,
  getAccounts,
  getTxCategories,
  type TxSource,
  type TxType,
} from '@/api/finance';
import { Pagination } from '@/components/Pagination';
import { Badge } from '@/components/ui/badge';
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
import { getTransactions } from '@/api/finance';
import { apiErrorMessage, formatDate, formatMoney } from '@/lib/format';
import { t } from '@/lib/i18n';

const emptyForm = { type: 'expense', accountId: '', categoryId: '', amount: '', note: '' };
const emptyCategoryForm = { name: '', type: 'expense' };

/** FR-3.2/3.3: journal + manual transactions + category management. */
export function TransactionsPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [typeFilter, setTypeFilter] = useState('');
  const [sourceFilter, setSourceFilter] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [categoriesOpen, setCategoriesOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [categoryForm, setCategoryForm] = useState(emptyCategoryForm);
  const [error, setError] = useState('');
  const [listError, setListError] = useState('');

  const { data: list, isLoading } = useQuery({
    queryKey: ['transactions', page, typeFilter, sourceFilter],
    queryFn: () =>
      getTransactions({
        page,
        type: (typeFilter || undefined) as TxType | undefined,
        source: (sourceFilter || undefined) as TxSource | undefined,
      }),
  });
  const { data: accounts } = useQuery({
    queryKey: ['accounts'],
    queryFn: getAccounts,
  });
  const { data: categories } = useQuery({
    queryKey: ['tx-categories'],
    queryFn: () => getTxCategories(),
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['transactions'] });
    queryClient.invalidateQueries({ queryKey: ['finance'] });
  };

  const createMutation = useMutation({
    mutationFn: createTransaction,
    onSuccess: () => {
      invalidate();
      setDialogOpen(false);
    },
    onError: (err) => setError(apiErrorMessage(err)),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteTransaction,
    onSuccess: () => {
      invalidate();
      setListError('');
    },
    onError: (err) => setListError(apiErrorMessage(err)),
  });

  const categoryMutation = useMutation({
    mutationFn: () =>
      createTxCategory({
        name: categoryForm.name,
        type: categoryForm.type as TxType,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tx-categories'] });
      setCategoryForm(emptyCategoryForm);
      setError('');
    },
    onError: (err) => setError(apiErrorMessage(err)),
  });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setError('');
    createMutation.mutate({
      type: form.type,
      accountId: Number(form.accountId),
      categoryId: Number(form.categoryId),
      amount: Number(form.amount),
      note: form.note || undefined,
    });
  };

  const formCategories = categories?.filter((c) => c.type === form.type) ?? [];

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">{t('txs.title')}</h1>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => { setError(''); setCategoriesOpen(true); }}>
            <Tags className="h-4 w-4" /> {t('txs.categories')}
          </Button>
          <Button
            onClick={() => {
              setForm(emptyForm);
              setError('');
              setDialogOpen(true);
            }}
          >
            <Plus className="h-4 w-4" /> {t('txs.new')}
          </Button>
        </div>
      </div>

      <div className="mb-3 flex gap-2">
        <Select
          className="w-44"
          value={typeFilter}
          onChange={(e) => {
            setTypeFilter(e.target.value);
            setPage(1);
          }}
        >
          <option value="">{t('common.all')}</option>
          <option value="income">{t('txs.income')}</option>
          <option value="expense">{t('txs.expense')}</option>
        </Select>
        <Select
          className="w-44"
          value={sourceFilter}
          onChange={(e) => {
            setSourceFilter(e.target.value);
            setPage(1);
          }}
        >
          <option value="">{t('common.all')}</option>
          {(['manual', 'payment', 'salary', 'advance', 'transfer'] as const).map(
            (s) => (
              <option key={s} value={s}>
                {t(`txs.source.${s}`)}
              </option>
            ),
          )}
        </Select>
      </div>
      {listError && <p className="mb-2 text-sm text-destructive">{listError}</p>}

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t('common.date')}</TableHead>
            <TableHead>{t('txs.account')}</TableHead>
            <TableHead>{t('txs.category')}</TableHead>
            <TableHead>{t('txs.sourceLabel')}</TableHead>
            <TableHead>{t('common.note')}</TableHead>
            <TableHead className="text-right">{t('common.total')}</TableHead>
            <TableHead className="w-14">{t('common.actions')}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading ? (
            <TableRow>
              <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
                {t('common.loading')}
              </TableCell>
            </TableRow>
          ) : (list?.data.length ?? 0) === 0 ? (
            <TableRow>
              <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
                {t('common.noData')}
              </TableCell>
            </TableRow>
          ) : (
            list?.data.map((tx) => (
              <TableRow key={tx.id}>
                <TableCell>{formatDate(tx.date)}</TableCell>
                <TableCell>{tx.account.name}</TableCell>
                <TableCell>{tx.category.name}</TableCell>
                <TableCell>
                  <Badge variant={tx.source === 'manual' ? 'secondary' : 'outline'}>
                    {t(`txs.source.${tx.source}`)}
                  </Badge>
                </TableCell>
                <TableCell className="text-muted-foreground">{tx.note ?? '—'}</TableCell>
                <TableCell
                  className={`text-right font-medium ${
                    tx.type === 'income' ? 'text-green-700' : 'text-destructive'
                  }`}
                >
                  {tx.type === 'income' ? '+' : '−'}
                  {formatMoney(tx.amount)}
                </TableCell>
                <TableCell>
                  {tx.source === 'manual' && (
                    <Button
                      variant="ghost"
                      size="icon"
                      disabled={deleteMutation.isPending}
                      onClick={() => {
                        if (window.confirm(t('txs.deleteConfirm'))) {
                          deleteMutation.mutate(tx.id);
                        }
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
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
        title={t('txs.new')}
      >
        <form onSubmit={submit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>{t('common.status')} *</Label>
              <Select
                value={form.type}
                onChange={(e) =>
                  setForm({ ...form, type: e.target.value, categoryId: '' })
                }
              >
                <option value="expense">{t('txs.expense')}</option>
                <option value="income">{t('txs.income')}</option>
              </Select>
            </div>
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
                    {a.name}
                  </option>
                ))}
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>{t('txs.category')} *</Label>
              <Select
                required
                value={form.categoryId}
                onChange={(e) => setForm({ ...form, categoryId: e.target.value })}
              >
                <option value="">{t('txs.selectCategory')}</option>
                {formCategories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
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

      <Dialog
        open={categoriesOpen}
        onClose={() => setCategoriesOpen(false)}
        title={t('txs.categories')}
      >
        <div className="space-y-3">
          <form
            className="flex items-end gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              categoryMutation.mutate();
            }}
          >
            <div className="flex-1 space-y-1.5">
              <Label>{t('txs.newCategory')}</Label>
              <Input
                required
                value={categoryForm.name}
                onChange={(e) =>
                  setCategoryForm({ ...categoryForm, name: e.target.value })
                }
              />
            </div>
            <Select
              className="w-32"
              value={categoryForm.type}
              onChange={(e) =>
                setCategoryForm({ ...categoryForm, type: e.target.value })
              }
            >
              <option value="expense">{t('txs.expense')}</option>
              <option value="income">{t('txs.income')}</option>
            </Select>
            <Button type="submit" disabled={categoryMutation.isPending}>
              <Plus className="h-4 w-4" />
            </Button>
          </form>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="max-h-72 space-y-1 overflow-y-auto">
            {categories?.map((c) => (
              <div
                key={c.id}
                className="flex items-center justify-between rounded-md border px-3 py-1.5 text-sm"
              >
                <span>{c.name}</span>
                <Badge variant={c.type === 'income' ? 'success' : 'secondary'}>
                  {t(`txs.${c.type}`)}
                </Badge>
              </div>
            ))}
          </div>
        </div>
      </Dialog>
    </div>
  );
}
