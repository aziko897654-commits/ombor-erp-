import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { getDebts, type DebtRow } from '@/api/finance';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
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

  // customer cards are a sales-module page (matrix 2.1): admin only here
  const customerLink = user?.role === 'admin';

  return (
    <div>
      <h1 className="mb-4 text-2xl font-semibold">{t('debts.title')}</h1>
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
    </div>
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
