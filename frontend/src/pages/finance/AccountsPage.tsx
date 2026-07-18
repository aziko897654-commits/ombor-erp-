import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Landmark, Plus, Wallet } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { getBalanceSummary } from '@/api/finance';
import { createAccount } from '@/api/finance';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Dialog } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { apiErrorMessage, formatMoney } from '@/lib/format';
import { t } from '@/lib/i18n';

const emptyForm = { name: '', type: 'cash', openingBalance: '' };

/** FR-3.1/3.4: accounts with computed balances + period cash flow. */
export function AccountsPage() {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState('');

  const { data: summary, isLoading } = useQuery({
    queryKey: ['finance', 'balance'],
    queryFn: () => getBalanceSummary(),
  });

  const mutation = useMutation({
    mutationFn: createAccount,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['finance'] });
      setDialogOpen(false);
    },
    onError: (err) => setError(apiErrorMessage(err)),
  });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setError('');
    mutation.mutate({
      name: form.name,
      type: form.type,
      openingBalance: Number(form.openingBalance) || 0,
    });
  };

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">{t('accounts.title')}</h1>
        <Button
          onClick={() => {
            setForm(emptyForm);
            setError('');
            setDialogOpen(true);
          }}
        >
          <Plus className="h-4 w-4" /> {t('accounts.new')}
        </Button>
      </div>

      {isLoading ? (
        <p className="text-muted-foreground">{t('common.loading')}</p>
      ) : (
        <>
          <div className="mb-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <SummaryCard
              label={t('accounts.total')}
              value={summary?.total}
              emphasize
            />
            <SummaryCard
              label={t('accounts.flowIncome')}
              value={summary?.flow.income}
              tone="text-green-700"
            />
            <SummaryCard
              label={t('accounts.flowExpense')}
              value={summary?.flow.expense}
              tone="text-destructive"
            />
            <SummaryCard
              label={t('accounts.flowNet')}
              value={summary?.flow.net}
              tone={
                Number(summary?.flow.net ?? 0) < 0
                  ? 'text-destructive'
                  : 'text-green-700'
              }
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {summary?.accounts.map((account) => {
              const negative = Number(account.balance) < 0;
              return (
                <Card
                  key={account.id}
                  className={negative ? 'border-destructive' : undefined}
                >
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center gap-2 text-base">
                      {account.type === 'cash' ? (
                        <Wallet className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <Landmark className="h-4 w-4 text-muted-foreground" />
                      )}
                      {account.name}
                      <span className="ml-auto text-xs font-normal text-muted-foreground">
                        {t(`accounts.${account.type}`)}
                      </span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p
                      className={`text-xl font-semibold ${
                        negative ? 'text-destructive' : ''
                      }`}
                    >
                      {formatMoney(account.balance)}
                    </p>
                    {negative && (
                      <p className="mt-1 flex items-center gap-1 text-xs font-medium text-destructive">
                        <AlertTriangle className="h-3.5 w-3.5" />
                        {t('accounts.negativeBalance')}
                      </p>
                    )}
                    <p className="mt-1 text-xs text-muted-foreground">
                      {t('accounts.openingBalance')}:{' '}
                      {formatMoney(account.openingBalance)}
                    </p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </>
      )}

      <Dialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        title={t('accounts.new')}
      >
        <form onSubmit={submit} className="space-y-3">
          <div className="space-y-1.5">
            <Label>{t('common.name')} *</Label>
            <Input
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>{t('accounts.type')} *</Label>
              <Select
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value })}
              >
                <option value="cash">{t('accounts.cash')}</option>
                <option value="bank">{t('accounts.bank')}</option>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>{t('accounts.openingBalance')}</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={form.openingBalance}
                onChange={(e) =>
                  setForm({ ...form, openingBalance: e.target.value })
                }
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

function SummaryCard({
  label,
  value,
  tone,
  emphasize,
}: {
  label: string;
  value?: string;
  tone?: string;
  emphasize?: boolean;
}) {
  return (
    <Card>
      <CardContent className="pt-6">
        <p className="text-sm text-muted-foreground">{label}</p>
        <p
          className={`mt-1 font-semibold ${emphasize ? 'text-xl' : 'text-lg'} ${tone ?? ''}`}
        >
          {formatMoney(value)}
        </p>
      </CardContent>
    </Card>
  );
}
