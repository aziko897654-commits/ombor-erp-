import { useQuery } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { getPurchases } from '@/api/warehouse';
import { Pagination } from '@/components/Pagination';
import { Button } from '@/components/ui/button';
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

export function PurchasesPage() {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<SortDir>('desc');
  const { data: list, isLoading } = useQuery({
    queryKey: ['purchases', page, sort],
    queryFn: () => getPurchases({ page, sort }),
  });

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">{t('purchases.title')}</h1>
        <Button onClick={() => navigate('/purchases/new')}>
          <Plus className="h-4 w-4" /> {t('purchases.new')}
        </Button>
      </div>

      <div className="mb-3 flex items-center gap-2">
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
            <TableHead>{t('common.number')}</TableHead>
            <TableHead>{t('common.date')}</TableHead>
            <TableHead>{t('purchases.supplier')}</TableHead>
            <TableHead>{t('purchases.warehouse')}</TableHead>
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
            list?.data.map((p) => (
              <TableRow key={p.id}>
                <TableCell>
                  <Link to={`/purchases/${p.id}`} className="font-medium hover:underline">
                    {p.number}
                  </Link>
                </TableCell>
                <TableCell>{formatDate(p.date)}</TableCell>
                <TableCell>
                  <Link to={`/suppliers/${p.supplierId}`} className="hover:underline">
                    {p.supplier?.name}
                  </Link>
                </TableCell>
                <TableCell>{p.warehouse?.name}</TableCell>
                <TableCell className="text-right font-medium">
                  {formatMoney(p.total)}
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
