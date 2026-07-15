import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { getAccounts } from '@/api/finance';
import { createPayroll, getPayrollPreview } from '@/api/hr';
import { Button, buttonVariants } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
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
import { confirmDialog } from '@/lib/confirm';
import { apiErrorMessage, formatMoney } from '@/lib/format';
import { t } from '@/lib/i18n';
import { cn } from '@/lib/utils';

function currentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

interface RowInput {
  bonus: string;
  penalty: string;
}

/** FR-4.5: base + bonus − penalty − advances = net; HR confirms. */
export function PayrollCreatePage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [month, setMonth] = useState(currentMonth());
  const [accountId, setAccountId] = useState('');
  const [inputs, setInputs] = useState<Record<number, RowInput>>({});
  const [error, setError] = useState('');

  const {
    data: preview,
    error: previewError,
    isLoading,
  } = useQuery({
    queryKey: ['payroll', 'preview', month],
    queryFn: () => getPayrollPreview(month),
    retry: false,
  });
  const { data: accounts } = useQuery({
    queryKey: ['accounts'],
    queryFn: getAccounts,
  });

  const mutation = useMutation({
    mutationFn: createPayroll,
    onSuccess: (payroll) => {
      queryClient.invalidateQueries({ queryKey: ['payroll'] });
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['finance'] });
      navigate(`/payroll/${payroll.id}`);
    },
    onError: (err) => setError(apiErrorMessage(err)),
  });

  const setInput = (employeeId: number, patch: Partial<RowInput>) => {
    setInputs((prev) => {
      const current = prev[employeeId] ?? { bonus: '', penalty: '' };
      return { ...prev, [employeeId]: { ...current, ...patch } };
    });
  };

  const netOf = (row: { baseSalary: string; advance: string; employeeId: number }) => {
    const input = inputs[row.employeeId];
    return (
      Number(row.baseSalary) +
      (Number(input?.bonus) || 0) -
      (Number(input?.penalty) || 0) -
      Number(row.advance)
    );
  };

  const total = preview?.rows.reduce((acc, row) => acc + netOf(row), 0) ?? 0;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    if (!(await confirmDialog(t('payroll.createConfirm')))) return;
    mutation.mutate({
      month,
      accountId: Number(accountId),
      items: preview?.rows.map((row) => ({
        employeeId: row.employeeId,
        bonus: Number(inputs[row.employeeId]?.bonus) || 0,
        penalty: Number(inputs[row.employeeId]?.penalty) || 0,
      })),
    });
  };

  return (
    <div className="max-w-5xl">
      <div className="mb-4 flex items-center gap-3">
        <Link
          to="/payroll"
          aria-label={t('common.back')}
          className={cn(buttonVariants({ variant: 'ghost', size: 'icon' }))}
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <h1 className="text-2xl font-semibold">{t('payroll.new')}</h1>
      </div>

      <form onSubmit={submit}>
        <Card>
          <CardContent className="space-y-4 pt-6">
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-1.5">
                <Label>{t('payroll.month')} *</Label>
                <Input
                  required
                  type="month"
                  value={month}
                  onChange={(e) => e.target.value && setMonth(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>{t('txs.account')} *</Label>
                <Select
                  required
                  value={accountId}
                  onChange={(e) => setAccountId(e.target.value)}
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

            {previewError ? (
              <p className="py-6 text-center text-sm text-destructive">
                {apiErrorMessage(previewError)}
              </p>
            ) : isLoading ? (
              <p className="py-6 text-center text-muted-foreground">
                {t('common.loading')}
              </p>
            ) : (preview?.rows.length ?? 0) === 0 ? (
              <p className="py-6 text-center text-muted-foreground">
                {t('common.noData')}
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('employees.fullName')}</TableHead>
                    <TableHead className="text-right">
                      {t('payroll.baseSalary')}
                    </TableHead>
                    <TableHead className="w-32">{t('payroll.bonus')}</TableHead>
                    <TableHead className="w-32">{t('payroll.penalty')}</TableHead>
                    <TableHead className="text-right">
                      {t('payroll.advanceDeduction')}
                    </TableHead>
                    <TableHead className="text-right">{t('payroll.net')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {preview?.rows.map((row) => (
                    <TableRow key={row.employeeId}>
                      <TableCell className="font-medium">{row.fullName}</TableCell>
                      <TableCell className="text-right">
                        {formatMoney(row.baseSalary)}
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          className="h-8"
                          value={inputs[row.employeeId]?.bonus ?? ''}
                          onChange={(e) =>
                            setInput(row.employeeId, { bonus: e.target.value })
                          }
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          className="h-8"
                          value={inputs[row.employeeId]?.penalty ?? ''}
                          onChange={(e) =>
                            setInput(row.employeeId, { penalty: e.target.value })
                          }
                        />
                      </TableCell>
                      <TableCell className="text-right text-destructive">
                        {Number(row.advance) > 0
                          ? `−${formatMoney(row.advance)}`
                          : '—'}
                      </TableCell>
                      <TableCell className="text-right font-semibold">
                        {formatMoney(netOf(row))}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}

            <div className="flex items-center justify-between border-t pt-4">
              <span className="text-lg font-semibold">
                {t('common.total')}: {formatMoney(total)}
              </span>
              <div className="flex gap-2">
                <Button type="button" variant="outline" onClick={() => navigate('/payroll')}>
                  {t('common.cancel')}
                </Button>
                <Button
                  type="submit"
                  disabled={
                    mutation.isPending ||
                    !!previewError ||
                    (preview?.rows.length ?? 0) === 0
                  }
                >
                  {mutation.isPending ? t('common.saving') : t('common.save')}
                </Button>
              </div>
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
          </CardContent>
        </Card>
      </form>
    </div>
  );
}
