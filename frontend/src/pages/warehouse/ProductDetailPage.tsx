import { useQuery } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react';
import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { getProduct, getProductMovements } from '@/api/warehouse';
import { Pagination } from '@/components/Pagination';
import { Badge } from '@/components/ui/badge';
import { buttonVariants } from '@/components/ui/button';
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
import { formatDateTime, formatMoney, formatQty } from '@/lib/format';
import { t } from '@/lib/i18n';
import { cn } from '@/lib/utils';

const REF_LINKS: Record<string, (id: number) => string> = {
  purchase: (id) => `/purchases/${id}`,
  transfer: () => `/stock/transfers`,
  stock_count: (id) => `/stock/counts/${id}`,
  purchase_return: () => `/returns/purchases`,
  order: (id) => `/orders/${id}`,
};

export function ProductDetailPage() {
  const { id } = useParams();
  const productId = Number(id);
  const [page, setPage] = useState(1);

  const { data: product } = useQuery({
    queryKey: ['product', productId],
    queryFn: () => getProduct(productId),
  });
  const { data: movements } = useQuery({
    queryKey: ['product-movements', productId, page],
    queryFn: () => getProductMovements(productId, page),
  });

  if (!product) {
    return <div className="text-muted-foreground">{t('common.loading')}</div>;
  }

  return (
    <div>
      <div className="mb-4 flex items-center gap-3">
        <Link
          to="/products"
          aria-label={t('common.back')}
          className={cn(buttonVariants({ variant: 'ghost', size: 'icon' }))}
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <h1 className="text-2xl font-semibold">{product.name}</h1>
        {!product.isActive && <Badge variant="outline">{t('common.inactive')}</Badge>}
      </div>

      <div className="mb-6 grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t('products.title')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1.5 text-sm">
            <InfoRow label={t('products.sku')} value={product.sku} />
            <InfoRow label={t('products.barcode')} value={product.barcode ?? '—'} />
            <InfoRow label={t('products.category')} value={product.category?.name ?? '—'} />
            <InfoRow label={t('products.unit')} value={product.unit} />
            <InfoRow label={t('products.costPrice')} value={formatMoney(product.costPrice)} />
            <InfoRow label={t('products.avgCost')} value={formatMoney(product.avgCost)} />
            <InfoRow label={t('products.salePrice')} value={formatMoney(product.salePrice)} />
            <InfoRow label={t('products.minStock')} value={formatQty(product.minStock)} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {t('products.stockByWarehouse')} — {t('common.total')}:{' '}
              {formatQty(product.totalStock ?? 0)} {product.unit}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {(product.stockByWarehouse?.length ?? 0) === 0 ? (
              <p className="text-sm text-muted-foreground">{t('common.noData')}</p>
            ) : (
              <ul className="space-y-1.5 text-sm">
                {product.stockByWarehouse?.map((w) => (
                  <li key={w.warehouseId} className="flex justify-between">
                    <span>{w.warehouseName}</span>
                    <span
                      className={
                        Number(w.stock) < 0 ? 'font-semibold text-destructive' : 'font-medium'
                      }
                    >
                      {formatQty(w.stock)} {product.unit}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <h2 className="mb-3 text-lg font-semibold">{t('products.movements')}</h2>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t('common.date')}</TableHead>
            <TableHead>{t('purchases.warehouse')}</TableHead>
            <TableHead>Turi</TableHead>
            <TableHead className="text-right">{t('common.quantity')}</TableHead>
            <TableHead>Kim</TableHead>
            <TableHead>Hujjat</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {(movements?.data.length ?? 0) === 0 ? (
            <TableRow>
              <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                {t('common.noData')}
              </TableCell>
            </TableRow>
          ) : (
            movements?.data.map((m) => {
              const qty = Number(m.quantity);
              return (
                <TableRow key={m.id}>
                  <TableCell>{formatDateTime(m.createdAt)}</TableCell>
                  <TableCell>{m.warehouse.name}</TableCell>
                  <TableCell>
                    {t(`products.movementType.${m.type}`)}
                    {m.reason && (
                      <span className="ml-1 text-xs text-muted-foreground">({m.reason})</span>
                    )}
                  </TableCell>
                  <TableCell
                    className={`text-right font-medium ${qty < 0 ? 'text-destructive' : 'text-green-700'}`}
                  >
                    {qty > 0 ? '+' : ''}
                    {formatQty(m.quantity)}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {m.user ? `${m.user.firstName} ${m.user.lastName}` : '—'}
                  </TableCell>
                  <TableCell>
                    {m.refType && m.refId && REF_LINKS[m.refType] ? (
                      <Link
                        to={REF_LINKS[m.refType](m.refId)}
                        className="text-xs underline-offset-2 hover:underline"
                      >
                        {m.refType}#{m.refId}
                      </Link>
                    ) : (
                      '—'
                    )}
                  </TableCell>
                </TableRow>
              );
            })
          )}
        </TableBody>
      </Table>
      {movements?.meta && (
        <Pagination
          page={movements.meta.page}
          limit={movements.meta.limit}
          total={movements.meta.total}
          onPageChange={setPage}
        />
      )}
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}
