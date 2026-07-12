import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { getAccounts } from '@/api/finance';
import { createAdvance, getAdvances, getEmployees } from '@/api/hr';
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
import { apiErrorMessage, formatDate, formatMoney } from '@/lib/format';
import { t } from '@/lib/i18n';

const emptyForm = { employeeId: '', accountId: '', amount: '', date: '', note: '' };

/** FR-4.4: advances — auto expense tx + auto deduction in payroll. */
export function AdvancesPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState('');

  const { data: list, isLoading } = useQuery({
    queryKey: ['advances', page],
    queryFn: () => getAdvances({ page }),
  });
  const { data: employees } = useQuery({
    queryKey: ['employees', 'active-all'],
    queryFn: () => getEmployees({ page: 1, limit: 100, status: 'active' }),
    enabled: dialogOpen,
  });
  const { data: accounts } = useQuery({
    queryKey: ['accounts'],
    queryFn: getAccounts,
    enabled: dialogOpen,
  });

  const mutation = useMutation({
    mutationFn: createAdvance,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['advances'] });
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['finance'] });
      setDialogOpen(false);
    },
    onError: (err) => setError(apiErrorMessage(err)),
  });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setError('');
    mutation.mutate({
      employeeId: Number(form.employeeId),
      accountId: Number(form.accountId),
      amount: Number(form.amount),
      date: form.date || undefined,
      note: form.note || undefined,
    });
  };

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">{t('advances.title')}</h1>
        <Button
          onClick={() => {
            setForm(emptyForm);
            setError('');
            setDialogOpen(true);
          }}
        >
          <Plus className="h-4 w-4" /> {t('advances.new')}
        </Button>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t('common.date')}</TableHead>
            <TableHead>{t('advances.employee')}</TableHead>
            <TableHead>{t('txs.account')}</TableHead>
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
            list?.data.map((advance) => (
              <TableRow key={advance.id}>
                <TableCell>{formatDate(advance.date)}</TableCell>
                <TableCell className="font-medium">
                  {advance.employee?.fullName}
                </TableCell>
                <TableCell>{advance.accountName ?? '—'}</TableCell>
                <TableCell className="text-muted-foreground">
                  {advance.note ?? '—'}
                </TableCell>
                <TableCell className="text-right font-medium">
                  {formatMoney(advance.amount)}
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
        title={t('advances.new')}
      >
        <form onSubmit={submit} className="space-y-3">
          <div className="space-y-1.5">
            <Label>{t('advances.employee')} *</Label>
            <Select
              required
              value={form.employeeId}
              onChange={(e) => setForm({ ...form, employeeId: e.target.value })}
            >
              <option value="">{t('advances.selectEmployee')}</option>
              {employees?.data.map((employee) => (
                <option key={employee.id} value={employee.id}>
                  {employee.fullName}
                </option>
              ))}
            </Select>
          </div>
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
                    {a.name}
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
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>{t('common.date')}</Label>
              <Input
                type="date"
                value={form.date}
                onChange={(e) => setForm({ ...form, date: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>{t('common.note')}</Label>
              <Input
                value={form.note}
                onChange={(e) => setForm({ ...form, note: e.target.value })}
              />
            </div>
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
