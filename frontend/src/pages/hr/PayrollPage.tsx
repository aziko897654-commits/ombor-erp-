import { useQuery } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { getPayrolls } from '@/api/hr';
import { Pagination } from '@/components/Pagination';
import { Button } from '@/components/ui/button';
import { ExportMenu } from '@/components/ui/export-menu';
import { SortToggle, type SortDir } from '@/components/ui/sort-toggle';
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

export function PayrollPage() {
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<SortDir>('desc');
  const { data: list, isLoading } = useQuery({
    queryKey: ['payroll', page, sort],
    queryFn: () => getPayrolls({ page, sort }),
  });

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">{t('payroll.title')}</h1>
        <Button>
          <Link to="/payroll/new" className="flex items-center gap-2">
            <Plus className="h-4 w-4" /> {t('payroll.new')}
          </Link>
        </Button>
      </div>

      <div className="mb-3 flex items-center justify-end gap-2">
        <ExportMenu slug="payroll" />
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
            <TableHead>{t('payroll.month')}</TableHead>
            <TableHead>{t('common.date')}</TableHead>
            <TableHead className="text-right">{t('payroll.employeesCount')}</TableHead>
            <TableHead className="text-right">{t('common.total')}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading ? (
            <TableRow>
              <TableCell colSpan={4} className="py-8 text-center text-muted-foreground">
                {t('common.loading')}
              </TableCell>
            </TableRow>
          ) : (list?.data.length ?? 0) === 0 ? (
            <TableRow>
              <TableCell colSpan={4} className="py-8 text-center text-muted-foreground">
                {t('common.noData')}
              </TableCell>
            </TableRow>
          ) : (
            list?.data.map((payroll) => (
              <TableRow key={payroll.id}>
                <TableCell>
                  <Link
                    to={`/payroll/${payroll.id}`}
                    className="font-medium hover:underline"
                  >
                    {payroll.month}
                  </Link>
                </TableCell>
                <TableCell>{formatDate(payroll.createdAt)}</TableCell>
                <TableCell className="text-right">
                  {payroll._count?.items ?? 0}
                </TableCell>
                <TableCell className="text-right font-medium">
                  {formatMoney(payroll.total)}
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
    </div>
  );
}
