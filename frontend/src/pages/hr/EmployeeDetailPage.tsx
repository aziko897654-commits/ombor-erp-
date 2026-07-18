import { useQuery } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { getEmployee } from '@/api/hr';
import { StatusBadge } from '@/components/ui/status-badge';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { buttonVariants } from '@/components/ui/button';
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
import { cn } from '@/lib/utils';

const ATTENDANCE_KEYS = ['present', 'absent', 'vacation', 'sick'] as const;

/** FR-4.1: employee card — info, attendance summary, pay history. */
export function EmployeeDetailPage() {
  const { id } = useParams();
  const { data: employee } = useQuery({
    queryKey: ['employee', id],
    queryFn: () => getEmployee(Number(id)),
  });

  if (!employee) {
    return <div className="text-muted-foreground">{t('common.loading')}</div>;
  }

  return (
    <div>
      <div className="mb-4 flex items-center gap-3">
        <Link
          to="/employees"
          aria-label={t('common.back')}
          className={cn(buttonVariants({ variant: 'ghost', size: 'icon' }))}
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <h1 className="text-2xl font-semibold">{employee.fullName}</h1>
        <StatusBadge
          status={employee.status}
          label={t(`employees.status.${employee.status}`)}
        />
      </div>

      <div className="mb-6 grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t('employees.title')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1.5 text-sm">
            <Row label={t('employees.department')} value={employee.department?.name ?? '—'} />
            <Row label={t('employees.position')} value={employee.position?.name ?? '—'} />
            <Row label={t('common.phone')} value={employee.phone ?? '—'} />
            <Row label="Email" value={employee.email ?? '—'} />
            <Row label={t('employees.salary')} value={formatMoney(employee.salary)} />
            <Row label={t('employees.hiredAt')} value={formatDate(employee.hiredAt)} />
            {employee.firedAt && (
              <Row label={t('employees.firedAt')} value={formatDate(employee.firedAt)} />
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {t('employees.attendanceSummary')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1.5 text-sm">
            {ATTENDANCE_KEYS.map((key) => (
              <Row
                key={key}
                label={t(`attendance.statuses.${key}`)}
                value={String(employee.attendanceSummary.counts[key] ?? 0)}
              />
            ))}
          </CardContent>
        </Card>
      </div>

      <h2 className="mb-3 text-lg font-semibold">{t('employees.payrollHistory')}</h2>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t('payroll.month')}</TableHead>
            <TableHead className="text-right">{t('payroll.baseSalary')}</TableHead>
            <TableHead className="text-right">{t('payroll.bonus')}</TableHead>
            <TableHead className="text-right">{t('payroll.penalty')}</TableHead>
            <TableHead className="text-right">{t('payroll.advanceDeduction')}</TableHead>
            <TableHead className="text-right">{t('payroll.net')}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {employee.payrollItems.length === 0 ? (
            <TableRow>
              <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                {t('common.noData')}
              </TableCell>
            </TableRow>
          ) : (
            employee.payrollItems.map((item) => (
              <TableRow key={item.id}>
                <TableCell>
                  <Link
                    to={`/payroll/${item.payroll?.id}`}
                    className="font-medium hover:underline"
                  >
                    {item.payroll?.month}
                  </Link>
                </TableCell>
                <TableCell className="text-right">
                  {formatMoney(item.baseSalary)}
                </TableCell>
                <TableCell className="text-right">{formatMoney(item.bonus)}</TableCell>
                <TableCell className="text-right">{formatMoney(item.penalty)}</TableCell>
                <TableCell className="text-right">{formatMoney(item.advance)}</TableCell>
                <TableCell className="text-right font-medium">
                  {formatMoney(item.amount)}
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>

      <h2 className="mb-3 mt-6 text-lg font-semibold">
        {t('employees.advancesHistory')}
      </h2>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t('common.date')}</TableHead>
            <TableHead>{t('common.note')}</TableHead>
            <TableHead className="text-right">{t('common.total')}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {employee.advances.length === 0 ? (
            <TableRow>
              <TableCell colSpan={3} className="py-8 text-center text-muted-foreground">
                {t('common.noData')}
              </TableCell>
            </TableRow>
          ) : (
            employee.advances.map((advance) => (
              <TableRow key={advance.id}>
                <TableCell>{formatDate(advance.date)}</TableCell>
                <TableCell className="text-muted-foreground">
                  {advance.note ?? '—'}
                </TableCell>
                <TableCell className="text-right">{formatMoney(advance.amount)}</TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}
