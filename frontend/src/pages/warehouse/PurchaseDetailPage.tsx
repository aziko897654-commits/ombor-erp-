import { useQuery } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { getPurchase } from '@/api/warehouse';
import { buttonVariants } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { formatDate, formatMoney, formatQty } from '@/lib/format';
import { t } from '@/lib/i18n';
import { cn } from '@/lib/utils';

export function PurchaseDetailPage() {
  const { id } = useParams();
  const { data: purchase } = useQuery({
    queryKey: ['purchase', id],
    queryFn: () => getPurchase(Number(id)),
  });

  if (!purchase) {
    return <div className="text-muted-foreground">{t('common.loading')}</div>;
  }

  return (
    <div className="max-w-4xl">
      <div className="mb-4 flex items-center gap-3">
        <Link
          to="/purchases"
          aria-label={t('common.back')}
          className={cn(buttonVariants({ variant: 'ghost', size: 'icon' }))}
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <h1 className="text-2xl font-semibold">{purchase.number}</h1>
      </div>

      <Card className="mb-6">
        <CardContent className="grid gap-3 pt-6 text-sm md:grid-cols-4">
          <div>
            <div className="text-muted-foreground">{t('common.date')}</div>
            <div className="font-medium">{formatDate(purchase.date)}</div>
          </div>
          <div>
            <div className="text-muted-foreground">{t('purchases.supplier')}</div>
            <Link
              to={`/suppliers/${purchase.supplierId}`}
              className="font-medium hover:underline"
            >
              {purchase.supplier?.name}
            </Link>
          </div>
          <div>
            <div className="text-muted-foreground">{t('purchases.warehouse')}</div>
            <div className="font-medium">{purchase.warehouse?.name}</div>
          </div>
          <div>
            <div className="text-muted-foreground">{t('common.total')}</div>
            <div className="font-semibold">{formatMoney(purchase.total)}</div>
          </div>
          {purchase.note && (
            <div className="md:col-span-4">
              <div className="text-muted-foreground">{t('common.note')}</div>
              <div>{purchase.note}</div>
            </div>
          )}
        </CardContent>
      </Card>

      <h2 className="mb-3 text-lg font-semibold">{t('purchases.items')}</h2>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t('purchases.product')}</TableHead>
            <TableHead>{t('products.sku')}</TableHead>
            <TableHead className="text-right">{t('common.quantity')}</TableHead>
            <TableHead className="text-right">{t('products.costPrice')}</TableHead>
            <TableHead className="text-right">{t('common.total')}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {purchase.items?.map((item) => (
            <TableRow key={item.id}>
              <TableCell>
                <Link to={`/products/${item.productId}`} className="font-medium hover:underline">
                  {item.product.name}
                </Link>
              </TableCell>
              <TableCell className="text-muted-foreground">{item.product.sku}</TableCell>
              <TableCell className="text-right">
                {formatQty(item.quantity)} {item.product.unit}
              </TableCell>
              <TableCell className="text-right">{formatMoney(item.costPrice)}</TableCell>
              <TableCell className="text-right font-medium">
                {formatMoney(Number(item.quantity) * Number(item.costPrice))}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {(purchase.returns?.length ?? 0) > 0 && (
        <>
          <h2 className="mb-3 mt-6 text-lg font-semibold">{t('purchases.returns')}</h2>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('common.number')}</TableHead>
                <TableHead>{t('common.date')}</TableHead>
                <TableHead className="text-right">{t('common.total')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {purchase.returns?.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">{r.number}</TableCell>
                  <TableCell>{formatDate(r.date)}</TableCell>
                  <TableCell className="text-right">{formatMoney(r.total)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </>
      )}
    </div>
  );
}
