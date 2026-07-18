import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, CheckCheck, Save } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  completeStockCount,
  getStockCount,
  updateStockCount,
} from '@/api/warehouse';
import { StatusBadge } from '@/components/ui/status-badge';
import { Button, buttonVariants } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { confirmDialog } from '@/lib/confirm';
import { apiErrorMessage, formatDate, formatQty } from '@/lib/format';
import { t } from '@/lib/i18n';
import { cn } from '@/lib/utils';

export function StockCountDetailPage() {
  const { id } = useParams();
  const countId = Number(id);
  const queryClient = useQueryClient();
  const [actuals, setActuals] = useState<Record<number, string>>({});
  const [error, setError] = useState('');

  const { data: count } = useQuery({
    queryKey: ['stock-count', countId],
    queryFn: () => getStockCount(countId),
  });

  useEffect(() => {
    if (count?.items) {
      setActuals(
        Object.fromEntries(count.items.map((i) => [i.id, i.actualQty])),
      );
    }
  }, [count]);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['stock-count', countId] });
    queryClient.invalidateQueries({ queryKey: ['stock-counts'] });
    queryClient.invalidateQueries({ queryKey: ['products'] });
  };

  const saveMutation = useMutation({
    mutationFn: () =>
      updateStockCount(countId, {
        items: Object.entries(actuals).map(([itemId, actualQty]) => ({
          itemId: Number(itemId),
          actualQty: Number(actualQty),
        })),
      }),
    onSuccess: () => {
      invalidate();
      setError('');
    },
    onError: (err) => setError(apiErrorMessage(err)),
  });

  const completeMutation = useMutation({
    mutationFn: async () => {
      // save the entered quantities first, then complete
      await updateStockCount(countId, {
        items: Object.entries(actuals).map(([itemId, actualQty]) => ({
          itemId: Number(itemId),
          actualQty: Number(actualQty),
        })),
      });
      return completeStockCount(countId);
    },
    onSuccess: () => {
      invalidate();
      setError('');
    },
    onError: (err) => setError(apiErrorMessage(err)),
  });

  if (!count) {
    return <div className="text-muted-foreground">{t('common.loading')}</div>;
  }

  const isDraft = count.status === 'draft';

  return (
    <div className="max-w-4xl">
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Link
          to="/stock/counts"
          aria-label={t('common.back')}
          className={cn(buttonVariants({ variant: 'ghost', size: 'icon' }))}
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <h1 className="text-2xl font-semibold">{count.number}</h1>
        {isDraft ? (
          <StatusBadge status="draft" label={t('stockCounts.draft')} />
        ) : (
          <StatusBadge status="completed" label={t('stockCounts.completed')} />
        )}
        <span className="text-sm text-muted-foreground">
          {count.warehouse?.name} · {formatDate(count.date)}
        </span>
        {isDraft && (
          <div className="ml-auto flex gap-2">
            <Button
              variant="outline"
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending}
            >
              <Save className="h-4 w-4" /> {t('common.save')}
            </Button>
            <Button
              onClick={async () => {
                if (await confirmDialog(t('stockCounts.completeConfirm'))) {
                  completeMutation.mutate();
                }
              }}
              disabled={completeMutation.isPending}
            >
              <CheckCheck className="h-4 w-4" /> {t('stockCounts.complete')}
            </Button>
          </div>
        )}
      </div>

      {error && <p className="mb-3 text-sm text-destructive">{error}</p>}

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t('purchases.product')}</TableHead>
            <TableHead className="text-right">{t('stockCounts.systemQty')}</TableHead>
            <TableHead className="w-36">{t('stockCounts.actualQty')}</TableHead>
            <TableHead className="text-right">{t('stockCounts.diff')}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {count.items?.map((item) => {
            const actual = actuals[item.id] ?? item.actualQty;
            const diff = Number(actual) - Number(item.systemQty);
            return (
              <TableRow key={item.id}>
                <TableCell>
                  <span className="font-medium">{item.product.name}</span>
                  <span className="ml-2 text-xs text-muted-foreground">
                    {item.product.sku}
                  </span>
                </TableCell>
                <TableCell className="text-right">
                  {formatQty(item.systemQty)} {item.product.unit}
                </TableCell>
                <TableCell>
                  {isDraft ? (
                    <Input
                      type="number"
                      min="0"
                      step="0.001"
                      className="h-8"
                      value={actual}
                      onChange={(e) =>
                        setActuals({ ...actuals, [item.id]: e.target.value })
                      }
                    />
                  ) : (
                    formatQty(item.actualQty)
                  )}
                </TableCell>
                <TableCell
                  className={`text-right font-medium ${
                    diff < 0 ? 'text-destructive' : diff > 0 ? 'text-green-700' : ''
                  }`}
                >
                  {diff > 0 ? '+' : ''}
                  {formatQty(diff)}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
