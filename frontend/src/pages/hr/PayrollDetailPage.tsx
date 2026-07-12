import { useQuery } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { getPayroll } from '@/api/hr';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { formatDate, formatMoney } from '@/lib/format';
import { t } from '@/lib/i18n';

export function PayrollDetailPage() {
  const { id } = useParams();
  const { data: payroll } = useQuery({
    queryKey: ['payroll', 'detail', id],
    queryFn: () => getPayroll(Number(id)),
  });

  if (!payroll) {
    return <div className="text-muted-foreground">{t('common.loading')}</div>;
  }

  return (
    <div className="max-w-5xl">
      <div className="mb-4 flex items-center gap-3">
        <Button variant="ghost" size="icon">
          <Link to="/payroll">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <h1 className="text-2xl font-semibold">
          {t('payroll.title')}: {payroll.month}
        </h1>
        <span className="ml-auto text-sm text-muted-foreground">
          {formatDate(payroll.createdAt)}
        </span>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t('employees.fullName')}</TableHead>
            <TableHead>{t('employees.position')}</TableHead>
            <TableHead className="text-right">{t('payroll.baseSalary')}</TableHead>
            <TableHead className="text-right">{t('payroll.bonus')}</TableHead>
            <TableHead className="text-right">{t('payroll.penalty')}</TableHead>
            <TableHead className="text-right">{t('payroll.advanceDeduction')}</TableHead>
            <TableHead className="text-right">{t('payroll.net')}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {payroll.items?.map((item) => (
            <TableRow key={item.id}>
              <TableCell>
                <Link
                  to={`/employees/${item.employeeId}`}
                  className="font-medium hover:underline"
                >
                  {item.employee?.fullName}
                </Link>
              </TableCell>
              <TableCell className="text-muted-foreground">
                {item.employee?.position?.name ?? '—'}
              </TableCell>
              <TableCell className="text-right">
                {formatMoney(item.baseSalary)}
              </TableCell>
              <TableCell className="text-right">{formatMoney(item.bonus)}</TableCell>
              <TableCell className="text-right">{formatMoney(item.penalty)}</TableCell>
              <TableCell className="text-right">{formatMoney(item.advance)}</TableCell>
              <TableCell className="text-right font-semibold">
                {formatMoney(item.amount)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <p className="mt-4 text-right text-lg font-semibold">
        {t('common.total')}: {formatMoney(payroll.total)}
      </p>
    </div>
  );
}
