import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Plus, Trash2 } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  createPurchase,
  getProducts,
  getSuppliers,
  getWarehouses,
} from '@/api/warehouse';
import { Button, buttonVariants } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Combobox } from '@/components/ui/combobox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { apiErrorMessage, formatMoney } from '@/lib/format';
import { t } from '@/lib/i18n';
import { cn } from '@/lib/utils';

interface ItemRow {
  productId: string;
  quantity: string;
  costPrice: string;
}

export function PurchaseCreatePage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [supplierId, setSupplierId] = useState('');
  const [warehouseId, setWarehouseId] = useState('');
  const [note, setNote] = useState('');
  const [items, setItems] = useState<ItemRow[]>([
    { productId: '', quantity: '', costPrice: '' },
  ]);
  const [error, setError] = useState('');

  const { data: suppliers } = useQuery({
    queryKey: ['suppliers', 'all'],
    queryFn: () => getSuppliers({ page: 1, limit: 100 }),
  });
  const { data: warehouses } = useQuery({
    queryKey: ['warehouses'],
    queryFn: () => getWarehouses(),
  });
  const { data: products } = useQuery({
    queryKey: ['products', 'all'],
    queryFn: () => getProducts({ page: 1, limit: 100 }),
  });

  const mutation = useMutation({
    mutationFn: createPurchase,
    onSuccess: (purchase) => {
      queryClient.invalidateQueries({ queryKey: ['purchases'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      navigate(`/purchases/${purchase.id}`);
    },
    onError: (err) => setError(apiErrorMessage(err)),
  });

  const setItem = (i: number, patch: Partial<ItemRow>) => {
    setItems((rows) => rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  };

  const pickProduct = (i: number, productId: string) => {
    const product = products?.data.find((p) => String(p.id) === productId);
    setItem(i, {
      productId,
      costPrice: product ? product.costPrice : '',
    });
  };

  const total = items.reduce(
    (acc, r) => acc + (Number(r.quantity) || 0) * (Number(r.costPrice) || 0),
    0,
  );

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setError('');
    mutation.mutate({
      supplierId: Number(supplierId),
      warehouseId: Number(warehouseId),
      note: note || undefined,
      items: items.map((r) => ({
        productId: Number(r.productId),
        quantity: Number(r.quantity),
        costPrice: Number(r.costPrice),
      })),
    });
  };

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
        <h1 className="text-2xl font-semibold">{t('purchases.new')}</h1>
      </div>

      <form onSubmit={submit}>
        <Card>
          <CardContent className="space-y-4 pt-6">
            <div className="grid gap-3 md:grid-cols-3">
              <div className="space-y-1.5">
                <Label>{t('purchases.supplier')} *</Label>
                <Combobox
                  required
                  value={supplierId}
                  onChange={setSupplierId}
                  placeholder={t('purchases.selectSupplier')}
                  options={
                    suppliers?.data.map((s) => ({
                      value: String(s.id),
                      label: s.name,
                      hint: s.phone ?? undefined,
                    })) ?? []
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label>{t('purchases.warehouse')} *</Label>
                <Select
                  required
                  value={warehouseId}
                  onChange={(e) => setWarehouseId(e.target.value)}
                >
                  <option value="">{t('purchases.selectWarehouse')}</option>
                  {warehouses?.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>{t('common.note')}</Label>
                <Input value={note} onChange={(e) => setNote(e.target.value)} />
              </div>
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between">
                <Label>{t('purchases.items')}</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setItems([...items, { productId: '', quantity: '', costPrice: '' }])
                  }
                >
                  <Plus className="h-4 w-4" /> {t('purchases.addItem')}
                </Button>
              </div>
              <div className="space-y-2">
                {items.map((row, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <Combobox
                      required
                      className="flex-1"
                      value={row.productId}
                      onChange={(productId) => pickProduct(i, productId)}
                      placeholder={t('purchases.selectProduct')}
                      options={
                        products?.data.map((p) => ({
                          value: String(p.id),
                          label: `${p.name} (${p.sku})`,
                          hint: p.sku,
                        })) ?? []
                      }
                    />
                    <Input
                      required
                      className="w-28"
                      type="number"
                      min="0.001"
                      step="0.001"
                      placeholder={t('common.quantity')}
                      value={row.quantity}
                      onChange={(e) => setItem(i, { quantity: e.target.value })}
                    />
                    <Input
                      required
                      className="w-36"
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder={t('products.costPrice')}
                      value={row.costPrice}
                      onChange={(e) => setItem(i, { costPrice: e.target.value })}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label={t('common.removeRow')}
                      disabled={items.length === 1}
                      onClick={() => setItems(items.filter((_, idx) => idx !== i))}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between border-t pt-4">
              <span className="text-lg font-semibold">
                {t('common.total')}: {formatMoney(total)}
              </span>
              <div className="flex gap-2">
                <Button type="button" variant="outline" onClick={() => navigate('/purchases')}>
                  {t('common.cancel')}
                </Button>
                <Button type="submit" disabled={mutation.isPending}>
                  {mutation.isPending ? t('common.saving') : t('common.save')}
                </Button>
              </div>
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
          </CardContent>
        </Card>
      </form>
    </div>
  );
}
