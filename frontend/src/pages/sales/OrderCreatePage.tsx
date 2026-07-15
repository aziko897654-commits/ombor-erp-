import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Plus, Trash2 } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { createOrder, getCustomers } from '@/api/sales';
import { getProducts, getWarehouses } from '@/api/warehouse';
import { Button, buttonVariants } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Combobox } from '@/components/ui/combobox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { apiErrorMessage, formatMoney, formatQty } from '@/lib/format';
import { t } from '@/lib/i18n';
import { cn } from '@/lib/utils';

interface ItemRow {
  productId: string;
  quantity: string;
  price: string;
}

/** FR-1.4: draft order — warehouse choice, discount, live totals. */
export function OrderCreatePage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [customerId, setCustomerId] = useState('');
  const [warehouseId, setWarehouseId] = useState('');
  const [discount, setDiscount] = useState('');
  const [items, setItems] = useState<ItemRow[]>([
    { productId: '', quantity: '', price: '' },
  ]);
  const [error, setError] = useState('');

  const { data: customers } = useQuery({
    queryKey: ['customers', 'all'],
    queryFn: () => getCustomers({ page: 1, limit: 100 }),
  });
  const { data: warehouses } = useQuery({
    queryKey: ['warehouses'],
    queryFn: () => getWarehouses(),
  });
  // stock is shown for the selected warehouse (FR-1.4)
  const { data: products } = useQuery({
    queryKey: ['products', 'all', warehouseId],
    queryFn: () =>
      getProducts({
        page: 1,
        limit: 100,
        warehouseId: warehouseId ? Number(warehouseId) : undefined,
      }),
  });

  const mutation = useMutation({
    mutationFn: createOrder,
    onSuccess: (order) => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      navigate(`/orders/${order.id}`);
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
      price: product ? product.salePrice : '',
    });
  };

  const stockOf = (productId: string) => {
    const product = products?.data.find((p) => String(p.id) === productId);
    return product?.stock ?? product?.totalStock;
  };

  const subtotal = items.reduce(
    (acc, r) => acc + (Number(r.quantity) || 0) * (Number(r.price) || 0),
    0,
  );
  const total = subtotal - (Number(discount) || 0);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setError('');
    mutation.mutate({
      customerId: Number(customerId),
      warehouseId: Number(warehouseId),
      discount: Number(discount) || 0,
      items: items.map((r) => ({
        productId: Number(r.productId),
        quantity: Number(r.quantity),
        price: Number(r.price),
      })),
    });
  };

  return (
    <div className="max-w-4xl">
      <div className="mb-4 flex items-center gap-3">
        <Link
          to="/orders"
          aria-label={t('common.back')}
          className={cn(buttonVariants({ variant: 'ghost', size: 'icon' }))}
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <h1 className="text-2xl font-semibold">{t('orders.new')}</h1>
      </div>

      <form onSubmit={submit}>
        <Card>
          <CardContent className="space-y-4 pt-6">
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-1.5">
                <Label>{t('orders.customer')} *</Label>
                <Combobox
                  required
                  value={customerId}
                  onChange={setCustomerId}
                  placeholder={t('orders.selectCustomer')}
                  options={
                    customers?.data.map((c) => ({
                      value: String(c.id),
                      label: c.name,
                      hint: c.phone ?? undefined,
                    })) ?? []
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label>{t('orders.warehouse')} *</Label>
                <Select
                  required
                  value={warehouseId}
                  onChange={(e) => setWarehouseId(e.target.value)}
                >
                  <option value="">{t('orders.selectWarehouse')}</option>
                  {warehouses?.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name}
                    </option>
                  ))}
                </Select>
              </div>
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between">
                <Label>{t('orders.items')}</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setItems([...items, { productId: '', quantity: '', price: '' }])
                  }
                >
                  <Plus className="h-4 w-4" /> {t('orders.addItem')}
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
                      placeholder={t('orders.selectProduct')}
                      options={
                        products?.data.map((p) => ({
                          value: String(p.id),
                          label: `${p.name} (${p.sku})${
                            warehouseId
                              ? ` — ${t('orders.stock').toLowerCase()}: ${formatQty(p.stock ?? p.totalStock)}`
                              : ''
                          }`,
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
                      placeholder={t('orders.price')}
                      value={row.price}
                      onChange={(e) => setItem(i, { price: e.target.value })}
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
                    {row.productId && warehouseId && (
                      <span className="w-20 whitespace-nowrap text-xs text-muted-foreground">
                        {formatQty(stockOf(row.productId))}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="flex items-end justify-between gap-4 border-t pt-4">
              <div className="space-y-1.5">
                <Label>{t('orders.discount')}</Label>
                <Input
                  className="w-40"
                  type="number"
                  min="0"
                  step="0.01"
                  value={discount}
                  onChange={(e) => setDiscount(e.target.value)}
                />
              </div>
              <div className="space-y-1 text-right text-sm">
                <p className="text-muted-foreground">
                  {t('orders.subtotal')}: {formatMoney(subtotal)}
                </p>
                <p className="text-lg font-semibold">
                  {t('common.total')}: {formatMoney(total)}
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => navigate('/orders')}>
                {t('common.cancel')}
              </Button>
              <Button type="submit" disabled={mutation.isPending}>
                {mutation.isPending ? t('common.saving') : t('common.save')}
              </Button>
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
          </CardContent>
        </Card>
      </form>
    </div>
  );
}
