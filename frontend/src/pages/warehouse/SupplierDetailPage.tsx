import { useQuery } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { getSupplier } from '@/api/warehouse';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
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

export function SupplierDetailPage() {
  const { id } = useParams();
  const { data: supplier } = useQuery({
    queryKey: ['supplier', id],
    queryFn: () => getSupplier(Number(id)),
  });

  if (!supplier) {
    return <div className="text-muted-foreground">{t('common.loading')}</div>;
  }

  const debt = Number(supplier.stats?.debt ?? 0);

  return (
    <div>
      <div className="mb-4 flex items-center gap-3">
        <Button variant="ghost" size="icon">
          <Link to="/suppliers">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <h1 className="text-2xl font-semibold">{supplier.name}</h1>
      </div>

      <div className="mb-6 grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t('suppliers.title')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1.5 text-sm">
            <Row label={t('common.phone')} value={supplier.phone ?? '—'} />
            <Row label="Email" value={supplier.email ?? '—'} />
            <Row label={t('common.address')} value={supplier.address ?? '—'} />
            <Row label={t('common.note')} value={supplier.note ?? '—'} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Balans</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1.5 text-sm">
            <Row
              label={t('suppliers.purchasesTotal')}
              value={formatMoney(supplier.stats?.purchasesTotal)}
            />
            <Row
              label={t('suppliers.returnsTotal')}
              value={formatMoney(supplier.stats?.returnsTotal)}
            />
            <Row
              label={t('suppliers.paymentsTotal')}
              value={formatMoney(supplier.stats?.paymentsTotal)}
            />
            <div className="flex justify-between border-t pt-1.5">
              <span className="font-medium">{t('suppliers.debt')}</span>
              <span
                className={`font-semibold ${debt > 0 ? 'text-destructive' : 'text-green-700'}`}
              >
                {formatMoney(supplier.stats?.debt)}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      <h2 className="mb-3 text-lg font-semibold">{t('suppliers.purchasesHistory')}</h2>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t('common.number')}</TableHead>
            <TableHead>{t('common.date')}</TableHead>
            <TableHead>{t('purchases.warehouse')}</TableHead>
            <TableHead className="text-right">{t('common.total')}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {(supplier.purchases?.length ?? 0) === 0 ? (
            <TableRow>
              <TableCell colSpan={4} className="py-8 text-center text-muted-foreground">
                {t('common.noData')}
              </TableCell>
            </TableRow>
          ) : (
            supplier.purchases?.map((p) => (
              <TableRow key={p.id}>
                <TableCell>
                  <Link to={`/purchases/${p.id}`} className="font-medium hover:underline">
                    {p.number}
                  </Link>
                </TableCell>
                <TableCell>{formatDate(p.date)}</TableCell>
                <TableCell>{p.warehouse?.name}</TableCell>
                <TableCell className="text-right">{formatMoney(p.total)}</TableCell>
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
