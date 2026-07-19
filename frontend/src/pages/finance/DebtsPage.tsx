import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { getDebtAging, getDebts, type DebtRow } from '@/api/finance';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ExportMenu } from '@/components/ui/export-menu';
import { useAuth } from '@/lib/auth';
import { formatMoney } from '@/lib/format';
import { t } from '@/lib/i18n';

/** FR-3.7: debtors and creditors, desc by debt, linked to cards. */
export function DebtsPage() {
  const { user } = useAuth();
  const { data, isLoading } = useQuery({
    queryKey: ['finance', 'debts'],
    queryFn: getDebts,
  });
  // TASK-031: receivables aging buckets
  const { data: aging } = useQuery({
    queryKey: ['finance', 'debts', 'aging'],
    queryFn: getDebtAging,
  });

  // customer cards are a sales-module page (matrix 2.1): admin only here
  const customerLink = user?.role === 'admin';

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">{t('debts.title')}</h1>
        <ExportMenu slug="debts" />
      </div>
      <div className="grid gap-6 xl:grid-cols-2">
        <DebtTable
          title={t('debts.debtors')}
          rows={data?.debtors}
          isLoading={isLoading}
          linkTo={customerLink ? (id) => `/customers/${id}` : undefined}
        />
        <DebtTable
          title={t('debts.creditors')}
          rows={data?.creditors}
          isLoading={isLoading}
          linkTo={(id) => `/suppliers/${id}`}
        />
      </div>

      {/* TASK-031: aging buckets for open customer documents */}
      <div className="mt-8">
        <h2 className="mb-1 text-lg font-semibold">{t('debts.agingTitle')}</h2>
        <p className="mb-3 text-xs text-muted-foreground">
          {t('debts.agingHint')}
        </p>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('debts.name')}</TableHead>
              <TableHead className="text-right">0–30</TableHead>
              <TableHead className="text-right">31–60</TableHead>
              <TableHead className="text-right">61–90</TableHead>
              <TableHead className="text-right text-destructive">90+</TableHead>
              <TableHead className="text-right">{t('common.total')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(aging?.length ?? 0) === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                  {t('common.noData')}
                </TableCell>
              </TableRow>
            ) : (
              aging?.map((row) => (
                <TableRow key={row.customerId}>
                  <TableCell>
                    {customerLink ? (
                      <Link
                        to={`/customers/${row.customerId}`}
                        className="font-medium hover:underline"
                      >
                        {row.name}
                      </Link>
                    ) : (
                      <span className="font-medium">{row.name}</span>
                    )}
                  </TableCell>
                  <AgingCell value={row.d0_30} />
                  <AgingCell value={row.d31_60} overdue={Number(row.d31_60) > 0} />
                  <AgingCell value={row.d61_90} overdue={Number(row.d61_90) > 0} />
                  <AgingCell value={row.d90plus} overdue={Number(row.d90plus) > 0} />
                  <TableCell className="text-right font-semibold">
                    {formatMoney(row.total)}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function AgingCell({ value, overdue }: { value: string; overdue?: boolean }) {
  const empty = Number(value) === 0;
  return (
    <TableCell
      className={`text-right ${
        empty ? 'text-muted-foreground/50' : overdue ? 'font-medium text-destructive' : ''
      }`}
    >
      {empty ? '—' : formatMoney(value)}
    </TableCell>
  );
}

function DebtTable({
  title,
  rows,
  isLoading,
  linkTo,
}: {
  title: string;
  rows?: DebtRow[];
  isLoading: boolean;
  linkTo?: (id: number) => string;
}) {
  return (
    <div>
      <h2 className="mb-3 text-lg font-semibold">{title}</h2>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t('common.name')}</TableHead>
            <TableHead>{t('common.phone')}</TableHead>
            <TableHead className="text-right">{t('debts.debt')}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading ? (
            <TableRow>
              <TableCell colSpan={3} className="py-8 text-center text-muted-foreground">
                {t('common.loading')}
              </TableCell>
            </TableRow>
          ) : (rows?.length ?? 0) === 0 ? (
            <TableRow>
              <TableCell colSpan={3} className="py-8 text-center text-muted-foreground">
                {t('common.noData')}
              </TableCell>
            </TableRow>
          ) : (
            rows?.map((row) => (
              <TableRow key={row.id}>
                <TableCell>
                  {linkTo ? (
                    <Link to={linkTo(row.id)} className="font-medium hover:underline">
                      {row.name}
                    </Link>
                  ) : (
                    <span className="font-medium">{row.name}</span>
                  )}
                </TableCell>
                <TableCell>{row.phone ?? '—'}</TableCell>
                <TableCell className="text-right font-semibold text-destructive">
                  {formatMoney(row.debt)}
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
